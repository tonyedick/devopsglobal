# DevOps.global Candidate Intake — Supabase Setup Walkthrough

https://supabase.com/dashboard/project/ndypurygmnkxxgiozldm/functions

> Goal: candidates submit the intake form (with CV) and the data lands directly in your Supabase project. Strict, defence-in-depth security throughout. About 60–90 minutes end to end.

---

## What you're building

```
Candidate Browser
       │
       │  (1) Page loads from Vercel (HTTPS, strict CSP headers)
       │  (2) Turnstile widget loads + issues a token
       │  (3) User fills form, picks PDF/DOCX, clicks Submit
       │
       ▼
  Vercel-hosted HTML form
       │
       │  POST  (multipart/form-data, includes Turnstile token)
       │
       ▼
Supabase Edge Function  ──►  Cloudflare (verifies Turnstile token)
  • Honeypot check
  • Server-side input validation
  • File: extension + MIME + magic-byte check + size limit
  • Filename sanitised → UUID-based path
  • Uses SERVICE ROLE KEY (server-side only)
       │
       ▼
Supabase  ──  Postgres table  intake.candidates   (RLS on, default deny)
          ──  Storage bucket  cv-uploads          (private, RLS on)
```

Security layers, in order of how an attack is stopped:

1. **CSP + HSTS + X-Frame-Options** on the page itself (set by Vercel).
2. **Cloudflare Turnstile** rejects most bots before the Edge Function runs.
3. **Honeypot field** catches naive form-fillers that Turnstile lets through.
4. **Per-IP rate limiter** inside the Edge Function (5 req/min).
5. **Strict schema validation** — every field length, enum, regex enforced.
6. **File checks** — extension allow-list, MIME allow-list, **magic byte verification**, 10 MB cap.
7. **Filename sanitisation** + UUID-based storage path so user input never becomes a path.
8. **Row-Level Security** (RLS) — anon role has zero direct DB or storage access; only the service-role-backed Edge Function can insert.
9. **No public CV URLs** — files live in a private bucket; recruiters access via signed URLs from the dashboard.

You don't need a server, a Docker container, or any infrastructure of your own. Total monthly cost on hobby tiers: **$0** for low volume.

---

## Files in this package

| File                                     | What it is                               | Where it goes                               |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `supabase_schema.sql`                    | Tables, RLS, storage bucket, constraints | Run once in Supabase SQL Editor             |
| `supabase_edge_function.ts`              | The TypeScript Edge Function             | `supabase/functions/intake-submit/index.ts` |
| `DevOps_Global_Candidate_Intake_v2.html` | The new form                             | Deployed to Vercel                          |
| `vercel.json`                            | Security headers + routing               | Root of your Vercel project                 |
| `Supabase_Setup_Walkthrough.md`          | This document                            | Keep for reference                          |

---

# Part 1 — Supabase project

## 1.1 Create the project

1. Go to <https://supabase.com> and sign up (free tier is enough to start).
2. New Project → name it `devops-global-intake`.
3. Pick a strong database password and **save it in a password manager** — you'll never need it again unless you do an admin recovery.
4. Region: pick the one closest to most of your candidates. For Africa-heavy audiences, **eu-west-1** or **eu-central-1** works well.
5. Wait ~2 minutes for provisioning.

## 1.2 Run the SQL schema

1. In the left sidebar: **SQL Editor → New Query**.
2. Open `supabase_schema.sql` from this package, copy the **entire contents**, paste into the editor.
3. Click **Run**. You should see "Success. No rows returned."
4. Verify:
   - **Database → Tables** — you should see schema `intake` containing `candidates` and `submission_rejects`.
   - **Storage** — you should see a private bucket `cv-uploads` with a 10 MB file size limit and only PDF/DOCX MIME types allowed.
5. Click on the `candidates` table → **Authentication** sub-tab → confirm **Row Level Security is ENABLED**. (The script enables it; this is just a sanity check.)

## 1.3 Note your project keys

In **Project Settings → API**, copy these two strings to a safe place:

| Key                                                   | Where it's used                                                              | Sensitivity                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Project URL** (e.g. `https://abcdefgh.supabase.co`) | Frontend + Edge Function env                                                 | Public                                                      |
| **anon public key**                                   | Not used in our flow (intake goes through Edge Function), but useful to have | Public — safe in browser                                    |
| **service_role key**                                  | **Edge Function only**. NEVER expose in frontend code.                       | Treat like a password. If it leaks, regenerate immediately. |

> ⚠️ The `service_role` key bypasses every RLS policy. If anyone gets it, they can read everything. Never paste it in your HTML, never commit it to git, never share it in Slack/email.

---

# Part 2 — Cloudflare Turnstile (the captcha)

## 2.1 Create a Turnstile site

