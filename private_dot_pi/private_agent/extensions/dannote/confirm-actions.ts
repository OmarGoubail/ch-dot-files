/**
 * Confirm Actions Extension
 *
 * GitHub mutations use a single-command agent checkpoint by default; strict mode
 * requires human approval. Recursive removal of home/root always needs approval.
 * This is a workflow guard, not a shell sandbox.
 */

import { homedir } from 'node:os'
import { basename, resolve } from 'node:path'
import type {
  ExtensionAPI,
  SessionBeforeSwitchEvent,
  ExtensionContext,
  SessionMessageEntry
} from '@earendil-works/pi-coding-agent'
import { isToolCallEventType } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import {
  parse as parseShell,
  type ArithmeticExpression,
  type Node,
  type Script,
  type Word,
  type WordPart
} from 'unbash'
import { notifyDesktop } from './shared/desktop-notify'
import { formatPiNotificationTitle } from './shared/project-name'
import { withHerdrBlocked } from './shared/herdr'
import { readLayeredSettings } from './shared/settings'

export type CommandRule = {
  argv: string[]
  label: string
  matches?: (argv: string[], cwd: string) => boolean
}

const GITHUB_RULES: CommandRule[] = [
  exact(['gh', 'pr', 'create'], 'Publish GitHub PR'),
  exact(['gh', 'pr', 'edit'], 'Edit GitHub PR'),
  exact(['gh', 'pr', 'comment'], 'Publish GitHub PR comment'),
  exact(['gh', 'pr', 'review'], 'Publish GitHub PR review'),
  exact(['gh', 'pr', 'close'], 'Close GitHub PR'),
  exact(['gh', 'pr', 'reopen'], 'Reopen GitHub PR'),
  exact(['gh', 'pr', 'merge'], 'Merge GitHub PR'),
  exact(['gh', 'pr', 'ready'], 'Mark GitHub PR ready'),
  exact(['gh', 'issue', 'create'], 'Create GitHub issue'),
  exact(['gh', 'issue', 'edit'], 'Edit GitHub issue'),
  exact(['gh', 'issue', 'comment'], 'Publish GitHub issue comment'),
  exact(['gh', 'issue', 'close'], 'Close GitHub issue'),
  exact(['gh', 'issue', 'delete'], 'Delete GitHub issue'),
  exact(['gh', 'issue', 'reopen'], 'Reopen GitHub issue'),
  exact(['gh', 'repo', 'create'], 'Create GitHub repo'),
  exact(['gh', 'repo', 'delete'], 'Delete GitHub repo'),
  exact(['gh', 'repo', 'archive'], 'Archive GitHub repo'),
  exact(['gh', 'repo', 'edit'], 'Edit GitHub repo'),
  exact(['gh', 'repo', 'rename'], 'Rename GitHub repo'),
  exact(['gh', 'repo', 'transfer'], 'Transfer GitHub repo'),
  matched(['gh', 'repo', 'deploy-key'], 'Mutate GitHub repo deploy keys', isMutatingGhSubcommand),
  exact(['gh', 'repo', 'set-default'], 'Change default GitHub repo'),
  exact(['gh', 'release', 'create'], 'Publish GitHub release'),
  exact(['gh', 'release', 'delete'], 'Delete GitHub release'),
  exact(['gh', 'release', 'edit'], 'Edit GitHub release'),
  matched(['gh', 'api'], 'Mutate via GitHub API', isMutatingGhApi)
]

const FILESYSTEM_RULES: CommandRule[] = [
  matched(['rm'], 'Recursive removal of home or root', isCatastrophicRemoval)
]

export const DEFAULT_COMMAND_RULES: CommandRule[] = buildDefaultCommandRules()

export function buildDefaultCommandRules(): CommandRule[] {
  return [...FILESYSTEM_RULES, ...GITHUB_RULES]
}

export type ConfirmActionsMode = 'autonomous' | 'strict'
const MODE_ENTRY = 'confirm-actions-mode'

export function confirmActionsMode(ctx: Pick<ExtensionContext, 'sessionManager'>): ConfirmActionsMode {
  // A continued child must inherit the parent's current mode, not its old one.
  if (process.env.HERDR_SUBAGENT_CHILD === '1') {
    return process.env.PI_CONFIRM_ACTIONS_MODE === 'strict' ? 'strict' : 'autonomous'
  }
  for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
    if (entry.type === 'custom' && entry.customType === MODE_ENTRY) {
      const mode = (entry.data as { mode?: unknown })?.mode
      if (mode === 'strict' || mode === 'autonomous') return mode
    }
  }
  return 'autonomous'
}

