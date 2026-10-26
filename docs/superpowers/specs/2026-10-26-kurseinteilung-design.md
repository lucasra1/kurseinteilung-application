# Kurseinteilung – Design

Date: 2026-10-26
Status: Draft, awaiting review

## Purpose

A small web app for planning which trainers teach which courses (Kurse) at
the Österreichisches Rotes Kreuz. An administrator sets up Kurse and their
dates (Termine), shares a secret invite link, and trainers register and put
themselves on the Termine they want to teach. The admin sees at a glance
which Termine are fully staffed and which still have gaps, without chasing
people by email or spreadsheet.

Expected scale: one or a few admins, dozens of trainers.

The UI is German. The app must run on free tiers (Vercel, Supabase, Resend).
The Red Cross name and emblem are legally protected, so they must not appear
in the domain, logo, or app name. The app is called "Kurseinteilung".

## Roles

- **Trainer**: any registered person. Sees all upcoming Termine and who is
  signed up (names only). Can sign up for and withdraw from Termine, and edit
  their own profile.
- **Admin**: a trainer with `is_admin = true`. Can see and edit everything:
  Kurse, Termine, signups, people, the invite link. Admins see contact
  details (email, phone); trainers do not.

## Domain concepts

- **Kurs**: a course, e.g. "Erste-Hilfe Grundkurs". Has a title, a
  description, and staffing numbers: `trainers_needed` and `backups_needed`.
  The staffing numbers apply to every Termin of the Kurs.
- **Termin**: one date of a Kurs. Has a date, start and end time, its own
  topic (different Termine of a Kurs cover different topics), and an
  optional location.
- **Signup**: a person on a Termin, with a `position` (1, 2, 3, …).
- **Role**: derived, never stored. Signups of a Termin are ranked by
  `position`:
  - ranks `1 … trainers_needed` → **Trainer**
  - the next `backups_needed` ranks → **Backup**
  - any rank beyond that → **Überzählig** (only possible after an admin
    lowers the staffing numbers; the admin resolves it manually)
- **Capacity** = `trainers_needed + backups_needed`. A Termin at capacity is
  "ausgebucht" and accepts no more signups.

When someone leaves a Termin, everyone behind them moves up one position, so
a Backup can become a Trainer.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), `cacheComponents: true`, React 19 |
| Language | TypeScript (strict) |
| Package manager | pnpm |
| Database | Supabase Postgres (free tier) |
| DB access | Drizzle ORM + `postgres` (postgres.js), direct connection |
| Migrations | drizzle-kit (schema in TypeScript) |
| Auth | Supabase Auth, magic link only, via `@supabase/ssr` |
| Email | Resend: SMTP for Supabase Auth mails, SDK for notifications |
| UI | Tailwind CSS v4, shadcn/ui |
| Validation | Zod |
| Dates | date-fns + @date-fns/tz (Europe/Vienna) |
| Lint/format | Biome |
| Hosting | Vercel (Hobby), GitHub repo `lucasra1/kurseinteilung-application` |
| Domain | Cloudflare Registrar (name to be decided: `<domain>` below) |
| Local dev | Supabase CLI local stack in Docker (Postgres, Auth, Mailpit) |

## Architecture

### Data access: Next.js code only

All business logic and authorization live in Next.js server code. There are
no Postgres functions, triggers, or RLS policies.

- The app connects to Postgres directly with postgres.js through Supabase's
  connection pooler in **transaction mode** (port 6543, `prepare: false`),
  which suits serverless functions on Vercel.
- All app tables live in a dedicated Postgres schema **`app`**, not
  `public`. Supabase's Data API (PostgREST/GraphQL) only exposes `public`,
  so the app tables can't be reached through the public Supabase API. In
  production the Data API is additionally switched off in the dashboard.
- Supabase Auth is used for sessions only. `@supabase/ssr` with the
  publishable key handles cookies; the secret key is used server-side for
  the Auth admin API (creating users, deleting users).
- No Supabase client ever runs in the browser.

### Data access layer (`lib/dal/`)

Every read and write goes through a small server-only module (`import
"server-only"`):

- `getCurrentUser()`: reads the Supabase session from cookies and loads the
  profile. Returns `null` if not logged in or if no profile exists.
- `requireUser()` / `requireAdmin()`: like `getCurrentUser()`, but redirect
  to `/login` or throw a forbidden error.
- Every Server Action and every page that shows protected data starts with
  one of these guards.
