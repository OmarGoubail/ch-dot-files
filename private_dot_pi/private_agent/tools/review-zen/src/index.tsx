import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { resolve } from "node:path"
import { App } from "./app"
import { loadBundle } from "./bundle"
import { loadTheme } from "./theme"

const usage = `Usage: review-zen <review.json> [--theme <theme.json>]
       review-zen --demo [--theme <theme.json>]

Keys:
  n/p       Next or previous review stop
  j/k       Next or previous focus block
  Tab       Focus one zone; Shift-Tab moves back
  Esc       Show all zones
  t         Open or close Test Evidence
  [/]       Previous or next linked test
  d         Open the full diff in Delta
  m         Open or close the code map
  q         Quit`

type CliOptions = {
  bundlePath: string
  themePath?: string
}

export function parseArgs(args: string[]): CliOptions {
  let bundlePath: string | undefined
  let themePath: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`${usage}\n`)
      process.exit(0)
    }
    if (argument === "--demo") {
      bundlePath = resolve(import.meta.dir, "../examples/transfer-review.json")
      continue
    }
    if (argument === "--theme") {
      const value = args[index + 1]
      if (!value) throw new Error("--theme needs a file path.")
      themePath = resolve(value)
      index += 1
      continue
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`)
    if (bundlePath) throw new Error("Pass only one review bundle.")
    bundlePath = resolve(argument)
  }

  if (!bundlePath) throw new Error(usage)
  return { bundlePath, themePath }
}

if (import.meta.main) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const bundle = loadBundle(options.bundlePath)
    const theme = loadTheme(options.themePath)
    const renderer = await createCliRenderer({ exitOnCtrlC: true, useMouse: true })
    createRoot(renderer).render(<App bundle={bundle} theme={theme} />)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`review-zen: ${message}\n`)
    process.exitCode = 1
  }
}
