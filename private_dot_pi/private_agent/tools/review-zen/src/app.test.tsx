import { afterEach, describe, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { resolve } from "node:path"
import { act } from "react"
import { App } from "./app"
import { loadBundle, validateBundle } from "./bundle"
import { testTheme } from "./theme"

const bundle = loadBundle(resolve(import.meta.dir, "../examples/transfer-review.json"))

async function pressKey(setup: { mockInput: { pressKey(key: string): void } }, key: string) {
  await act(async () => {
    setup.mockInput.pressKey(key)
    await Promise.resolve()
  })
}

async function pressTab(setup: { mockInput: { pressTab(): void } }) {
  await act(async () => {
    setup.mockInput.pressTab()
    await Promise.resolve()
  })
}

describe("Review Zen", () => {
  const renderers: Array<{ destroy(): void }> = []

  afterEach(async () => {
    await act(async () => {
      for (const renderer of renderers.splice(0)) renderer.destroy()
      await Promise.resolve()
    })
  })

  test("shows Source, Focus, Language, and Intent together", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    const frame = await setup.waitForFrame((value) =>
      value.includes("SOURCE") &&
      value.includes("FOCUS 1/2") &&
      value.includes("LANGUAGE") &&
      value.includes("INTENT"),
    )

    expect(frame).toContain("TransferController.create/2")
    expect(frame).toContain("Accept and dispatch the request")
    expect(frame).toContain("Elixir map pattern")
    expect(frame).toContain("read the transfer parameters")
  })

  test("moves one focus block and updates both explanations", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "j")
    const frame = await setup.waitForFrame((value) =>
      value.includes("FOCUS 2/2") &&
      value.includes("Elixir tuple pattern") &&
      value.includes("when the transfer succeeds"),
    )

    expect(frame).toContain("Build the success response")
    expect(frame).toContain("status 201")
  })

  test("opens and closes Test Evidence without leaving Source", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "t")
    const open = await setup.waitForFrame((value) => value.includes("TEST EVIDENCE 1/2") && value.includes("moves money and records entries"))
    expect(open).toContain("SOURCE")
    expect(open).toContain("moves money and records entries")

    await pressKey(setup, "t")
    const closed = await setup.waitForFrame((value) => !value.includes("TEST EVIDENCE"))
    expect(closed).toContain("SOURCE")
    expect(closed).toContain("LANGUAGE")
  })

  test("cycles linked tests inside Test Evidence", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "t")
    await setup.waitForFrame((value) => value.includes("TEST EVIDENCE 1/2") && value.includes("moves money and records entries"))
    await pressKey(setup, "]")
    const frame = await setup.waitForFrame((value) => value.includes("TEST EVIDENCE 2/2") && value.includes("does not move money without funds"))

    expect(frame).toContain("SOURCE")
    expect(frame).toContain("failure path")
  })

  test("shows separate source ranges as one focus block", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "n")
    await pressKey(setup, "n")
    const frame = await setup.waitForFrame((value) => value.includes("Connect the transaction to rollback") && value.includes("Repo.rollback(reason)"))

    expect(frame).toContain("Repo.transaction(fn ->")
    expect(frame).toContain("…")
  })

  test("states when a focus block has no linked test evidence", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "n")
    await pressKey(setup, "n")
    await pressKey(setup, "j")
    await setup.waitForFrame((value) => value.includes("Lock both account rows"))
    await pressKey(setup, "t")
    const frame = await setup.waitForFrame((value) => value.includes("No linked test evidence.") && value.includes("This does not prove that the code is untested."))

    expect(frame).toContain("SOURCE")
    expect(frame).toContain("This does not prove that the code is untested.")
    expect(frame).toContain("○")
  })

  test("keeps Delta source lines aligned", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 130, height: 48 })
    renderers.push(setup.renderer)

    const frame = await setup.waitForFrame((value) => value.includes("def create(conn") && value.includes("case Transfers.transfer(params)"))
    const lines = frame.split("\n")
    const definition = lines.find((line) => line.includes("def create(conn"))
    const branch = lines.find((line) => line.includes("case Transfers.transfer(params)"))

    expect(definition).toBeDefined()
    expect(branch).toBeDefined()
    expect(Math.abs(definition!.indexOf("def") - branch!.indexOf("case"))).toBeLessThanOrEqual(4)
  })

  test("stacks details and scrolls to the focused zone on a narrow terminal", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 90, height: 36 })
    renderers.push(setup.renderer)

    await pressTab(setup)
    await pressTab(setup)
    await pressTab(setup)
    const frame = await setup.waitForFrame((value) => value.includes("INTENT") && value.includes("The endpoint cannot start a transfer."))

    expect(frame).toContain("SOURCE")
    expect(frame).toContain("PSEUDOCODE")
  })

  test("shows a clear message when the terminal is too small", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 70, height: 19 })
    renderers.push(setup.renderer)

    const frame = await setup.waitForFrame((value) => value.includes("at least 72×20"))
    expect(frame).toContain("Current: 70×19")
  })

  test("opens the code map without replacing the review page", async () => {
    const setup = await testRender(<App bundle={bundle} theme={testTheme} />, { width: 150, height: 48 })
    renderers.push(setup.renderer)

    await pressKey(setup, "m")
    const frame = await setup.waitForFrame((value) => value.includes("CODE MAP"))

    expect(frame).toContain("SOURCE")
    expect(frame).toContain("create/2")
    expect(frame).toContain("transfers.ex")
  })
})

describe("review bundle validation", () => {
  test("rejects a focus range that has no source line", () => {
    const invalid = structuredClone(bundle) as unknown as Record<string, any>
    invalid.stops[0].focusBlocks[0].ranges = [{ start: 999, end: 999 }]

    expect(() => validateBundle(invalid)).toThrow("references missing source line 999")
  })

  test("rejects source lines that are not in source order", () => {
    const invalid = structuredClone(bundle) as unknown as Record<string, any>
    const lines = invalid.frames[0].lines
    ;[lines[0], lines[1]] = [lines[1], lines[0]]

    expect(() => validateBundle(invalid)).toThrow("must be greater than the previous source line")
  })

  test("rejects a linked test when evidence is unlinked", () => {
    const invalid = structuredClone(bundle) as unknown as Record<string, any>
    const block = invalid.stops
      .flatMap((stop: Record<string, any>) => stop.focusBlocks)
      .find((focusBlock: Record<string, any>) => focusBlock.evidence.state === "unlinked")
    block.evidence.testIds = [invalid.tests[0].id]

    expect(() => validateBundle(invalid)).toThrow("unlinked evidence must not link a test")
  })
})
