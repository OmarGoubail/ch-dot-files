import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { uuidv7 } from '@earendil-works/pi-ai'
import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent'

type SessionEntry = {
  type?: string
  message?: {
    role?: string
    content?: unknown
  }
}

type QmdHit = {
  docid?: string
  file?: string
  title?: string
  snippet?: string
  score?: number
}

type CaptureResult = {
  capture?: boolean
  title?: string
  type?: string
  project?: string | null
  topic?: string | null
  slug?: string
  summary?: string
  body?: string
}

const execFileAsync = promisify(execFile)
const KNOWLEDGE_ROOT = process.env.QMD_KNOWLEDGE_ROOT ?? join(homedir(), 'Documents', 'knowledge')
const MAX_CONVERSATION_CHARS = 60_000
const MAX_SOURCE_CHARS = 8_000
const MAX_QMD_HITS = 8

function notify(ctx: ExtensionCommandContext, message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level)
  } else if (level === 'error') {
    console.error(message)
  }
}

function extractText(content: unknown): string[] {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []

  return content.flatMap((part) => {
    if (!part || typeof part !== 'object') return []
    const block = part as { type?: string; text?: string }
    return block.type === 'text' && typeof block.text === 'string' ? [block.text] : []
  })
}

function buildConversationText(entries: SessionEntry[]): string {
  const sections: string[] = []

  for (const entry of entries) {
    if (entry.type !== 'message' || !entry.message) continue
    if (entry.message.role !== 'user' && entry.message.role !== 'assistant') continue

    const text = extractText(entry.message.content).join('\n').trim()
    if (!text) continue
    sections.push(`${entry.message.role === 'user' ? 'User' : 'Assistant'}:\n${text}`)
  }

  const conversation = sections.join('\n\n')
  if (conversation.length <= MAX_CONVERSATION_CHARS) return conversation

  const headLength = Math.floor(MAX_CONVERSATION_CHARS * 0.35)
  const tailLength = MAX_CONVERSATION_CHARS - headLength
  return `${conversation.slice(0, headLength)}\n\n[Middle of session omitted for capture size]\n\n${conversation.slice(-tailLength)}`
}

function oneLine(text: string, maxLength = 6_000): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parseQmdHits(output: string): QmdHit[] {
  const start = output.indexOf('[')
  const end = output.lastIndexOf(']')
  if (start < 0 || end <= start) return []

  try {
    const value: unknown = JSON.parse(output.slice(start, end + 1))
    return Array.isArray(value) ? value.filter(isQmdHit) : []
  } catch {
    return []
  }
}

function isQmdHit(value: unknown): value is QmdHit {
  return !!value && typeof value === 'object' && ('file' in value || 'docid' in value)
}

async function runQmd(args: string[]): Promise<string> {
  const result = await execFileAsync('qmd', args, {
    cwd: KNOWLEDGE_ROOT,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 2_000_000,
  })
  return result.stdout
}

async function findRelatedNotes(conversation: string, workingDirectory: string): Promise<{ hits: QmdHit[]; sources: string }> {
  if (!existsSync(KNOWLEDGE_ROOT)) return { hits: [], sources: '' }

  const queryText = oneLine(`${basename(workingDirectory)} ${conversation}`, 7_000)
  const structuredQuery = [
    'intent: Find project and topic notes related to this coding session. Prefer canonical project names and avoid generic unrelated notes.',
    `lex: ${queryText}`,
    `vec: ${queryText}`,
  ].join('\n')

  let hits: QmdHit[] = []
  try {
    hits = parseQmdHits(await runQmd(['query', structuredQuery, '-c', 'knowledge', '-n', String(MAX_QMD_HITS), '--format', 'json', '--no-rerank']))
  } catch {
    try {
      hits = parseQmdHits(await runQmd(['search', queryText, '-c', 'knowledge', '-n', String(MAX_QMD_HITS), '--format', 'json']))
    } catch {
      return { hits: [], sources: '' }
    }
  }

  const paths = hits.map((hit) => hit.file).filter((file): file is string => !!file).slice(0, 5)
  if (paths.length === 0) return { hits, sources: '' }

  try {
    const sources = await runQmd([
      'multi-get',
      paths.join(','),
      '--format',
      'md',
      '--no-line-numbers',
      '--max-bytes',
      '30000',
      '-l',
      '180',
    ])
    return { hits, sources: sources.slice(0, MAX_SOURCE_CHARS * 5) }
  } catch {
    return { hits, sources: '' }
  }
}

function relatedContext(hits: QmdHit[], sources: string): string {
  const leads = hits
    .slice(0, MAX_QMD_HITS)
    .map((hit) => {
      const score = typeof hit.score === 'number' ? ` score=${hit.score.toFixed(2)}` : ''
      return `- ${hit.file ?? hit.docid ?? 'unknown'}${score}: ${hit.title ?? 'untitled'}\n  ${oneLine(hit.snippet ?? '', 500)}`
    })
    .join('\n')

  return [
    'QMD search leads:',
    leads || '(No related notes found.)',
    '',
    'Retrieved QMD source excerpts:',
    sources || '(No source excerpts available.)',
  ].join('\n')
}

