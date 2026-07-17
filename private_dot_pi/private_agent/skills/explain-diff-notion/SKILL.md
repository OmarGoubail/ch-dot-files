---
name: explain-diff-notion
description: Create a rich Notion page that explains and quizzes the reader about a code change, diff, branch, or pull request.
---

# Explain Diff Notion

Create a Notion page that teaches a reader how a specified code change works. The result should be useful both as a review aid and as a durable explanation someone can revisit later.

## Workflow

1. Identify the change and its scope from the current checkout, diff, branch, PR metadata, or user-supplied files. If the target is ambiguous, infer the most likely change and state the assumption on the page.
2. Explore relevant surrounding code, tests, configuration, callers, data models, and documentation. Trace old and new paths far enough to explain observable behavior and contracts. Prefer checked-in examples and tests over speculation.
3. Build the narrative before creating the page:
   - what problem or constraint motivated the change;
   - how the old system behaved;
   - the smallest useful mental model of the new behavior;
   - how the implementation realizes that model;
   - edge cases, trade-offs, and consequences for callers or operators.
4. Use the configured Notion MCP tools to create one new page, populate it, and return its URL. Inspect the available MCP tool schema first if the exact tool names or block format are unclear. Do not overwrite an existing page unless the user explicitly asks.
5. If Notion tools are unavailable or unauthenticated, say so plainly and provide a complete Notion-ready Markdown version in the response instead of pretending the page was created.

## Required page structure

Use these top-level sections in this order:

1. **Summary** — one paragraph stating the change and why it matters.
2. **Background** — an optional beginner-friendly mental model, then the exact components, contracts, and prior behavior involved.
3. **Intuition** — the core idea before implementation detail, with small concrete toy inputs and outputs.
4. **Code walkthrough** — conceptual groups ordered by execution or dependency flow, with file and line references when available. Do not paste the whole diff.
5. **Behavior and trade-offs** — failure modes, edge cases, compatibility, performance, security, and operational consequences supported by the inspected source.
6. **Quiz** — exactly five medium-difficulty multiple-choice questions.

Use Notion headings, paragraphs, code blocks, numbered and bulleted lists, tables where they clarify a comparison, callouts for definitions/invariants/edge cases, and synced or ordinary blocks only when appropriate. Use divider blocks sparingly. Keep the page one continuous document; do not create top-level tabs or unrelated child pages.

## Diagrams and examples

Use a small, reusable set of Notion-friendly diagrams:

- tables for before/after behavior and toy data;
- labeled callout or column blocks for component boundaries;
- numbered lists for flows and execution order;
- Mermaid or image blocks only when the available Notion integration supports them reliably.

Never use ASCII-art diagrams. Include example values whenever a diagram describes data movement. Add a short textual explanation so the page remains understandable if a visual block does not render.

## Quiz quality rules

Each question must have comparable multiple-choice options and an explanation for every option. Represent each question's answer choices as separate Notion toggle blocks nested under the question. A toggle's body should say either why the choice is correct or why it is not, and should reference the relevant behavior or code path.

Before creating the page:

- Randomize the visible option order independently for each question using a deterministic per-page seed or another reproducible method. Do not rely on habitual authoring order.
- Balance correct-answer positions across the five questions as evenly as possible.
- Keep options comparable in length, grammar, specificity, and confidence. Never make the correct answer the longest or most qualified by construction.
- Make distractors plausible and tied to real misunderstandings. Avoid joke answers, “all/none of the above,” gotchas, and trivia.
- Ask about behavior, causality, contracts, edge cases, or trade-offs.
- Do not reveal the answer in the question text, toggle title, emoji, ordering, or pre-toggle styling. The explanation belongs inside the toggle and is revealed when opened.

If the MCP API cannot express nested toggles directly, use the closest supported toggle/block representation and preserve the same nesting and explanation semantics. Do not claim a toggle is interactive if the created integration only supports plain text.

## Writing style

Use plain, precise systems-oriented prose with smooth transitions. Explain jargon on first use. Distinguish observed facts from interpretation, and do not claim behavior that was not supported by the inspected source. Return the new page URL prominently after creation.
