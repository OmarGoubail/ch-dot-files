---
name: explain-diff-html
description: Create a rich, self-contained interactive HTML explanation of a code change, diff, branch, or pull request, saved as a dated file outside the repository.
---

# Explain Diff HTML

Produce a single long-form HTML page that teaches a reader how a specified code change works. Investigate the surrounding system before explaining the diff: the page should make sense to a beginner while still giving an experienced engineer a concise path through the changed behavior.

## Workflow

1. Identify the change and its scope from the current checkout, diff, branch, PR metadata, or user-supplied files. If the target is ambiguous, infer the most likely change and state the assumption in the page.
2. Explore relevant surrounding code, tests, configuration, callers, data models, and documentation. Trace the old and new paths far enough to explain behavior, not merely file-by-file edits. Prefer checked-in examples and tests over speculation.
3. Build a narrative before writing:
   - what problem or constraint motivated the change;
   - how the old system behaved;
   - the smallest useful mental model of the new behavior;
   - how the implementation realizes that model;
   - edge cases, trade-offs, and observable consequences.
4. Write a JSON content spec and render it with the bundled `render.py` beside this skill:

   ```sh
   python ~/.pi/agent/skills/explain-diff-html/render.py /path/to/spec.json
   ```

   The renderer owns the repeated page scaffold, CSS, JavaScript, table of contents, deterministic quiz ordering, and dated `/tmp/YYYY-MM-DD-explanation-<slug>.html` output. Write the content, not a new copy of the scaffold. Use `--help-schema` for the exact JSON example and `--output` when a specific path is needed.
5. Validate the generated artifact before handing it off: confirm it exists, is a complete HTML document, has no external asset dependencies, contains five quiz questions, and includes working quiz feedback. Check that code examples use `<pre><code>...</code></pre>` and that `pre` CSS explicitly preserves whitespace. If practical, open the local file in a browser or use a local HTML inspection tool.
6. Return the exact absolute path as a clickable local-file link.

## Required page structure

The content spec must include a clear title, a short summary, and sections in this order:

1. **Background** — an optional beginner-friendly mental model, followed by the exact components, contracts, and prior behavior involved.
2. **Intuition** — the core idea before implementation detail, with small concrete toy inputs and outputs.
3. **Code** — a high-level walkthrough grouped by execution or dependency flow, with precise file and line references when available.
4. **Quiz** — exactly five medium-difficulty interactive multiple-choice questions.

Use smooth, plain-language systems prose. Do not use top-level tabs; make it one continuous page. Use callouts for definitions, invariants, important edge cases, and practical consequences.

## Diagrams and examples

Use a small, reusable set of semantic HTML/CSS diagram patterns rather than ornamental graphics. The bundled renderer supports `.diagram`, `.flow`, `.box`, `.box.fail`, `.arrow`, `.callout`, and normal tables. Use:

- flow diagrams for requests, data, or control flow;
- before/after panels for changed behavior;
- labeled component cards for system boundaries;
- compact tables for mappings, invariants, and toy data.

Never use ASCII diagrams. Label arrows and include example values whenever a diagram describes data movement. Add a caption or accessible text so the explanation does not depend on visual inspection.

## Quiz quality rules

The renderer randomizes option order deterministically from the content, independently for each question, and balances correct-answer positions as evenly as possible. List options in the order that reads naturally; do not try to manually vary positions. Each question must have exactly one `correct: true` option and each option should include an explanation suitable for immediate feedback.

Before rendering:

- Keep options comparable in length, grammar, specificity, and confidence. The correct option must not be conspicuously longer, more qualified, or more technical than distractors.
- Make every distractor plausible and tied to a real misunderstanding of the change.
- Ask about behavior, causality, contracts, edge cases, or trade-offs—not trivia or copied phrases.
- Ensure feedback explains why the selected answer is correct or incorrect and points back to the relevant behavior or code path.

The renderer keeps correctness in data attributes and reveals feedback only after selection. Do not add visible labels, source-order hints, titles, or styling that reveal the answer before a click.

## HTML and safety constraints

- Escape code-derived text in JSON strings and use valid JSON. Section `html` fields are intentionally raw HTML; do not put untrusted secrets or executable content in them.
- Use `<pre><code>...</code></pre>` for code blocks. The renderer's `pre` rule includes `white-space: pre-wrap`, but verify it in the output before delivery.
- Keep diagrams, CSS, and JavaScript dependency-free. Do not reference external fonts, CDNs, images, packages, or network resources.
- Include visible focus states and sufficient contrast. Do not make correctness depend on color alone.
- Do not claim behavior that the inspected source does not support. Distinguish observed facts from reasonable interpretation.