export function registerCommandGuard(
  pi: ExtensionAPI,
  options: { child?: boolean; onBlocked?: (action: string) => void } = {}
) {
  let commandRules = DEFAULT_COMMAND_RULES
  const checkpoints = new Map<string, 'pending' | 'acknowledged'>()
  const keyFor = (command: string, cwd: string) => JSON.stringify([cwd, command])

  pi.on('session_start', (_event, ctx) => {
    commandRules = loadCommandRules(ctx.cwd)
    checkpoints.clear()
  })
  pi.on('agent_start', () => { checkpoints.clear() })
  pi.on('agent_end', () => { checkpoints.clear() })

  pi.registerCommand('confirm-actions', {
    description: 'Set session approval mode: autonomous or strict (inherited by subagents)',
    handler: async (args, ctx) => {
      const mode = args.trim()
      if (options.child || (mode !== 'autonomous' && mode !== 'strict')) {
        ctx.ui.notify(`Mode: ${confirmActionsMode(ctx)}. Usage: /confirm-actions autonomous|strict`, 'info')
        return
      }
      checkpoints.clear()
      pi.appendEntry(MODE_ENTRY, { mode })
      ctx.ui.notify(`Confirm actions: ${mode}`, 'info')
    }
  })

  pi.registerTool({
    name: 'acknowledge_github_action',
    label: 'Acknowledge GitHub action',
    description: 'Acknowledge one exact GitHub bash command after its checkpoint blocks it. Only proceed within requested scope, after reviewing exact content/diff and passing relevant checks. This is agent acknowledgement, not human approval.',
    parameters: Type.Object({
      command: Type.String({ description: 'Exact blocked bash command, unchanged' }),
      withinRequestedScope: Type.Literal(true),
      exactContentReviewed: Type.Literal(true),
      relevantChecksPassed: Type.Literal(true),
      review: Type.String({ minLength: 1, description: 'Explain the authorized scope, content/diff reviewed, and checks passed' })
    }),
    async execute(_id, params, _signal, _update, ctx) {
      const key = keyFor(params.command, ctx.cwd)
      if (confirmActionsMode(ctx) !== 'autonomous' || checkpoints.get(key) !== 'pending') {
        return { content: [{ type: 'text', text: 'No pending autonomous checkpoint for this exact command. Do not retry; report the pending action and end your turn.' }], details: {}, isError: true }
      }
      checkpoints.set(key, 'acknowledged')
      return { content: [{ type: 'text', text: 'Acknowledged for one execution of this exact command in this working directory. Run it now; changes require a new checkpoint.' }], details: {} }
    }
  })

  pi.on('tool_call', async (event, ctx) => {
    if (!isToolCallEventType('bash', event)) return
    const command = event.input.command
    const match = matchCommandRule(command, commandRules, ctx.cwd)
    if (!match) return
    const key = keyFor(command, ctx.cwd)
    if (GITHUB_RULES.includes(match) && confirmActionsMode(ctx) === 'autonomous') {
      if (checkpoints.get(key) === 'acknowledged') {
        checkpoints.delete(key)
        return
      }
      const repeated = checkpoints.has(key)
      checkpoints.set(key, 'pending')
      return {
        block: true,
        ...(repeated ? { terminate: true } : {}),
        reason: `${match.label}: agent checkpoint. Nothing ran. Only proceed within the user's requested scope, after reviewing the exact content/diff and passing relevant checks. Call acknowledge_github_action with this exact command and explicit review, then retry once. Otherwise report the action as pending approval and end your turn. Do not retry without acknowledgement.\nCommand: ${command}`
      }
    }

    checkpoints.delete(key)
    const pending = `${match.label}: ${command}`
    if (options.child || !ctx.hasUI) {
      options.onBlocked?.(pending)
      return { block: true, terminate: true, reason: `Human approval required. Report this pending action and end your turn; do not retry or wait for a modal.\n${pending}` }
    }
    notifyDesktop(notificationTitle(ctx.cwd), `Approve: ${match.label}`)
    const confirmed = await withHerdrBlocked(pi, match.label, () =>
      ctx.ui.confirm(`${match.label}?`, `Review the exact command:\n\n${command}`)
    )
    if (!confirmed) {
      return { block: true, terminate: true, reason: `User cancelled: ${match.label}. Report it as pending and end your turn; do not retry.` }
    }
  })
}