- Cached reads (`"use cache"`) never read cookies. They take plain
  arguments and are called only after the guard has run.

### Caching (`cacheComponents`)

- Layout and page chrome are prerendered as the static shell.
- Everything that depends on the logged-in user (the user's own status, the
  sign-up button, admin-only details) renders inside `<Suspense>`.
- Shared data (Kurse, Termine, signups with names) is loaded by cached
  functions tagged with `cacheTag("termine")`; the person list is tagged
  `cacheTag("profiles")`.
- Every mutation calls `updateTag(...)` for the tags it affects, so the next
  render shows fresh data immediately.

### Concurrency: the "first N" rule

Signups, withdrawals, and admin edits of a Termin each run in one database
transaction that starts by locking the Termin row:

```ts
await db.transaction(async (tx) => {
  const termin = await lockTermin(tx, terminId); // SELECT … FOR UPDATE
  // read signups, check capacity / rules, write changes
});
```

Simultaneous requests for the same Termin therefore run one after the other,
and capacity can never be exceeded. Concurrent signups beyond capacity get
the "ausgebucht" error.

### Role changes and notifications

Every mutation that can change roles uses one helper:

1. Inside the transaction, compute roles of the affected Termine **before**
   the change (pure function in `lib/staffing.ts`).
2. Apply the change.
3. Compute roles **after** the change and diff them: who was promoted, who
   was demoted, who was removed.
4. After the transaction commits, send emails (see below). Email failures
   are logged and never roll back or fail the action.

Mutations that use it: sign up, withdraw, admin add / remove / move up / move
down, admin edits staffing numbers of a Kurs, admin deletes a Termin or Kurs,
admin removes a person. Changes to Termine in the past send no emails.

## Data model

All tables in schema `app`. IDs are `uuid` with `gen_random_uuid()`
defaults. Timestamps are `timestamptz`.

```
profiles
  id            uuid PK, references auth.users(id) ON DELETE CASCADE
  full_name     text NOT NULL
  email         text NOT NULL UNIQUE
  phone         text NULL
  is_admin      boolean NOT NULL DEFAULT false
  created_at    timestamptz NOT NULL DEFAULT now()

kurse
  id               uuid PK
  title            text NOT NULL
  description      text NOT NULL DEFAULT ''
  trainers_needed  integer NOT NULL CHECK (trainers_needed >= 1)
  backups_needed   integer NOT NULL CHECK (backups_needed >= 0)
  created_at       timestamptz NOT NULL DEFAULT now()

termine
  id          uuid PK
  kurs_id     uuid NOT NULL references kurse(id) ON DELETE CASCADE
  date        date NOT NULL
  start_time  time NOT NULL
  end_time    time NOT NULL CHECK (end_time > start_time)
  topic       text NOT NULL
  location    text NULL
  created_at  timestamptz NOT NULL DEFAULT now()

signups
  id          uuid PK
  termin_id   uuid NOT NULL references termine(id) ON DELETE CASCADE
  profile_id  uuid NOT NULL references profiles(id) ON DELETE CASCADE
  position    integer NOT NULL CHECK (position >= 1)
  created_at  timestamptz NOT NULL DEFAULT now()
  UNIQUE (termin_id, profile_id)
  UNIQUE (termin_id, position) DEFERRABLE INITIALLY DEFERRED

app_settings      (exactly one row, id = 1)
  id            integer PK CHECK (id = 1)
  invite_token  text NOT NULL
```

- Dates and times are wall-clock times in Europe/Vienna; no time zone is
  stored.
- `position` is kept gap-free (1…n) by the app: removing a signup shifts all
  later positions down by one inside the same transaction. The position
  uniqueness constraint is deferred so these shifts and admin swaps don't
  collide mid-transaction.
- The initial `app_settings` row with a random invite token is created by a
  seed step in the migrations.

## Auth and registration

