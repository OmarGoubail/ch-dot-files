import { readFileSync } from "node:fs"
import type { EvidenceState, ReviewBundle, TestKind, VisualKind } from "./types"

const evidenceStates = new Set<EvidenceState>(["asserted", "exercised", "unlinked", "unknown"])
const testKinds = new Set<TestKind>(["unit", "integration", "server-dom", "browser", "visual"])
const visualKinds = new Set<VisualKind>(["structure", "flow", "state"])

export function loadBundle(path: string): ReviewBundle {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read the review bundle at ${path}: ${detail}`)
  }

  validateBundle(parsed)
  return parsed
}

export function validateBundle(value: unknown): asserts value is ReviewBundle {
  if (!isRecord(value)) fail("bundle", "must be an object")
  if (value.schemaVersion !== 1) fail("schemaVersion", "must equal 1")
  expectString(value.title, "title")
  expectStringArray(value.diff, "diff")
  if (value.diff.length === 0) fail("diff", "must not be empty")
  expectArray(value.codeMap, "codeMap")
  expectArray(value.tests, "tests")
  expectArray(value.frames, "frames")
  expectArray(value.stops, "stops")
  if (value.frames.length === 0) fail("frames", "must contain at least one source frame")
  if (value.stops.length === 0) fail("stops", "must contain at least one review stop")

  const testIds = new Set<string>()
  value.tests.forEach((test, index) => {
    const path = `tests[${index}]`
    if (!isRecord(test)) fail(path, "must be an object")
    const id = expectString(test.id, `${path}.id`)
    if (testIds.has(id)) fail(`${path}.id`, `duplicates ${id}`)
    testIds.add(id)
    const kind = expectString(test.kind, `${path}.kind`)
    if (!testKinds.has(kind as TestKind)) fail(`${path}.kind`, "must be unit, integration, server-dom, browser, or visual")
    expectString(test.title, `${path}.title`)
    expectString(test.scenario, `${path}.scenario`)
    expectString(test.file, `${path}.file`)
    expectPositiveInteger(test.startLine, `${path}.startLine`)
    expectStringArray(test.code, `${path}.code`)
    expectStringArray(test.setup, `${path}.setup`)
    expectString(test.action, `${path}.action`)
    expectStringArray(test.checks, `${path}.checks`)
    expectStringArray(test.limits, `${path}.limits`)
  })

  value.codeMap.forEach((entry, index) => {
    const path = `codeMap[${index}]`
    if (!isRecord(entry)) fail(path, "must be an object")
    expectString(entry.file, `${path}.file`)
    expectStringArray(entry.symbols, `${path}.symbols`)
  })

  const frameLines = new Map<string, Set<number>>()
  value.frames.forEach((frame, frameIndex) => {
    const path = `frames[${frameIndex}]`
    if (!isRecord(frame)) fail(path, "must be an object")
    const id = expectString(frame.id, `${path}.id`)
    if (frameLines.has(id)) fail(`${path}.id`, `duplicates ${id}`)
    expectString(frame.file, `${path}.file`)
    expectString(frame.symbol, `${path}.symbol`)
    if (frame.highlightAs !== undefined && frame.highlightAs !== "heex") {
      fail(`${path}.highlightAs`, "must equal heex when present")
    }
    expectStringArray(frame.diff, `${path}.diff`)
    if (frame.diff.length === 0) fail(`${path}.diff`, "must not be empty")
    expectArray(frame.lines, `${path}.lines`)
    const lineNumbers = new Set<number>()
    let previousLineNumber = 0
    frame.lines.forEach((line, lineIndex) => {
      const linePath = `${path}.lines[${lineIndex}]`
      if (!isRecord(line)) fail(linePath, "must be an object")
      const number = expectPositiveInteger(line.number, `${linePath}.number`)
      if (number <= previousLineNumber) fail(`${linePath}.number`, "must be greater than the previous source line")
      previousLineNumber = number
      lineNumbers.add(number)
      expectString(line.text, `${linePath}.text`, true)
    })
    frameLines.set(id, lineNumbers)
  })

  const stopIds = new Set<string>()
  value.stops.forEach((stop, stopIndex) => {
    const path = `stops[${stopIndex}]`
    if (!isRecord(stop)) fail(path, "must be an object")
    const id = expectString(stop.id, `${path}.id`)
    if (stopIds.has(id)) fail(`${path}.id`, `duplicates ${id}`)
    stopIds.add(id)
    expectString(stop.title, `${path}.title`)
    expectString(stop.scenario, `${path}.scenario`)
    const sourceFrameId = expectString(stop.sourceFrameId, `${path}.sourceFrameId`)
    const lineNumbers = frameLines.get(sourceFrameId)
    if (!lineNumbers) fail(`${path}.sourceFrameId`, `references missing frame ${sourceFrameId}`)
    expectArray(stop.focusBlocks, `${path}.focusBlocks`)
    if (stop.focusBlocks.length === 0) fail(`${path}.focusBlocks`, "must not be empty")

    const blockIds = new Set<string>()
    let previousBlockStart = 0
    stop.focusBlocks.forEach((block, blockIndex) => {
      const blockPath = `${path}.focusBlocks[${blockIndex}]`
      if (!isRecord(block)) fail(blockPath, "must be an object")
      const blockId = expectString(block.id, `${blockPath}.id`)
      if (blockIds.has(blockId)) fail(`${blockPath}.id`, `duplicates ${blockId}`)
      blockIds.add(blockId)
      expectString(block.title, `${blockPath}.title`)
      expectArray(block.ranges, `${blockPath}.ranges`)
      if (block.ranges.length === 0) fail(`${blockPath}.ranges`, "must not be empty")
      let previousRangeEnd = 0
      let firstRangeStart = 0
      block.ranges.forEach((range, rangeIndex) => {
        const rangePath = `${blockPath}.ranges[${rangeIndex}]`
        if (!isRecord(range)) fail(rangePath, "must be an object")
        const start = expectPositiveInteger(range.start, `${rangePath}.start`)
        const end = expectPositiveInteger(range.end, `${rangePath}.end`)
        if (start > end) fail(rangePath, "start must not be greater than end")
        if (start <= previousRangeEnd) fail(rangePath, "must be after the previous range")
        if (rangeIndex === 0) firstRangeStart = start
        previousRangeEnd = end
        for (let number = start; number <= end; number += 1) {
          if (!lineNumbers.has(number)) fail(rangePath, `references missing source line ${number}`)
        }
      })
      if (firstRangeStart < previousBlockStart) fail(`${blockPath}.ranges`, "must follow source order")
      previousBlockStart = firstRangeStart
      expectArray(block.language, `${blockPath}.language`)
      block.language.forEach((item, itemIndex) => {
        const itemPath = `${blockPath}.language[${itemIndex}]`
        if (!isRecord(item)) fail(itemPath, "must be an object")
        expectString(item.token, `${itemPath}.token`)
        expectString(item.origin, `${itemPath}.origin`)
        expectString(item.meaning, `${itemPath}.meaning`)
        expectString(item.why, `${itemPath}.why`)
        expectStringArray(item.alternatives, `${itemPath}.alternatives`)
      })
      if (block.visuals !== undefined) {
        expectArray(block.visuals, `${blockPath}.visuals`)
        block.visuals.forEach((visual, visualIndex) => {
          const visualPath = `${blockPath}.visuals[${visualIndex}]`
          if (!isRecord(visual)) fail(visualPath, "must be an object")
          const kind = expectString(visual.kind, `${visualPath}.kind`)
          if (!visualKinds.has(kind as VisualKind)) fail(`${visualPath}.kind`, "must be structure, flow, or state")
          expectString(visual.title, `${visualPath}.title`)
          expectStringArray(visual.lines, `${visualPath}.lines`)
        })
      }
      if (!isRecord(block.intent)) fail(`${blockPath}.intent`, "must be an object")
      expectStringArray(block.intent.pseudocode, `${blockPath}.intent.pseudocode`)
      expectString(block.intent.effect, `${blockPath}.intent.effect`)
      expectString(block.intent.reason, `${blockPath}.intent.reason`)
      expectString(block.intent.removed, `${blockPath}.intent.removed`)
      if (!isRecord(block.evidence)) fail(`${blockPath}.evidence`, "must be an object")
      if (!evidenceStates.has(block.evidence.state as EvidenceState)) {
        fail(`${blockPath}.evidence.state`, "must be asserted, exercised, unlinked, or unknown")
      }
      expectStringArray(block.evidence.testIds, `${blockPath}.evidence.testIds`)
      for (const testId of block.evidence.testIds) {
        if (!testIds.has(testId)) fail(`${blockPath}.evidence.testIds`, `references missing test ${testId}`)
      }
      if ((block.evidence.state === "asserted" || block.evidence.state === "exercised") && block.evidence.testIds.length === 0) {
        fail(`${blockPath}.evidence`, `${block.evidence.state} evidence must link at least one test`)
      }
      if ((block.evidence.state === "unlinked" || block.evidence.state === "unknown") && block.evidence.testIds.length > 0) {
        fail(`${blockPath}.evidence`, `${block.evidence.state} evidence must not link a test`)
      }
    })
  })
}

function expectArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(path, "must be an array")
}

function expectStringArray(value: unknown, path: string): asserts value is string[] {
  expectArray(value, path)
  value.forEach((item, index) => expectString(item, `${path}[${index}]`, true))
}

function expectString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    fail(path, allowEmpty ? "must be a string" : "must be a non-empty string")
  }
  return value
}

function expectPositiveInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) fail(path, "must be a positive integer")
  return value as number
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid review bundle: ${path} ${message}.`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