function exact(argv: string[], label: string): CommandRule {
  return { argv, label }
}

function matched(
  argv: string[],
  label: string,
  matches: NonNullable<CommandRule['matches']>
): CommandRule {
  return { argv, label, matches }
}

const PREFIX_WRAPPERS = new Set(['sudo', 'command', 'env', 'noglob'])

export default function (pi: ExtensionAPI) {
  registerCommandGuard(pi)

  pi.on('session_before_switch', async (event: SessionBeforeSwitchEvent, ctx) => {
    if (!ctx.hasUI) return

    if (event.reason === 'new') {
      notifyDesktop(notificationTitle(ctx.cwd), 'Approve: clear current session')

      const confirmed = await withHerdrBlocked(pi, 'Clear session', () =>
        ctx.ui.confirm('Clear session?', 'This will delete all messages in the current session.')
      )

      if (!confirmed) {
        ctx.ui.notify('Clear cancelled', 'info')
        return { cancel: true }
      }
      return
    }

    const entries = ctx.sessionManager.getEntries()
    const hasUnsavedWork = entries.some(
      (e): e is SessionMessageEntry => e.type === 'message' && e.message.role === 'user'
    )

    if (hasUnsavedWork) {
      notifyDesktop(notificationTitle(ctx.cwd), 'Approve: switch session')

      const confirmed = await withHerdrBlocked(pi, 'Switch session', () =>
        ctx.ui.confirm('Switch session?', 'You have messages in the current session. Switch anyway?')
      )

      if (!confirmed) {
        ctx.ui.notify('Switch cancelled', 'info')
        return { cancel: true }
      }
    }
  })

  pi.on('session_before_fork', async (event, ctx) => {
    if (!ctx.hasUI) return

    notifyDesktop(notificationTitle(ctx.cwd), `Approve: fork from ${event.entryId.slice(0, 8)}`)

    const choice = await withHerdrBlocked(pi, `Fork from entry ${event.entryId.slice(0, 8)}`, () =>
      ctx.ui.select(`Fork from entry ${event.entryId.slice(0, 8)}?`, [
        'Yes, create fork',
        'No, stay in current session'
      ])
    )

    if (choice !== 'Yes, create fork') {
      ctx.ui.notify('Fork cancelled', 'info')
      return { cancel: true }
    }
  })
}

export function matchCommandRule(
  command: string,
  rules: CommandRule[],
  cwd = process.cwd()
): CommandRule | undefined {
  const parsed = parseCommand(command)

  // Check human-only rules first across the entire command: a GitHub checkpoint
  // must never authorize a catastrophic rm (or a custom protected command).
  const invocations = parsed.invocations.flatMap((invocation) => unwrapInvocation(invocation.argv))
  const orderedRules = [...rules.filter((rule) => !GITHUB_RULES.includes(rule)), ...rules.filter((rule) => GITHUB_RULES.includes(rule))]
  for (const rule of orderedRules) {
    for (const argv of invocations) {
      const comparable = normalizeToolInvocation(argv, rule.argv)
      if (startsWithArgv(comparable, rule.argv) && (rule.matches?.(comparable, cwd) ?? true)) return rule
    }
  }
}

export function parseInvocations(command: string): string[][] {
  return parseCommand(command).invocations.map((invocation) => invocation.argv)
}

type ParsedInvocation = {
  argv: string[]
}

type ParsedCommand = {
  invocations: ParsedInvocation[]
}

function parseCommand(command: string): ParsedCommand {
  try {
    const script = parseShell(command)
    return { invocations: collectInvocationsFromScript(script) }
  } catch {
    return { invocations: [] }
  }
}

function collectInvocationsFromScript(script: Script | undefined): ParsedInvocation[] {
  if (!script) return []
  return script.commands.flatMap((statement) => collectInvocationsFromNode(statement))
}

