# Running Prepy locally

Windows and PowerShell are shown; macOS and Linux work the same way with the equivalent commands.

## 1. Requirements

- **Node.js 22.13 or newer** (`node -v` to check). Get the LTS from https://nodejs.org. The database is a local SQLite file (`data/prepy.db`); there are no build tools to install.
- **One AI key.** Two providers have free tiers:
  - **Gemini:** create a key at https://aistudio.google.com/apikey (sign in with Google, click *Create API key*).
  - **Groq** (not Grok): create a key at https://console.groq.com/keys.
  - With both set, Groq takes over automatically when Gemini is busy or hits its free limit. Grok (`XAI_API_KEY`) and Claude (`ANTHROPIC_API_KEY`) also work, but are paid.
- **Chrome or Edge** for voice input (speech recognition and read-aloud).

## 2. Install and configure

```powershell
git clone https://github.com/sanehkr08/Prepy-MBA-Placement-Prep-App.git prepy
cd prepy
npm install
copy .env.example .env.local
code .env.local
```

In `.env.local`:

- Paste your key after `GEMINI_API_KEY=` and/or `GROQ_API_KEY=`.
- Set `AUTH_SECRET` (it signs the sign-in cookie). Generate one with:

  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```

On Windows you can instead double-click `setup.bat`, which installs packages, creates `.env.local` and opens VS Code.

## 3. Run

```powershell
npm run dev
```

Open http://localhost:3000. You land on the sign-in page: choose **Create account**, then upload your resume or type your details.

If PowerShell says "running scripts is disabled", use `npm.cmd run dev`, or allow local scripts once with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Check the AI key works: open http://localhost:3000/api/health/llm. You should see `"ok": true`.

## 4. Optional: "Continue with Google"

Email and password work without this. It's free and takes about 5 minutes.

1. Go to https://console.cloud.google.com/ and create a project (any name, e.g. "Prepy").
2. **APIs & Services → OAuth consent screen** (or **Google Auth Platform**): choose **External**, fill in the app name and your email, and save. Under **Audience → Test users**, add the Google accounts that may sign in, or **Publish app** (only basic profile scopes are used, so no review is needed).
3. **Credentials → Create credentials → OAuth client ID**, type **Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret** into `.env.local` after `AUTH_GOOGLE_ID=` and `AUTH_GOOGLE_SECRET=`, then restart `npm run dev`.

## 5. Troubleshooting

- **"Model … was not found":** set `GEMINI_MODEL` (or `GROQ_MODEL`) in `.env.local` to a model your key can use, and restart.
- **Free-tier limits:** Gemini's free tier allows a limited number of requests per minute and per day. Prepy falls back to the next provider automatically, or waits and retries when there is no fallback.
- **Privacy on free tiers:** Google may use prompts and outputs (including resume text) on the free tier to improve its products.

## 6. Run the evals

The eval harness measures grounding (unsupported claims), question and case relevance, concept coverage, role adaptivity and scoring consistency.

1. Use the app once so your profile is saved. With several accounts, set `$env:PREPY_EVAL_EMAIL = "you@example.com"` to choose whose profile the evals use.
2. Put JDs in `evals/testset/` as `"<Company> - <Role>.txt"` (two clearly labelled samples are included). Put real JDs you don't want in Git in `evals/testset/private/`. Optionally add `"<same name>.concepts.txt"` with a reference concept list, one per line.
3. Run:

   ```powershell
   npx tsx --env-file=.env.local evals/run-evals.ts
   ```

Results are written to `evals/results/<date>.md`.

## Where your data lives

Accounts, resumes, JDs and practice answers are stored in `data/prepy.db` (SQLite), and your keys in `.env.local`. (The hosted demo uses a Turso database instead: see `docs/DEPLOY.md`.) Both are git-ignored and never leave your computer, except for the text sent to the AI provider to generate each answer.