function buildCapturePrompt(conversation: string, related: string, workingDirectory: string): string {
  return [
    'You are a knowledge-capture subagent. You have no tools and must return exactly one JSON object.',
    'Read only the User and Assistant text inside <conversation>. Tool calls, tool results, shell output, file contents, and hidden reasoning are intentionally absent and must not be reconstructed.',
    'Create a concise durable note only when the session contains a reusable decision, project fact, architecture choice, workflow, gotcha, implementation finding, or handoff. Do not preserve a play-by-play transcript.',
    'Use the QMD notes as related context, not as authority. Prefer their canonical project and topic names when they fit. Do not copy unrelated facts or duplicate an existing note when this session adds nothing new.',
    'Never include API keys, tokens, passwords, credentials, private personal data, or other secrets. Do not invent facts that are not supported by the conversation.',
    '',
    'Return this JSON shape with no Markdown fence:',
    '{"capture":true,"title":"...","type":"decision|architecture|technical-reference|project-plan|project-workflow|handoff|topic","project":"canonical-slug-or-null","topic":"canonical-slug-or-null","slug":"short-kebab-case-slug","summary":"one sentence","body":"Markdown sections only; no H1 and no front matter"}',
    'Set capture to false only when there is no reusable knowledge or the session is wholly redundant with the related notes.',
    'The body should be self-contained and include only useful sections such as Context, Decision, Findings, Risks, Open questions, or Next steps. Omit empty sections.',
    '',
    `<working_directory>${basename(workingDirectory)}</working_directory>`,
    `<related_qmd>\n${related}\n</related_qmd>`,
    `<conversation>\n${conversation}\n</conversation>`,
  ].join('\n')
}

function parseCaptureResult(text: string): CaptureResult {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Capture model did not return JSON')

  const value: unknown = JSON.parse(text.slice(start, end + 1))
  if (!value || typeof value !== 'object') throw new Error('Capture model returned an invalid object')
  return value as CaptureResult
}

function slugify(value: string | null | undefined, fallback: string): string {
  const slug = (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function qmdPath(hit: QmdHit): string | undefined {
  const file = hit.file
  if (!file) return undefined
  return file.replace(/^qmd:\/\/knowledge\//, '').replace(/^\.?\//, '')
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeBody(result: CaptureResult): string {
  const bodyText = stringValue(result.body).trim()
  const summaryText = stringValue(result.summary).trim()
  const body = bodyText || (summaryText ? `## Summary\n\n${summaryText}` : '')
  if (!body) throw new Error('Capture model returned no note body')

  return body
    .replace(/^```(?:markdown)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^---[\s\S]*?---\s*/, '')
    .trim()
}

function redactSecrets(text: string): string {
  return text
    .replace(/\b(?:sk|ghp|github_pat|glpat|xox[baprs])[-_][A-Za-z0-9_-]+\b/g, '[REDACTED_SECRET]')
    .replace(/\bAIza[0-9A-Za-z_-]+\b/g, '[REDACTED_SECRET]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/((?:api[_ -]?key|token|password|secret)\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED_SECRET]')
}

function buildNote(result: CaptureResult, relatedHits: QmdHit[], noteDate: string): { title: string; relativePath: string; content: string } {
  const title = oneLine(redactSecrets(stringValue(result.title) || 'Captured session knowledge'), 200)
  const project = result.project ? slugify(redactSecrets(oneLine(stringValue(result.project), 120)), '') : ''
  const topic = result.topic ? slugify(redactSecrets(oneLine(stringValue(result.topic), 120)), '') : ''
  const slug = slugify(redactSecrets(stringValue(result.slug) || title), 'captured-session')
  const allowedTypes = new Set(['decision', 'architecture', 'technical-reference', 'project-plan', 'project-workflow', 'handoff', 'topic'])
  const requestedType = redactSecrets(oneLine(stringValue(result.type), 80))
  const type = allowedTypes.has(requestedType) ? requestedType : 'topic'
  const directory = project
    ? join('projects', project, ...(topic ? [topic] : []))
    : 'inbox'
  const relativePath = join(directory, `${slug}.md`)
  const body = redactSecrets(normalizeBody(result))
  const related = relatedHits
    .map((hit) => {
      const path = qmdPath(hit)
      const safePath = path ? redactSecrets(path) : undefined
      const title = redactSecrets(stringValue(hit.title) || 'related note')
      if (!safePath || safePath.includes('[REDACTED_SECRET]')) return undefined
      return `- \`qmd://knowledge/${safePath}\` — ${title}`
    })
    .filter((line): line is string => !!line)
    .slice(0, 5)
  const frontMatter = [
    '---',
    `title: ${yamlString(title)}`,
    `type: ${yamlString(type)}`,
    ...(project ? [`project: ${yamlString(project)}`] : []),
    ...(topic ? [`topic: ${yamlString(topic)}`] : []),
    'status: "active"',
    `captured_at: ${yamlString(noteDate)}`,
    'source: "pi-session-capture"',
    '---',
  ].join('\n')
  const relatedSection = related.length > 0 ? `\n\n## Related QMD notes\n\n${related.join('\n')}` : ''
  return { title, relativePath, content: `${frontMatter}\n\n# ${title}\n\n${body}${relatedSection}\n` }
}

async function uniqueNotePath(relativePath: string): Promise<string> {
  const extension = '.md'
  const withoutExtension = relativePath.endsWith(extension) ? relativePath.slice(0, -extension.length) : relativePath
  let candidate = relativePath
  let suffix = 2

  while (existsSync(join(KNOWLEDGE_ROOT, candidate))) {
    candidate = `${withoutExtension}-${suffix}${extension}`
    suffix += 1
  }

  return candidate
}

async function generateCapture(ctx: ExtensionCommandContext, conversation: string): Promise<{ result: CaptureResult; hits: QmdHit[] }> {
  const related = await findRelatedNotes(conversation, ctx.cwd)
  const model = ctx.model
  if (!model) throw new Error('No active model is available for capture')

  const provider = ctx.modelRegistry.getProvider(model.provider)
  if (!provider) throw new Error(`No provider is registered for ${model.provider}`)

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model)
  if (!auth.ok) throw new Error(auth.error)

  const stream = provider.stream(
    model,
    {
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: buildCapturePrompt(conversation, relatedContext(related.hits, related.sources), ctx.cwd) }],
        timestamp: Date.now(),
      }],
    },
    {
      apiKey: auth.apiKey,
      headers: auth.headers,
      env: auth.env,
      reasoningEffort: 'medium',
      cacheRetention: 'none',
      sessionId: uuidv7(),
    },
  )
  const response = await stream.result()

  const text = response.content
    .filter((content): content is { type: 'text'; text: string } => content.type === 'text')
    .map((content) => content.text)
    .join('\n')

  return { result: parseCaptureResult(text), hits: related.hits }
}

