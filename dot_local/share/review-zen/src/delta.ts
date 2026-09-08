import { spawnSync } from "node:child_process"
import type { EvidenceState, ReviewTheme, SourceLine } from "./types"

const ansiPattern = /\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-_])/g

const evidenceGlyph: Record<EvidenceState, string> = {
  asserted: "●",
  exercised: "◐",
  unlinked: "○",
  unknown: "?",
}

const evidenceRank: Record<EvidenceState, number> = {
  unknown: 0,
  unlinked: 1,
  exercised: 2,
  asserted: 3,
}

export function renderSourceWithDelta(options: {
  diff: string[]
  highlightAs?: "heex"
  width: number
  height: number
  lines: SourceLine[]
  focusedLines: Set<number>
  evidenceByLine: Map<number, EvidenceState>
  theme: ReviewTheme
  dim: boolean
}): string {
  const result = spawnSync("theme", [
    "delta",
    "--paging=never",
    "--file-style=omit",
    "--hunk-header-style=omit",
    "--width",
    String(Math.max(50, options.width - 3)),
  ], {
    input: `${diffForSyntax(options.diff, options.highlightAs).join("\n")}\n`,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
    maxBuffer: 2 * 1024 * 1024,
  })

  if (result.error) {
    throw new Error(`Cannot run Delta through theme: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || "Delta failed to render the source frame.")
  }

  return annotateDelta(result.stdout.toString("utf8"), options)
}

export function diffForSyntax(diff: string[], highlightAs: "heex" | undefined): string[] {
  if (highlightAs !== "heex") return diff
  return diff.map((line) => {
    if (line.startsWith("diff --git ")) return line.replaceAll(".ex ", ".html.eex ").replace(/\.ex$/, ".html.eex")
    if (line.startsWith("--- ") || line.startsWith("+++ ")) return line.replace(/\.ex$/, ".html.eex")
    return line
  })
}

export function strongestEvidence(states: EvidenceState[]): EvidenceState {
  return states.reduce((best, state) => evidenceRank[state] > evidenceRank[best] ? state : best, "unknown")
}

function annotateDelta(
  rendered: string,
  options: {
    lines: SourceLine[]
    focusedLines: Set<number>
    evidenceByLine: Map<number, EvidenceState>
    theme: ReviewTheme
    dim: boolean
    height: number
  }
): string {
  let sourceIndex = 0
  const focusedRows: number[] = []
  const rows = rendered.replace(/\r\n/g, "\n").split("\n")
  const output = rows.map((row, rowIndex) => {
    while (options.lines[sourceIndex]?.text === "") sourceIndex += 1
    const sourceLine = options.lines[sourceIndex]
    const matchesSource = sourceLine !== undefined && stripAnsi(row).trimEnd() === sourceLine.text
    let prefix = "   "

    if (matchesSource) {
      const evidence = options.evidenceByLine.get(sourceLine.number)
      const focus = options.focusedLines.has(sourceLine.number)
      const focusMark = focus ? color("›", options.theme.accent) : " "
      const evidenceMark = evidence ? color(evidenceGlyph[evidence], evidenceColor(evidence, options.theme)) : " "
      prefix = `${focusMark}${evidenceMark} `
      if (focus) focusedRows.push(rowIndex)
      sourceIndex += 1
    }

    const content = options.dim ? dimAnsi(row) : row
    return `${prefix}${content}`
  })

  return sourceWindow(output, focusedRows, options.height).join("\r\n")
}

function sourceWindow(rows: string[], focusedRows: number[], height: number): string[] {
  if (height < 1 || rows.length <= height) return rows

  const firstFocus = focusedRows[0] ?? 0
  const lastFocus = focusedRows.at(-1) ?? firstFocus
  const visibleLastFocus = lastFocus - firstFocus < height ? lastFocus : firstFocus
  const focusHeight = visibleLastFocus - firstFocus + 1
  const contextBefore = Math.floor((height - focusHeight) / 2)
  const start = Math.max(0, Math.min(firstFocus - contextBefore, rows.length - height))

  return rows.slice(start, start + height)
}

function evidenceColor(state: EvidenceState, theme: ReviewTheme): string {
  if (state === "asserted") return theme.green
  if (state === "exercised") return theme.yellow
  if (state === "unlinked") return theme.red
  return theme.muted
}

function color(value: string, hex: string): string {
  const [red, green, blue] = hexToRgb(hex)
  return `\x1b[38;2;${red};${green};${blue}m${value}\x1b[0m`
}

function dimAnsi(value: string): string {
  return `\x1b[2m${value.replaceAll("\x1b[0m", "\x1b[0m\x1b[2m")}\x1b[0m`
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid theme color: ${hex}`)
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, "")
}