function collectInvocationsFromNode(node: Node | undefined): ParsedInvocation[] {
  if (!node) return []

  switch (node.type) {
    case 'Statement':
      return [
        ...collectInvocationsFromNode(node.command),
        ...collectInvocationsFromRedirects(node.redirects)
      ]
    case 'Command': {
      const words = [node.name, ...node.suffix].filter((word): word is Word => Boolean(word))
      const argv = words.map((word) => word.value)
      return [
        ...(argv.length > 0 ? [{ argv }] : []),
        ...words.flatMap(collectInvocationsFromWord),
        ...node.prefix.flatMap((assignment) => collectInvocationsFromWord(assignment.value)),
        ...collectInvocationsFromRedirects(node.redirects)
      ]
    }
    case 'Pipeline':
    case 'AndOr':
      return node.commands.flatMap((command) => collectInvocationsFromNode(command))
    case 'If':
      return [
        ...collectInvocationsFromNode(node.clause),
        ...collectInvocationsFromNode(node.then),
        ...collectInvocationsFromNode(node.else)
      ]
    case 'For':
      return [
        ...collectInvocationsFromWord(node.name),
        ...node.wordlist.flatMap(collectInvocationsFromWord),
        ...collectInvocationsFromNode(node.body)
      ]
    case 'ArithmeticFor':
      return [
        ...collectInvocationsFromArithmetic(node.initialize),
        ...collectInvocationsFromArithmetic(node.test),
        ...collectInvocationsFromArithmetic(node.update),
        ...collectInvocationsFromNode(node.body)
      ]
    case 'Select':
      return [
        ...collectInvocationsFromWord(node.name),
        ...node.wordlist.flatMap(collectInvocationsFromWord),
        ...collectInvocationsFromNode(node.body)
      ]
    case 'While':
      return [...collectInvocationsFromNode(node.clause), ...collectInvocationsFromNode(node.body)]
    case 'Function':
      return [
        ...collectInvocationsFromWord(node.name),
        ...collectInvocationsFromNode(node.body),
        ...collectInvocationsFromRedirects(node.redirects)
      ]
    case 'Subshell':
    case 'BraceGroup':
      return collectInvocationsFromNode(node.body)
    case 'CompoundList':
      return node.commands.flatMap((statement) => collectInvocationsFromNode(statement))
    case 'Case':
      return [
        ...collectInvocationsFromWord(node.word),
        ...node.items.flatMap((item) => [
          ...item.pattern.flatMap(collectInvocationsFromWord),
          ...collectInvocationsFromNode(item.body)
        ])
      ]
    case 'Coproc':
      return [
        ...collectInvocationsFromWord(node.name),
        ...collectInvocationsFromNode(node.body),
        ...collectInvocationsFromRedirects(node.redirects)
      ]
    case 'TestCommand':
      return collectInvocationsFromTestExpression(node.expression)
    case 'ArithmeticCommand':
      return collectInvocationsFromArithmetic(node.expression)
  }
}

function collectInvocationsFromRedirects(
  redirects: { target?: Word; body?: Word }[]
): ParsedInvocation[] {
  return redirects.flatMap((redirect) => [
    ...collectInvocationsFromWord(redirect.target),
    ...collectInvocationsFromWord(redirect.body)
  ])
}

function collectInvocationsFromWord(word: Word | undefined): ParsedInvocation[] {
  if (!word?.parts) return []
  return word.parts.flatMap(collectInvocationsFromWordPart)
}

function collectInvocationsFromWordPart(part: WordPart): ParsedInvocation[] {
  switch (part.type) {
    case 'CommandExpansion':
    case 'ProcessSubstitution':
      return collectInvocationsFromScript(part.script)
    case 'ArithmeticExpansion':
      return collectInvocationsFromArithmetic(part.expression)
    case 'DoubleQuoted':
    case 'LocaleString':
      return part.parts.flatMap(collectInvocationsFromWordPart)
    case 'ParameterExpansion':
      return [
        ...collectInvocationsFromWord(part.operand),
        ...collectInvocationsFromWord(part.slice?.offset),
        ...collectInvocationsFromWord(part.slice?.length),
        ...collectInvocationsFromWord(part.replace?.pattern),
        ...collectInvocationsFromWord(part.replace?.replacement)
      ]
    default:
      return []
  }
}

function collectInvocationsFromArithmetic(
  expression: ArithmeticExpression | undefined
): ParsedInvocation[] {
  if (!expression) return []

  switch (expression.type) {
    case 'ArithmeticCommandExpansion':
      return collectInvocationsFromScript(expression.script)
    case 'ArithmeticBinary':
      return [
        ...collectInvocationsFromArithmetic(expression.left),
        ...collectInvocationsFromArithmetic(expression.right)
      ]
    case 'ArithmeticUnary':
      return collectInvocationsFromArithmetic(expression.operand)
    case 'ArithmeticTernary':
      return [
        ...collectInvocationsFromArithmetic(expression.test),
        ...collectInvocationsFromArithmetic(expression.consequent),
        ...collectInvocationsFromArithmetic(expression.alternate)
      ]
    case 'ArithmeticGroup':
      return collectInvocationsFromArithmetic(expression.expression)
    case 'ArithmeticWord':
      return []
  }
}

