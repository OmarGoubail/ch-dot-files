# Review bundle format

`review-zen` reads one JSON file. The file is a stable snapshot. It must not depend on the current working tree.

## Top level

```json
{
  "schemaVersion": 1,
  "title": "Add safe account transfers",
  "diff": ["diff --git ..."],
  "codeMap": [],
  "tests": [],
  "frames": [],
  "stops": []
}
```

Store diff and code content as arrays of lines. Do not include newline characters in the array items.

## Source Frame

A Source Frame has a unique `id`, a repository-relative `file`, a `symbol`, a focused unified `diff`, and post-change source `lines`.

```json
{
  "id": "transfers-execute",
  "file": "lib/shop/transfers.ex",
  "symbol": "Transfers.execute/1",
  "highlightAs": "heex",
  "diff": ["diff --git ...", "@@ ...", "+defp execute(command) do"],
  "lines": [
    {"number": 22, "text": "  defp execute(command) do"}
  ]
}
```

Use enough context to show the complete changed function. Put source lines in ascending order. Each line number must be unique in its frame.

Use `"highlightAs": "heex"` for a Source Frame that primarily contains a HEEx template. Review Zen uses an HTML-EEx syntax grammar for that frame.

## Review Stop and Focus Block

A Review Stop names one behavior and one scenario. `sourceFrameId` selects its Source Frame. Order the Focus Blocks by their first source range.

A Focus Block can use more than one range. Use this for code that must be read as one unit.

```json
{
  "id": "domain-failure",
  "title": "Reject an unsafe transfer",
  "scenario": "insufficient funds",
  "sourceFrameId": "transfers-execute",
  "focusBlocks": [
    {
      "id": "atomic-rollback",
      "title": "Connect the transaction to rollback",
      "ranges": [
        {"start": 23, "end": 23},
        {"start": 30, "end": 31}
      ],
      "language": [],
      "intent": {
        "pseudocode": ["open one transaction", "roll back every write on error"],
        "effect": "One error cancels all writes from this transfer.",
        "reason": "A rejected transfer must leave the database unchanged.",
        "removed": "An error can leave partial data."
      },
      "visuals": [
        {
          "kind": "flow",
          "title": "Event flow",
          "lines": ["submit → handle_event → assign → DOM patch"]
        }
      ],
      "evidence": {
        "state": "asserted",
        "testIds": ["insufficient-funds"]
      }
    }
  ]
}
```

Each Language item has `token`, `origin`, `meaning`, `why`, and `alternatives`. Use short ASD-STE100-style sentences. Define unfamiliar language before you use it.

## Test Evidence

Test Evidence contains the test source and a plain behavior analysis.

```json
{
  "id": "insufficient-funds",
  "kind": "integration",
  "title": "does not move money without funds",
  "scenario": "failure path",
  "file": "test/shop_web/controllers/transfer_controller_test.exs",
  "startLine": 17,
  "code": ["test ... do", "  ...", "end"],
  "setup": ["Create a sender with $10.00."],
  "action": "Request a transfer of $25.00.",
  "checks": ["Both balances stay unchanged."],
  "limits": ["It does not test concurrent transfers."]
}
```

Use `unit`, `integration`, `server-dom`, `browser`, or `visual` for `kind`. A server DOM test does not prove browser JavaScript, focus, CSS, or responsive layout.

A Focus Block can include `visuals`. Each visual has a `kind` of `structure`, `flow`, or `state`, a short title, and an array of display lines.

Use these evidence states:

- `asserted`: a test check observes the behavior.
- `exercised`: a test runs the path but does not check its result directly.
- `unlinked`: the bundle has no linked test.
- `unknown`: the relation was not analyzed.

An `asserted` or `exercised` Focus Block must link at least one Test Evidence ID. An `unlinked` or `unknown` Focus Block must not link a test. Do not use `unlinked` to claim that no test exists.
