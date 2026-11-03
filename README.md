# Prepy

Interview prep from your own story. Upload your resume once, add a job description for **any role**, and Prepy gives you:

1. **Fit and Gap Map**: every JD requirement marked Strong, Partial or Gap, with the resume line behind it.
2. **Role prep kit**: concepts to study, likely interview questions, case studies, situational and behavioral questions, resume and gap questions, and a study plan.
3. **Answer outlines** (STAR) built only from your real experience, with `[placeholders]` where details are missing.
4. **Practice**: answer by typing or **speaking** (voice dictation) and get rubric-scored feedback with a stronger answer.

Built as an MBA product-management project. Spec: the Prepy PRD. Rules for AI coding agents: `CLAUDE.md`. Build steps: `BUILD_PLAN.md`.

## Run it on your computer (Windows, PowerShell)

You need Node.js 20 or newer (`node -v` to check) and an Anthropic API key.

```powershell
cd "$HOME\projects\prepy"
npm install
copy .env.example .env.local
code .env.local      # paste your key after ANTHROPIC_API_KEY=
npm run dev
```

Open http://localhost:3000 in **Chrome or Edge** (needed for voice input).

Check the key works: open http://localhost:3000/api/health/llm. You should see `"ok": true`.

If you see "Model … was not found", set `LLM_MODEL` in `.env.local` to a model your key can use and restart `npm run dev`.

## Put it on GitHub (first time)

1. On github.com, create a new **private** repository named `prepy`. Leave it empty (no README, no .gitignore, no license).
2. In PowerShell, in the project folder:

```powershell
git init
git add .
git commit -m "feat: Prepy MVP (resume and JD parsing, fit map, prep kit, practice with voice)"
git branch -M main
git remote add origin https://github.com/<your-username>/prepy.git
git push -u origin main
```

Your resume, JDs and practice answers live in `data/` and your key in `.env.local`. Both are git-ignored, so they never reach GitHub.

After each change: `git add .` → `git commit -m "feat: …"` → `git push`.

## Work on it with Claude Code

In VS Code, open the folder, open the terminal and run `claude`. Start with: "Read CLAUDE.md and BUILD_PLAN.md." `CLAUDE.md` holds the product rules (never invent experience, any role, workflow UI), the stack and the design tokens.

## Run the evals (for the report)

1. Use the app once so your profile is saved.
2. Put JDs in `evals/testset/` as `"<Company> - <Role>.txt"` (two clearly-labelled samples are included). Put real JDs you don't want on GitHub in `evals/testset/private/`. Optionally add `"<same name>.concepts.txt"` with a reference concept list, one per line.
3. Run:

```powershell
npx tsx --env-file=.env.local evals/run-evals.ts
```

Results are written to `evals/results/<date>.md`: grounding (unsupported claims), question and case relevance, concept coverage, role adaptivity and scoring consistency.

## Project layout

| Path | What |
| --- | --- |
| `src/app/` | Pages (setup, fit, kit, practice, tutor) and API routes |
| `src/lib/prompts.ts` | All prompts P1–P9, versioned |
| `src/lib/llm.ts` | Model calls: JSON only, Zod validation, one retry, token logging |
| `src/lib/prep.ts` | Fit map, kit sections, grounding guards, practice queue, study plan |
| `src/lib/store.ts` | Local JSON data store (`data/prepy.json`) |
| `src/components/` | UI kit (pastel cards, pill chips, side rail), profile editor, voice dictation hook |
| `evals/` | Eval harness and test set |
| `docs/` | Decision log; add mockup screenshots to `docs/mockups/` |

## Known limits (MVP)

- Single user, runs locally; no login.
- Voice uses the browser's speech recognition (Chrome or Edge). Accuracy for Indian English varies; always check the transcript before scoring.
- The voice AI tutor is a v1 feature; `/tutor` is a placeholder.
