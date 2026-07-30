---
name: resume-assistant
description: Generate a JD-tailored PDF resume from the user's project material (local code, README, docs, or pasted snippets), job descriptions, and business context. Use when the user wants to create or tailor a resume for a specific job, rewrite project experience to match a JD, or produce a PDF resume from their code and project details.
---

# Resume Assistant

A resume collaborator that tailors a PDF resume to a specific job description (JD). It reads the user's project material (local code, README, docs, or pasted snippets) as *leads* (never as fact), extracts candidate highlights, cross-examines the user to confirm what they actually did, rewrites against the JD, then renders to PDF.

The user is the single source of truth. The skill never invents. Its entire value rests on three lines that must not break.

---

## The Three Lines (R1 / R2 / R3)

These are hard constraints on every piece of text that goes into the resume. Re-read them before writing any resume content. They exist because LLMs have a systematic bias toward inflating a candidate's profile — the lines are what keep the resume honest and interview-survivable.

### R1 — Verb locking

You may polish tone, you may not upgrade the level of responsibility.

- `participated` / 参与 → can become `contributed to` / 协助完成, never `led` / 负责 or `owned` / 主导
- `familiar with` / 了解 → can become `worked with`, never `proficient` / 精通 or `expert`
- `assisted` / 协助 → stays at assist level, never becomes `drove` / 推动 or `headed` / 牵头

The verb's semantic tier is locked to the original. Polishing wording is allowed; claiming more ownership than the user had is not. This applies to both Chinese and English output.

**Why:** "参与变负责" is the most common form of resume inflation. It survives the user's glance because the verb still describes real work, but it collapses the moment an interviewer probes depth. The user cannot always catch this themselves, so the skill must enforce it mechanically.

### R2 — No fabricated data

- Numbers in the resume must come from the user, not from the LLM.
- If the user gives a vague metric ("失败率降低了很多" / "reduced failures a lot"), **stop and ask for the precise value** ("从多少降到多少？" / "from what to what?"). Do not proceed until the user gives a number or explicitly says there is no number.
- If a project genuinely has no quantifiable metric, write a qualitative outcome instead ("消除了三类并发竞态" / "eliminated three classes of race conditions"). Do not invent a percentage to make it look stronger.
- Never generate plausible-sounding metrics (QPS, conversion rates, percentages) that the user did not provide.

**Why:** Fabricated data is the fastest way to fail an interview. The interviewer asks "how did you measure that?" and the candidate has no answer. A qualitative truth always beats a fabricated number.

### R3 — Highlights anchor on what the user did, not on code properties

When reading code, the LLM extracts *candidate* technical points. But it must not judge whether something is a "highlight" based on code properties alone:

- **Code complexity is not a highlight.** An 800-line if-else state machine is complex, but the complexity may come from poor design, not a hard problem. Don't write "designed a high-complexity state machine" for spaghetti code.
- **Code reuse is not a highlight.** A function called 5 times may have been copy-pasted, not deliberately abstracted. Don't write "built a reusable component" unless the user confirms they designed the abstraction.
- **Library usage is not a highlight.** A standard retry-with-backoff is not "自主设计指数退避算法" unless the user wrote the algorithm themselves.

The correct anchor is: **did the user actually do this?** Every candidate point extracted from code must be brought back to the user for endorsement before it enters the resume. The LLM asks "这是你做的吗？是不是这么回事？" The user says yes → write it. The user says no or "it's just a library" → drop it or downgrade to factual description.

**Why:** The user admitted they "don't know how to write highlights." That means they also can't reliably judge whether an LLM-generated highlight is real or inflated. So the skill doesn't ask the LLM to judge significance — it asks the LLM to only surface candidates, and the user to confirm facts. Significance is a byproduct of truth, not a target.

---

## Workflow

