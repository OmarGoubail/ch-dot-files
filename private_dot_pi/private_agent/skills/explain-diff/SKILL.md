---
name: explain-diff
description: Explain a code change, diff, branch, or pull request clearly and teach the reader how and why it works. Use when the user wants a guided Markdown explanation with examples, trade-offs, and a quiz.
---

# Explain Diff

Teach the reader how a specified code change works. The explanation should help them review, maintain, and extend the change—not merely paraphrase the diff.

## Workflow

1. Establish the source of truth. Identify the requested diff, branch, commit range, pull request, or files. If it is ambiguous, infer the most likely target from the checkout and state the assumption briefly.
2. Explore the surrounding system before explaining it. Read relevant callers, tests, data models, configuration, routes, documentation, and previous behavior. Trace the old and new paths far enough to explain observable behavior and contracts.
3. Build the narrative before writing:
   - what problem or constraint motivated the change;
   - how the old system behaved;
   - the smallest useful mental model of the new behavior;
   - how the implementation realizes that model;
   - edge cases, trade-offs, and consequences for callers or operators.
4. Present the explanation in Markdown using the structure below. Prefer conceptual groups ordered by execution or dependency flow over arbitrary file order.
5. Finish with a guided quiz. Ask one question at a time if the user wants to be tested interactively; otherwise include all five questions and wait for the reader's answers before revealing the solutions.

## Required structure

- **Summary** — one paragraph stating the change and why it matters.
- **Background** — begin with an optional beginner-friendly mental model, then narrow to the exact components, contracts, and prior behavior involved.
- **Intuition** — explain the core idea before implementation detail. Use small toy inputs and outputs, and compare old and new behavior when useful.
- **Code walkthrough** — group changes by responsibility or flow. Cite file paths and line numbers when available, but do not dump the whole diff.
- **Behavior and trade-offs** — cover failure modes, edge cases, compatibility, performance, security, and operational consequences that the inspected code supports.
- **Quiz** — exactly five medium-difficulty multiple-choice questions about behavior, causality, contracts, edge cases, or trade-offs. Avoid gotchas and trivia.

Use tables for compact comparisons and Mermaid only when the surrounding interface renders it reliably; otherwise use Markdown lists and prose. Never use ASCII-art diagrams. Distinguish observed facts from interpretation, and do not claim behavior that was not supported by the inspected source.

## Quiz quality

Treat the quiz as part of the teaching, not decoration:

- Write plausible distractors based on real misunderstandings of the change.
- Keep every option comparable in length, grammar, specificity, and confidence. The correct answer must not be recognizable because it is longer or more qualified.
- Vary the correct-answer position deliberately across the five questions. Do not habitually put it first, second, or last.
- Do not use “all of the above,” “none of the above,” joke answers, or answers that can be guessed from wording alone.
- If quizzing interactively, do not reveal the answer until the reader responds. Then explain why it is correct and, when useful, name the misconception behind the selected distractor.
- If writing all questions at once, put answers in a separate **Solutions** section after the questions rather than immediately after each option.

## Writing style

Use plain, precise systems-oriented prose with smooth transitions and concrete examples. Explain jargon on first use. Be concise where the change is simple and deep where the reader needs a mental model. Do not turn the response into a file-by-file changelog.
