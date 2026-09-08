import { EmbeddedTerminalRenderable, ScrollBoxRenderable } from "@opentui/core"
import { extend, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { spawnSync } from "node:child_process"
import { useEffect, useMemo, useRef, useState } from "react"
import { renderSourceWithDelta, strongestEvidence } from "./delta"
import type {
  EvidenceState,
  FocusBlock,
  ReviewBundle,
  ReviewStop,
  ReviewTheme,
  SourceFrame,
  SourceLine,
  TestEvidence,
  Zone,
} from "./types"

extend({ embeddedTerminal: EmbeddedTerminalRenderable })

declare module "@opentui/react" {
  interface OpenTUIComponents {
    embeddedTerminal: typeof EmbeddedTerminalRenderable
  }
}

const zoneOrder: Zone[] = ["source", "language", "intent", "tests"]

function openFullDiff(renderer: ReturnType<typeof useRenderer>, bundle: ReviewBundle) {
  renderer.suspend()
  try {
    const result = spawnSync("theme", ["delta"], {
      input: `${bundle.diff.join("\n")}\n`,
      stdio: ["pipe", "inherit", "inherit"],
      env: { ...process.env, TERM: process.env.TERM || "xterm-256color", COLORTERM: "truecolor" },
    })
    if (result.error) throw new Error(`Cannot run Delta through theme: ${result.error.message}`)
    if (result.status !== 0) throw new Error("Delta failed to open the full diff.")
  } finally {
    renderer.resume()
  }
}

function DeltaPane({
  frame,
  stop,
  block,
  width,
  height,
  theme,
  dim,
}: {
  frame: SourceFrame
  stop: ReviewStop
  block: FocusBlock
  width: number
  height: number
  theme: ReviewTheme
  dim: boolean
}) {
  const terminalRef = useRef<EmbeddedTerminalRenderable>(null)
  const focusedLines = useMemo(() => lineNumbersForBlock(block), [block])
  const evidenceByLine = useMemo(() => evidenceForStop(stop), [stop])
  const rendered = useMemo(() => renderSourceWithDelta({
    diff: frame.diff,
    width,
    lines: frame.lines,
    focusedLines,
    evidenceByLine,
    theme,
    dim,
  }), [frame, stop, block, width, theme, dim, focusedLines, evidenceByLine])

  useEffect(() => {
    terminalRef.current?.write("\u001b[2J\u001b[H\u001b[?25l")
    terminalRef.current?.write(rendered)
  }, [rendered])

  return (
    <embeddedTerminal
      ref={terminalRef}
      cols={width}
      rows={height}
      width={width}
      height={height}
      maxScrollback={0}
      selectable
    />
  )
}

function FocusPanel({
  frame,
  stop,
  block,
  blockIndex,
  theme,
  activeZone,
}: {
  frame: SourceFrame
  stop: ReviewStop
  block: FocusBlock
  blockIndex: number
  theme: ReviewTheme
  activeZone: Zone | null
}) {
  const groups = linesForBlock(frame, block)
  const dimmed = activeZone !== null && activeZone !== "source"
  const foreground = dimmed ? theme.dim : theme.text
  const height = groups.reduce((total, group) => total + group.length, 0) + Math.max(0, groups.length - 1) + 2

  return (
    <box
      width="100%"
      height={height}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={activeZone === "source" ? theme.accent : theme.borderMuted}
      title={` FOCUS ${blockIndex + 1}/${stop.focusBlocks.length} · ${block.title} `}
      titleColor={dimmed ? theme.dim : theme.yellow}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {groups.flatMap((group, groupIndex) => [
        ...(groupIndex > 0 ? [<text key={`gap:${groupIndex}`} fg={theme.dim}>…</text>] : []),
        ...group.map((line) => (
          <text key={line.number} fg={foreground} selectable>
            <span fg={dimmed ? theme.dim : theme.muted}>{String(line.number).padStart(4)}  </span>
            {line.text}
          </text>
        )),
      ])}
    </box>
  )
}

function LanguagePanel({ block, theme, activeZone, height, width }: {
  block: FocusBlock
  theme: ReviewTheme
  activeZone: Zone | null
  height: number
  width: number
}) {
  const dimmed = activeZone !== null && activeZone !== "language"
  const text = dimmed ? theme.dim : theme.text
  const muted = dimmed ? theme.dim : theme.muted
  const accent = dimmed ? theme.dim : theme.accent
  const contentWidth = Math.max(10, width - 4)

  return (
    <box
      id="language-panel"
      width={width}
      height={height}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={activeZone === "language" ? theme.accent : theme.borderMuted}
      title=" LANGUAGE "
      titleColor={activeZone === "language" ? theme.accent : muted}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {block.language.length === 0 && <text fg={muted}>No language notes.</text>}
      {block.language.map((item, index) => {
        const heading = `${item.token} · ${item.origin}`
        const why = `Why: ${item.why}`
        const alternatives = `Instead: ${item.alternatives.join(" · ")}`
        const itemHeight = wrappedHeight(heading, contentWidth)
          + wrappedHeight(item.meaning, contentWidth)
          + wrappedHeight(why, contentWidth)
          + (item.alternatives.length > 0 ? wrappedHeight(alternatives, contentWidth) : 0)
          + 1
        return (
          <box key={`${item.token}:${index}`} height={itemHeight} flexDirection="column">
            <text height={wrappedHeight(heading, contentWidth)} selectable wrapMode="word">
              <span fg={accent}>{item.token}</span>
              <span fg={muted}> · {item.origin}</span>
            </text>
            <text height={wrappedHeight(item.meaning, contentWidth)} fg={text} selectable wrapMode="word">{item.meaning}</text>
            <text height={wrappedHeight(why, contentWidth)} fg={muted} selectable wrapMode="word">{why}</text>
            {item.alternatives.length > 0 && (
              <text height={wrappedHeight(alternatives, contentWidth)} fg={muted} selectable wrapMode="word">{alternatives}</text>
            )}
          </box>
        )
      })}
    </box>
  )
}

function IntentPanel({ block, theme, activeZone, height, width }: {
  block: FocusBlock
  theme: ReviewTheme
  activeZone: Zone | null
  height: number
  width: number
}) {
  const dimmed = activeZone !== null && activeZone !== "intent"
  const text = dimmed ? theme.dim : theme.text
  const muted = dimmed ? theme.dim : theme.muted
  const accent = dimmed ? theme.dim : theme.magenta
  const danger = dimmed ? theme.dim : theme.red
  const contentWidth = Math.max(10, width - 4)

  return (
    <box
      id="intent-panel"
      width={width}
      height={height}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={activeZone === "intent" ? theme.accent : theme.borderMuted}
      title=" INTENT "
      titleColor={activeZone === "intent" ? theme.accent : muted}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      <Label value="PSEUDOCODE" color={accent} />
      {block.intent.pseudocode.map((step, index) => (
        <text key={`${index}:${step}`} height={wrappedHeight(step, contentWidth)} fg={text} selectable wrapMode="word">{step}</text>
      ))}
      <box height={1} />
      <Label value="EFFECT" color={muted} />
      <text height={wrappedHeight(block.intent.effect, contentWidth)} fg={text} selectable wrapMode="word">{block.intent.effect}</text>
      <Label value="REASON" color={muted} />
      <text height={wrappedHeight(block.intent.reason, contentWidth)} fg={text} selectable wrapMode="word">{block.intent.reason}</text>
      <Label value="IF REMOVED" color={danger} />
      <text height={wrappedHeight(block.intent.removed, contentWidth)} fg={danger} selectable wrapMode="word">{block.intent.removed}</text>
    </box>
  )
}

function TestPanel({
  block,
  tests,
  testIndex,
  theme,
  activeZone,
  height,
}: {
  block: FocusBlock
  tests: TestEvidence[]
  testIndex: number
  theme: ReviewTheme
  activeZone: Zone | null
  height: number
}) {
  const dimmed = activeZone !== null && activeZone !== "tests"
  const text = dimmed ? theme.dim : theme.text
  const muted = dimmed ? theme.dim : theme.muted
  const accent = dimmed ? theme.dim : theme.green
  const warning = dimmed ? theme.dim : theme.yellow
  const test = tests[testIndex]

  return (
    <box
      id="test-evidence"
      width="100%"
      height={height}
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={activeZone === "tests" ? theme.accent : theme.borderMuted}
      title={` TEST EVIDENCE${tests.length > 1 ? ` ${testIndex + 1}/${tests.length}` : ""} `}
      titleColor={activeZone === "tests" ? theme.accent : muted}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      {!test ? (
        <box flexDirection="column">
          <text fg={warning} selectable>No linked test evidence.</text>
          <text fg={text} selectable wrapMode="word">The bundle marks this focus block as {block.evidence.state}.</text>
          <text fg={muted} selectable wrapMode="word">This does not prove that the code is untested.</text>
        </box>
      ) : (
        <box flexDirection="column">
          <text fg={accent} selectable>{test.title}</text>
          <text fg={muted} selectable>{test.file}:{test.startLine} · {test.scenario}</text>
          <box height={1} />
          {test.code.map((line, index) => (
            <text key={`${index}:${line}`} fg={text} selectable>
              <span fg={muted}>{String(test.startLine + index).padStart(4)}  </span>
              {line || " "}
            </text>
          ))}
          <box height={1} />
          <Label value="SETUP" color={muted} />
          {test.setup.map((step, index) => <text key={`${index}:${step}`} fg={text} selectable wrapMode="word">• {step}</text>)}
          <Label value="ACTION" color={muted} />
          <text fg={text} selectable wrapMode="word">{test.action}</text>
          <Label value="CHECK" color={accent} />
          {test.checks.map((check, index) => <text key={`${index}:${check}`} fg={text} selectable wrapMode="word">• {check}</text>)}
          <Label value="DOES NOT PROVE" color={warning} />
          {test.limits.map((limit, index) => <text key={`${index}:${limit}`} fg={warning} selectable wrapMode="word">• {limit}</text>)}
        </box>
      )}
      <box height={1} />
      <text fg={muted} selectable>● asserted   ◐ exercised   ○ no linked evidence   ? not analyzed</text>
    </box>
  )
}

function Label({ value, color }: { value: string; color: string }) {
  return <text fg={color} selectable={false}>{value}</text>
}

function CodeMap({ frame, entries, theme }: {
  frame: SourceFrame
  entries: ReviewBundle["codeMap"]
  theme: ReviewTheme
}) {
  return (
    <box
      width={29}
      height="100%"
      flexDirection="column"
      paddingLeft={2}
      paddingRight={1}
      backgroundColor={theme.surface}
    >
      <text height={1} fg={theme.magenta} selectable={false}>CODE MAP</text>
      <box height={1} />
      {entries.map((entry) => {
        const currentFile = entry.file === frame.file
        return (
          <box key={entry.file} flexDirection="column" height={currentFile ? entry.symbols.length + 1 : 1}>
            <text height={1} fg={currentFile ? theme.blue : theme.muted} selectable={false}>
              {currentFile ? "● " : "  "}{compactName(fileName(entry.file), 24)}
            </text>
            {currentFile && entry.symbols.map((symbol) => {
              const currentSymbol = frame.symbol.includes(symbol) || symbol.includes(frame.symbol)
              return (
                <text height={1} key={symbol} fg={currentSymbol ? theme.yellow : theme.muted} selectable={false}>
                  {currentSymbol ? "  › " : "    "}{compactName(symbol, 22)}
                </text>
              )
            })}
          </box>
        )
      })}
    </box>
  )
}

export function App({ bundle, theme }: { bundle: ReviewBundle; theme: ReviewTheme }) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const lowerRef = useRef<ScrollBoxRenderable>(null)
  const previousScroll = useRef(0)
  const [stopIndex, setStopIndex] = useState(0)
  const [blockIndex, setBlockIndex] = useState(0)
  const [testIndex, setTestIndex] = useState(0)
  const [testOpen, setTestOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [activeZone, setActiveZone] = useState<Zone | null>(null)
  const stop = bundle.stops[stopIndex]
  const currentBlockIndex = Math.min(blockIndex, stop.focusBlocks.length - 1)
  const block = stop.focusBlocks[currentBlockIndex]
  const frame = bundle.frames.find((candidate) => candidate.id === stop.sourceFrameId)!
  const linkedTests = block.evidence.testIds
    .map((id) => bundle.tests.find((test) => test.id === id))
    .filter((test): test is TestEvidence => test !== undefined)
  const showMap = mapOpen && dimensions.width >= 105
  const workspaceWidth = Math.max(68, Math.min(148, dimensions.width - 2))
  const mainWidth = showMap ? workspaceWidth - 30 : Math.min(118, workspaceWidth)
  const contentHeight = Math.max(18, dimensions.height - 2)
  const sourceHeight = Math.max(11, Math.min(Math.floor(contentHeight * 0.53), frame.lines.length + 4))
  const lowerHeight = Math.max(7, contentHeight - sourceHeight)
  const detailsSideBySide = mainWidth >= 100
  const languageWidth = detailsSideBySide ? Math.floor((mainWidth - 1) / 2) : mainWidth
  const intentWidth = detailsSideBySide ? mainWidth - languageWidth - 1 : mainWidth
  const languageHeight = languagePanelHeight(block, languageWidth)
  const intentHeight = intentPanelHeight(block, intentWidth)
  const detailsHeight = Math.max(languageHeight, intentHeight)
  const testHeight = linkedTests[testIndex]
    ? linkedTests[testIndex].code.length + linkedTests[testIndex].setup.length + linkedTests[testIndex].checks.length + linkedTests[testIndex].limits.length + 13
    : 8
  const focusHeight = linesForBlock(frame, block).reduce((total, group) => total + group.length, 0)
    + Math.max(0, block.ranges.length - 1)
    + 2
  const detailsContainerHeight = detailsSideBySide ? detailsHeight : languageHeight + intentHeight + 1
  const lowerContentHeight = focusHeight + detailsContainerHeight + 1 + (testOpen ? testHeight + 1 : 0)
  const testScrollTop = focusHeight + detailsContainerHeight + 2
  const languageScrollTop = focusHeight + 1
  const intentScrollTop = detailsSideBySide ? languageScrollTop : languageScrollTop + languageHeight + 1

  useEffect(() => {
    setBlockIndex(0)
    setTestIndex(0)
  }, [stopIndex])

  useEffect(() => {
    setTestIndex(0)
  }, [blockIndex])

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout>
    const scrollWhenReady = () => {
      if (cancelled) return
      const scrollBox = lowerRef.current
      if (!scrollBox || scrollBox.viewport.height === 0) {
        timeout = setTimeout(scrollWhenReady, 0)
        return
      }
      if (testOpen) {
        scrollBox.scrollTo({ y: testScrollTop, x: 0 })
      } else {
        scrollBox.scrollTo({ y: previousScroll.current, x: 0 })
      }
    }
    timeout = setTimeout(scrollWhenReady, 0)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [testOpen, stopIndex, blockIndex, testIndex, testScrollTop])

  useEffect(() => {
    if (activeZone === null) return
    const target = activeZone === "source"
      ? 0
      : activeZone === "language"
        ? languageScrollTop
        : activeZone === "intent"
          ? intentScrollTop
          : testScrollTop
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout>
    const scrollWhenReady = () => {
      if (cancelled) return
      const scrollBox = lowerRef.current
      if (!scrollBox || scrollBox.viewport.height === 0) {
        timeout = setTimeout(scrollWhenReady, 0)
        return
      }
      scrollBox.scrollTo({ y: target, x: 0 })
    }
    timeout = setTimeout(scrollWhenReady, 0)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [activeZone, languageScrollTop, intentScrollTop, testScrollTop])

  useKeyboard((key) => {
    if (key.ctrl || key.meta || key.eventType === "release") return
    if (key.name === "q") {
      renderer.destroy()
      return
    }
    if (key.name === "n") setStopIndex((value) => Math.min(bundle.stops.length - 1, value + 1))
    else if (key.name === "p") setStopIndex((value) => Math.max(0, value - 1))
    else if (key.name === "j" || key.name === "down") setBlockIndex((value) => Math.min(stop.focusBlocks.length - 1, value + 1))
    else if (key.name === "k" || key.name === "up") setBlockIndex((value) => Math.max(0, value - 1))
    else if (key.name === "t") {
      if (!testOpen) previousScroll.current = lowerRef.current?.scrollTop || 0
      if (testOpen && activeZone === "tests") setActiveZone(null)
      setTestOpen((value) => !value)
    }
    else if (key.name === "m") setMapOpen((value) => !value)
    else if (key.name === "d") openFullDiff(renderer, bundle)
    else if (key.name === "tab") setActiveZone((value) => nextZone(value, testOpen, key.shift ? -1 : 1))
    else if (key.name === "[" || key.sequence === "[") setTestIndex((value) => Math.max(0, value - 1))
    else if (key.name === "]" || key.sequence === "]") setTestIndex((value) => Math.min(Math.max(0, linkedTests.length - 1), value + 1))
    else if (key.name === "escape") {
      setActiveZone(null)
      if (mapOpen) setMapOpen(false)
    }
  })

  if (dimensions.width < 72 || dimensions.height < 20) {
    return (
      <box width="100%" height="100%" alignItems="center" justifyContent="center">
        <text fg={theme.yellow}>Review Zen needs a terminal of at least 72×20. Current: {dimensions.width}×{dimensions.height}.</text>
      </box>
    )
  }

  const header = `${frame.symbol} · ${frame.file} · stop ${stopIndex + 1}/${bundle.stops.length} · ${stop.scenario}`
  const footer = `n/p stop · j/k focus · tab zone · t tests${testOpen && linkedTests.length > 1 ? " · [/] test" : ""} · d diff · m map · q  ·  focus ${currentBlockIndex + 1}/${stop.focusBlocks.length}`

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box width="100%" height={1} paddingLeft={1} paddingRight={1} justifyContent="center">
        <text fg={theme.muted} selectable={false}>{compactName(header, dimensions.width - 2)}</text>
      </box>
      <box height={contentHeight} width="100%" flexDirection="row" justifyContent="center" overflow="hidden">
        <box width={mainWidth} height="100%" flexDirection="column">
          <box
            width="100%"
            height={sourceHeight}
            border
            borderStyle="rounded"
            borderColor={activeZone === "source" ? theme.accent : theme.borderMuted}
            title=" SOURCE "
            titleColor={activeZone === "source" ? theme.accent : theme.muted}
          >
            <DeltaPane
              frame={frame}
              stop={stop}
              block={block}
              width={mainWidth - 2}
              height={sourceHeight - 2}
              theme={theme}
              dim={activeZone !== null && activeZone !== "source"}
            />
          </box>
          <scrollbox
            key={`${stop.id}:${block.id}:${testOpen}:${testIndex}:${mainWidth}`}
            ref={lowerRef}
            width="100%"
            height={lowerHeight}
            scrollY
            viewportCulling
            contentOptions={{ flexDirection: "column", gap: 1, minHeight: lowerContentHeight }}
            verticalScrollbarOptions={{ visible: false }}
          >
            <FocusPanel frame={frame} stop={stop} block={block} blockIndex={currentBlockIndex} theme={theme} activeZone={activeZone} />
            <box
              width="100%"
              height={detailsContainerHeight}
              flexShrink={0}
              flexDirection={detailsSideBySide ? "row" : "column"}
              gap={1}
            >
              <LanguagePanel block={block} theme={theme} activeZone={activeZone} height={languageHeight} width={languageWidth} />
              <IntentPanel block={block} theme={theme} activeZone={activeZone} height={intentHeight} width={intentWidth} />
            </box>
            {testOpen && (
              <TestPanel
                block={block}
                tests={linkedTests}
                testIndex={testIndex}
                theme={theme}
                activeZone={activeZone}
                height={testHeight}
              />
            )}
          </scrollbox>
        </box>
        {showMap && <CodeMap frame={frame} entries={bundle.codeMap} theme={theme} />}
      </box>
      <box width="100%" height={1} paddingLeft={1} paddingRight={1} justifyContent="center">
        <text fg={theme.muted} selectable={false}>{compactName(footer, dimensions.width - 2)}</text>
      </box>
    </box>
  )
}

