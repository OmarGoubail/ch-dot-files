import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'

type UsageTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cacheHitRate?: number
  cost: number
}

type ProviderInfo = {
  mark: string
  name: string
}

type TpsInfo = {
  label: string
  shortLabel: string
  rate?: number
}

const ANSI_ESCAPE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const SEPARATOR = ' · '

function providerInfo(provider: string): ProviderInfo {
  const value = provider.toLowerCase()

  if (value.includes('openai-codex') || value === 'openai') {
    return { mark: '◎', name: 'codex' }
  }
  if (value.includes('anthropic') || value.includes('claude')) {
    return { mark: '△', name: 'anthropic' }
  }
  if (value.includes('google') || value.includes('gemini')) {
    return { mark: '✦', name: 'gemini' }
  }
  if (value.includes('fireworks')) {
    return { mark: '✺', name: 'fireworks' }
  }
  if (value.includes('opencode')) {
    return { mark: '▣', name: 'opencode' }
  }
  if (value.includes('openrouter')) {
    return { mark: '↗', name: 'router' }
  }
  if (value.includes('baseten')) {
    return { mark: '▤', name: 'baseten' }
  }
  if (value.includes('deepseek')) {
    return { mark: '◌', name: 'deepseek' }
  }
  if (value.includes('mistral')) {
    return { mark: '◆', name: 'mistral' }
  }

  const fallback = provider.replace(/[^a-z0-9]/gi, '').slice(0, 1).toUpperCase() || '?'
  return { mark: fallback, name: provider.split('-')[0] || 'model' }
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '').replace(/[\r\n\t]/g, ' ').replace(/ +/g, ' ').trim()
}

function projectName(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '')
  const name = normalized.split(/[\\/]/).pop()
  return name || cwd
}

function middleEllipsis(text: string, maxWidth: number): string {
  if (visibleWidth(text) <= maxWidth) return text
  if (maxWidth <= 1) return '…'.slice(0, maxWidth)

  const available = maxWidth - 1
  const leftWidth = Math.ceil(available / 2)
  const rightWidth = Math.floor(available / 2)
  return `${text.slice(0, leftWidth)}…${text.slice(-rightWidth)}`
}

