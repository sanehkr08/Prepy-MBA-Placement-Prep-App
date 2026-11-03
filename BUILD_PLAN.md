# BUILD_PLAN.md — Prepy MVP

> **Status (4 Nov 2026):** Tasks 1–10 are built and the production build passes. Task 0 is partly done (the app is scaffolded; you still create the GitHub repo and `.env.local`, see README). This plan stays as the reference for how the app was built and for future changes.
>
> Changes from the original plan: storage is a JSON file (`src/lib/store.ts`) instead of SQLite, so `npm install` needs no native build tools on Windows; prompts are in one file (`src/lib/prompts.ts`); PDF text uses `unpdf`.

How to use this file with Claude Code: say **"Do Task N from BUILD_PLAN.md"**. Claude Code finishes that task, runs the checks, suggests a commit message, and stops. You test it in the browser, commit, then ask for the next task.

If time runs short, stop after **Task 8**. Tasks 0–8 are a complete, demo-ready MVP.

| Task | What you get | Est. time | Must / optional |
|---|---|---|---|
| 0 | Repo, Next.js app, GitHub (you do this) | 20 min | Must |
| 1 | App shell in the pastel design | 45 min | Must |
| 2 | Data layer (SQLite) | 30 min | Must |
| 3 | LLM wrapper, schemas, logging | 30 min | Must |
| 4 | Resume upload → parse → editable profile | 45 min | Must |
| 5 | JD input → parse, JD history | 30 min | Must |
| 6 | Fit and Gap Map | 45 min | Must |
| 7 | Role prep kit + answer outlines | 75 min | Must |
| 8 | Practice: typed answers + rubric scoring + voice dictation | 60 min | Must |
| 9 | Polish, error states, delete data, tutor placeholder | 30 min | Should |
| 10 | Eval scripts and results | 45 min | Should (needed for the report) |
| 11 | Deploy a Vercel preview | 20 min | Optional |

---

## Task 0 — Setup (done by you, not Claude Code)

PowerShell, in the folder where you keep projects:

```powershell
npx create-next-app@latest prepy --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd prepy
mkdir docs, docs\mockups, evals, data
```

