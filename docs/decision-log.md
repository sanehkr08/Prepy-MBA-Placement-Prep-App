# Prepy decision log

Newest first. The full PRD (with the same log) lives in the Prepy PRD doc in the claude.ai Project.

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-04 | Topic generators get a random theme and style per request, exclude topics already shown, and run at a higher temperature | "Different topic" kept circling between two ideas when only started topics were remembered |
| 2026-11-04 | Group discussion with 0, 2 or 3 AI members in rounds, then the user's summary | Rounds keep a simulated GD easy to follow; solo mode covers practice without a group |
| 2026-11-04 | AI GD members never quote numbers or sources | Made-up statistics would teach bad habits and can't be checked |
| 2026-11-04 | Speaking pace and filler words measured in code; pace only for spoken answers | Exact numbers build trust; typed answers have no speaking pace to judge |
| 2026-11-04 | Mock interviews: up to two follow-ups, no feedback until the end | Mirrors real interviews while keeping each session short and affordable on free tiers |
| 2026-11-04 | "Prepare for a role" stored as a JD built from a standard role profile | Fit map, prep kit, practice and model answers work for roles with no new pipeline |
| 2026-11-04 | Accounts (Auth.js: Google + email/password) and per-user data | v1 moves from a single-user tool to an app others can use; each user only sees their own data |
| 2026-11-04 | SQLite via Node's built-in `node:sqlite`, replacing the JSON file | Safe for several users and still needs no native build tools on Windows |
| 2026-11-04 | Gemini Flash-Lite by default, with Groq as an automatic fallback | The bigger Flash model allows about 20 free requests a day; fallback keeps practice working |
| 2026-11-04 | Guided home with two paths (a role, or a JD) and a labelled sidebar | Users without a JD still get full prep; the sidebar groups everything not tied to one kit |
| 2026-11-04 | Local JSON file store instead of SQLite (MVP; replaced by built-in SQLite in v1) | `better-sqlite3` needs native build tools on Windows; a JSON file behind one module is enough for a single user and can be swapped later |
| 2026-11-04 | Grounding enforced in code, not only in prompts | A Strong fit label needs a real resume line ref (else downgraded to Partial); invalid outline refs are dropped |
| 2026-11-04 | Voice dictation in MVP (browser Web Speech API); voice AI tutor in v1 | Speaking makes practice realistic at no extra cost; a real-time tutor needs more time and budget |
| 2026-11-04 | Soft pastel card UI (from a reference image) | Preferred visual style; still a workflow UI, not a chat box |
| 2026-11-04 | Role-agnostic: any JD, any role | Placements cover sales, account management, analytics, product, consulting and more |
| 2026-11-04 | Role prep kit (concepts, questions, cases, situational, behavioral) in MVP | Complete role preparation is the core value |
| 2026-11-04 | Single user; no survey; self-use as validation (MVP; accounts added in v1) | Built for personal use; one-day deadline |
| 2026-11-04 | Next.js + Tailwind instead of Streamlit | Streamlit apps look generic |
| 2026-11-04 | Resume uploaded at runtime, never in code | Real product behaviour; reusable profile |
| 2026-11-03 | No RAG in MVP | Case books not collected yet; resume + JD give enough context |
| 2026-11-03 | Plan in the claude.ai Project, build with Claude Code | Planning docs persist; code built from the docs |