function formatTokens(value: number): string {
  if (value < 1000) return String(Math.round(value))
  if (value < 10_000) return `${(value / 1000).toFixed(1)}k`
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`
  if (value < 10_000_000) {
    const millions = value / 1_000_000
    return `${millions.toFixed(Number.isInteger(millions) ? 0 : 1)}M`
  }
  return `${Math.round(value / 1_000_000)}M`
}

function formatNumber(value: string | undefined): string | undefined {
  if (!value) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? formatTokens(number) : value
}

function collectUsage(ctx: ExtensionContext): UsageTotals {
  let input = 0
  let output = 0
  let cacheRead = 0
  let cacheWrite = 0
  let cost = 0
  let cacheHitRate: number | undefined

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== 'message' || entry.message.role !== 'assistant') continue

    const usage = entry.message.usage as Partial<{
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      cost: { total: number }
    }>
    const messageInput = usage.input ?? 0
    const messageCacheRead = usage.cacheRead ?? 0
    const messageCacheWrite = usage.cacheWrite ?? 0

    input += messageInput
    output += usage.output ?? 0
    cacheRead += messageCacheRead
    cacheWrite += messageCacheWrite
    cost += usage.cost?.total ?? 0

    const promptTokens = messageInput + messageCacheRead + messageCacheWrite
    cacheHitRate = promptTokens > 0 ? (messageCacheRead / promptTokens) * 100 : undefined
  }

  return { input, output, cacheRead, cacheWrite, cacheHitRate, cost }
}

function formatTps(raw: string | undefined): TpsInfo | undefined {
  if (!raw) return undefined

  const text = stripAnsi(raw)
  const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*t\/s/i)
  if (!rateMatch) return { label: text, shortLabel: text }

  const rate = Number(rateMatch[1])
  const output = formatNumber(text.match(/[↓]?\s*([\d.]+)\s+tokens?/i)?.[1])
  const duration = text.match(/\bin\s+([\d.]+s)/i)?.[1]
  const complete = text.trimStart().startsWith('✓')
  const rateLabel = `${complete ? '✓ ' : ''}${rateMatch[1]}t/s`
  const parts = [rateLabel]
  if (output) parts.push(`↓${output}`)
  if (duration) parts.push(duration)

  return { label: parts.join(SEPARATOR), shortLabel: rateLabel, rate }
}

function compactProfile(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const value = stripAnsi(raw).replace(/^profile:\s*/i, '').trim()
  return value || undefined
}

function compactStatus(key: string, raw: string): string | undefined {
  const text = stripAnsi(raw)
  if (!text) return undefined

  if (key === 'plan-mode') {
    const progress = text.match(/(\d+\/\d+)/)?.[1]
    return progress ? `plan ${progress}` : 'plan'
  }
  if (key === 'critic') return 'critic'
  if (key === 'oracle') return 'oracle'
  if (key === 'opencode-go-cache') return 'cache'
  if (key === 'worktrees') {
    const count = text.match(/(\d+)\s*:/)?.[1]
    return count ? `wt ${count}` : 'wt'
  }
  if (key === 'background') return 'bg'

  return text
}

function shortModelId(id: string): string {
  const parts = id.split('/')
  return parts[parts.length - 1] || id
}

function narrowModelId(id: string): string {
  const short = shortModelId(id)
  if (short.length <= 10) return short

  const familyVersion = short.match(/^(?:gpt|claude|gemini|deepseek)-[\w.]+-(.+)$/i)?.[1]
  return familyVersion || short.split('-').pop() || short
}

function modelLabels(ctx: ExtensionContext): {
  full: string
  compact: string
  narrow: string
} {
  const provider = ctx.model?.provider ?? 'model'
  const id = shortModelId(ctx.model?.id ?? 'no-model')
  const info = providerInfo(provider)
  const providerName = info.name

  return {
    full: `${info.mark} ${providerName}/${id}`,
    compact: `${info.mark} ${id}`,
    narrow: `${info.mark} ${narrowModelId(id)}`,
  }
}

function thinkingLevel(pi: ExtensionAPI): string {
  return pi.getThinkingLevel?.() || 'off'
}

function contextLabels(ctx: ExtensionContext): { detailed: string; compact: string; percent: number } {
  const usage = ctx.getContextUsage()
  const percent = usage?.percent ?? null
  const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0

  if (percent === null) {
    return {
      detailed: `ctx ?/${formatTokens(window)}`,
      compact: 'ctx ?',
      percent: 0,
    }
  }

  const clamped = Math.max(0, Math.min(100, percent))
  return {
    detailed: `ctx ${clamped.toFixed(clamped >= 10 ? 1 : 1)}%/${formatTokens(window)}`,
    compact: `ctx ${clamped.toFixed(0)}%`,
    percent: clamped,
  }
}

function usageLabels(usage: UsageTotals, subscription: boolean): { detailed: string; compact: string } {
  const tokens = [
    usage.input > 0 ? `↑${formatTokens(usage.input)}` : '',
    usage.output > 0 ? `↓${formatTokens(usage.output)}` : '',
  ].filter(Boolean)
  const cache = usage.cacheRead > 0 ? [`R${formatTokens(usage.cacheRead)}`] : []
  if (usage.cacheHitRate !== undefined && usage.cacheRead > 0) {
    cache.push(`CH${usage.cacheHitRate.toFixed(0)}%`)
  }

  const cost = usage.cost > 0 ? `$${usage.cost.toFixed(3)}${subscription ? ' sub' : ''}` : undefined
  return {
    detailed: [...tokens, ...cache, ...(cost ? [cost] : [])].join('  '),
    compact: [...tokens, ...(cost ? [`$${usage.cost.toFixed(2)}${subscription ? ' sub' : ''}`] : [])].join(' '),
  }
}

function tpsColor(rate: number | undefined): 'success' | 'warning' | 'error' | 'muted' {
  if (rate === undefined) return 'muted'
  if (rate >= 100) return 'success'
  if (rate >= 30) return 'warning'
  return 'error'
}

function contextColor(percent: number): 'muted' | 'warning' | 'error' {
  if (percent > 90) return 'error'
  if (percent > 70) return 'warning'
  return 'muted'
}

function joinParts(parts: string[], theme: ExtensionContext['ui']['theme']): string {
  return parts.filter(Boolean).join(theme.fg('dim', SEPARATOR))
}

function fitLine(text: string, width: number): string {
  return truncateToWidth(text, width, '…')
}

function padColumn(text: string, width: number): string {
  const fitted = truncateToWidth(text, width, '…')
  return fitted + ' '.repeat(Math.max(0, width - visibleWidth(fitted)))
}

function alignedColumns(
  rows: string[][],
  width: number,
  theme: ExtensionContext['ui']['theme'],
  firstColumnMaxWidth: number,
): string[] {
  const firstColumnWidth = Math.min(
    Math.max(...rows.map((row) => visibleWidth(row[0] ?? '')), 0),
    firstColumnMaxWidth,
  )
  const secondColumnWidth = Math.max(...rows.map((row) => visibleWidth(row[1] ?? '')), 0)

  return rows.map((row) => {
    const columns = row.map((value, index) => {
      if (index === 0) return padColumn(value ?? '', firstColumnWidth)
      if (index === 1) return padColumn(value ?? '', secondColumnWidth)
      return value ?? ''
    })
    while (columns.length > 2 && !columns[columns.length - 1]) columns.pop()
    return fitLine(columns.join(theme.fg('dim', SEPARATOR)), width)
  })
}

function alignedLine(left: string, right: string, width: number): string {
  if (!right) return fitLine(left, width)
  const gap = width - visibleWidth(left) - visibleWidth(right)
  if (gap >= 2) return `${left}${' '.repeat(gap)}${right}`
  return truncateToWidth(`${left}${SEPARATOR}${right}`, width, '…')
}

function renderFooter(
  width: number,
  theme: ExtensionContext['ui']['theme'],
  footerData: ReadonlyFooterDataProvider,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): string[] {
  const branch = footerData.getGitBranch()
  const project = theme.bold(theme.fg('text', projectName(ctx.cwd)))
  const branchText = branch
    ? theme.fg('accent', `⎇ ${middleEllipsis(branch, Math.max(12, Math.floor(width * 0.35)))}`)
    : ''
  const identity = `${project}${branchText ? ` ${branchText}` : ''}`

  const statuses = footerData.getExtensionStatuses()
  const profile = compactProfile(statuses.get('profile'))
  const tps = formatTps(statuses.get('tps'))
  const extras = Array.from(statuses.entries())
    .filter(([key]) => key !== 'profile' && key !== 'tps')
    .map(([key, value]) => compactStatus(key, value))
    .filter((value): value is string => Boolean(value))

  const labels = modelLabels(ctx)
  const thinking = thinkingLevel(pi)
  const model = ctx.model
  const provider = model?.provider ?? ''
  const subscription = provider.includes('openai-codex')
  const context = contextLabels(ctx)
  const usage = usageLabels(collectUsage(ctx), subscription)

  const styledModel = (label: string): string => {
    const [mark, ...rest] = label.split(' ')
    return theme.fg('accent', mark ?? '?') + theme.fg('text', ` ${theme.bold(rest.join(' '))}`)
  }
  const styledContext = theme.fg(contextColor(context.percent), context.detailed)
  const styledContextCompact = theme.fg(contextColor(context.percent), context.compact)
  const styledTps = tps ? theme.fg(tpsColor(tps.rate), tps.label) : ''
  const styledTpsShort = tps ? theme.fg(tpsColor(tps.rate), tps.shortLabel) : ''
  const styledProfile = profile ? theme.fg('accent', theme.bold(profile)) : ''
  const styledThinking = theme.fg('muted', thinking)
  const styledUsage = theme.fg('muted', usage.detailed)
  const styledUsageCompact = theme.fg('muted', usage.compact)
  const styledExtras = extras.map((value) => theme.fg('warning', value))

  if (width >= 96) {
    const right = joinParts([styledProfile, styledModel(`${labels.full} · ${thinking}`)], theme)
    const leftStats = joinParts([styledContext, styledUsage, ...styledExtras], theme)
    const rightStats = styledTps
    return [
      alignedLine(identity, right, width),
      alignedLine(leftStats, rightStats, width),
    ].map((line) => fitLine(line, width))
  }

  if (width >= 72) {
    const rows = [
      [identity, styledProfile, styledThinking],
      [styledModel(labels.compact), styledContextCompact, joinParts([styledTps, styledUsageCompact, ...styledExtras], theme)],
    ]
    return alignedColumns(rows, width, theme, width >= 90 ? 28 : 22)
  }

  const narrowBranch = branch ? theme.fg('accent', `⎇ ${middleEllipsis(branch, Math.max(8, Math.floor(width * 0.25)))}`) : ''
  const narrowIdentity = `${project}${narrowBranch ? ` ${narrowBranch}` : ''}`
  const narrowRows = [
    [narrowIdentity, styledProfile],
    [styledModel(labels.narrow), styledThinking, styledContextCompact, styledTpsShort],
  ]
  return alignedColumns(narrowRows, width, theme, 18)
}

export default function compactFooterExtension(pi: ExtensionAPI): void {
  pi.on('session_start', (_event, ctx) => {
    if (ctx.mode !== 'tui') return

    ctx.ui.setFooter((tui, theme, footerData) => ({
      dispose: footerData.onBranchChange(() => tui.requestRender()),
      invalidate() {},
      render(width: number): string[] {
        return renderFooter(width, theme, footerData, ctx, pi)
      },
    }))
  })
}
