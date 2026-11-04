# Deploying the live demo (Vercel + Turso, free)

The live demo runs on **Vercel** (hosting) with a **Turso** database (hosted SQLite). Both free tiers are enough.
Your local copy keeps using `data/prepy.db`; nothing changes on your computer.

On the demo:

- The sign-in page offers **Open the demo**: a shared account with a fictional candidate (Aarav Mehta), created automatically on first use.
- Only the emails you list can create accounts (for you); everyone else uses the demo account.
- The demo account can't edit its profile or delete data, so it stays tidy for the next visitor.
- AI calls are capped per account and for the whole site per 24 hours, so your free Gemini and Groq quotas can't be drained.

## 1. Create the Turso database (about 3 minutes)

1. Go to https://turso.tech and sign up with **GitHub**.
2. In the dashboard, create a **database** (any name, e.g. `prepy`; pick the location closest to you, e.g. Mumbai if offered).
3. On the database page, copy the **URL**. It starts with `libsql://`.
4. Create a **token** for the database (read and write) and copy it. It is shown only once.

The app creates its tables automatically on first use.

## 2. Deploy on Vercel (about 5 minutes)

1. Go to https://vercel.com and sign up with **GitHub** (Hobby plan, free).
2. **Add New → Project**, and import `sanehkr08/Prepy-MBA-Placement-Prep-App`. Vercel detects Next.js; keep the defaults.
3. Before clicking **Deploy**, open **Environment Variables** and add:

| Name | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | the `libsql://…` URL from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |
| `GEMINI_API_KEY` | your Gemini key |
| `GROQ_API_KEY` | your Groq key |
| `AUTH_SECRET` | a **new** random value (run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
| `DEMO_MODE` | `1` |
| `DEMO_PASSWORD` | a password for the shared demo account, e.g. `try-prepy` (it is shown on the sign-in page) |
| `ALLOWED_SIGNUP_EMAILS` | your own email(s), comma-separated |

   Optional: `DAILY_AI_LIMIT_PER_USER` (default 150) and `DAILY_AI_LIMIT_TOTAL` (default 600).

4. Click **Deploy**. When it finishes, Vercel shows your address, e.g. `https://prepy-xyz.vercel.app`. You can rename it under **Settings → Domains** (e.g. `prepy-mba.vercel.app`).

## 3. Optional: Google sign-in on the demo

1. In Google Cloud Console, open your OAuth client (**APIs & Services → Credentials**).
2. Add to **Authorized JavaScript origins**: `https://<your-app>.vercel.app`
3. Add to **Authorized redirect URIs**: `https://<your-app>.vercel.app/api/auth/callback/google`
4. In Vercel, add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, then **Deployments → … → Redeploy**.

## 4. Warm it up before sharing

Open the demo yourself and click **Open the demo**. Then pick **Product Manager** (or the role your recruiters care about) and let the fit map and prep kit build. Kits are saved, so every recruiter after you sees them instantly instead of waiting for the AI.

## Updating the demo

Every `git push` to `main` redeploys automatically.