1. Copy `CLAUDE.md` and `BUILD_PLAN.md` into `prepy\`.
2. Export the PRD doc as Markdown → save as `docs\PRD.md`. Save screenshots of the 5 mockup screens into `docs\mockups\`.
3. Create `.env.local` with `ANTHROPIC_API_KEY=...` and `LLM_MODEL=claude-sonnet-5-5`. Create `.env.example` with the same names, empty values.
4. Add to `.gitignore`: `.env.local`, `data/`, `*.db`.
5. On GitHub, create an **empty private repo** named `prepy` (no README, no .gitignore). Then:

```powershell
git add .
git commit -m "chore: scaffold Next.js app with Prepy docs"
git branch -M main
git remote add origin https://github.com/<your-username>/prepy.git
git push -u origin main
```

6. Open the folder in VS Code, open the terminal, run `claude`, and start with Task 1.

---

## Task 1 — App shell and design system

Build:
- Tailwind theme tokens from CLAUDE.md section 5; DM Sans via `next/font/google`.
- Components: `AppShell` (left rail + main + right panel), `SideRail` (icons: Resume/JD, Fit, Prep kit, Practice, Voice tutor; active = ink circle), `ProfilePanel` (avatar initial, name, programme), `PillChip` (white icon circle + label, active state), `PastelCard` (colour prop: pink, peach, lavender, mint), `Badge` (white pill).
- Routes with placeholder content: `/`, `/fit/[jdId]`, `/kit/[jdId]`, `/practice/[jdId]`, `/tutor`.

Done when:
- [ ] All 5 routes render with the rail, headline style and right panel, matching `docs/mockups/`.
- [ ] Layout stacks cleanly at phone width.
- [ ] `npm run build` passes.

Commit: `feat: app shell and pastel design system`

---

## Task 2 — Data layer

Build `src/lib/store.ts` as a JSON file store (`data/prepy.json`, created on first run). Collections:

| Table | Key columns |
|---|---|
| `profile` | id, raw_text, data_json, updated_at (single row) |
| `jd` | id, company, role, role_family, raw_text, data_json, created_at |
| `fit_map` | id, jd_id, data_json, overall_label, created_at |
| `kit_section` | id, jd_id, section (concepts, questions, cases, situational, outlines, plan), data_json, prompt_version, created_at |
| `practice_attempt` | id, jd_id, item_type, item_id, input_mode (typed or voice), answer_text, scores_json, feedback_json, created_at |
| `llm_calls` | id, prompt_name, prompt_version, input_tokens, output_tokens, latency_ms, ok, created_at |

Typed helper functions for each collection.

Done when:
- [ ] A small script or test creates, reads and deletes a row in each table.
- [ ] `data/` is git-ignored.

Commit: `feat: sqlite data layer`

---

## Task 3 — LLM wrapper, schemas, logging

Build:
- `src/lib/llm.ts`: `callLLM<T>({ name, version, system, user, schema })` → asks for JSON only, parses, validates with Zod, retries once with the validation error, logs to `llm_calls`, throws a typed error on failure.
- `src/lib/schemas.ts`: Zod schemas for Profile, JD, FitMap, Concepts, Questions, Cases, SituationalBehavioral, AnswerOutline, PracticeScore (fields in Tasks 4–8).
- A shared `GROUNDING_RULE` text block reused by every prompt that writes about the user.

Done when:
- [ ] A test route `/api/health/llm` returns a validated tiny JSON from the model.
- [ ] A missing API key shows a clear error, not a crash.

Commit: `feat: validated LLM wrapper with logging`

---

## Task 4 — Resume upload, parse, review (US-01 to US-03)

Build:
- Setup page, left card (lavender): upload PDF/DOCX up to 5 MB or paste text.
- `src/lib/extract.ts`: `unpdf` for PDF, `mammoth` for DOCX. If extracted text is under 200 characters, show "Looks like a scanned PDF. Paste the text instead."
- **P1 Resume parser** → `Profile` JSON: `name`, `education[] {degree, institution, years, line_ref}`, `experience[] {title, company, dates, bullets[], line_ref}`, `projects[]`, `skills[]`, `achievements[]`, `interests[]`. Rule: copy facts only; leave a field empty rather than guess.
- Editable review form for every field; Save stores the confirmed profile. "Replace resume" re-runs the parse.
- Right panel shows the profile name and programme from the saved profile.

Done when:
- [ ] Uploading your own resume gives a correct, editable profile.
- [ ] Reloading the page keeps the saved profile.

Commit: `feat: resume upload, parsing and profile review`

---

## Task 5 — JD input and parse (US-04, US-15)

Build:
- Setup page, right card (peach): company, role, JD text or PDF; button "Analyse my fit →".
- **P2 JD parser** → `JD` JSON: `role`, `role_family` (e.g. sales, account management, analytics, product, consulting, marketing, finance, operations, other), `must_have[] {text, category}`, `nice_to_have[]`, `responsibilities[]`, `competencies[]`, `company_context`.
- "Earlier dossiers" list in the right panel: company, role, fit label, date; click opens `/fit/[jdId]`.

Done when:
- [ ] Two very different JDs (e.g. area sales manager, business analyst) parse into sensible requirements and the right role family.

Commit: `feat: JD parsing and history`

---

## Task 6 — Fit and Gap Map (US-05)

Build:
- **P3 Matcher** (input: profile + JD) → `FitMap`: `items[] {requirement, kind, label: Strong|Partial|Gap, evidence, source_ref | null, tip}`, `overall_label: Strong|Moderate|Low`, counts. Rules: Strong needs direct evidence; Partial = related evidence; Gap = none. Evidence text must quote or closely paraphrase a profile line. Tips may use `[placeholders]`.
- Page as in the mockup: headline "How you fit / <role>", filter chips (All, Strong, Partial, Gaps with counts, working filters), grid of pastel cards (mint, peach, pink) with a text label, evidence, source and tip.
- Right panel: fit summary (label, counts, bars) + "Open prep kit →".

Done when:
- [ ] Every Strong item shows a real resume line as its source.
- [ ] Filters work.

Commit: `feat: fit and gap map`

---

## Task 7 — Role prep kit and answer outlines (US-06 to US-11, US-14)

Generate each section on demand (first visit to its tab) and cache it in `kit_section`.

| Prompt | Output schema |
|---|---|
| **P4 Concepts** | `topics[] {name, note, items[] {name, what, why_it_matters, priority: High|Medium|Low, covers_gap: boolean}}`, 8–14 concepts for this role family and JD |
| **P5 Questions** | `questions[] {text, category: role_knowledge|technical|resume|gap, linked_concepts[], likelihood_rank}`, 15–25 items |
| **P6 Cases** | `cases[] {title, prompt, framework, solution_outline[], linked_concepts[]}`, 2–4 role-relevant cases |
| **P7 Situational + behavioral** | `situational[] {text, competency}`, `behavioral[] {text, competency}` |
| **P8 Answer coach** | per behavioral, resume or gap question: `{situation, task, action, result, source_refs[], placeholders[]}`; uses only profile facts |
| Study plan | built in code from High-priority and gap-covering concepts first, then cases, then gap questions |

Page as in the mockup: section chips (Concepts, Questions, Cases, Situational, Behavioral, Resume and gaps), topic groups of pastel concept cards with priority badges, "Explain it in practice →" links, right panel with a study-plan checklist (saved) and "Start practising →". Case solutions stay hidden until the user has attempted the case.

Done when:
- [ ] Area sales manager and business analyst JDs give clearly different concepts and cases.
- [ ] Answer outlines contain no facts that are not in the profile (spot-check 5).

Commit: `feat: role prep kit and grounded answer outlines`

---

## Task 8 — Practice: typed + voice (US-12, US-13)

Build:
- Practice page as in the mockup: queue chips (concept, case, situational, gap, behavioral items from the kit), the current item in a lavender card, a framework hint you can expand, the answer textarea, "Score my answer" and "Revise and retry".
- **Voice dictation**: `MicButton` using the Web Speech API (`en-IN`, continuous, interim results). A recording bar with a stop button, timer and simple level bars; the transcript streams into the textarea and stays editable. If the browser lacks support or mic permission is denied, show a clear message and keep typing available. Save `input_mode = voice`.
- **P9 Scorer** (input: item, user answer, JD, linked concepts) → `PracticeScore`: `scores {structure, relevance, evidence_or_concepts, clarity}` (1–5 each), `headline`, `concepts_used[]`, `concepts_missed[]`, `stronger_answer[]` (outline steps). It must not invent user experience.
- Right panel: score bars, concept chips (used = mint, missed = pink), stronger answer, "Next item →".

Done when:
- [ ] A spoken answer in Chrome or Edge appears as text, can be edited, and gets scored.
- [ ] Attempts are saved with `input_mode`.

Commit: `feat: practice with rubric scoring and voice dictation`

---

## Task 9 — Polish and safety

- Loading states (skeleton cards) and friendly errors on every LLM step.
- "Delete all my data" (profile, JDs, kits, attempts) with a confirmation (US-16).
- `/tutor` page: "Talk to Prepy, coming in v1" in the mockup style.
- Accessibility pass: labels, focus states, contrast, 44px targets.

Commit: `chore: polish, error states, data deletion`

---

## Task 10 — Evals (for the report)

Create `evals/` with:
- `testset/`: 5 JDs from different role families (owner adds real ones; git-ignore them if private) + hand-written reference concept lists.
- `run-evals.ts` (run with `npx tsx evals/run-evals.ts`): for each JD, run P2–P9 and an LLM-as-judge for:

| Eval | Pass threshold |
|---|---|
| Grounding / no fabrication (answer outlines vs profile) | 0 unsupported claims |
| Question and case relevance (1–5) | average ≥ 4 |
| Concept coverage vs reference list | [X]% covered, 0 incorrect |
| Role adaptivity (overlap between 2 role families) | low overlap |
| Scoring consistency (same answer × 3 runs) | spread ≤ 1 point |

- Write results to `evals/results/<date>.md` as tables (used directly in the report).

Commit: `test: eval harness and first results`

---

## Task 11 — Optional: Vercel preview

The local JSON store does not persist on Vercel. For a public demo, either show it running locally in the report (recommended for the deadline) or swap `src/lib/store.ts` to a hosted database later.