function collectInvocationsFromTestExpression(expression: unknown): ParsedInvocation[] {
  if (!expression || typeof expression !== 'object') return []

  const invocations: ParsedInvocation[] = []
  for (const value of Object.values(expression)) {
    if (isWord(value)) invocations.push(...collectInvocationsFromWord(value))
    else if (Array.isArray(value)) {
      for (const item of value) invocations.push(...collectInvocationsFromTestExpression(item))
    } else if (value && typeof value === 'object') {
      invocations.push(...collectInvocationsFromTestExpression(value))
    }
  }
  return invocations
}

function isWord(value: unknown): value is Word {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'text' in value &&
    'value' in value &&
    typeof (value as Word).text === 'string'
  )
}

function unwrapInvocation(argv: string[], depth = 0): string[][] {
  const normalized = normalizeInvocation(argv)
  if (depth >= 8) return [normalized]
  const tool = normalized[0]
  if (['bash', 'sh', 'zsh'].includes(tool)) {
    const index = normalized.findIndex((arg, index) => index > 0 && /^-[^-]*c/.test(arg))
    if (index > 0 && normalized[index + 1]) {
      return [normalized, ...parseInvocations(normalized[index + 1]).flatMap((args) => unwrapInvocation(args, depth + 1))]
    }
  }
  if (tool === 'eval') {
    return [normalized, ...parseInvocations(normalized.slice(1).join(' ')).flatMap((args) => unwrapInvocation(args, depth + 1))]
  }
  if (tool === 'xargs') {
    const index = findXargsCommandIndex(normalized)
    if (index > 0) return [normalized, ...unwrapInvocation(normalized.slice(index), depth + 1)]
  }
  if (tool === 'find') {
    const index = normalized.findIndex((arg) => arg === '-exec' || arg === '-execdir')
    if (index > 0) return [normalized, ...unwrapInvocation(normalized.slice(index + 1), depth + 1)]
  }
  return [normalized]
}

function normalizeInvocation(argv: string[]): string[] {
  let rest = dropAssignments(argv)

  while (rest.length > 0 && PREFIX_WRAPPERS.has(rest[0] ?? '')) {
    const wrapper = rest[0]
    rest = rest.slice(1)

    if (wrapper === 'sudo' || wrapper === 'env') {
      rest = dropFlagsAndAssignments(rest)
    }
  }

  return rest.length ? [basename(rest[0]), ...rest.slice(1)] : rest
}

function normalizeToolInvocation(argv: string[], ruleArgv: string[]): string[] {
  const tool = ruleArgv[0]
  if (tool !== 'gh' && tool !== 'glab') return argv
  if (argv[0] !== tool) return argv

  return [tool, ...dropCliGlobalOptions(argv.slice(1))]
}

function dropCliGlobalOptions(argv: string[]): string[] {
  let index = 0
  while (index < argv.length) {
    const arg = argv[index] ?? ''
    if (!isFlag(arg)) break
    if (arg === '--') return argv.slice(index + 1)
    index += cliGlobalFlagConsumesValue(arg) ? 2 : 1
  }
  return argv.slice(index)
}

function cliGlobalFlagConsumesValue(arg: string): boolean {
  return ['-R', '--repo', '--hostname', '--config'].includes(arg)
}

function dropAssignments(argv: string[]): string[] {
  const index = argv.findIndex((arg) => !isAssignment(arg))
  return index === -1 ? [] : argv.slice(index)
}

function dropFlagsAndAssignments(argv: string[]): string[] {
  let index = 0
  while (index < argv.length) {
    const arg = argv[index] ?? ''
    if (isAssignment(arg)) {
      index += 1
      continue
    }
    if (!isFlag(arg)) break

    index += flagConsumesValue(arg) ? 2 : 1
  }
  return argv.slice(index)
}

function flagConsumesValue(arg: string): boolean {
  return ['-u', '-g', '-h', '-p', '-C', '-c', '--user', '--group', '--host', '--prompt'].includes(
    arg
  )
}

function startsWithArgv(argv: string[], prefix: string[]): boolean {
  return prefix.length > 0 && prefix.every((part, index) => argv[index] === part)
}

