# Resume Assistant

A local-first agent skill that generates a JD-tailored PDF resume from your code, job descriptions, and business context.

## What it does

1. **Intake** — collects the JD, your local project path, and any existing resume
2. **Code extraction** — reads your code as *leads*, extracting candidate technical points
3. **Endorsement** — cross-examines you on each point: "did you actually do this?"
4. **JD-tailored rewrite** — rewrites your experience against the JD, under three hard constraints
5. **Review** — shows you the draft with boundaries called out
6. **Render** — outputs a PDF via `github-markdown-css` + Puppeteer

## The three lines (R1 / R2 / R3)

These constraints keep the resume honest and interview-survivable:

- **R1 Verb locking** — polish tone, never upgrade responsibility. 参与 ≠ 负责, 了解 ≠ 精通.
- **R2 No fabricated data** — vague metrics get interrogated for precision; no number is invented.
- **R3 Highlights anchor on fact** — the LLM surfaces candidates; only what you confirm enters the resume. Code complexity ≠ a highlight.

## Requirements

- Node.js 18+
- Google Chrome (or Chromium) installed — the renderer uses your system browser, no bundled Chromium download

## Install

```bash
npm install
```

## Render a resume to PDF

```bash
node scripts/render-pdf.mjs <input.md> <output.pdf>
```

## Use as a ZCode skill

Copy (or symlink) this directory to `~/.agents/skills/resume-assistant/`. Then ask your agent to tailor a resume for a JD — the skill triggers automatically.

## Files

```
├── SKILL.md                 # Core instructions: three lines + six-phase workflow
├── scripts/render-pdf.mjs   # Markdown → HTML → PDF renderer
├── assets/print.css         # Print stylesheet (A4, typography, spacing)
├── assets/sample-resume.md  # Sample resume for testing
└── references/              # Reserved for extended docs
```
