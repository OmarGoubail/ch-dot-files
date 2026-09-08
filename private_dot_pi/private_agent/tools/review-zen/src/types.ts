export type EvidenceState = "asserted" | "exercised" | "unlinked" | "unknown"

export type SourceLine = {
  number: number
  text: string
}

export type SourceRange = {
  start: number
  end: number
}

export type LanguageItem = {
  token: string
  origin: string
  meaning: string
  why: string
  alternatives: string[]
}

export type Intent = {
  pseudocode: string[]
  effect: string
  reason: string
  removed: string
}

export type FocusEvidence = {
  state: EvidenceState
  testIds: string[]
}

export type FocusBlock = {
  id: string
  title: string
  ranges: SourceRange[]
  language: LanguageItem[]
  intent: Intent
  evidence: FocusEvidence
}

export type SourceFrame = {
  id: string
  file: string
  symbol: string
  diff: string[]
  lines: SourceLine[]
}

export type ReviewStop = {
  id: string
  title: string
  scenario: string
  sourceFrameId: string
  focusBlocks: FocusBlock[]
}

export type TestEvidence = {
  id: string
  title: string
  scenario: string
  file: string
  startLine: number
  code: string[]
  setup: string[]
  action: string
  checks: string[]
  limits: string[]
}

export type CodeMapEntry = {
  file: string
  symbols: string[]
}

export type ReviewBundle = {
  schemaVersion: 1
  title: string
  diff: string[]
  codeMap: CodeMapEntry[]
  tests: TestEvidence[]
  frames: SourceFrame[]
  stops: ReviewStop[]
}

export type ReviewTheme = {
  accent: string
  blue: string
  magenta: string
  green: string
  yellow: string
  red: string
  text: string
  muted: string
  dim: string
  borderMuted: string
  selectedBg: string
  surface: string
}

export type Zone = "source" | "language" | "intent" | "tests"
