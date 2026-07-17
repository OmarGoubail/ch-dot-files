#!/usr/bin/env python3
"""Render an explain-diff content spec as a self-contained HTML page."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import random
import re
from pathlib import Path

CSS = r"""
  :root {
    --bg: #fafaf8; --fg: #1a1a1a; --accent: #b5541f; --muted: #6b6b6b;
    --code-bg: #282c34; --code-fg: #e6e6e6; --callout-bg: #fff4e8; --border: #e0ddd6;
  }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: var(--bg); color: var(--fg);
    max-width: 820px; margin: 0 auto; padding: 2rem 1.5rem 6rem; line-height: 1.65; }
  h1 { font-size: 1.9rem; border-bottom: 3px solid var(--accent); padding-bottom: .5rem; }
  h2 { font-size: 1.4rem; margin-top: 3rem; color: var(--accent); }
  h3 { font-size: 1.1rem; margin-top: 1.8rem; }
  a { color: var(--accent); }
  code { font-family: 'SF Mono', Consolas, monospace; background: #eee; padding: .1rem .3rem; border-radius: 3px; font-size: .92em; }
  pre { background: var(--code-bg); color: var(--code-fg); padding: 1rem 1.2rem; border-radius: 8px;
    overflow-x: auto; white-space: pre-wrap; font-family: 'SF Mono', Consolas, monospace; font-size: .88rem; line-height: 1.5; }
  pre code { background: none; padding: 0; color: inherit; }
  .callout { background: var(--callout-bg); border-left: 4px solid var(--accent); padding: .9rem 1.2rem;
    border-radius: 0 6px 6px 0; margin: 1.2rem 0; }
  .toc { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.5rem; margin: 1.5rem 0; }
  .toc a { text-decoration: none; }
  .toc ul { margin: .3rem 0; }
  .diagram { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 1.2rem;
    margin: 1.2rem 0; font-family: 'SF Mono', Consolas, monospace; font-size: .85rem; }
  .flow { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; justify-content: center; padding: .5rem 0; }
  .box { border: 2px solid var(--accent); border-radius: 8px; padding: .6rem 1rem; background: #fdf6ee; text-align: center; min-width: 120px; }
  .box.fail { border-color: #b91c1c; background: #fef2f2; }
  .arrow { font-size: 1.4rem; color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem; }
  th, td { border: 1px solid var(--border); padding: .5rem .7rem; text-align: left; }
  th { background: #f0ede6; }
  .quiz-q { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 1.2rem 1.5rem; margin: 1.2rem 0; }
  .quiz-opt { display: block; width: 100%; text-align: left; padding: .6rem 1rem; margin: .4rem 0;
    border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer; font-family: inherit; font-size: .95rem; }
  .quiz-opt:hover, .quiz-opt:focus-visible { background: #f5f2ec; outline: 2px solid var(--accent); outline-offset: 2px; }
  .quiz-opt.selected { border-width: 2px; }
  .feedback { display: none; margin-top: .6rem; padding: .6rem 1rem; border-radius: 6px; font-size: .9rem; }
  .feedback.correct { background: #ecfdf3; color: #166534; border-left: 3px solid #16a34a; }
  .feedback.incorrect { background: #fef2f2; color: #991b1b; border-left: 3px solid #dc2626; }
  @media (max-width: 600px) { body { padding: 1rem; } .flow { flex-direction: column; } }
"""

QUIZ_JS = r"""
(() => {
  document.querySelectorAll('.quiz-q').forEach((question) => {
    const options = [...question.querySelectorAll('.quiz-opt')];
    options.forEach((option) => option.addEventListener('click', () => {
      options.forEach((item) => {
        item.disabled = true;
        item.classList.toggle('selected', item === option);
      });
      const correct = option.dataset.correct === 'true';
      const feedback = question.querySelector('.feedback');
      feedback.className = `feedback ${correct ? 'correct' : 'incorrect'}`;
      feedback.replaceChildren();
      feedback.append(document.createTextNode(`${correct ? '✅ Correct.' : '❌ Not quite.'} ${option.dataset.explanation}`));
      if (!correct) {
        const answer = options.find((item) => item.dataset.correct === 'true');
        const label = document.createElement('strong');
        label.textContent = ' Best answer: ';
        feedback.append(label, document.createTextNode(answer.textContent));
      }
      feedback.style.display = 'block';
    }));
  });
})();
"""

SCHEMA = """
{
  "title": "A short page title",
  "subtitle": "Optional context",
  "slug": "optional-file-slug",
  "sections": [
    {"id": "background", "heading": "Background", "html": "<p>...</p>"},
    {"id": "intuition", "heading": "Intuition", "html": "<p>...</p>"},
    {"id": "code", "heading": "Code walkthrough", "html": "<pre><code>...</code></pre>"}
  ],
  "quiz": [
    {
      "question": "Why does the changed behavior matter?",
      "options": [
        {"text": "A plausible answer.", "correct": false, "explanation": "This would be true only under the old path."},
        {"text": "The answer supported by the inspected code.", "correct": true, "explanation": "The new path establishes this behavior."}
      ]
    }
  ]
}
"""


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "explanation"


def stable_seed(spec: dict) -> int:
    payload = json.dumps(spec, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def validate_quiz(quiz: list[dict]) -> None:
    if len(quiz) != 5:
        raise ValueError(f"quiz must contain exactly five questions, got {len(quiz)}")
    for index, question in enumerate(quiz, start=1):
        options = question.get("options", [])
        correct = [option for option in options if option.get("correct") is True]
        if len(options) < 2:
            raise ValueError(f"quiz question {index} needs at least two options")
        if len(correct) != 1:
            raise ValueError(f"quiz question {index} must have exactly one correct option")
        if any(not option.get("explanation") for option in options):
            raise ValueError(f"quiz question {index} needs an explanation for every option")


def ordered_options(quiz: list[dict], seed: int) -> list[list[dict]]:
    rng = random.Random(seed)
    positions_by_count: dict[int, list[int]] = {}
    for question in quiz:
        count = len(question["options"])
        if count not in positions_by_count:
            positions_by_count[count] = list(range(count))
            rng.shuffle(positions_by_count[count])

    ordered: list[list[dict]] = []
    seen_by_count: dict[int, int] = {}
    for question in quiz:
        options = list(question["options"])
        correct = next(option for option in options if option["correct"] is True)
        distractors = [option for option in options if option is not correct]
        rng.shuffle(distractors)
        count = len(options)
        question_index = seen_by_count.get(count, 0)
        target = positions_by_count[count][question_index % count]
        seen_by_count[count] = question_index + 1
        result = distractors[:]
        result.insert(target, correct)
        ordered.append(result)
    return ordered


def render(spec: dict) -> str:
    sections = spec.get("sections", [])
    quiz = spec.get("quiz", [])
    validate_quiz(quiz)
    if not sections:
        raise ValueError("sections must not be empty")

    toc_items = "\n".join(
        f'  <li><a href="#{html.escape(section["id"], quote=True)}">'
        f'{html.escape(section["heading"])}</a></li>'
        for section in sections
    )
    toc_items += '\n  <li><a href="#quiz">Quiz</a></li>'
    body_sections = "\n\n".join(
        f'<h2 id="{html.escape(section["id"], quote=True)}">'
        f'{html.escape(section["heading"])}</h2>\n{section["html"]}'
        for section in sections
    )

    quiz_blocks = []
    for question, options in zip(quiz, ordered_options(quiz, stable_seed(spec)), strict=True):
        option_blocks = []
        for option in options:
            text = html.escape(str(option["text"]))
            explanation = html.escape(str(option["explanation"]))
            correct = "true" if option["correct"] else "false"
            option_blocks.append(
                f'<button class="quiz-opt" data-correct="{correct}" '
                f'data-explanation="{explanation}">{text}</button>'
            )
        quiz_blocks.append(
            '<article class="quiz-q">\n'
            f'<p><strong>{html.escape(str(question["question"]))}</strong></p>\n'
            + "\n".join(option_blocks)
            + '\n<div class="feedback" role="status" aria-live="polite"></div>\n</article>'
        )
    quiz_html = '<h2 id="quiz">Quiz</h2>\n\n' + "\n\n".join(quiz_blocks)

    title = html.escape(str(spec["title"]))
    subtitle = spec.get("subtitle")
    subtitle_html = (
        f'<p style="color:var(--muted); margin-top:-.5rem;">{html.escape(str(subtitle))}</p>'
        if subtitle
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body>
<h1>{title}</h1>
{subtitle_html}
<div class="toc">
<strong>Contents</strong>
<ul>
{toc_items}
</ul>
</div>
{body_sections}
{quiz_html}
<script>{QUIZ_JS}</script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", nargs="?", type=Path, help="path to a JSON content spec")
    parser.add_argument("-o", "--output", type=Path, help="specific output HTML path")
    parser.add_argument("--help-schema", action="store_true", help="print the JSON schema example")
    args = parser.parse_args()
    if args.help_schema:
        print(SCHEMA.strip())
        return
    if args.spec is None:
        parser.error("spec is required unless --help-schema is used")

    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    output = args.output or Path(
        f"/tmp/{dt.date.today():%Y-%m-%d}-explanation-"
        f"{slugify(spec.get('slug') or spec['title'])}.html"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render(spec), encoding="utf-8")
    print(output.resolve())


if __name__ == "__main__":
    main()
