# Rotaract Event Reporting CRM

A production-oriented CRM that replaces hand-made event PDFs with a short, guided reporting flow.

A board member logs in, answers a handful of questions, adds photos, and taps **Submit**. The system stores every
number in a typed database column, files the evidence into a tidy Google Drive tree, runs the review/approval
workflow, and generates the event, monthly, avenue and annual reports on demand.

> **The board member never designs, formats or uploads a PDF.** The uploaded reference PDF was used only to work out
> *what information* a club report must contain; the CRM turns that into structured fields.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Environment variables](#environment-variables)
5. [Database setup](#database-setup)
6. [Google Cloud, OAuth and Drive setup](#google-cloud-oauth-and-drive-setup)
7. [AI configuration (optional)](#ai-configuration-optional)
8. [Deployment](#deployment)
9. [Admin setup](#admin-setup)
10. [Using it day to day](#using-it-day-to-day)
11. [Project structure](#project-structure)
12. [Testing](#testing)
13. [Troubleshooting](#troubleshooting)
14. [Known limitations](#known-limitations)

---

## What it does

### For a board member
- **Report Event** wizard — 13 short steps, each one screenful, designed thumb-first for phones.
- Totals are calculated for you (participants, beneficiaries); you never add numbers up by hand.
- Photos upload straight from the camera, with progress, captions, reordering and a cover photo.
- A live **report completeness** score separates *required* from *recommended* so nothing blocks you unnecessarily.
- Autosave every few seconds, plus a browser-side backup so a dropped connection never loses your answers.
- Optional **✨ Improve description** — rewrites *your* words. It is prompted never to invent facts, and you edit
  the result before it is saved.

### For the President / Secretary / Directors
- Admin dashboard: events, participants, beneficiaries, expenditure, pending and overdue reports.
- Charts: events by month, events by avenue, participants and beneficiaries by month, expenditure by month, top
  chairs, top collaborating organisations.
- **Reporting health** — % approved, who has reports outstanding, what is overdue against the club's deadline.
- Review queue: start review, request corrections with a note, approve. Approval locks the report; an admin can unlock.
- Search and filter everything, export to CSV/Excel with the filters applied.
- One-click **event / monthly / avenue / annual** PDF reports, compiled from approved events only.
- Full audit log: who created, edited, submitted, reviewed, corrected and approved, with timestamps.

### Google Drive
Submitting a report creates (idempotently):

```
<root folder>/
└── 2026-27/
    └── Community Service/
        └── January 2026/
            └── EVT-2026-0001_Care2Cook/
                ├── 01_Event_Photos/     EVT-2026-0001_Care2Cook_Photo_01.jpg
                ├── 02_Event_Poster/     EVT-2026-0001_Care2Cook_Poster.png
                ├── 03_Documents/
                ├── 04_Financials/       EVT-2026-0001_Care2Cook_Bill_01.pdf
                ├── 05_Social_Media/
                └── 06_Generated_Report/ EVT-2026-0001_Care2Cook_Report.pdf
```

Uploads land on the server first, so **Drive being down never loses event data**. Each event shows a sync status
(`SYNCED` / `PENDING` / `FAILED`) with a retry, and admins get a queue view at **Settings → Google Drive**.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, server actions, route handlers) |
| Language | TypeScript, `strict` |
| UI | Tailwind CSS, hand-rolled shadcn-style primitives, lucide icons, Recharts |
| Database | PostgreSQL (Supabase / Neon / self-hosted) |
| ORM | Prisma 6 with the `prisma-client` generator + `@prisma/adapter-pg` (no native engine binary in the bundle) |
| Auth | Auth.js v5 (NextAuth) — Google OAuth **and** email/password |
| Files | Google Drive API v3, staged through a local/volume upload directory |
| PDF | PDFKit (server-side), images normalised with sharp |
| Validation | Zod schemas shared by client and server |
| Tests | Vitest (unit) + a database smoke test + a Playwright UI walkthrough |

---

## Quick start

**Requirements:** Node.js 18.18 or newer (20 LTS / 22 LTS recommended), npm, and a PostgreSQL 14+ database
(a free Neon or Supabase project works — nothing to install locally).

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env         # then fill in DATABASE_URL and AUTH_SECRET at minimum
#    AUTH_SECRET: openssl rand -base64 32

# 3. create the schema
npx prisma migrate deploy    # or: npx prisma db push

# 4. demo data (optional but recommended for a first look)
npm run db:seed

# 5. run
npm run dev                  # http://localhost:3000
```

Seeded sign-ins (password from `SEED_PASSWORD`, default `Rotaract@2026`):

| Role | Email |
| --- | --- |
| Super Admin | `admin@rotaract.demo` |
| President | `president@rotaract.demo` |
| Secretary | `secretary@rotaract.demo` |
| Director (Community Service) | `director.cs@rotaract.demo` |
| Board member | `akshaya@rotaract.demo` |
| Viewer | `member@rotaract.demo` |

> Delete or deactivate the demo users before real use — **Members → deactivate**.

---

## Environment variables

Everything lives in `.env` (never commit it). `.env.example` is the template.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | — | Non-pooled URL used by `prisma migrate` (Supabase/Neon) |
| `AUTH_SECRET` | ✅ | Session encryption — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ in prod | Public base URL, e.g. `https://reports.myclub.org` |
| `AUTH_TRUST_HOST` | ✅ on Vercel | Set to `true` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google login + Drive | OAuth client (Web application) |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | for Drive | Root folder id; can also be set in the UI |
| `GOOGLE_SERVICE_ACCOUNT_JSON` or `_FILE` | alternative to OAuth | Unattended Drive access |
| `GOOGLE_DRIVE_ID` | — | Only if the root folder lives on a Shared Drive |
| `UPLOAD_DIR` | — | Where uploads are staged (default `./.uploads`) |
| `MAX_UPLOAD_MB` | — | Per-file limit (default 25) |
| `OPENAI_API_KEY` | — | Enables the optional AI buttons |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | — | Any OpenAI-compatible endpoint |
| `SUPER_ADMIN_EMAILS` | — | Comma-separated emails auto-promoted to Super Admin on first login |
| `SEED_PASSWORD` | — | Password for seeded demo accounts |

Google credentials are read **only** on the server (`src/server/drive/*`, `src/auth.ts`). Nothing secret is ever sent
to the browser.

---

## Database setup

Any PostgreSQL 14+ works.

**Supabase / Neon**
1. Create a project and copy the connection string into `DATABASE_URL`.
2. Copy the direct (non-pooled) string into `DIRECT_URL`.
3. `npx prisma migrate deploy`

**Local Docker**
```bash
docker run --name rotaract-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
npx prisma migrate deploy && npm run db:seed
```

Useful commands:

```bash
npm run db:generate   # regenerate the Prisma client after editing the schema
npm run db:migrate    # create a new migration in development
npm run db:push       # push schema without a migration (prototyping)
npm run db:studio     # browse the data
npm run db:seed       # demo data
```

The initial migration lives in `prisma/migrations/20260829000000_init/migration.sql`.

---

## Google Cloud, OAuth and Drive setup

1. **Create a project** — <https://console.cloud.google.com/projectcreate>.
2. **Enable the Drive API** — *APIs & Services → Library → Google Drive API → Enable*.
3. **OAuth consent screen** — *External* (or *Internal* for Workspace). Add your club's email as a test user while
   the app is unverified. Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `.../auth/drive`.
4. **Create credentials** — *Credentials → Create credentials → OAuth client ID → Web application*.
   - Authorised JavaScript origins: `http://localhost:3000` and your production URL.
   - Authorised redirect URIs — **both** of these:
     - `http://localhost:3000/api/auth/callback/google` (login)
     - `http://localhost:3000/api/drive/callback` (Drive authorisation)
     - …and the same two on your production domain.
5. Put the client id/secret into `.env`.
6. **Create the root folder** in Drive, e.g. `ROTARACT EVENT REPORTS`, and copy its id from the URL
   (`https://drive.google.com/drive/folders/<THIS_PART>`).
7. In the app: sign in as an admin → **Settings → Google Drive → Connect Google Drive**, then paste or pick the root
   folder. The refresh token is stored server-side in `drive_credentials`.

**Service account alternative** (better for unattended servers): create a service account, download the JSON key,
put it in `GOOGLE_SERVICE_ACCOUNT_JSON` (single line) or `GOOGLE_SERVICE_ACCOUNT_FILE`, then **share the root folder
with the service account's email** as Editor. No in-app connection step is needed.

---

## AI configuration (optional)

The CRM is fully functional without AI; the buttons are simply hidden.

```env
OPENAI_API_KEY="sk-…"
OPENAI_BASE_URL="https://api.openai.com/v1"   # or any compatible endpoint
OPENAI_MODEL="gpt-4o-mini"
```

Available: improve description, one-line event summary, suggest beneficiary categories, detect missing information,
draft a monthly narrative. Every prompt ships the user's own data and instructs the model to invent nothing; the user
always edits before anything is saved. Admins can switch AI off for the whole club in **Settings**.

---

## Deployment

**Vercel** (recommended)
1. Push the repo and import it.
2. Add every environment variable from `.env`.
3. Build command `npm run build` (it runs `prisma generate` first). No native Prisma engine is bundled.
4. Set `NEXTAUTH_URL` to the deployed URL and `AUTH_TRUST_HOST=true`.
5. Add the production redirect URIs in Google Cloud.

**Uploads on serverless.** `UPLOAD_DIR` is ephemeral on Vercel: files staged there survive long enough to reach
Drive, but they are not durable storage. For production either
(a) run on a host with a persistent volume (Railway, Fly.io, a VPS, Docker), or
(b) swap `src/server/storage/local.ts` for S3/R2 — it is a three-function interface (`saveUpload`, `readStored`,
`removeStored`) used everywhere else through those names.

**Drive retries.** Point a cron job (Vercel Cron, GitHub Actions, `curl`) at `POST /api/drive` with
`{"action":"retry_all"}` and an admin session, or open **Settings → Google Drive → Retry pending**.

---

## Admin setup

1. Sign in as the Super Admin (`SUPER_ADMIN_EMAILS` promotes the first Google login automatically).
2. **Settings** — club name, sponsor, club ID, RI district, president/secretary, Rotaract year, currency.
3. **Settings → reporting policy** — minimum/maximum photos, reporting deadline in hours, which fields are required.
4. **Settings → report builder** — what appears in generated PDFs.
5. **Members** — add the board. *Only people listed here can sign in*, whether by Google or password. Give Directors
   an avenue so they review their own portfolio.
6. **Settings → Google Drive** — connect and choose the root folder.
7. **Projects** — create recurring initiatives (e.g. *Avalukkaga*) so phases stay linked.

---

## Using it day to day

**Board member**: Dashboard → *Report a new event* → answer the steps → add photos → *Submit report*.
Target time: 5–10 minutes. A correction request arrives as a notification with the reviewer's note; edit and resubmit.

**Reviewer**: Notification or *Pending Reviews* → open the report → *Start review* → *Approve* or *Request correction*
with a note. Reviewers cannot approve their own events, and Directors only see their avenue.

**Reports**: *Reports* → pick monthly / avenue / annual → *Generate report*. The PDF downloads and is filed into Drive.
Single-event PDFs are generated from the event page once approved.

---

## Project structure

```
prisma/
  schema.prisma                 data model (25 tables)
  migrations/                   initial SQL migration
  seed.ts                       realistic demo club, events and photos
scripts/
  smoke.ts                      end-to-end check against a real database
  e2e.mjs                       Playwright walkthrough (desktop + mobile)
src/
  app/
    (app)/                      authenticated pages (dashboard, events, reviews, …)
    api/                        route handlers (uploads, files, drive, reports, export, ai, search)
    login/                      sign-in
  components/                   ui primitives, layout shell, charts, event table
  features/
    events/wizard/              the reporting wizard, split per step
    events/                     gallery, review panel, actions, filters
    members/ projects/ reports/ settings/
  lib/                          permissions, validation, completeness, naming, constants, utils
  server/
    actions/                    server actions (events, admin)
    drive/                      Google Drive client + sync service
    reports/                    PDF generation
    storage/                    upload staging
    analytics.ts search.ts events.ts settings.ts notifications.ts audit.ts ai.ts export.ts
tests/                          vitest unit tests
```

---

## Testing

```bash
npm test          # 51 unit tests: permissions, completeness, validation, Drive naming
npm run typecheck # tsc --noEmit
npm run build     # production build
npm run smoke     # end-to-end against your database (creates and removes a test event)
```

`npm run smoke` walks the whole acceptance scenario: draft → completeness gate → evidence upload → permission checks
→ correction → resubmission → approval lock → event PDF → monthly PDF → search → analytics → CSV/XLSX → Drive
(including the graceful path when Drive is not configured).

Browser walkthrough (optional):

```bash
npm run build && npm start
npm i --no-save playwright && npx playwright install chromium
node scripts/e2e.mjs http://localhost:3000 ./screenshots
```

Manual checks worth doing once: submit from a phone, a >10 MB photo, disconnecting the network mid-wizard, and a
correction round trip.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Can't reach database server` | Check `DATABASE_URL`; Supabase/Neon need `?sslmode=require` |
| `PrismaClientInitializationError` after editing the schema | `npm run db:generate` |
| Google login says *not a member* | Add the email in **Members** first — only listed people may sign in |
| Google returns `redirect_uri_mismatch` | The URI must match exactly, including `/api/auth/callback/google` and `/api/drive/callback` |
| Drive connect says *no refresh token* | Remove the app at <https://myaccount.google.com/permissions> and connect again (Google only returns a refresh token on first consent) |
| Events show *Drive sync pending* | Drive is not connected, or the root folder is unset — **Settings → Google Drive**. Data is safe; press **Retry pending** |
| Photo upload fails | Check `MAX_UPLOAD_MB`, and that `UPLOAD_DIR` is writable |
| AI buttons missing | `OPENAI_API_KEY` unset, or AI switched off in Settings |
| PDF shows boxes instead of Tamil/Devanagari text | See below |

### Reports in non-Latin scripts

PDFKit's built-in fonts cover Latin text only. To print event names in Tamil, Devanagari, etc., drop a Unicode TTF at:

```
public/fonts/report-regular.ttf
public/fonts/report-bold.ttf
```

They are picked up automatically on the next report generation (e.g. Noto Sans Tamil). The database always stores the
original text correctly — this only affects PDF rendering.

---

## Known limitations

- **Uploads are not durable on serverless hosts.** See [Deployment](#deployment); Drive holds the permanent copy.
- **Drive sync runs in-process.** Retries are queued in `sync_jobs` and triggered by an admin or a cron ping, not by a
  background worker.
- **Non-Latin PDF text needs a font drop-in** (above).
- **Notifications are in-app only.** Email/WhatsApp would slot into `src/server/notifications.ts`.
- **Avenues are edited via `upsertAvenueAction` or the database**; the settings screen lists them read-only.
- **AI features are optional and unconfigured by default** — no key, no buttons.
- Photo *originals* are preserved; only the 640px thumbnail is compressed.

---

Built for Rotaract clubs that would rather run projects than format documents.
