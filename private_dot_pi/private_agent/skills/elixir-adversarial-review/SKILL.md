---
name: elixir-adversarial-review
description: Applies a skeptical second-pass Elixir/Phoenix review lens that challenges happy-path assumptions, validates reviewer findings, and looks for overlooked blockers in a fresh or parallel context.
---

# Elixir Adversarial Review

Use this skill for a second-pass skeptical review of Elixir/Phoenix diffs, especially risky PRs, large changes, security-sensitive code, deploy-sensitive work, or cases where the initial review may have been too trusting.

## Review Contract

Ask: **What would break if the author's and first reviewer's assumptions are wrong?**

This is not a debate framework or multi-model protocol. It is a disciplined adversarial lens that can be run in fresh context or parallel with other review skills. It should challenge conclusions with code evidence, not contrarian speculation.

## Posture

Be skeptical of:

- Happy-path-only reasoning.
- Claims not backed by files, tests, or commands.
- Hidden caller assumptions.
- UI-only guards.
- Migrations that assume instant deploys.
- Retried jobs that assume exactly-once execution.
- Tests that mirror implementation but miss behavior.

Be fair:

- Drop suspicions disproven by code.
- Do not penalize established local patterns.
- Do not report style differences as adversarial findings.
- Prefer one strong finding over many weak concerns.

## Evidence Rules

1. Read the diff and the full files for any suspected issue.
2. Trace at least one concrete failure path before reporting.
3. Try to falsify your own finding by searching for guards, tests, policies, constraints, and downstream checks.
4. Distinguish introduced blockers from pre-existing risks.
5. If another reviewer found an issue, independently verify it before accepting or rejecting it.

## Scope Triggers

| Change type | Adversarial questions |
| --- | --- |
| Auth/tenant data | Can another user/account reach it by ID or URL? |
| LiveView UI | Can direct navigation bypass hidden buttons? |
| Migrations/deploy | What happens during rolling deploy or rollback? |
| Jobs/external side effects | What happens on retry, timeout, duplicate delivery? |
| Logging-only payload construction | Is payload construction pure, cheap, and gated when logging is disabled? |
| Tests | What important failure path remains untested? |
| Refactors | Did behavior accidentally change at a boundary? |
| Public APIs | Which callers assume old return shapes? |
| Generated code | What complexity hides the real invariant? |

## Fresh-Context Use

This skill is especially useful when invoked in a fresh review context:

- Do not inherit the first reviewer's conclusions as truth.
- Start from the diff and user request.
- Form independent hypotheses.
- Compare only after you have inspected the relevant code.
- When reviewing another agent's findings, verify each one from source before agreeing.

## Skeptical Pass Checklist

### 1. Boundary Attacks

- Can params, session, socket assigns, headers, uploaded files, webhook payloads, or queue args be attacker-controlled?
- Are IDs scoped before data is returned, rendered, mutated, or subscribed to?
- Are route params and LiveView actions authorized on direct navigation?
- Are API response shapes still compatible with clients?

### 2. State and Time

- What happens if two requests/jobs/events run concurrently?
- What happens if a job retries after partial success?
- What happens if the process crashes between DB write and side effect?
- Does state survive reconnects, remounts, deploys, and rollbacks?
- Are time zones, date boundaries, and stale assigns considered where relevant?

### 3. Data Integrity

- Are multi-step writes transactional when they must be atomic?
- Are database constraints backing application validations?
- Can duplicate events create duplicate rows or external actions?
- Do queries preload what templates/functions assume?
- Does nil/empty handling hide data loss or bad inputs?

### 4. Deploy and Operations

- Can old and new code run against the same data during rolling deploy?
- Are new env vars, queues, capabilities, flags, and registries present before code uses them?
- Can migrations lock or rewrite hot tables?
- Are logs and errors useful without leaking secrets?
- For "logging-only" changes, does constructing the payload perform expensive work, execute prompts/business logic, touch external services, or mutate state before confirming the log will be emitted?
- Is best-effort `rescue` isolated to persistence/emit boundaries, rather than swallowing failures in core payload construction, prompt execution, authorization, or data shaping?

### 5. Tests and Checks

- Do tests cover the risk, or only the happy path?
- Are negative auth, unauthorized tenant, retry, and invalid input cases missing where risk is high?
- Did targeted checks actually run, or were they assumed?
- Are assertions broad enough to catch behavior, not just implementation details?

## Finding Validation

Before reporting a finding, answer:

1. What exact input, state, or deployment sequence triggers it?
2. What code path proves it?
3. What existing guard/test/constraint did I check for?
4. Is it introduced or worsened by the change?
5. What minimal fix would remove the risk?

If you cannot answer these, keep it as an internal suspicion or an observation, not a blocker.

## Reviewing Other Reviewers

When asked to assess previous findings:

- Re-read the cited file and line.
- Verify whether the alleged path is reachable.
- Check for compensating controls in callers, plugs, policies, migrations, DB constraints, or tests.
- Preserve severity only when impact is proven.
- Explicitly mark false positives and explain the code evidence.
- Merge duplicate findings that describe the same root cause.

## Output Guidance

Use the main reviewer output format. Findings should be few and high-signal:

- `[blocking]` for verified issues that can break correctness, security, deploy safety, data integrity, or required behavior.
- `[observation]` for plausible but non-blocking risks, missing hardening, or follow-up tests.

Include the adversarial angle in each finding: the assumption being challenged, the failure path, and the evidence that makes it real.
