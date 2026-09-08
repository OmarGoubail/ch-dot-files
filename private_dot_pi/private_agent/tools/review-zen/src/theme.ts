import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ReviewTheme } from "./types"

const requiredVars = [
  "accent",
  "blue",
  "magenta",
  "green",
  "yellow",
  "red",
  "text",
  "muted",
  "dim",
  "borderMuted",
  "selectedBg",
  "customMsgBg",
] as const

export const testTheme: ReviewTheme = {
  accent: "#99ffe4",
  blue: "#8e8ee8",
  magenta: "#ff8080",
  green: "#ffc799",
  yellow: "#ffee99",
  red: "#ff5555",
  text: "#d4d4d4",
  muted: "#9aa0a6",
  dim: "#666666",
  borderMuted: "#505050",
  selectedBg: "#303545",
  surface: "#2d2838",
}

export function defaultThemePath(): string {
  const home = process.env.HOME
  if (!home) throw new Error("HOME is not set. Pass --theme <path>.")
  return resolve(home, ".pi/agent/themes/theme-current.json")
}

export function loadTheme(path = defaultThemePath()): ReviewTheme {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read the Review Zen theme at ${path}: ${detail}`)
  }

  if (!isRecord(parsed) || !isRecord(parsed.vars)) {
    throw new Error(`The Review Zen theme at ${path} has no vars object.`)
  }

  for (const name of requiredVars) {
    if (typeof parsed.vars[name] !== "string") {
      throw new Error(`The Review Zen theme at ${path} has no string var named ${name}.`)
    }
  }

  return {
    accent: parsed.vars.accent as string,
    blue: parsed.vars.blue as string,
    magenta: parsed.vars.magenta as string,
    green: parsed.vars.green as string,
    yellow: parsed.vars.yellow as string,
    red: parsed.vars.red as string,
    text: parsed.vars.text as string,
    muted: parsed.vars.muted as string,
    dim: parsed.vars.dim as string,
    borderMuted: parsed.vars.borderMuted as string,
    selectedBg: parsed.vars.selectedBg as string,
    surface: parsed.vars.customMsgBg as string,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
