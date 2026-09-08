# Review Zen

Review Zen is a guided TUI for code changes. Source stays visible. The active Focus Block controls the Language, Intent, and Test Evidence sections.

## Run the demo

```sh
bun install
bun run start
```

After chezmoi applies the tool, run:

```sh
review-zen --demo
review-zen --demo-ui
review-zen path/to/review.json
cat path/to/review.json | review-zen -
review-zen --check path/to/review.json
```

Review Zen reads `~/.pi/agent/themes/theme-current.json`. Use `--theme path/to/theme.json` to select another compatible Pi theme.

## Keys

| Key | Action |
|---|---|
| `n` / `p` | Move to the next or previous Review Stop |
| `j` / `k` | Move to the next or previous Focus Block |
| `Tab` / `Shift-Tab` | Focus one zone and dim the other zones |
| `Esc` | Show all zones |
| `t` | Open or close Test Evidence |
| `[` / `]` | Move between linked tests |
| `d` | Open the full diff in Delta |
| `m` | Open or close the code map |
| `q` | Quit |

## Evidence markers

- `●` — a test check observes the behavior.
- `◐` — a test runs the path but does not check its result directly.
- `○` — the review bundle has no linked test evidence.
- `?` — the relation was not analyzed.

The `○` marker does not prove that code has no test. See [FORMAT.md](FORMAT.md) for the bundle format.
