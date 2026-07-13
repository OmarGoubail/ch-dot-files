# Pi Reset Checklist

## Baseline and ownership

- [x] Start normal sessions with the configured active account profile.
- [x] Remove the presentation-only Snake extension.
- [x] Commit a clean baseline before the larger reset.
- [x] Keep FFF as the owner of `find`, `grep`, and file autocomplete.
- [x] Keep Hashline responsible only for `read` and `edit`.

## Core configuration

- [x] Replace `personas.ts` with the small `profiles.ts` account manager.
- [x] Keep `work` and `personal` profiles.
- [x] Store each profile's model, thinking level, and subagent model/thinking policies.
- [x] Add `/profile status` with model availability/auth diagnostics.
- [x] Remove persona prompt injection and model-family prompt selection.
- [x] Remove obsolete orchestrator prompt variants and custom `oracle.md`.
- [x] Use `pi-subagents` built-in agents with profile-driven overrides.
- [x] Use built-in `scout`, `worker`, `reviewer`, and `oracle`; remove redundant custom agents.

## Dannote adoption

- [x] Adopt Dannote's core extensions as a coherent package.
- [x] Adopt Dannote's workflow shortcuts supplied by the package.
- [x] Add `plan-mode` as an optional extension.
- [x] Add Dannote Oracle with a safer review context preset.
- [x] Add Critic as an optional extension; configure conservative triggers after runtime testing.
- [x] Add a small audited set of model-aware rules.
- [x] Avoid duplicate websearch tools because `pi-web-access` already covers them.

## Tools and context

- [x] Add `pi-hashline-edit` with `grep: false`.
- [x] FFF is installed and working.
- [x] Add FFF and Hashline package declarations to chezmoi.
- [x] FFF uses override mode via shell environment.
- [x] Add the `pi-context` package declaration for later evaluation.
- [x] Add published `pi-btw` for isolated side conversations.
- [x] Keep Hunk as the visual review surface and retain `hunk-review` annotations.

## Skills

- [x] Add selected Matt Pocock skills as local reproducible skills.
- [x] Add `grilling`, `tdd`, `code-review`, `diagnosing-bugs`, `research`, and `handoff` skills.
- [x] Keep architecture/domain skills user-invoked.
- [x] Collapse Elixir review into `elixir-pr-review` with internal baseline correctness, Phoenix/LiveView, data/deploy, testing, security, contracts/maintainability/history, and Jump routing sections; retain memory and code-quality helpers.
- [x] Remove redundant focused Elixir review skills; use `jump-elixir-review` only as the optional Jump overlay.

## Safety and workflows

- [ ] Enable and test GitHub/external-write guards.
- [x] Keep `rm-guard`.
- [x] Add compact commit/review/retry workflows via the Dannote package and local `/review` prompt.
- [ ] Keep MCP instructions short and task-scoped.
- [ ] Test normal coding, exploration, Elixir work, review, Oracle, side questions, and profile switching.

## Verification

- [ ] Validate all JSON and package manifests.
- [ ] Run `chezmoi diff` before applying each coherent phase.
- [ ] Confirm FFF owns `grep` after Hashline installation.
- [ ] Confirm both account profiles expose and authenticate their configured models.
- [ ] Measure startup time and prompt/system size before and after.
- [ ] Remove unused packages/extensions only after representative task testing.

## Reset note

- Chēzmoi apply has not been run; these are source-side changes only.