function nextZone(current: Zone | null, testOpen: boolean, direction: 1 | -1): Zone | null {
  const available = testOpen ? zoneOrder : zoneOrder.filter((zone) => zone !== "tests")
  if (current === null) return direction === 1 ? available[0] : available.at(-1) || null
  const index = available.indexOf(current)
  if (index === -1) return null
  const next = index + direction
  if (next < 0 || next >= available.length) return null
  return available[next]
}

function evidenceForStop(stop: ReviewStop): Map<number, EvidenceState> {
  const states = new Map<number, EvidenceState[]>()
  for (const block of stop.focusBlocks) {
    for (const number of lineNumbersForBlock(block)) {
      states.set(number, [...(states.get(number) || []), block.evidence.state])
    }
  }
  return new Map([...states].map(([number, values]) => [number, strongestEvidence(values)]))
}

function lineNumbersForBlock(block: FocusBlock): Set<number> {
  const numbers = new Set<number>()
  for (const range of block.ranges) {
    for (let number = range.start; number <= range.end; number += 1) numbers.add(number)
  }
  return numbers
}

function linesForBlock(frame: SourceFrame, block: FocusBlock): SourceLine[][] {
  return block.ranges.map((range) => frame.lines.filter((line) => line.number >= range.start && line.number <= range.end))
}

