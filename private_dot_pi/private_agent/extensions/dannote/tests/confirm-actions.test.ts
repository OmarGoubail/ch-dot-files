import assert from 'node:assert/strict'
import { test } from 'node:test'
import { homedir } from 'node:os'
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { DEFAULT_COMMAND_RULES, matchCommandRule, registerCommandGuard, confirmActionsMode } from '../confirm-actions.ts'

const cwd = '/work/project'
const match = (command: string, directory = cwd) => matchCommandRule(command, DEFAULT_COMMAND_RULES, directory)

for (const command of [
  'rm -rf /tmp/agent-result', 'rm /tmp/output.json', 'rm -rf /var/tmp/agent/',
  'rm -rf node_modules dist/', 'rm -rf ~/scratch/', 'rm -rf "$HOME/tmp/output"',
  'rm -rf . ../other ./tmp/*', 'sudo rm -rf /tmp/build',
  'git reset --hard', 'git clean -fdx', 'git branch -D scratch',
  'npm publish', 'glab mr create', 'bash -lc "rm -rf /tmp/build"',
  'find /tmp/build -type f -exec rm {} \\;', 'printf x | xargs rm -rf /tmp/build',
  'npx mcporter list && agent-browser snapshot && rm /tmp/output.json',
  'printf "%s" "rm -fr ~/"', 'echo "gh pr create"',
  'gh pr view 12', 'gh api repos/org/repo', 'gh api -XGET repos/org/repo -f page=1',
  'gh api graphql -f \'query=query { viewer { login } }\'',
]) {
  test(`allows ${command}`, () => assert.equal(match(command), undefined))
}

for (const command of [
  'rm -fr ~/', 'rm -rf ~', 'rm -rf /', 'rm --recursive --force -- /',
  'rm -Rf "$HOME"', 'rm -rf "${HOME}/"', `rm -rf ${homedir()}/`,
  'rm -rf ~/*', 'rm -rf "$HOME"/.*', 'rm -rf /*', 'rm -rf //',
  'rm -rf ~/scratch/..', '/bin/rm -rf ~/', 'sudo /bin/rm -rf ~/',
  'bash -lc \'rm -fr ~/\'', 'env bash -c \'rm -rf "$HOME"\'',
  'eval \'rm -rf /\'', 'gh pr create --title x; rm -rf ~/',
]) {
  test(`protects ${command}`, () => assert.equal(match(command)?.argv[0], 'rm'))
}

test('relative home/root paths are protected in their working directory', () => {
  assert.equal(match('rm -rf .', homedir())?.argv[0], 'rm')
  assert.equal(match('rm -rf *', homedir())?.argv[0], 'rm')
  assert.equal(match('rm -rf ./', '/')?.argv[0], 'rm')
})

for (const command of [
  'gh pr create --title x', 'gh -R org/repo pr comment 1 --body x',
  'gh pr merge 1', 'gh issue edit 1 --body x', 'gh release create v1',
  'gh api -XPOST repos/org/repo/issues', 'gh api repos/org/repo/issues --field=title=x',
  'gh api repos/org/repo/issues -ftitle=x', 'gh api repos/org/repo/issues --input payload.json',
  'gh api graphql -f \'query=mutation Update($id: ID!) { updateIssue(input: {id: $id}) { clientMutationId } }\'',
  'bash -lc \'gh pr create --title x\'', 'echo x | xargs gh pr comment 1 --body',
  'echo $(gh pr create --title x)',
]) {
  test(`checkpoints ${command}`, () => assert.equal(match(command)?.argv[0], 'gh'))
}

function harness(child = false) {
  const handlers = new Map<string, Function[]>()
  const tools = new Map<string, any>()
  const commands = new Map<string, any>()
  const entries: any[] = []
  const blocked: string[] = []
  const prompts: string[] = []
  let approved = false
  const pi = {
    on: (name: string, fn: Function) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
    registerTool: (tool: any) => tools.set(tool.name, tool),
    registerCommand: (name: string, command: any) => commands.set(name, command),
    appendEntry: (customType: string, data: unknown) => entries.push({ type: 'custom', customType, data }),
    events: { emit: () => {} },
  } as unknown as ExtensionAPI
  const ctx = {
    cwd, hasUI: true,
    sessionManager: { getBranch: () => entries },
    ui: {
      notify: () => {},
      confirm: async (_title: string, message: string) => { prompts.push(message); return approved },
    },
  } as unknown as ExtensionContext
  registerCommandGuard(pi, { child, onBlocked: (action) => blocked.push(action) })
  const emit = async (event: string, value = {}) => {
    let result: any
    for (const fn of handlers.get(event) ?? []) result = await fn(value, ctx) ?? result
    return result
  }
  return {
    ctx, entries, blocked, prompts, emit,
    approve: () => { approved = true },
    mode: (mode: string) => commands.get('confirm-actions').handler(mode, ctx),
    call: (command: string) => emit('tool_call', { toolName: 'bash', input: { command } }),
    ack: (command: string) => tools.get('acknowledge_github_action').execute('id', {
      command, withinRequestedScope: true, exactContentReviewed: true,
      relevantChecksPassed: true, review: 'Requested comment reviewed; relevant checks passed.',
    }, undefined, undefined, ctx),
  }
}