export default function qmdCapture(pi: ExtensionAPI) {
  pi.registerCommand('capture', {
    description: 'Capture durable knowledge from user and assistant messages into QMD',
    async handler(args, ctx) {
      await ctx.waitForIdle()

      const conversation = buildConversationText(ctx.sessionManager.getBranch() as SessionEntry[])
      if (!conversation.trim()) {
        notify(ctx, 'No user/assistant text found in this session', 'warning')
        return
      }

      notify(ctx, 'Searching QMD and preparing a capture note...', 'info')

      try {
        const { result, hits } = await generateCapture(ctx, conversation)
        if (result.capture === false) {
          notify(ctx, 'No new durable knowledge found; nothing was written', 'info')
          return
        }

        const draft = buildNote(result, hits, new Date().toISOString().slice(0, 10))
        const relativePath = await uniqueNotePath(draft.relativePath)
        const absolutePath = resolve(KNOWLEDGE_ROOT, relativePath)
        const resolvedRoot = resolve(KNOWLEDGE_ROOT)
        const pathFromRoot = relative(resolvedRoot, absolutePath)
        if (!pathFromRoot || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
          throw new Error('Generated note path escaped the knowledge vault')
        }

        if (args.includes('--dry-run') || args.includes('--preview')) {
          if (ctx.hasUI) {
            await ctx.ui.editor(`Capture preview: ${relativePath}`, draft.content)
          } else {
            console.log(draft.content)
          }
          notify(ctx, `Preview only; no note written (${relativePath})`, 'info')
          return
        }

        if (ctx.hasUI) {
          const relatedCount = hits.length > 0 ? `\n${hits.length} related QMD notes found.` : ''
          const confirmed = await ctx.ui.confirm(
            `Capture ${draft.title}?`,
            `Write ${relativePath}.${relatedCount}\n\nUse /capture --preview to inspect the full note first.`,
          )
          if (!confirmed) {
            notify(ctx, 'Capture cancelled; no note written', 'info')
            return
          }
        }

        await mkdir(dirname(absolutePath), { recursive: true })
        const physicalRoot = await realpath(KNOWLEDGE_ROOT)
        const physicalDirectory = await realpath(dirname(absolutePath))
        const physicalPathFromRoot = relative(physicalRoot, physicalDirectory)
        if (!physicalPathFromRoot || physicalPathFromRoot.startsWith('..') || isAbsolute(physicalPathFromRoot)) {
          throw new Error('Generated note directory escaped the knowledge vault')
        }
        await writeFile(absolutePath, draft.content, { encoding: 'utf8', flag: 'wx' })
        notify(ctx, `Wrote ${absolutePath}; refreshing QMD index...`, 'info')

        try {
          await runQmd(['update'])
          await runQmd(['embed', '-c', 'knowledge'])
          notify(ctx, `Captured ${draft.title} and refreshed QMD`, 'info')
        } catch (error) {
          notify(ctx, `Captured ${absolutePath}, but QMD refresh failed: ${String(error)}`, 'warning')
        }
      } catch (error) {
        notify(ctx, `Capture failed: ${String(error)}`, 'error')
      }
    },
  })
}
