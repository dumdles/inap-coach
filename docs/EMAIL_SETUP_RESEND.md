# Setting up password-reset emails (Resend + Supabase)

> **Who this is for:** someone setting this up for the first time. No coding is
> needed — everything happens in websites' settings pages. Allow about 1 hour,
> plus up to a day of waiting for the domain to "verify".
>
> **What you're doing:** FitRep already has a "Forgot password?" page. When a
> cadet uses it, **Supabase** (our database/login service) sends them an email
> with a reset link. Out of the box Supabase can only email *our own team* and
> only 2 emails an hour, so cadets never get the link. You'll connect a proper
> email-sending service, **Resend**, so the emails actually reach cadets.

---

## Contents

0. [Words you'll see](#0-words-youll-see)
1. [Before you start — what to ask the project owner for](#1-before-you-start)
2. [Do we have a domain? (read this first)](#2-do-we-have-a-domain-read-this-first)
3. [Option A (recommended): buy a domain](#3-option-a-recommended-buy-a-domain)
4. [Set up Resend](#4-set-up-resend)
5. [Connect Resend to Supabase](#5-connect-resend-to-supabase)
6. [Tell Supabase where the reset link should go](#6-tell-supabase-where-the-reset-link-should-go)
7. [Test it](#7-test-it)
8. [Option B (temporary, no domain): use a Gmail account](#8-option-b-temporary-no-domain-use-a-gmail-account)
9. [Troubleshooting](#9-troubleshooting)
10. [Keeping it secure](#10-keeping-it-secure)

---

## 0. Words you'll see

| Word | What it means here |
|---|---|
| **Domain** | A web address you own, like `fitrep.app`. Ours currently looks like `something.vercel.app`, which belongs to Vercel, not us. |
| **DNS records** | Small lines of settings attached to a domain. Email services ask you to add a few to prove you own the domain. You copy-paste them; you don't need to understand them. |
| **Verify a domain** | Resend checks those DNS records exist. Once it sees them, it's allowed to send email "from" your domain. |
| **SMTP** | The standard way one service hands an email to another. Supabase hands its emails to Resend over SMTP. |
| **API key** | A long secret password Resend gives you. Treat it like a bank PIN. |
| **Supabase** | The service that stores FitRep's data and handles logins. Sends the reset email. |
| **Vercel** | The service that hosts the FitRep website. |

---

## 1. Before you start

Ask the project owner for:

- [ ] Access to the **Supabase** project (Dashboard → your project). You need to be able to open **Authentication** settings.
- [ ] (Option A) A way to **pay ~US$10–20/year** for a domain, or ask them to buy it and give you access.
- [ ] The **website address(es)** FitRep runs on — the live one, plus the preview/staging one
      (currently `https://fitrep-git-…-dumdles-projects.vercel.app`).
- [ ] (Optional) Access to **Vercel**, if you'll also point the website at the new domain.

You'll create (free): a **Resend** account at <https://resend.com>.

---

## 2. Do we have a domain? (read this first)

**We don't have one right now** — the site lives on a `vercel.app` address, and we
can't add DNS records to that because Vercel owns it.

That matters because **Resend will only send email to real people from a domain
you've verified.** Without one, Resend can only send test emails to *your own*
inbox (from `onboarding@resend.dev`) — useless for cadets.

So you have two choices:

| | **Option A — buy a domain** (recommended) | **Option B — Gmail account** (stop-gap) |
|---|---|---|
| Cost | ~US$10–20 a year | Free |
| Emails come from | `no-reply@yourdomain.com` | `fitrep.something@gmail.com` |
| Daily limit | 100/day, 3,000/month on Resend's free plan | ~500/day |
| Lands in inbox? | Best — properly authenticated | Usually fine, but looks less official |
| Bonus | The website can use the same domain (e.g. `fitrep.app` instead of a long vercel.app address) | — |
| Steps | Sections 3 → 7 | Section 8, then 6 → 7 |

**Recommendation:** do **Option A**. If you need something working *today*,
do Option B first and switch to A later — switching only means changing the
SMTP settings in Supabase (section 5).

---

## 3. Option A (recommended): buy a domain

1. Pick a name — e.g. `fitrep.app`, `getfitrep.com`, `fitrep-ocs.com`. Shorter is better.
2. Buy it from **one** of these (all fine; pick the one you find simplest):
   - **Vercel** — Vercel dashboard → **Domains** → **Buy**. Easiest if you'll also put the website on it, because the website part is then automatic.
   - **Cloudflare Registrar** (<https://dash.cloudflare.com>) — sells at cost, simple DNS screen.
   - **Namecheap** (<https://namecheap.com>) — beginner-friendly.
3. Turn on **auto-renew** so it doesn't expire (if it expires, password emails stop).
4. Remember where you bought it — that's where you'll paste DNS records in step 4.

> Avoid unusual endings like `.xyz` or `.top`: some email filters treat them as spam.
> `.com`, `.app`, `.co` and `.sg` are all fine (`.sg` costs more and needs a Singapore entity).

---

## 4. Set up Resend

### 4.1 Create the account
1. Go to <https://resend.com> → **Sign up** (use a shared/team email if you have one, not a personal one, so access isn't lost when people leave).

### 4.2 Add your domain
1. In Resend, open **Domains** → **Add Domain**.
2. Type your domain (e.g. `fitrep.app`). Choose the region closest to Singapore if asked (e.g. Tokyo / `ap-northeast-1`).
3. Resend now shows a table of **DNS records** (usually 3–4 rows: an **MX**, one or two **TXT**, sometimes a **DMARC** TXT). **Leave this page open.**

### 4.3 Paste the DNS records where you bought the domain
Open the DNS settings at your domain seller:
- **Vercel:** Dashboard → **Domains** → your domain → **DNS Records** → **Add**.
- **Cloudflare:** your domain → **DNS** → **Records** → **Add record**. If there's an orange-cloud "Proxy" toggle, set it to **DNS only** (grey) for these records.
- **Namecheap:** **Domain List** → **Manage** → **Advanced DNS** → **Add new record**.

For **each row** in Resend's table, add a record with exactly the same:
- **Type** (MX or TXT)
- **Name / Host** (e.g. `send` or `resend._domainkey`) — copy it exactly. Some sites want just the part before your domain (`send`), others the full thing (`send.fitrep.app`); if one doesn't work, try the other.
- **Value / Content** — use Resend's copy button; one wrong character breaks it.
- **Priority** (MX only) — copy Resend's number (often 10).

### 4.4 Verify
1. Back in Resend, click **Verify DNS Records**.
2. It can take **a few minutes up to 24–48 hours**. Status turns **Verified** (green) when done. You can continue with the next step meanwhile, but emails won't send until it's verified.

### 4.5 Create an API key (this is the password Supabase will use)
1. Resend → **API Keys** → **Create API Key**.
2. Name: `supabase-auth`. Permission: **Sending access** (not Full access). Domain: your domain.
3. Copy the key (starts with `re_`). **You only see it once** — put it straight into the team password manager.

---

## 5. Connect Resend to Supabase

1. Open the **Supabase dashboard** → the FitRep project.
2. Go to **Authentication** → **Emails** → **SMTP Settings** (the exact menu name can shift slightly between Supabase versions; look for "SMTP").
3. Turn on **Enable Custom SMTP** and fill in:

| Field | What to type |
|---|---|
| Sender email | `no-reply@yourdomain.com` (must end in your verified domain) |
| Sender name | `FitRep` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (literally the word "resend") |
| Password | your Resend API key (`re_…`) |
| Minimum interval between emails | leave the default |

4. **Save.**
5. Go to **Authentication** → **Rate Limits** and check **"Rate limit for sending emails"** — set it to something like **30 per hour** (it's a safety brake against abuse; raise it if a whole intake resets passwords at once).

> If there's a **staging** Supabase project too, repeat sections 5 and 6 there.
> Both can use the same Resend domain and API key.

---

## 6. Tell Supabase where the reset link should go

The email contains a link back to our website. Supabase only allows links to
addresses you list, otherwise it sends people to the homepage instead.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL:** the live website address, e.g. `https://fitrep.app` (or the current vercel.app address until you move to the domain).
3. **Redirect URLs** → **Add URL**, one per line:
   - `https://<live-website-address>/auth/reset-password`
   - `https://*-dumdles-projects.vercel.app/**` (covers preview + staging links)
   - `http://localhost:3000/**` (for developers testing on their own computer)
4. **Save.**

### Optional: make the email look like FitRep
Supabase → **Authentication** → **Emails** → **Templates** → **Reset Password**.
You can change the subject and wording. **Keep the link part working:**
- Easiest: leave the `{{ .ConfirmationURL }}` link as it is.
- More robust (some school/work email scanners "click" links before the person does, which uses up the one-time link): change the button's link to
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`
  Our reset page already understands both versions.

---

## 7. Test it

1. Open the website → **Sign in** → **Forgot password?**
2. Enter an email address of a **real test account** (not your own team email — we want to prove it reaches outsiders) and press **Send reset link**.
3. Within a minute the email should arrive (check **Spam** too).
4. Click the link → you should land on **"Choose a new password"** → set one → you're taken to the dashboard.
5. Sign out and sign in with the new password. ✅
6. In Resend → **Emails** (or **Logs**), you should see the email listed as **Delivered**.

Also check: clicking an **old or already-used** link shows "This link has expired" with a button to send a new one — that's correct.

---

## 8. Option B (temporary, no domain): use a Gmail account

Use this only until you have a domain. Emails will come from a Gmail address.

1. Create a new Gmail account just for this, e.g. `fitrep.noreply@gmail.com` (don't use a personal one).
2. Turn on **2-Step Verification** for it: Google Account → **Security** → **2-Step Verification**.
3. Create an **App Password**: Google Account → **Security** → **App passwords** (search "App passwords" if you can't see it) → name it `Supabase` → copy the 16-character password.
4. In Supabase → **Authentication** → **Emails** → **SMTP Settings** → **Enable Custom SMTP**:

| Field | What to type |
|---|---|
| Sender email | `fitrep.noreply@gmail.com` (the Gmail address itself) |
| Sender name | `FitRep` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `fitrep.noreply@gmail.com` |
| Password | the 16-character **App Password** (not the normal Gmail password) |

5. Continue with **section 6** and **section 7**.

**Limits:** about 500 recipients per day; if exceeded, Google pauses sending for up to 24 hours. When you later get a domain, just redo **section 4 and 5** with Resend's details — nothing else changes.

---

## 9. Troubleshooting

| What you see | Likely cause → fix |
|---|---|
| Resend domain stuck on **Pending** | DNS not added correctly or still spreading. Re-check each record's Name and Value character-by-character; wait a few more hours. On Cloudflare make sure the records are **DNS only**. |
| Cadet says no email arrived | 1) Check **Spam**. 2) Resend → Emails: is it there? If **not**, Supabase never handed it over → recheck section 5 (host/port/username/password). If it's there but **bounced**, the email address is wrong. |
| "Email address not authorized" | Custom SMTP isn't turned on/saved in Supabase (section 5). |
| "Too many reset emails requested" on our page | Supabase's rate limit hit → raise it in Authentication → Rate Limits (section 5, step 5). |
| Link opens the homepage instead of "Choose a new password" | The website address isn't in **Redirect URLs** (section 6). |
| Link says **expired** straight away | An email scanner used it first, or it was clicked twice. Switch to the `token_hash` template (section 6, optional part). Links also expire after 1 hour. |
| Gmail option: "Username and Password not accepted" | You used the normal password — it must be the **App Password**, and 2-Step Verification must be on. |

---

## 10. Keeping it secure

- **Never** paste the Resend API key or Gmail App Password into code, GitHub, chat groups or screenshots. It lives only in Supabase's SMTP settings and the team password manager.
- If a key may have leaked: Resend → **API Keys** → delete it → create a new one → update Supabase (section 5).
- Use a **shared team account** (not personal emails) for Resend, the domain and the Gmail stop-gap, so access survives people leaving.
- Keep the domain on **auto-renew**.

---

*Where this lives in the code (for developers): the pages are
`app/auth/forgot-password/page.tsx` and `app/auth/reset-password/page.tsx`;
the technical summary is in `docs/ROLES_AND_ENVIRONMENTS.md` → "Password reset".
No code changes are needed for anything in this guide.*
