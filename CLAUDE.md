# CLAUDE.md — Prepy

Instructions for Claude Code. Read this file and `BUILD_PLAN.md` before every task.

## 1. What Prepy is

Prepy is a GenAI interview-prep web app for MBA placements. The user uploads a resume once, adds a job description (JD) for **any role** (area sales manager, account executive, business analyst, product manager, consultant, …), and gets:

1. **Fit and Gap Map**: each JD requirement labelled Strong / Partial / Gap, with the resume evidence behind it.
2. **Role prep kit**: concepts to study, expected interview questions, case studies, situational and behavioral questions, resume and gap questions, and a study plan.
3. **Answer builder**: STAR answer outlines built only from the user's own resume.
4. **Practice**: answer any kit item by typing **or speaking (voice dictation)** and get rubric-scored feedback.

Version 1 adds accounts: sign in with Google or email + password, onboarding (resume upload or manual details), and per-user data. Each user only ever sees their own data.

Full spec: the Prepy PRD doc in the claude.ai Project (export it as Markdown to `docs/PRD.md` to keep a copy in the repo). Decisions: `docs/decision-log.md`. Screen designs: `docs/mockups/` (screenshots of the approved mockups).

## 2. Non-negotiable product rules

- **Never invent experience.** Any text about the user (answer outlines, gap tips, tutor replies) may only use facts in the confirmed profile. When a number or detail is missing, write a bracketed placeholder like `[add metric]` or `[add team size]`.
- **Show the source.** Answer outlines and fit-map evidence carry a `source_ref` that points to the profile field and line used.
- **Role-agnostic.** Never hard-code PM or consulting. Concepts, questions and cases adapt to the role family parsed from the JD.
- **Workflow UI, not a chat box.** The home screen is the guided flow (Resume → JD → Fit → Prep kit → Practice). Do not build a chat interface as the main UI.
- **Resume and JD are runtime uploads.** Never put resume or JD content in code, seeds or tests (use clearly fake fixtures in tests).

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript. Next 16 has breaking changes: read `node_modules/next/dist/docs/` before using an unfamiliar API. Route handler `params` is a Promise. |
| Styling | Tailwind CSS; design tokens in section 5 |
| LLM | `src/lib/llm.ts` supports four providers: **Gemini** (default, free tier, REST via fetch), **Groq** (free tier, open models, OpenAI-compatible REST; not Grok), **xAI Grok** (paid, OpenAI-compatible REST) and **Anthropic** (`@anthropic-ai/sdk`). Chosen by `LLM_PROVIDER` or by whichever key is set; when several keys are set the others are fallbacks (tried in order gemini → groq → xai → anthropic if the first fails). `LLM_MODEL` overrides the first provider's model; `GEMINI_MODEL` / `GROQ_MODEL` / `XAI_MODEL` / `ANTHROPIC_MODEL` override per provider. Free tiers are rate-limited: on HTTP 429 it falls back at once, or waits and retries once when no fallback is set; a provider whose daily quota is used up is skipped until its retry time. Each call times out after 45 s (`LLM_TIMEOUT_MS`) and moves to the next provider. Default Gemini model is `gemini-flash-lite-latest` with `thinkingLevel: "low"` (the bigger `gemini-flash-latest` allows only ~20 free requests a day) |
| Validation | Zod schema for every LLM output; one automatic retry on invalid JSON |
| PDF text | `unpdf` |
| DOCX text | `mammoth` |
| Auth | Auth.js v5 (`next-auth@5` beta) in `src/auth.ts`: Google (when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set) + email/password (scrypt hashes, `src/lib/users.ts`). JWT sessions signed with `AUTH_SECRET`. `src/proxy.ts` (Next 16's renamed middleware) sends signed-out page requests to /signin and answers API requests with 401 |
| Storage | SQLite via Node's built-in `node:sqlite` (`data/prepy.db`, `src/lib/db.ts`; Node 22.13+, no native build tools). A "Prepare for a role" kit is stored as a `jds` row with `kind = 'role'` (empty company, data from P14), so the fit map, kit, practice and model answers work unchanged; `kind = 'jd'` is a user's JD. `src/lib/store.ts` keeps the same API but is scoped to the current user: every API route is wrapped in `withUser` (`src/lib/api-auth.ts`), which runs the work inside `runAsUser` (`src/lib/user-context.ts`). Background work (e.g. `after()`) must be wrapped in `runAsUser` too |
| Voice (MVP) | Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `lang = 'en-IN'`, interim results on |
| Icons | `lucide-react` (stroke icons only, no emoji in the UI) |
| Font | DM Sans, self-hosted via `@fontsource-variable/dm-sans` (no network fetch at build) |

The owner develops on **Windows** with VS Code. Give shell commands for PowerShell.

## 4. Project structure (as built)

```
prepy/
  CLAUDE.md, BUILD_PLAN.md, README.md
  docs/                   decision-log.md, mockups/ (add screenshots of the approved mockups)
  src/
    app/
      signin/                          Sign in / create account (Google + email/password)
      onboarding/page.tsx              First sign-in: upload resume or enter details → profile
      page.tsx                         Home: random time-of-day greeting (src/lib/greetings.ts), two paths: Prepare for a role / Prepare for your JD (the JD form and earlier JDs live here)
      profile/page.tsx                 View / edit profile, replace from a new resume, delete all data
      role/[slug]/page.tsx             Prepare for a role (listed in src/lib/roles.ts, or typed: /role/custom?name=…): builds or reopens the role kit, then opens its fit map
      fit/[jdId]/page.tsx              Fit and Gap Map
      kit/[jdId]/page.tsx              Role prep kit (6 tabs, Read more study notes per concept, Generate More per concept topic, answer outlines, study plan)
      practice/[jdId]/page.tsx         Practice: kit categories → subcategories → question list; typed + voice dictation, undo/redo, rubric feedback
      tutor/page.tsx                   v1 placeholder for the voice AI tutor
      api/
        auth/[...nextauth]/route.ts    Auth.js endpoints
        register/route.ts              POST email/password sign-up
        me/route.ts                    GET the signed-in account (name, email, picture)
        resume/route.ts                POST upload/paste → P1 parse (not saved yet)
        profile/route.ts               GET / PUT the confirmed profile
        jd/route.ts                    GET list, POST add JD → P2 parse
        jd/[id]/route.ts               DELETE a JD with its fit map, kit, plan and attempts
        role/route.ts                  POST { name } → the user's saved role kit, or a new one from a standard role profile (P14)
        fit/[jdId]/route.ts            GET fit map (P3), cached; ?refresh=1; then prefetches the kit in the background
        kit/[jdId]/[section]/route.ts  GET concepts | questions | cases | situational (P4–P7), cached
        kit/[jdId]/more/route.ts       POST Generate More: new, non-repeating items for one kit tab, or one concept topic (P10)
        kit/[jdId]/notes/route.ts      POST Read more: study notes for one concept (P12), cached
        kit/[jdId]/outline/route.ts    POST STAR outline for one question (P8)
        kit/[jdId]/plan/route.ts       GET / PUT study plan
        practice/[jdId]/route.ts       GET practice queue (builds two interview-style questions per concept, P13)
        practice/score/route.ts        POST score an answer (P9), saves attempt
        practice/model/route.ts        POST model answer for one practice item, in the candidate's voice (P11)
        data/route.ts                  DELETE all data
        health/llm/route.ts            GET quick API-key check
    components/   ui.tsx (shell, rail, Back/Next step bar, chips, cards, buttons), ProfileEditor.tsx, hooks.ts (useProfile, useDictation, useUndoableText)
    lib/
      llm.ts            callLLM (JSON + Zod + one retry + logging), errorResponse
      prompts.ts        P1–P14 with versions + GROUNDING_RULE
      prep.ts           orchestration, caching, in-flight request sharing, kit prefetch, Generate More, grounding guards, practice queue, study plan
      profile-lines.ts  numbered profile lines (ED1, EX1.B2, AC1…) used for citations
      schemas.ts        Zod schemas
      db.ts             SQLite connection + schema
      store.ts          per-user data store (same API as the MVP's JSON store)
      users.ts          accounts, password hashing, one-time import of data/prepy.json into the first account
      user-context.ts   runAsUser / currentUserId (AsyncLocalStorage)
      api-auth.ts       withUser(): signed-in check + user scope for API routes
      extract.ts        PDF/DOCX/TXT → text
      client.ts         browser fetch helper
  evals/          run-evals.ts, testset/ (sample JDs + reference concept lists), results/
  data/           local data (git-ignored)
```

## 5. Design system (match the approved mockups)

| Token | Value | Use |
|---|---|---|
| `ground` | `#F6F2EE` | Page background |
| `panel` | `#EFE7E1` | Right side panel, inactive chips |
| `ink` | `#1C1B1F` | Text, active pill, primary buttons |
| `muted` | `#5F5A57` | Secondary text (passes 4.5:1 on ground) |
| `pink` | `#F6C9C9` | Gap cards, sales-topic cards |
| `peach` | `#F8DDB8` | Partial cards, distribution-topic cards |
| `lavender` | `#D9D3FA` | Resume card, case card, avatar |
| `mint` | `#C3EED9` | Strong cards, done states |
| `white` | `#FFFFFF` | Icon circles, badges, inputs |

- Radius: cards 32px, side panel 40px, inner boxes and inputs 16–20px, pills and buttons fully rounded.
- Type: DM Sans. Page headline 68px weight 300, tight leading, letter-spacing -0.02em. Card titles 21–28px weight 500. Body 15px.
- Layout: left icon rail (88px) · main column · right panel (~340px). On narrow screens they stack.
- Chips: pill with a 40px white icon circle on the left; the active chip is ink with white text.
- Strong / Partial / Gap always shows a **text label** as well as a colour.
- Touch targets at least 44px. Real `<button>`, `<a>`, `<label>` + `<input>`.
- No gradients, no glassmorphism, no emoji, no chat bubble as the home screen.

## 6. Coding rules

- One task from `BUILD_PLAN.md` at a time. Do not start the next task until the owner confirms.
- Keep the API key server-side only (API routes). Never expose it to the client.
- Every new API route is wrapped in `withUser`. Never read or write data outside a user scope.
- Every LLM call goes through `callLLM` with a Zod schema; it logs prompt name, tokens and latency to the store.
- Grounding is enforced in code too: a Strong fit label without a valid profile ref is downgraded to Partial, and answer-outline refs not in the profile are dropped (`src/lib/prep.ts`).
- Prompts live in `src/lib/prompts.ts`, each with a `version` string so evals can compare versions. Bump it when you change a prompt.
- Handle errors visibly: empty or scanned PDF, missing API key, LLM failure, mic permission denied.
- Do not add libraries outside section 3 without asking.
- After each task: run `npm run lint` and `npm run build`, then suggest a commit message in Conventional Commits style (`feat: …`, `fix: …`).

## 7. Git

- `main` is always working. Commit at the end of every task.
- Never commit `.env.local`, `data/` (including `prepy.db`), uploaded resumes or JDs. Keep `.gitignore` up to date.
- `.env.example` lists the variable names with empty values.

## 8. Environment variables

```
GEMINI_API_KEY=          # free key from https://aistudio.google.com/apikey (default provider)
GROQ_API_KEY=            # free key from https://console.groq.com/keys (fallback when Gemini fails)
# XAI_API_KEY=           # optional, Grok (paid)
# ANTHROPIC_API_KEY=     # optional, Claude
# LLM_PROVIDER=          # gemini | xai | anthropic (auto from the key set)
# LLM_MODEL=             # override the default model (gemini-flash-latest, grok-4.3, claude-sonnet-5-5)
AUTH_SECRET=             # signs the sign-in cookie (generate a random value; see README)
AUTH_GOOGLE_ID=          # optional: Google OAuth client (README has the steps)
AUTH_GOOGLE_SECRET=
```

Free-tier note: on Gemini's free tier, Google may use prompts and outputs to improve its products. The resume text is sent to the model.

## 9. Out of scope for the MVP

Video answers, RAG over case books, deployment beyond an optional Vercel preview. (Version 1 plan, in order: accounts and onboarding (done), home page with greeting and two paths (done), Prepare for a role (done), mock interview, impromptu speaking, group discussion.)

## 10. Build status

Tasks 0–10 of `BUILD_PLAN.md` are built: app shell, store, LLM wrapper, resume and JD parsing, fit map, prep kit, answer outlines, practice with voice dictation, polish (errors, delete data, tutor placeholder) and the eval harness. Task 11 (deploy) is not done. Next work: test with real JDs, tune prompts (bump versions), run evals, then v1 features from the PRD.