function isMutatingGhApi(argv: string[]): boolean {
  const method = getOptionValue(argv, ['--method', '-X'])?.toUpperCase()
  if (argv.includes('graphql')) {
    const query = getGhApiField(argv, 'query')
    // Only recognizable inline queries are read-only; files/variables are opaque.
    return !query || !/^\s*(?:query\b|\{)/.test(query) || /\bmutation\b/.test(query)
  }
  if (method) return !['GET', 'HEAD', 'OPTIONS'].includes(method)
  return argv.some((arg) => /^(?:--field|--raw-field|--input)(?:=|$)|^-[fF]/.test(arg))
}

function getGhApiField(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    let value: string | undefined
    if (['--field', '--raw-field', '-f', '-F'].includes(arg)) value = argv[index + 1]
    else value = arg.match(/^(?:--field=|--raw-field=|-[fF]=?)(.*)$/)?.[1]
    if (value?.startsWith(`${name}=`)) return value.slice(name.length + 1)
  }
}

function isMutatingGhSubcommand(argv: string[]): boolean {
  return argv.some((arg) => ['add', 'delete', 'remove'].includes(arg))
}

function isCatastrophicRemoval(argv: string[], cwd: string): boolean {
  if (argv[0] !== 'rm') return false

  let parsingOptions = true
  let recursive = false
  const targets: string[] = []

  for (const arg of argv.slice(1)) {
    if (parsingOptions && arg === '--') {
      parsingOptions = false
      continue
    }

    if (parsingOptions && arg.startsWith('-') && arg !== '-') {
      if (arg === '--recursive' || /^-[^-]*r/i.test(arg)) recursive = true
      continue
    }

    targets.push(arg)
  }

  return recursive && targets.some((target) => {
    const home = resolve(homedir())
    const expanded = target.replace(/^(?:~|\$HOME|\$\{HOME\})(?=\/|$)/, home)
    // Broad globs at home/root also remove their contents; subdirectories are fine.
    const path = resolve(cwd, expanded).replace(/\/(?:\*{1,2}|\.\*|\{[^/]*\})$/, '') || '/'
    return path === '/' || path === home
  })
}

function findXargsCommandIndex(argv: string[]): number {
  let index = 1
  while (index < argv.length) {
    const arg = argv[index] ?? ''
    if (arg === '--') return index + 1 < argv.length ? index + 1 : -1
    if (!isFlag(arg)) return index
    index += flagConsumesValue(arg) || xargsFlagConsumesValue(arg) ? 2 : 1
  }
  return -1
}

function xargsFlagConsumesValue(arg: string): boolean {
  return [
    '-a',
    '--arg-file',
    '-d',
    '--delimiter',
    '-E',
    '-I',
    '--replace',
    '-i',
    '-L',
    '--max-lines',
    '-l',
    '-n',
    '--max-args',
    '-P',
    '--max-procs',
    '-s',
    '--max-chars'
  ].includes(arg)
}

function getOptionValue(argv: string[], names: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? ''
    for (const name of names) {
      if (arg === name) return argv[index + 1]
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1)
      if (/^-[^-]$/.test(name) && arg.startsWith(name) && arg.length > 2) return arg.slice(2)
    }
  }
}

function isAssignment(arg: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(arg)
}

function isFlag(arg: string): boolean {
  return arg.startsWith('-') && arg !== '-'
}

export function loadCommandRules(cwd: string): CommandRule[] {
  const settings = readLayeredSettings(cwd)
  return [...DEFAULT_COMMAND_RULES, ...settings.flatMap(readCommandRules)]
}

function readCommandRules(settings: Record<string, unknown>): CommandRule[] {
  const value = settings.confirmCommands
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => parseRule(item))
}

function parseRule(item: unknown): CommandRule[] {
  if (!item || typeof item !== 'object') return []

  const rule = item as { argv?: unknown; command?: unknown; label?: unknown }
  const argv = Array.isArray(rule.argv)
    ? rule.argv.filter((part): part is string => typeof part === 'string' && part.length > 0)
    : typeof rule.command === 'string'
      ? rule.command.trim().split(/\s+/)
      : []

  if (argv.length === 0 || typeof rule.label !== 'string' || rule.label.length === 0) return []
  return [{ argv, label: rule.label }]
}

function notificationTitle(cwd: string): string {
  return formatPiNotificationTitle(cwd)
}