const publish = 'gh pr comment 1 --body "Reviewed"'

test('autonomous checkpoint requires explicit acknowledgement for exactly one execution', async () => {
  const h = harness()
  assert.equal(confirmActionsMode(h.ctx), 'autonomous')
  assert.equal((await h.ack(publish)).isError, true)
  const first = await h.call(publish)
  assert.equal(first.block, true)
  assert.equal(first.terminate, undefined)
  assert.equal(h.prompts.length, 0)
  assert.equal((await h.ack(publish + ' ')).isError, true)
  assert.equal((await h.ack(publish)).isError, undefined)
  assert.equal(await h.call(publish), undefined)
  assert.equal((await h.call(publish)).block, true)
})

test('unacknowledged retry terminates instead of looping', async () => {
  const h = harness()
  await h.call(publish)
  assert.equal((await h.call(publish)).terminate, true)
})

test('checkpoint cannot authorize another cwd, another command, or a catastrophic removal', async () => {
  const h = harness()
  await h.call(publish)
  await h.ack(publish)
  h.ctx.cwd = '/other/project'
  assert.equal((await h.call(publish)).block, true)
  h.ctx.cwd = cwd
  assert.equal((await h.call(publish + '; rm -rf ~/')).block, true)
  assert.equal(h.prompts.length, 1)
})

test('acknowledgements expire across agent runs and session starts', async () => {
  for (const event of ['agent_end', 'agent_start', 'session_start']) {
    const h = harness()
    await h.call(publish)
    await h.ack(publish)
    await h.emit(event)
    assert.equal((await h.call(publish)).block, true)
  }
})

test('strict mode persists in the session and only human confirmation can approve', async () => {
  const h = harness()
  await h.mode('strict')
  assert.equal(confirmActionsMode(h.ctx), 'strict')
  assert.equal((await h.call(publish)).block, true)
  assert.equal((await h.ack(publish)).isError, true)
  assert.ok(h.prompts[0].includes(publish))
  h.approve()
  assert.equal(await h.call(publish), undefined)
  await h.mode('autonomous')
  assert.equal(confirmActionsMode(h.ctx), 'autonomous')
})

test('strict children and headless sessions return pending actions without UI', async () => {
  const h = harness(true)
  h.entries.push({ type: 'custom', customType: 'confirm-actions-mode', data: { mode: 'strict' } })
  assert.equal((await h.call(publish)).terminate, true)
  assert.equal(h.prompts.length, 0)
  assert.equal(h.blocked.length, 1)
  assert.equal((await h.call('rm -rf ~/')).terminate, true)
  const headless = harness()
  headless.ctx.hasUI = false
  assert.equal((await headless.call('rm -rf /')).terminate, true)
  assert.equal(headless.prompts.length, 0)
})

test('autonomous children can acknowledge; catastrophic removal remains human-only', async () => {
  const h = harness(true)
  assert.equal((await h.call(publish)).block, true)
  await h.ack(publish)
  assert.equal(await h.call(publish), undefined)
  assert.equal((await h.call('rm -rf ~/')).terminate, true)
  assert.equal((await h.ack('rm -rf ~/')).isError, true)
  assert.equal(h.prompts.length, 0)
})

test('child mode follows parent environment even when continuing an old child session', () => {
  const child = process.env.HERDR_SUBAGENT_CHILD
  const mode = process.env.PI_CONFIRM_ACTIONS_MODE
  try {
    process.env.HERDR_SUBAGENT_CHILD = '1'
    const h = harness(true)
    h.entries.push({ type: 'custom', customType: 'confirm-actions-mode', data: { mode: 'autonomous' } })
    process.env.PI_CONFIRM_ACTIONS_MODE = 'strict'
    assert.equal(confirmActionsMode(h.ctx), 'strict')
    process.env.PI_CONFIRM_ACTIONS_MODE = 'autonomous'
    assert.equal(confirmActionsMode(h.ctx), 'autonomous')
  } finally {
    if (child === undefined) delete process.env.HERDR_SUBAGENT_CHILD
    else process.env.HERDR_SUBAGENT_CHILD = child
    if (mode === undefined) delete process.env.PI_CONFIRM_ACTIONS_MODE
    else process.env.PI_CONFIRM_ACTIONS_MODE = mode
  }
})
