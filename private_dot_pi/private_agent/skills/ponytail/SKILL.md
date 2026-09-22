---
name: ponytail
description: >
  Simplify code without weakening its contract. Use when the user asks for the
  simplest implementation, flags over-engineering or unnecessary dependencies,
  requests a simplification review, or explicitly invokes ponytail.
license: MIT; see LICENSE
---

# Ponytail

Prefer the smallest clear solution that satisfies the actual requirements.
Optimize for code that is easy to understand and maintain, not line count.
Apply this skill to the current task only; project conventions and explicit
requirements remain authoritative.

## Understand before simplifying

Read the relevant code and tests and trace the affected flow before editing.
For a bug, inspect callers and identify the shared cause rather than patching
only the reported symptom. Finish this step when you can name the behavior to
preserve, the failure to fix, and the appropriate place to change it.

## The ladder

Stop at the first option that meets the requirements and fits the codebase:

1. **Is it necessary?** Skip speculative machinery for hypothetical future needs.
2. **Does it already exist here?** Reuse an appropriate helper, component, or local pattern.
3. **Does the standard library cover it?** Prefer it to custom machinery.
4. **Does the platform provide it?** Consider native inputs, CSS, or database constraints before building replacements.
5. **Does an installed dependency solve it?** Use its supported API before adding another dependency.
6. **Otherwise, implement the smallest clear solution.** Introduce abstractions only for a concrete responsibility or demonstrated reuse.

Evaluate candidates against required behavior, edge cases, and existing
contracts. A shorter implementation that changes those contracts is not an
acceptable simplification. Clarify consequential ambiguity; do not silently
substitute a smaller feature for the requested one.

## Implement and verify

- Keep the diff focused. Remove obsolete code made unnecessary by the change;
  leave unrelated refactors alone.
- Preserve trust-boundary validation, authorization, data-loss protections,
  error handling, accessibility, and required performance characteristics.
- Prefer readable control flow and useful module boundaries over compressed
  one-liners or minimizing the number of files.
- Explain a non-obvious trade-off only when it matters, using the project's
  comment/documentation conventions rather than branded annotations.
- Use the project's existing test framework and fixtures. Add regression tests
  for changed behavior and meaningful failure paths; coverage follows risk,
  not a fixed test-count limit.
- Inspect the diff and run the relevant checks. Report what passed and what
  remains unverified. A smaller diff is not evidence of correctness.

For a review-only request, report actionable simplifications with file/line
context, the simpler alternative, and the behavior it must preserve. Do not
apply changes unless requested. For implementation, summarize the result and
validation concisely; provide a full explanation when the user asks for one.
