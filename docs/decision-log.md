# Prepy decision log

Newest first. The full PRD (with the same log) lives in the Prepy PRD doc in the claude.ai Project.

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-04 | Local JSON file store instead of SQLite | `better-sqlite3` needs native build tools on Windows; a JSON file behind one module is enough for a single user and can be swapped later |
| 2026-11-04 | Grounding enforced in code, not only in prompts | A Strong fit label needs a real resume line ref (else downgraded to Partial); invalid outline refs are dropped |
| 2026-11-04 | Voice dictation in MVP (browser Web Speech API); voice AI tutor in v1 | Speaking makes practice realistic at no extra cost; a real-time tutor needs more time and budget |
| 2026-11-04 | Soft pastel card UI (from a reference image) | Preferred visual style; still a workflow UI, not a chat box |
| 2026-11-04 | Role-agnostic: any JD, any role | Placements cover sales, account management, analytics, product, consulting and more |
| 2026-11-04 | Role prep kit (concepts, questions, cases, situational, behavioral) in MVP | Complete role preparation is the core value |
| 2026-11-04 | Single user; no survey; self-use as validation | Built for personal use; one-day deadline |
| 2026-11-04 | Next.js + Tailwind instead of Streamlit | Streamlit apps look generic |
| 2026-11-04 | Resume uploaded at runtime, never in code | Real product behaviour; reusable profile |
| 2026-11-03 | No RAG in MVP | Case books not collected yet; resume + JD give enough context |
| 2026-11-03 | Plan in the claude.ai Project, build with Claude Code | Planning docs persist; code built from the docs |