1. Sign up free at <https://www.cloudflare.com/products/turnstile/>.
2. Add a new site (no domain needed yet — you can add multiple later).
3. Domain: enter whatever you'll eventually use, e.g. `intake.devops.global`. You can add `localhost` and your `*.vercel.app` preview URL too.
4. Widget mode: **Managed (recommended)** — invisible for most users, falls back to a one-click challenge.
5. Save. You now have:
   - **Site Key** (public, goes in the HTML form).
   - **Secret Key** (private, goes in the Supabase Edge Function env).

---

# Part 3 — Edge Function (the trusted backend)

## 3.1 Install the Supabase CLI

On macOS:

```bash
brew install supabase/tap/supabase
```

On Linux / WSL: see <https://github.com/supabase/cli#install-the-cli>.

Confirm:

```bash
supabase --version
```

## 3.2 Initialise the project locally

In a new folder (e.g. `~/work/devops-global`):

```bash
supabase init
```

This creates a `supabase/` directory with config files.

## 3.3 Add the function

```bash
supabase functions new intake-submit
```

Open `supabase/functions/intake-submit/index.ts` and **replace its entire contents** with the contents of `supabase_edge_function.ts` from this package.

## 3.4 Link to your Supabase project

```bash
supabase login                              # opens browser to authorise CLI
supabase link --project-ref YOUR-PROJECT-REF
```

Your project ref is the subdomain in the project URL (e.g. `abcdefgh` from `https://abcdefgh.supabase.co`).

## 3.5 Set environment variables (secrets)

```bash
supabase secrets set TURNSTILE_SECRET=PASTE-THE-CLOUDFLARE-SECRET-KEY-HERE
supabase secrets set ALLOWED_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
```

> Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — you don't need to set them.

Once you have a custom domain (e.g. `https://intake.devops.global`), update `ALLOWED_ORIGIN` to that.

## 3.6 Deploy

```bash
supabase functions deploy intake-submit --no-verify-jwt
```

The `--no-verify-jwt` flag is correct here: candidates are anonymous and don't have a Supabase auth token. The function does its own authentication via Turnstile + honeypot + validation.

Note the deployed URL — typically:

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/intake-submit
```

## 3.7 Quick smoke test

```bash
curl -X OPTIONS https://YOUR-PROJECT-REF.supabase.co/functions/v1/intake-submit -i
```

You should get a `204 No Content` with CORS headers. If you do, the function is live.

---

# Part 4 — Deploy the form on Vercel

## 4.1 Prepare the deploy folder

Create a folder for the form (anywhere on your machine), and put exactly two files in it:

```
intake-form/
├── index.html      <-- rename DevOps_Global_Candidate_Intake_v2.html to this
└── vercel.json
```

Open `index.html` and find this block near the top:

```html
<script>
  window.DEVOPS_GLOBAL_CONFIG = {
    EDGE_FUNCTION_URL:
      "https://YOUR-PROJECT-REF.supabase.co/functions/v1/intake-submit",
    TURNSTILE_SITE_KEY: "YOUR_TURNSTILE_SITE_KEY",
  };
</script>
```

Replace both values with your real ones from steps 3.6 and 2.1.

## 4.2 Deploy

Easiest path — drag-and-drop:

1. Sign in at <https://vercel.com> (free).
2. **New Project** → **Import** → drag the `intake-form/` folder onto the page.
3. Framework preset: **Other**. Build command: blank. Output directory: blank.
4. Deploy. In ~30 seconds you have a live URL like `intake-form-xyz.vercel.app`.

Or via CLI:

```bash
cd intake-form
npx vercel
```

## 4.3 Lock in the security headers

The `vercel.json` you put alongside `index.html` applies these on every response:

- **HSTS** (force HTTPS for 2 years, preload-ready)
- **X-Frame-Options: DENY** (no clickjacking — form can't be iframed)
- **X-Content-Type-Options: nosniff**
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** that disables camera, mic, geolocation, etc.
- **Cross-Origin-Opener-Policy / Resource-Policy** for cross-origin isolation
- **Content-Security-Policy** that:
  - Only allows scripts from `self` and `challenges.cloudflare.com` (the Turnstile widget)
  - Only allows form posts to `self` and `*.supabase.co`
  - Blocks all plugins (`object-src 'none'`)
  - Blocks framing (`frame-ancestors 'none'`)
  - Forces HTTPS on every subresource

After deploying, verify by opening browser DevTools → Network tab → reload — you should see all these headers on the response.

## 4.4 Custom domain (recommended)

In Vercel: **Settings → Domains → Add**. Point e.g. `intake.devops.global` at the project. Vercel handles the SSL cert automatically. Once it's live, update `ALLOWED_ORIGIN` in your Supabase secrets:

```bash
supabase secrets set ALLOWED_ORIGIN=https://intake.devops.global
```

Add the new domain to your Cloudflare Turnstile site too.

---

# Part 5 — Recruiter access (you & your team)

The intake side is now anonymous; you need a way to **read** the submissions. There are two reasonable paths:

## Option A (simplest, recommended) — Supabase Table Editor

The Supabase dashboard is already a recruiter-friendly UI:

1. **Authentication → Users → Add user**. Create your account with your real email + a strong password.
2. **Database → Authentication → Roles** is not where role claims live in Supabase; instead, set the recruiter role in the user's app_metadata. The cleanest way is to run this one SQL statement (after replacing the email):

```sql
update auth.users
set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data,'{}'::jsonb),
                                  '{user_role}', '"recruiter"')