Public signup is **disabled** in Supabase Auth ("Allow new users to sign
up" off), so nobody can create accounts through the Supabase API directly.
Accounts are created only by our server code.

### Invite flow: `/einladung/[token]`

1. The server compares the token with `app_settings.invite_token`. If it
   doesn't match: page "Link ungültig – bitte beim Admin melden".
2. Form: name, email, phone (optional).
3. Server Action re-checks the token, then:
   - If the email already has an account: send a normal magic link (no
     duplicate account).
   - Otherwise: create the user with the Supabase Auth admin API
     (`email_confirm: true`), insert the profile, then send the magic link.
4. Page shows "Wir haben dir einen Login-Link geschickt."

### Login: `/login`

- Email field → `signInWithOtp({ email, shouldCreateUser: false })`.
- Unknown emails get the same "link sent" message (no account enumeration),
  except admin bootstrap below.

### Magic link target: `/auth/confirm`

- The email template links to
  `<APP_URL>/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- The route calls `verifyOtp({ token_hash, type })`, which sets the session
  cookie, and redirects to `/termine`. This works even when the link is
  opened on a different device than the one that requested it.
- Expired or invalid link: redirect to `/login?fehler=link-abgelaufen`.

### Session refresh: `proxy.ts`

Refreshes the Supabase session cookie on each request and redirects
logged-out users from protected routes to `/login`. Public routes: `/login`,
`/einladung/*`, `/auth/*`, `/api/keepalive`.

### Admin bootstrap

The env var `ADMIN_EMAILS` (comma-separated) lists admin emails.

- On `/login`, an email in `ADMIN_EMAILS` without an account gets an account
  and a profile created (name defaults to the part before `@`, editable in
  `/profil`), then the magic link.
- A person is an admin if `profiles.is_admin` is true **or** their email is
  in `ADMIN_EMAILS` (checked in `getCurrentUser()`). Admins from
  `ADMIN_EMAILS` can't be demoted or removed in the UI. Other admins are
  promoted in `/admin/personen`.

### Invite link regeneration

`/admin/einstellungen` shows the invite link with "Kopieren" and "Neu
erzeugen". Regenerating replaces the token with a new random 24-character
URL-safe string; the old link stops working. Existing accounts are
unaffected.

## Pages

### Trainer

- **`/`**: redirects to `/termine` (logged in) or `/login`.
- **`/termine`**: upcoming Termine (today and later), grouped by Kurs,
  sorted by date. Each Termin shows date, time, topic, location, the ranked
  list of names with their role, filled counts ("Trainer 2/3 · Backup 0/2"),
  and one button for the current user: "Eintragen", "Abmelden", or a
  disabled "ausgebucht". A toggle shows only "Meine Termine". Past Termine
  are not shown.
- **`/profil`**: edit own name and phone. Email is shown read-only.

### Admin (all under `/admin`, all guarded by `requireAdmin()`)

- **`/admin`**: overview of all Termine (with a toggle to include past
  ones), color-coded: green = fully staffed, yellow = Trainer full but
  Backups missing, red = Trainer missing. Link to each Kurs and Termin.
- **`/admin/kurse/neu`**: create a Kurs.
- **`/admin/kurse/[id]`**: edit Kurs fields; list, add, edit, delete its
  Termine; delete the Kurs.
- **`/admin/termine/[id]`**: the ranked signup list with contact details;
  add any person (appended at the end, subject to capacity), remove a
  person, move a person up or down.
- **`/admin/personen`**: all people with contact details; toggle admin;
  remove a person (deletes the auth user; cascades to profile and signups).
  An admin cannot remove themselves or demote the last admin.
- **`/admin/einstellungen`**: invite link with copy and regenerate.

Destructive actions (delete Kurs, delete Termin, remove person) ask for
confirmation in an in-app dialog (shadcn AlertDialog).

## Permissions

| Action | Trainer | Admin |
|---|---|---|
| See upcoming Termine and names of signed-up people | ✓ | ✓ |
| See email/phone of others | – | ✓ |
| Sign self up / withdraw self (Termin not in the past) | ✓ | ✓ |
| Sign others up / remove / reorder (incl. past Termine) | – | ✓ |
| Create/edit/delete Kurse and Termine | – | ✓ |
| Edit own profile | ✓ | ✓ |
| Manage people, admin flag, invite link | – | ✓ |

## Business rules

- A person can be on a Termin at most once.
- Signup is rejected when the Termin is at capacity ("ausgebucht").
- Trainers can't sign up for or withdraw from Termine whose date is before
  today (Europe/Vienna). Withdrawing on the day itself is allowed.
- Admins may edit past Termine.
- Admin "add person" also respects capacity. To add more people, the admin
  raises the Kurs staffing numbers first.
- Lowering staffing numbers below the current number of signups is allowed;
  the excess signups show as "Überzählig" until the admin removes them.

## Emails

Sender: `Kurseinteilung <noreply@<domain>>`, sent via Resend. All texts in
German.

| Trigger | Recipient | Content |
|---|---|---|
| Login / invite | the person | Magic link (Supabase Auth via Resend SMTP) |
| A person withdraws themselves | all admins | Who withdrew from which Termin, new staffing state |
| Someone else's action changes a person's role (promoted, demoted, set to Überzählig) | that person | Kurs, Termin, old role → new role |
| An admin removes a person from a Termin, or deletes a Termin or Kurs they were on | that person | Kurs, Termin, "du wurdest ausgetragen" |

- The person whose own action caused a change gets no email about it.
- No emails for Termine in the past.
- Free quota: 100 emails/day, 3,000/month, which is ample.

## Error handling

- Server Actions return `{ ok: true } | { ok: false, error: string }`;
  forms show the German message inline via `useActionState`.
- Domain errors are typed (`TerminAusgebucht`, `BereitsEingetragen`,
  `TerminVorbei`, `KeineBerechtigung`, …) and mapped to German messages in
  one place.
- All form input is validated with Zod on the server.
- Unexpected errors show a generic German error page (`error.tsx`) and are
  logged to the Vercel function logs.

## Hosting and operations

### Free-tier notes

- **Supabase pauses free projects after 7 days without activity.** A daily
  Vercel Cron job calls `/api/keepalive` (protected by `CRON_SECRET`), which
  runs `SELECT 1`. The Hobby plan allows one cron run per day.
- **Vercel Hobby is for non-commercial use only.** A volunteer project for a
  non-profit with nobody paid for it is fine. If the work becomes paid, move
  to Vercel Pro or to Cloudflare Workers via OpenNext; the code works either
  way.

### Environments

- **Local**: `supabase start` (Docker) provides Postgres, Auth, and Mailpit
  (catches all emails locally). `supabase/config.toml` holds the local auth
  settings: signup disabled, magic link template, site URL. Migrations are
  applied with `drizzle-kit migrate`.
- **Production**: one Supabase free project, one Vercel project linked to the
  GitHub repo (deploys on push to `main`). Auth settings, SMTP, and email
  templates are configured in the Supabase dashboard. Migrations are applied
  with `drizzle-kit migrate` against the production `DATABASE_URL`.

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres via Supabase pooler, transaction mode |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Session handling via `@supabase/ssr` |
| `SUPABASE_SECRET_KEY` | Auth admin API (server only) |
| `RESEND_API_KEY` | Notification emails |
| `EMAIL_FROM` | e.g. `Kurseinteilung <noreply@<domain>>` |
| `APP_URL` | Public base URL, used in email links |
| `ADMIN_EMAILS` | Comma-separated bootstrap admin emails |
| `CRON_SECRET` | Protects `/api/keepalive` |

### Manual setup by the owner (only they can do these)

1. Buy `<domain>` at Cloudflare Registrar.
2. Create a Resend account, add `<domain>`, and add the DNS records in
   Cloudflare.
3. Create the Supabase project; configure SMTP (Resend), disable public
   signup, set the magic-link template, site URL, and redirect URLs; disable
   the Data API.
4. Create the Vercel project from the GitHub repo, set the env vars, and add
   `<domain>` (DNS record in Cloudflare).

## Project structure (sketch)

```
app/
  (auth)/login/  einladung/[token]/  auth/confirm/route.ts
  (app)/termine/  profil/
  admin/  kurse/neu/  kurse/[id]/  termine/[id]/  personen/  einstellungen/
  api/keepalive/route.ts
lib/
  db/        schema.ts, client.ts
  dal/       auth.ts, kurse.ts, termine.ts, signups.ts, profiles.ts, settings.ts
  staffing.ts    pure role ranking + before/after diff
  email.ts       Resend notifications
  supabase/  server.ts (cookie session client), admin.ts (secret key client)
  errors.ts      typed domain errors + German messages
components/      shadcn/ui + app components
drizzle/         generated migrations
supabase/        config.toml, email templates
proxy.ts
```

## Testing

No automated tests in this version (owner's decision). Changes are verified
by running the app locally against the local Supabase stack and checking
emails in Mailpit.

## Out of scope (v1)

- Automated tests
- Staffing numbers per Termin (they are per Kurs)
- Waitlist beyond capacity
- Trainer qualifications or topic restrictions
- Calendar export (iCal), reminders before a Termin
- Self-withdrawal deadlines
- Multiple organizations or locations as separate tenants

## Open items

- Domain name (`<domain>`), to be bought at Cloudflare Registrar.