function languagePanelHeight(block: FocusBlock, width: number): number {
  const contentWidth = Math.max(10, width - 4)
  const contentHeight = block.language.reduce((total, item) => {
    const alternatives = item.alternatives.length > 0
      ? wrappedHeight(`Instead: ${item.alternatives.join(" · ")}`, contentWidth)
      : 0
    return total
      + wrappedHeight(`${item.token} · ${item.origin}`, contentWidth)
      + wrappedHeight(item.meaning, contentWidth)
      + wrappedHeight(`Why: ${item.why}`, contentWidth)
      + alternatives
      + 1
  }, 0)
  return Math.max(9, contentHeight + 2)
}

function intentPanelHeight(block: FocusBlock, width: number): number {
  const contentWidth = Math.max(10, width - 4)
  const pseudocodeHeight = block.intent.pseudocode.reduce(
    (total, step) => total + wrappedHeight(step, contentWidth),
    0,
  )
  const contentHeight = 1
    + pseudocodeHeight
    + 1
    + 1 + wrappedHeight(block.intent.effect, contentWidth)
    + 1 + wrappedHeight(block.intent.reason, contentWidth)
    + 1 + wrappedHeight(block.intent.removed, contentWidth)
  return Math.max(12, contentHeight + 2)
}

function wrappedHeight(value: string, width: number): number {
  return value.split("\n").reduce((total, paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) return total + 1
    let lines = 1
    let used = 0
    for (const word of words) {
      if (used === 0) {
        lines += Math.floor((word.length - 1) / width)
        used = ((word.length - 1) % width) + 1
      } else if (used + 1 + word.length <= width) {
        used += 1 + word.length
      } else {
        lines += 1 + Math.floor((word.length - 1) / width)
        used = ((word.length - 1) % width) + 1
      }
    }
    return total + lines
  }, 0)
}

function compactName(value: string, width: number): string {
  if (value.length <= width) return value
  return `${value.slice(0, Math.max(1, width - 1))}…`
}

function fileName(path: string): string {
  return path.split("/").at(-1) || path
}