where email = 'tonye@yourdomain.com';
```

3. Sign in to <https://supabase.com> with that account, open your project, go to **Database → Tables → intake.candidates**, and you'll see every submission.
4. CV download: click on a row's `cv_storage_path` → in Storage, find that path → **Get URL → Signed URL → 1 hour**.

## Option B — Export to your Excel Tracker periodically

Use the helper view `intake.candidates_export` (already in the schema):

1. Supabase Dashboard → **SQL Editor**.
2. Paste:

```sql
select * from intake.candidates_export
where submitted_at >= now() - interval '7 days';
```

3. Run → click the **Export CSV** button (top right of the result).
4. Open the CSV in Excel and append rows into your Tracker.

Eventually you can automate this — see Part 8.

---

# Part 6 — Testing the security

After deploy, walk through this checklist before you share the URL with candidates.

## 6.1 Happy path

- Open the form in an incognito window.
- Fill in valid data, attach a real PDF or DOCX, complete the Turnstile, submit.
- You should see the green success banner.
- In Supabase Table Editor, the row exists. In Storage, the file is in `cv-uploads/YYYY-MM/<uuid>.pdf`.

## 6.2 Negative tests

| Test                                                                                                                                                      | Expected result                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submit without filling required fields                                                                                                                    | Client-side errors highlighted; no network call.                                                                                                               |
| Submit with `name` longer than 120 chars                                                                                                                  | Server-side `bad request` from Edge Function.                                                                                                                  |
| Try a `.exe` renamed to `.pdf`                                                                                                                            | Rejected with `cv-file-contents-do-not-match-claimed-type`. (This is the magic-byte check working.)                                                            |
| Try an 11 MB PDF                                                                                                                                          | Rejected `cv-too-large`.                                                                                                                                       |
| Submit 6 times in a minute from same IP                                                                                                                   | 6th submission rejected `rate-limited`.                                                                                                                        |
| Open browser console, paste `fetch('https://YOUR-REF.supabase.co/rest/v1/candidates', {headers:{apikey:'ANON-KEY'}}).then(r=>r.json()).then(console.log)` | Empty array or 401 — RLS blocks anon SELECT.                                                                                                                   |
| Take the Cloudflare Turnstile token out of the request and POST manually with curl                                                                        | Rejected `captcha-verification-failed`.                                                                                                                        |
| Fill the hidden `company_url` honeypot field via DevTools and submit                                                                                      | Server returns a 200 success-shaped response (so bots don't learn), but **no row is inserted** and a `honeypot-tripped` entry appears in `submission_rejects`. |

If any of these don't behave as expected, fix before going live.

---

# Part 7 — Production checklist

Before sharing the intake URL externally, confirm each item:

- [ ] **HTTPS only** — open `http://intake.devops.global` (or your domain), you should be redirected to HTTPS by Vercel.
- [ ] **CSP** — DevTools Network tab shows the `Content-Security-Policy` header on the form page.
- [ ] **No service-role key anywhere in the deployed HTML** — view source, search for the string `service_role`. It should NOT appear.
- [ ] **RLS verified** — run the SELECT-via-anon test in 6.2.
- [ ] **Turnstile keys** — site key in HTML, secret key in Supabase secrets, never the other way around.
- [ ] **`ALLOWED_ORIGIN`** is set to your real domain, not `*`.
- [ ] **Bucket is private** — Storage → cv-uploads → properties → `Public bucket: false`.
- [ ] **Backups** — Supabase free tier includes 7-day point-in-time recovery on Pro plans. If you're on free, plan to upgrade once you have >10 candidates.
- [ ] **Edge Function logs** — open **Edge Functions → intake-submit → Logs** to confirm submissions are showing up cleanly.
- [ ] **GDPR / data retention** — decide a retention period (e.g. 12 months) and set a calendar reminder to review/delete old candidates.

---

# Part 8 — Optional: automated sync to your Excel Tracker

When you're ready to remove the "manual CSV export" step:

**Approach 1 — Cowork scheduled task.** Once Supabase is live, ask me to extend your existing morning brief task with a query that reads new submissions from Supabase and adds them to your Tracker. (Requires the Supabase MCP connector to be installed.)

**Approach 2 — Database webhook.** In Supabase → **Database → Webhooks**, create a webhook that fires on `INSERT INTO intake.candidates` and POSTs the row to your own endpoint (Zapier, Make, or a tiny serverless function) that appends to a Google Sheet you have synced with your tracker.

**Approach 3 — Stay on Supabase as the system of record.** Long-term this is the right move. The Excel tracker is great for Week 1 and helpful as a personal scratchpad, but Supabase + the dashboard view scales better.

---

# Part 9 — Operations runbook

## 9.1 How to view a candidate's CV

1. Supabase Dashboard → Database → Tables → `intake.candidates`.
2. Find the row, copy the value of `cv_storage_path`.
3. Storage → `cv-uploads` → navigate to that path.
4. Click the file → **Get URL** → **Signed URL** → 1 hour.
5. Open in a new tab to view/download.

## 9.2 How to add the priority + decision after a call

In the table editor, edit the row directly:

- `priority`: A / B / C
- `recommendation`: client-ready / talent pool / not suitable / open
- `stage`: New / Stage 1: Rec Check / Stage 2: Tech Assess / Stage 3: Jobcoach / Client-Ready / Rejected
- `next_step`: free text
- `next_step_date`: date
- `recruiter_comment`: free text

The RLS update policy ensures only you (logged in with the recruiter role) can do this.

## 9.3 How to delete a candidate's data (GDPR request)

Run in the SQL Editor:

```sql
-- Step 1: get the storage path
select id, cv_storage_path from intake.candidates where email = 'their@email.com';

-- Step 2: delete the CV file (paste the path)
-- (Easier: do this in the Storage UI.)

-- Step 3: delete the row
delete from intake.candidates where email = 'their@email.com';
```

Log the deletion for compliance (date, requester, who actioned).

## 9.4 If you get bot traffic spikes

- Check `intake.submission_rejects` for patterns (same IP hash, repeated reason).
- Tighten the rate limiter in the Edge Function (`RATE_MAX` → lower, e.g. 3).
- In Cloudflare Turnstile, change widget mode to **Non-interactive** or **Visible** for one week.

## 9.5 Rotating the service role key

If you ever suspect a leak:

1. Supabase Dashboard → Project Settings → API → **Reset service_role key**.
2. The Edge Function picks up the new key automatically on next deploy. Re-deploy:

```bash
supabase functions deploy intake-submit --no-verify-jwt
```

3. Force-rotate the Turnstile secret in the same way if needed.

---

# Part 10 — What this setup does NOT do (and how you'd add it)

| Not yet implemented                          | How to add later if you need it                                                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Antivirus scan of uploaded CVs               | Add a step in the Edge Function that POSTs the file bytes to VirusTotal or ClamAV-as-a-service; on `malicious=true`, delete the upload and reject.                                           |
| Email notification to you on each submission | Database webhook (Part 8, approach 2) → email service like Resend or SendGrid. Or read directly from Cowork via the Supabase MCP.                                                            |
| Encrypted column storage for PII             | Switch sensitive columns to use `pgcrypto`'s `pgp_sym_encrypt` and `pgp_sym_decrypt`, store the key in Supabase Vault. Adds complexity; worth it only if you're storing very sensitive data. |
| Deletion-after-N-months automation           | Schedule a daily `delete from intake.candidates where submitted_at < now() - interval '12 months'` via Supabase Cron or pg_cron.                                                             |
| Multi-region failover                        | Available on Supabase Pro plans via read replicas.                                                                                                                                           |

---

# Quick reference — where every secret lives

| Secret                              | Location                                            | Who can see it                   |
| ----------------------------------- | --------------------------------------------------- | -------------------------------- |
| Supabase database password          | Saved in your password manager                      | You                              |
| Supabase **service_role** key       | Supabase Edge Function env (`supabase secrets`)     | Supabase + you (via dashboard)   |
| Supabase **anon** key               | Public — not used in this setup, but safe to expose | Anyone (RLS protects everything) |
| Cloudflare Turnstile **site key**   | Public — embedded in the HTML form                  | Anyone                           |
| Cloudflare Turnstile **secret key** | Supabase Edge Function env                          | Cloudflare + you                 |
| Recruiter login credentials         | Supabase auth                                       | You                              |

---

That's the whole setup. Pace yourself across the parts:

- **Day 1:** Parts 1–3 (Supabase + Turnstile + Edge Function deploy). ~45 min.
- **Day 2:** Part 4 (Vercel + custom domain). ~30 min.
- **Day 3:** Part 6 (testing) + Part 7 (production checklist). ~30 min.

Then point the intake link at your Slack/Discord/Andela posts and you're live.