Follow these phases in order. Do not skip phases. Do not collapse phases 2–3 into one (that's where R3 gets violated).

### Phase 1 — Intake

Collect the three inputs from the user:

1. **JD**: Ask the user to paste the job description. Extract: required skills, preferred skills, seniority level, domain keywords. These become the tailoring targets.
2. **Project material**: Ask the user what they can provide about the project. This need not be a code repo - acceptable sources, in descending order of fidelity:
   - **Local code path** (preferred): a path to the project repo. Confirm it exists (`ls` the path). If the user has multiple projects, collect all paths.
   - **Documentation files**: README, design docs, API docs, or any Markdown/text file describing the project - these often contain embedded code snippets.
   - **Pasted code snippets or descriptions**: raw code pasted inline, or a prose description of what the project does.

   Read whatever the user provides as *leads*, never as fact. The richer the material, the better the extraction - but the skill works with whatever is available. Do not reject a session just because the user only has a README.
3. **Existing resume / base info**: Ask if they have an existing Markdown resume to use as the content structure base. If yes, read it. If no, ask for basic info (name, contact, education, work history skeleton).

Do not proceed to Phase 2 until you have all three.

### Phase 2 — Material extraction (leads only)

Read whatever project material the user provided in Phase 1. For each source (code repo, README, doc, or pasted snippet):

1. For a code repo: scan directory structure, entry points, and key modules. For a README/doc: read the architecture, feature, and embedded code-snippet sections. For a pasted snippet: read what it does.
2. Extract **candidate** technical points: what the project/code does, notable patterns, potential talking points.
3. For each candidate, form a factual observation — not a resume bullet. Example: "代码里有一个指数退避重试函数 `retryWithBackoff`，被调用了 3 次" (factual). NOT "攻克了高并发重试难题" (inflated).

**Critical:** These are leads, not resume content. They have not been endorsed yet. Do not write them into the resume in this phase.

### Phase 3 — Endorsement cross-examination

This is the most important phase. For each candidate point from Phase 2:

1. Present the factual observation to the user.
2. Ask: "这是你做的吗？是不是这么回事？当时的情况是怎样的？"
3. Wait for the user's answer.
4. If the user confirms → record as endorsed fact, including any context the user adds (role, scale, constraints).
5. If the user says no, or "this is just a library / boilerplate" → discard it. Do not try to rehabilitate it.
6. If the user provides data (metrics, scale) → record it. If the data is vague → apply R2 and ask for precision now.

Go through points one batch at a time (3–5 at a time so the user isn't overwhelmed). Collect all endorsed facts before moving to Phase 4.

### Phase 4 — JD-tailored rewrite

Now write the resume content. For each endorsed fact:

1. **Select**: Is this fact relevant to the JD? If yes, prioritize it. If no, deprioritize or omit (the user's call).
2. **Rewrite for JD fit**: Adjust wording to echo the JD's language and keywords — but under R1 (verb locking). E.g., if JD wants "支付系统经验" and the user's endorsed fact is "participated in payment module dev," write "参与支付模块开发，熟悉支付流程" — not "负责支付系统架构".
3. **Apply R2 on all data**: Every number in the output must trace back to an endorsed fact. No exceptions.
4. **Apply R3 on all claims**: Every claim must trace back to an endorsed fact. No claim based solely on code properties.

Output the result as Markdown, matching the structure of the user's existing resume (or a clean structure if none existed).

### Phase 5 — Review with user

Show the drafted Markdown to the user. Specifically call out:

- Any places where you were tempted to upgrade a verb but didn't (so the user knows where the boundary was held).
- Any data points and their source (so the user can verify they're real).
- Any candidate points that were dropped (so the user knows what was left out and why).

Let the user edit. If the user asks to strengthen something, check against R1/R2/R3 before complying — if the strengthening would violate a line, say so and explain why.

### Phase 6 — Render to PDF

Once the user approves the Markdown, render it to PDF using the bundled script:

```bash
node ~/.agents/skills/resume-assistant/scripts/render-pdf.mjs <input.md> <output.pdf>
```

The script uses `github-markdown-css` as the base style and adds print-friendly adjustments (page size, margins). The page count is determined by content length — do not force-fit to one page. If the user wants to adjust styling, they can edit `~/.agents/skills/resume-assistant/assets/print.css`.

Tell the user the output path. Done.

---

## Format notes

- Resume language follows the JD: if the JD is in Chinese, write in Chinese; if English, write in English.
- The Markdown structure should have clear sections: 基本信息 / 工作经历 / 项目经历 / 技能 / 教育. Adapt to what the user has.
- Keep bullet points to one line each where possible — dense, scannable.
- For project entries, the strong format is: one-line summary (what + impact) + 2-3 bullets (how, with endorsed technical detail).

---

## What this skill does NOT do

- Does not read remote repos (GitLab, GitHub). Project material must be local - a local code path, or pasted README/docs/snippets.
- Does not invent experiences the user doesn't have.
- Does not force the resume to one page.
- Does not design visual layouts beyond the github-markdown-css base + print adjustments.
- Does not apply to jobs automatically. The user reviews every word.
