# Kurseinteilung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A German-language web app where an admin sets up Kurse with Termine, trainers register through a secret invite link and log in with magic links, and they sign themselves up for Termine. Roles (Trainer/Backup) come from signup order, and emails go out when roles change.

**Architecture:** Next.js 16 App Router with `cacheComponents`. Server Components render inside Suspense, and Server Actions handle mutations. All logic and authorization live in a server-only data access layer (`lib/dal/`) that talks to Supabase Postgres directly through Drizzle and postgres.js. Supabase Auth is used only for magic-link sessions. Each mutation of a Termin's signups runs in one transaction that locks the Termin rows first, diffs roles before and after, and sends notifications after commit.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript, pnpm 12, Tailwind v4 and shadcn/ui (base-nova, Base UI), Drizzle ORM 0.45 and drizzle-kit 0.31, postgres.js 3.4, @supabase/ssr 0.12 and @supabase/supabase-js 2.118, Resend 6, Zod 4, Biome 2, Supabase CLI 2.122 (dev dependency, local Docker stack).

**Spec:** `docs/superpowers/specs/2026-10-26-kurseinteilung-design.md`. Read it before starting. Where this plan says "per spec", the spec has the exact values.

## Global Constraints

- **No automated tests** (owner's decision). Verification is `pnpm typecheck`, `pnpm lint`, `pnpm build`, plus the manual checks listed per task against the local stack.
- **No RLS, no Postgres functions or triggers.** All logic lives in TypeScript under `lib/`. All app tables live in Postgres schema `app`.
- **Next.js 16 differs from your training data.** Before writing Next-specific code, read the matching guide in `node_modules/next/dist/docs/` (for example `01-app/02-guides/authentication-with-cache-components.md`, `01-app/03-api-reference/04-functions/refresh.md`, `01-app/03-api-reference/03-file-conventions/proxy.md`).
- **`cacheComponents: true`.** Never read `cookies()`, `params`, `searchParams` or the database outside a `<Suspense>` boundary. Each route group has a `loading.tsx`, which provides that boundary for its pages. Don't use `"use cache"` for signup data (see the spec's Caching section).
- **Every exported DAL function** in `lib/dal/` starts with `import "server-only"` at file level and calls `requireUser()` or `requireAdmin()` as its first statement, except the auth-flow functions explicitly marked unguarded.
- **Server Actions** are thin. They parse `FormData` with Zod, call one DAL function, and return an `ActionResult` via `runAction()`, which calls `refresh()` on success.
- **UI copy is German** ("du" form). Use `<html lang="de">`. The app name is "Kurseinteilung". Never use "Rotes Kreuz" or a red cross emblem anywhere.
- **Dates and times** are wall-clock values in Europe/Vienna. "Today" is computed only via `todayInVienna()` in `lib/dates.ts`. Never use `toISOString().slice(0, 10)`.
- **Emails** are trimmed and lowercased on input, in every Zod schema that accepts an email.
- **shadcn base-nova uses Base UI**, not Radix. Compose with the `render` prop, not `asChild`.
- **pnpm 12 blocks dependency build scripts.** `pnpm-workspace.yaml` must contain `allowBuilds:` with `esbuild: true` and `supabase: true`.
- Commit after every task with a conventional-commit message ending in the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

There are no automated tests, so each item below has a manual or code check in its owning task.

1. **Two people click "Eintragen" on the last free spot at the same moment.** Exactly one gets the spot and the other sees "ausgebucht". (Task 6: the lock is taken with `FOR UPDATE` before signups are counted, in the same transaction.)
2. **Someone in the middle of the list withdraws.** The people behind move up, a Backup becomes Trainer, the promoted person gets an email, admins get a withdrawal email, and the person who withdrew gets nothing. (Task 7, manual check.)
3. **A magic link is opened in a different browser, is expired, or was requested for an unknown email.** The first logs in. An expired one lands on `/login` with a message. An unknown email gets the same "Link gesendet" message as a known one. (Task 5, manual check.)
4. **An admin lowers a Kurs's staffing numbers below the current signups, then raises them again.** The extra people show as "Überzählig", and raising the numbers promotes them and emails them. (Task 8, manual check.)
5. **A Termin happening today, with the server running in UTC.** Before 01:00/02:00 Vienna time it must still count as today: visible and withdrawable. (Task 3: `todayInVienna()` uses `Intl` with an explicit time zone. Task 10: grep for `toISOString`.)

---

## File Structure

```
app/
  layout.tsx                         root html (lang="de"), font, metadata
  globals.css                        tailwind + shadcn (generated)
  page.tsx                           redirect("/termine")
  error.tsx                          generic German error UI ("use client")
  (auth)/layout.tsx                  centered narrow layout, no nav
  (auth)/loading.tsx
  (auth)/login/page.tsx              login form page, shows ?fehler= message
  (auth)/login/login-form.tsx        client form (useActionState)
  (auth)/login/actions.ts            requestLoginLink
  (auth)/einladung/[token]/page.tsx  validates token, renders invite form or "ungültig"
  (auth)/einladung/[token]/invite-form.tsx
  (auth)/einladung/[token]/actions.ts registerViaInvite
  auth/confirm/route.ts              verifyOtp → redirect
  (app)/layout.tsx                   header (static) + <Suspense> user nav + children
  (app)/loading.tsx
  (app)/actions.ts                   logout
  (app)/termine/page.tsx             upcoming Termine for trainers
  (app)/termine/actions.ts           signUp, withdraw
  (app)/profil/page.tsx, profile-form.tsx, actions.ts
  (app)/admin/page.tsx               overview
  (app)/admin/kurse/neu/page.tsx
  (app)/admin/kurse/[id]/page.tsx
  (app)/admin/kurse/actions.ts       kurs + termin CRUD actions
  (app)/admin/termine/[id]/page.tsx  termin edit + signup management
  (app)/admin/termine/actions.ts     admin signup actions
  (app)/admin/personen/page.tsx, actions.ts
  (app)/admin/einstellungen/page.tsx, actions.ts, copy-button.tsx
  api/keepalive/route.ts
components/
  ui/*                               shadcn generated
  user-nav.tsx                       server: name, admin link, logout button
  submit-button.tsx                  client: useFormStatus pending state
  form-message.tsx                   renders ActionResult
  confirm-dialog.tsx                 client: AlertDialog + form for destructive actions
  termin-card.tsx                    server: one Termin with ranked names
  signup-button.tsx                  client: Eintragen/Abmelden/ausgebucht
  staffing-badge.tsx                 status color + "Trainer 2/3 · Backup 0/2"
  kurs-form.tsx, termin-form.tsx     client forms reused by create/edit pages
lib/
  env.ts                             zod-validated process.env
  dates.ts                           Vienna date helpers + German formatting
  errors.ts                          DomainError + German messages
  action-result.ts                   ActionResult type + runAction()
  validation.ts                      zod schemas for all forms
  staffing.ts                        pure: roles from rank, status, diff
  email.ts                           sendEmail (Resend or console)
  notifications.ts                   German notification texts + sending
  db/schema.ts, db/client.ts
  supabase/server.ts                 cookie session client
  supabase/service.ts                secret-key client (admin API, sending OTP)
  dal/auth.ts                        getCurrentUser, requireUser, requireAdmin
  dal/auth-flows.ts                  sendLoginLink, registerViaInvite (unguarded)
  dal/settings.ts                    invite token
  dal/staffing-tx.ts                 mutateStaffing transaction core
  dal/read-model.ts                  KursView/TerminView loaders
  dal/signups.ts                     self + admin signup mutations
  dal/kurse.ts                       kurs + termin CRUD
  dal/profiles.ts                    profile, people, accounts
supabase/config.toml, supabase/templates/magic-link.html
drizzle.config.ts, drizzle/          generated migrations
proxy.ts
vercel.json
.env.example
README.md, AGENTS.md, CLAUDE.md
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: everything `create-next-app` generates, `components.json`, `components/ui/*`, `lib/utils.ts`, `.env.example`, `CLAUDE.md`
- Modify: `package.json`, `pnpm-workspace.yaml`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`

**Interfaces:**
- Produces: the `pnpm` scripts `dev`, `build`, `start`, `lint` (`biome check`), `format` (`biome format --write`), `typecheck` (`tsc --noEmit`), `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`), `sb:start` (`supabase start`), `sb:stop` (`supabase stop`). Also the shadcn components `button input label textarea card badge table alert-dialog separator`.

- [ ] **Step 1: Scaffold into the repo root.** The folder already contains `.git` and `docs/`, which create-next-app allows.

Run: `pnpm create next-app@16.4.3 . --ts --tailwind --app --no-src-dir --import-alias "@/*" --use-pnpm --biome --yes`
Expected: "Success! Created kurseinteilung". If it refuses because the folder isn't empty, scaffold into the scratchpad and copy everything except `.git` into the repo.

- [ ] **Step 2: Keep the generated `next.config.ts` as is** (`cacheComponents: true`, `partialPrefetching: true`, `reactCompiler: true`, Tailwind turbopack loader). Set `pnpm-workspace.yaml` to:

```yaml
allowBuilds:
  esbuild: true
  sharp: false
  supabase: true
  unrs-resolver: false
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm add drizzle-orm postgres @supabase/ssr @supabase/supabase-js resend zod server-only && pnpm add -D drizzle-kit supabase`
Expected: installs without "Ignored build scripts" errors. Then `pnpm exec supabase --version` prints `2.122.0` or newer.

- [ ] **Step 4: Initialize shadcn and add components**

Run: `pnpm dlx shadcn@latest init -d --no-monorepo && pnpm dlx shadcn@latest add button input label textarea card badge table alert-dialog separator -y`
Expected: `components.json` has `"style": "base-nova"` and the files exist in `components/ui/`.

- [ ] **Step 5: Add the scripts from Interfaces to `package.json`.** In `app/layout.tsx`, set `<html lang="de">` and metadata `{ title: "Kurseinteilung", description: "Einteilung von Trainer:innen für Kurse" }`. Replace `app/page.tsx` with a component that calls `redirect("/termine")`.

- [ ] **Step 6: Create `.env.example`** with every variable from the spec's env table, each with an empty value and a one-line comment. Add `.env*.local` to `.gitignore` if it's missing. Create `CLAUDE.md` containing `@AGENTS.md`. Below the Next.js block in `AGENTS.md`, add a short "Project" section listing the pnpm scripts and pointing to the spec.

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all three succeed. The build output lists `/` and `/_not-found`.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js 16 app with shadcn, drizzle, supabase deps"
```

---

### Task 2: Local Supabase, env, and database schema

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/templates/magic-link.html`, `lib/env.ts`, `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`, `drizzle/*` (generated), `.env.local` (not committed)

**Interfaces:**
- Produces:
  - `env` from `lib/env.ts`: `{ DATABASE_URL: string; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; SUPABASE_SECRET_KEY: string; RESEND_API_KEY?: string; EMAIL_FROM: string; APP_URL: string; ADMIN_EMAILS: string[] /* lowercased */; CRON_SECRET: string }`
  - From `lib/db/schema.ts`: `appSchema = pgSchema("app")`, and tables `profiles`, `kurse`, `termine`, `signups`, `appSettings` with columns per the spec's data model, as camelCase TypeScript fields mapped to snake_case by `casing: "snake_case"`. Also `authUsers` re-exported from `drizzle-orm/supabase`.
  - From `lib/db/client.ts`: `db` (a Drizzle instance with the schema) and `type Tx` (the transaction parameter type of `db.transaction`).

- [ ] **Step 1: Initialize Supabase**

Run: `pnpm exec supabase init --yes`

- [ ] **Step 2: Edit `supabase/config.toml`.** Change only these keys and leave everything else at its default:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/confirm"]
enable_signup = false          # blocks public signups; admin API still works

[auth.email]
enable_signup = true           # KEEP true: false disables the email provider and magic links
enable_confirmations = false

[auth.email.template.magic_link]
subject = "Dein Login-Link für die Kurseinteilung"
content_path = "./supabase/templates/magic-link.html"

[realtime]
enabled = false
[storage]
enabled = false
[edge_runtime]
enabled = false
[analytics]
enabled = false
```

- [ ] **Step 3: Write `supabase/templates/magic-link.html`.** This copy is final:

```html
<h2>Login bei der Kurseinteilung</h2>
<p>Klicke auf den folgenden Link, um dich anzumelden:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Jetzt anmelden</a></p>
<p>Der Link ist eine Stunde gültig. Wenn du keinen Login angefordert hast, kannst du diese E-Mail ignorieren.</p>
```

- [ ] **Step 4: Start the stack and fill in `.env.local`**

Run: `pnpm sb:start && pnpm exec supabase status -o env`
Expected: values for the API URL, DB URL and the publishable and secret keys. Write `.env.local`:
- `DATABASE_URL`: the DB URL (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
- `SUPABASE_URL`: the API URL (`http://127.0.0.1:54321`)
- `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`: the two keys
- `EMAIL_FROM`: `Kurseinteilung <noreply@localhost>`
- `APP_URL`: `http://localhost:3000`
- `ADMIN_EMAILS`: `lucas@base3.at`
- `CRON_SECRET`: `dev-secret`

Mailpit's UI runs at `http://127.0.0.1:54324`.

- [ ] **Step 5: Implement `lib/env.ts`.** Parse `process.env` with Zod at import time. `ADMIN_EMAILS` is a comma-separated string, transformed to a trimmed, lowercased array without empty entries. `RESEND_API_KEY` is optional; every other variable is required.

- [ ] **Step 6: Implement `lib/db/schema.ts`.** Follow the spec's data model exactly, with these specifics:
  - `uuid().primaryKey().defaultRandom()` for IDs.
  - `date({ mode: "string" })` for `termine.date`, and `time()` for the start and end times.
  - `profiles.id` references `authUsers.id` with `onDelete: "cascade"`.
  - Add `unique().on(t.terminId, t.profileId)` and `index().on(t.terminId, t.position)` on `signups`.
  - Write the CHECK constraints from the spec with `check()`.
  - `appSettings` has `id integer primary key` with `check(id = 1)` and `inviteToken text not null`.

- [ ] **Step 7: Implement `lib/db/client.ts`.** Start with `import "server-only"`. Call `postgres(env.DATABASE_URL, { prepare: false, max: 5 })`, reusing the client through `globalThis` in development so hot reloads don't leak connections. Then `drizzle(client, { schema, casing: "snake_case" })` and export `type Tx`.

- [ ] **Step 8: Write `drizzle.config.ts`.** Call `process.loadEnvFile(".env.local")` inside a try/catch so it doesn't fail in CI. Then `defineConfig({ schema: "./lib/db/schema.ts", out: "./drizzle", dialect: "postgresql", casing: "snake_case", schemaFilter: ["app"], dbCredentials: { url: process.env.DATABASE_URL! } })`.

- [ ] **Step 9: Generate and apply the migration**

Run: `pnpm db:generate && pnpm db:migrate`
Expected: one SQL file in `drizzle/` containing `CREATE SCHEMA "app"`, five tables, and a foreign key to `"auth"."users"`. Then check the tables:

Run: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c '\dt app.*'`
Expected: `app_settings`, `kurse`, `profiles`, `signups`, `termine`. (If `psql` isn't installed, run `docker exec` into the `supabase_db_*` container and use its `psql`.)

- [ ] **Step 10: Verify and commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add -A && git commit -m "feat: local supabase config and drizzle schema in app schema"
```

---

### Task 3: Domain primitives

**Files:**
- Create: `lib/staffing.ts`, `lib/dates.ts`, `lib/errors.ts`, `lib/validation.ts`, `lib/action-result.ts`

**Interfaces:**
- Produces from `lib/staffing.ts` (pure, with no imports from `lib/db`):
  - `type Role = "trainer" | "backup" | "ueberzaehlig"`
  - `const ROLE_LABEL: Record<Role, string>`: `{ trainer: "Trainer", backup: "Backup", ueberzaehlig: "Überzählig" }`
  - `type Staffing = { trainersNeeded: number; backupsNeeded: number }`
  - `capacity(s: Staffing): number`
  - `rankSignups<T extends { position: number; createdAt: Date }>(signups: T[], s: Staffing): Array<T & { role: Role; rank: number }>` sorts by position, then createdAt. Rank is 1-based. Ranks up to `trainersNeeded` are trainers, the next `backupsNeeded` are backups, and the rest are `ueberzaehlig`.
  - `type StaffingStatus = "voll" | "backup-fehlt" | "trainer-fehlt"`
  - `staffingStatus(signupCount: number, s: Staffing): StaffingStatus`
  - `type RoleSnapshot = Map<string /* terminId */, Map<string /* profileId */, Role>>`
  - `type RoleChange = { terminId: string; profileId: string; from: Role | null; to: Role | null }`
  - `diffRoles(before: RoleSnapshot, after: RoleSnapshot): RoleChange[]` returns only entries where from ≠ to. A Termin missing from `after` means everyone in it has `to: null`.
- Produces from `lib/dates.ts`:
  - `todayInVienna(): string` returns `YYYY-MM-DD`, via `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" })`
  - `isPastDate(date: string): boolean` (`date < todayInVienna()`)
  - `formatDate(date: string): string` returns e.g. `"Sa, 07.11.2026"` (de-AT, weekday short, formatted as UTC from the date string)
  - `formatTime(time: string): string` turns `"09:00:00"` into `"09:00"`
  - `formatTerminWhen(t: { date: string; startTime: string; endTime: string }): string` returns `"Sa, 07.11.2026, 09:00–17:00"`
- Produces from `lib/errors.ts`: `class DomainError extends Error { code: DomainErrorCode }` built with `new DomainError(code)`, where the message comes from this map (copy is final):

| code | message |
|---|---|
| `ausgebucht` | Dieser Termin ist leider schon ausgebucht. |
| `bereits-eingetragen` | Diese Person ist für den Termin bereits eingetragen. |
| `nicht-eingetragen` | Diese Person ist für den Termin nicht eingetragen. |
| `termin-vorbei` | Dieser Termin liegt in der Vergangenheit. |
| `nicht-gefunden` | Eintrag nicht gefunden. |
| `einladung-ungueltig` | Dieser Einladungslink ist ungültig – bitte beim Admin melden. |
| `letzter-admin` | Der letzte Admin kann nicht entfernt oder herabgestuft werden. |
| `admin-aus-env` | Dieser Admin ist fix eingetragen und kann hier nicht geändert werden. |
| `selbst-entfernen` | Du kannst dich nicht selbst entfernen. |

- Produces from `lib/validation.ts` (Zod schemas with German messages): `emailSchema`, `loginSchema { email }`, `inviteSchema { fullName, email, phone? }`, `profileSchema { fullName, phone? }`, `kursSchema { title, description, trainersNeeded (int ≥ 1), backupsNeeded (int ≥ 0) }`, `terminSchema { date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM, > startTime), topic, location? }`, `uuidSchema`. Use `z.coerce.number()` for numbers coming from FormData, and turn empty strings into `null` for optional text fields.
- Produces from `lib/action-result.ts`:
  - `type ActionResult = { ok: true; message?: string } | { ok: false; error: string } | null`
  - `runAction(fn: () => Promise<string | void>): Promise<ActionResult>`. It calls `unstable_rethrow(e)` first in the catch block, so redirects pass through. A `DomainError` becomes its message, a `ZodError` becomes the first issue's message, and anything else is logged with `console.error` and becomes `"Etwas ist schiefgelaufen. Bitte versuch es nochmal."`. On success it calls `refresh()` from `next/cache` and returns `{ ok: true, message }`, using the string `fn` returned as the message.

- [ ] **Step 1: Implement the five files** as specified in Interfaces.
- [ ] **Step 2: Sanity-check the date helper against Review Focus #5.** Run it under a time zone where the UTC date differs from Vienna's:

Run: `TZ=America/Los_Angeles node -e 'console.log(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Vienna"}).format(new Date()))'`
Expected: today's date in Vienna.

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck && pnpm lint`

```bash
git add -A && git commit -m "feat: staffing rules, dates, errors, validation, action results"
```

---

### Task 4: Supabase clients, proxy, and auth guards

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/service.ts`, `proxy.ts`, `lib/dal/auth.ts`

**Interfaces:**
- Consumes: `env`, `db`, `profiles`.
- Produces:
  - `createSupabaseServerClient(): Promise<SupabaseClient>` in `lib/supabase/server.ts`. It uses `createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll, setAll } })` with `cookies()` from `next/headers`. `setAll` is wrapped in try/catch, because Server Components can't set cookies and the proxy refreshes them instead.
  - `supabaseService` in `lib/supabase/service.ts`: `createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`, server-only.
  - In `lib/dal/auth.ts`:
    - `type CurrentUser = { id: string; fullName: string; email: string; phone: string | null; isAdmin: boolean; isEnvAdmin: boolean }`
    - `isEnvAdmin(email: string): boolean`
    - `getCurrentUser = cache(async (): Promise<CurrentUser | null>)`, using React `cache` for per-request dedupe. It calls `supabase.auth.getClaims()`, takes `claims.sub`, and loads the profile by id. It returns `null` if there are no claims or no profile. `isAdmin` is `profile.isAdmin || isEnvAdmin(profile.email)`.
    - `requireUser(): Promise<CurrentUser>` calls `redirect("/login")` when there's no user.
    - `requireAdmin(): Promise<CurrentUser>` calls `redirect("/termine")` when the user isn't an admin.

- [ ] **Step 1: Implement both Supabase clients.**
- [ ] **Step 2: Implement `proxy.ts`.** Export `async function proxy(request: NextRequest)` using Supabase's standard SSR proxy pattern: create the server client on request and response cookies, then `await supabase.auth.getClaims()`. If there are no claims and the path isn't public (`/login`, `/einladung/*`, `/auth/*`, `/api/keepalive`), redirect to `/login`. Otherwise return the response that carries the refreshed cookies. Set `config.matcher` to exclude `_next/static`, `_next/image`, `favicon.ico` and image files. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first.
- [ ] **Step 3: Implement `lib/dal/auth.ts`.**
- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`, then `pnpm dev` and `curl -sI http://localhost:3000/termine | head -3`
Expected: the build succeeds, and curl shows a `307` with `location: /login`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: supabase session handling, proxy redirect, DAL auth guards"
```

---

### Task 5: Login, invite, and magic-link flows

**Files:**
- Create: `lib/dal/settings.ts`, `lib/dal/auth-flows.ts`, `app/(auth)/layout.tsx`, `app/(auth)/loading.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/login/login-form.tsx`, `app/(auth)/login/actions.ts`, `app/(auth)/einladung/[token]/page.tsx`, `app/(auth)/einladung/[token]/invite-form.tsx`, `app/(auth)/einladung/[token]/actions.ts`, `app/auth/confirm/route.ts`, `components/submit-button.tsx`, `components/form-message.tsx`
- Modify: `lib/dal/profiles.ts` (create it with `createAccount`)

**Interfaces:**
- Consumes: `supabaseService`, `createSupabaseServerClient`, `db`, `profiles`, `authUsers`, `appSettings`, `isEnvAdmin`, `DomainError`, `runAction`, `loginSchema`, `inviteSchema`.
- Produces:
  - In `lib/dal/settings.ts`:
    - `isValidInviteToken(token: string): Promise<boolean>` (unguarded). It compares with `crypto.timingSafeEqual` after an equal-length check.
    - `getInviteToken(): Promise<string>` (requires admin)
    - `regenerateInviteToken(): Promise<void>` (requires admin)
    - Internal `ensureSettings()` runs `INSERT … ON CONFLICT DO NOTHING` with `randomBytes(18).toString("base64url")` (24 characters), then selects the row.
  - In `lib/dal/profiles.ts`: `createAccount(input: { email: string; fullName: string; phone: string | null }): Promise<string /* user id */>` (internal, unguarded, not used by actions directly). It looks up `authUsers` by email. If there's no user, it calls `supabaseService.auth.admin.createUser({ email, email_confirm: true })`. Then it upserts the profile (`onConflictDoNothing` on id) and returns the id.
  - In `lib/dal/auth-flows.ts` (all unguarded):
    - `sendLoginLink(email: string): Promise<void>`. If the email has no profile and `isEnvAdmin(email)`, it first calls `createAccount({ email, fullName: localPart, phone: null })`. Then it calls `supabaseService.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`. Errors for unknown users are swallowed so that every email gets the same response. Other errors are logged and rethrown.
    - `registerViaInvite(token: string, input: { fullName: string; email: string; phone: string | null }): Promise<void>`. It throws `DomainError("einladung-ungueltig")` if the token is invalid. If a profile with this email already exists, it only sends the login link. Otherwise it calls `createAccount` and then sends the login link.

- [ ] **Step 1: Implement `settings.ts`, `createAccount`, and `auth-flows.ts`.**
- [ ] **Step 2: Implement the shared form components.** `SubmitButton({ children, pendingText? })` uses `useFormStatus` to disable itself while pending. `FormMessage({ result }: { result: ActionResult })` renders a green message or a red error, or nothing when the result is `null`.
- [ ] **Step 3: Build `/login`.** The page renders a card with the title "Anmelden", the text "Wir schicken dir einen Login-Link per E-Mail.", and the login form. If `searchParams.fehler === "link-abgelaufen"`, it shows "Der Login-Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an." The action `requestLoginLink(prev, formData)` returns `runAction(async () => { await sendLoginLink(...); return "Wir haben dir einen Login-Link geschickt. Schau in dein Postfach." })`.
- [ ] **Step 4: Build `/einladung/[token]`.** The page checks `isValidInviteToken`. If the token is invalid, it shows the `einladung-ungueltig` message and a link to `/login`. Otherwise it shows the title "Registrieren" and a form with "Name", "E-Mail" and "Telefon (optional)", plus a hidden token field. The action `registerViaInvite` returns the same "Login-Link geschickt" message.
- [ ] **Step 5: Implement `app/auth/confirm/route.ts`.** The `GET` handler reads `token_hash` and `type` from the search params and calls `(await createSupabaseServerClient()).auth.verifyOtp({ token_hash, type })`. On success it redirects to `/termine`, and on any error to `/login?fehler=link-abgelaufen`.
- [ ] **Step 6: Manual check, admin bootstrap and Review Focus #3.** With `pnpm dev` running:
  1. On `/login`, submit `lucas@base3.at`. The page shows the "Login-Link geschickt" message, and a message arrives in Mailpit (`http://127.0.0.1:54324`). Opening its link lands on `/termine`. (The page may 404 because it isn't built yet, but the URL must be `/termine`, not `/login`.)
  2. Copy the link from step 1 again and open it in a private window. Expected: `/login?fehler=link-abgelaufen`, because the token was already used.
  3. Submit `unknown@example.com` on `/login`. Expected: the same success message and no email in Mailpit.
  4. Get the token with `psql … -c 'select invite_token from app.app_settings'`. Open `/einladung/<token>`, register "Test Trainer" / `trainer1@example.com`, then open the magic link from Mailpit. Expected: you land on `/termine`, and `select full_name from app.profiles` lists the new person.
  5. Open `/einladung/wrong`. Expected: the "ungültig" message.
  6. Confirm that public signup is blocked: `curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "content-type: application/json" -d '{"email":"x@example.com","password":"secret123"}'`. Expected: an error response containing "Signups not allowed".
- [ ] **Step 7: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A && git commit -m "feat: magic-link login, invite registration, admin bootstrap"
```

---

### Task 6: Staffing transaction core and notifications

**Files:**
- Create: `lib/dal/staffing-tx.ts`, `lib/email.ts`, `lib/notifications.ts`

**Interfaces:**
- Consumes: `db`, `Tx`, the tables, `rankSignups`, `diffRoles`, `RoleSnapshot`, `RoleChange`, `staffingStatus`, `isPastDate`, `formatTerminWhen`, `ROLE_LABEL`, `env`, `isEnvAdmin`.
- Produces:
  - In `lib/dal/staffing-tx.ts`:
    - `type LockedTermin = { id: string; kursId: string; kursTitle: string; date: string; startTime: string; endTime: string; topic: string; trainersNeeded: number; backupsNeeded: number }`
    - `mutateStaffing<T>(opts: { actorId: string; terminIds: (tx: Tx) => Promise<string[]>; run: (tx: Tx, termine: Map<string, LockedTermin>) => Promise<T> }): Promise<T>`
    - Helpers: `appendSignup(tx: Tx, termin: LockedTermin, profileId: string): Promise<void>` and `removeSignup(tx: Tx, terminId: string, profileId: string): Promise<void>`
  - In `lib/email.ts`: `sendEmail(msg: { to: string; subject: string; text: string }): Promise<void>`. It sends with Resend when `env.RESEND_API_KEY` is set and otherwise uses `console.info("[email]", msg)`. It throws on Resend errors.
  - In `lib/notifications.ts`: `type StaffingChange = RoleChange & { termin: LockedTermin; person: { fullName: string; email: string } }` and `sendStaffingNotifications(changes: StaffingChange[], ctx: { actorId: string; terminStateAfter: Map<string, { trainers: number; backups: number }> }): Promise<void>`. The withdrawal email's `{actorName}` is `change.person.fullName`, because the person who withdrew is the actor. It never throws: each email is wrapped in try/catch and logged.

- [ ] **Step 1: Implement `mutateStaffing`** with this algorithm:

```
const out = await db.transaction(async (tx) => {
  const ids = [...new Set(await opts.terminIds(tx))].sort()          // fixed lock order prevents deadlocks
  const before = await loadLocked(tx, ids, { lock: true })          // termine JOIN kurse … FOR UPDATE OF termine
  const beforeSignups = await loadSignups(tx, ids)                  // signups JOIN profiles (name, email)
  const result = await opts.run(tx, before)
  const after = await loadLocked(tx, ids, { lock: false })          // staffing may have changed; deleted termine are absent
  const afterSignups = await loadSignups(tx, ids)
  const changes = diffRoles(snapshot(before, beforeSignups), snapshot(after, afterSignups))
  const existingProfileIds = await profileIdsThatStillExist(tx, changes)   // excludes people deleted in `run`
  return { result, changes, before, beforeSignups, afterSignups, existingProfileIds }
})
// after commit:
//   drop changes whose termin date isPastDate (use `before` termin data)
//   drop changes whose profileId is not in existingProfileIds
//   enrich with termin (from `before`) + person (from beforeSignups ∪ afterSignups)
//   terminStateAfter = trainer/backup counts per termin from ranked afterSignups
await sendStaffingNotifications(enriched, { actorId, terminStateAfter })
return out.result
```

`loadLocked` uses Drizzle `.for("update", { of: termine })`. Ranking always goes through `rankSignups`.

`appendSignup`:
1. Count the termin's signups. If the count is at or above `capacity(termin)`, throw `DomainError("ausgebucht")`.
2. If the profile is already signed up, throw `bereits-eingetragen`.
3. Insert with `position = coalesce(max(position), 0) + 1`.

`removeSignup`:
1. Delete the row returning its position. If no row was deleted, throw `nicht-eingetragen`.
2. Run `update signups set position = position - 1 where termin_id = ? and position > ?`.

**Review Focus #1 code check:** the `FOR UPDATE` select is the first statement in the transaction, before any count. Each mutation that touches signups goes through `mutateStaffing`.

- [ ] **Step 2: Implement `email.ts` and `notifications.ts`.** Recipients and content follow the spec's Emails table:
  - A change with `profileId === actorId` and `to === null` is a self-withdrawal. Email every admin except the actor. Admins are profiles with `is_admin`, or whose email is in `ADMIN_EMAILS`.
  - For a change with `profileId !== actorId`, email that person.
  - Changes caused by the actor to themselves (signing up, being added by their own action) send nothing.

  All emails end with `\n\nKurseinteilung` and use `formatTerminWhen`. The texts are final:

  - **Withdrawal (to admins).** Subject: `Abmeldung: {kursTitle}, {formatDate(date)}`. Body: `{actorName} hat sich von „{kursTitle} – {topic}“ am {when} abgemeldet.\n\nAktueller Stand: Trainer {t}/{trainersNeeded}, Backup {b}/{backupsNeeded}.\n\n{APP_URL}/admin/termine/{id}`
  - **Role changed** (from and to both set). Subject: `Neue Rolle: {kursTitle}, {formatDate(date)}`. Body: `Hallo {fullName},\n\ndeine Rolle für „{kursTitle} – {topic}“ am {when} hat sich geändert: {ROLE_LABEL[from]} → {ROLE_LABEL[to]}.\n\n{APP_URL}/termine`
  - **Added by someone else** (from null). Subject: `Eingetragen: {kursTitle}, {formatDate(date)}`. Body: `Hallo {fullName},\n\ndu wurdest für „{kursTitle} – {topic}“ am {when} als {ROLE_LABEL[to]} eingetragen.\n\n{APP_URL}/termine`
  - **Removed by someone else** (to null). Subject: `Ausgetragen: {kursTitle}, {formatDate(date)}`. Body: `Hallo {fullName},\n\ndu wurdest von „{kursTitle} – {topic}“ am {when} ausgetragen.\n\n{APP_URL}/termine`

- [ ] **Step 3: Verify and commit.** Behavior is checked manually in Tasks 7 to 9, once the UI calls this code.

Run: `pnpm typecheck && pnpm lint`

```bash
git add -A && git commit -m "feat: locked staffing transactions with role diff notifications"
```

---

### Task 7: App shell and trainer pages

**Files:**
- Create: `lib/dal/read-model.ts`, `lib/dal/signups.ts` (self functions), `app/(app)/layout.tsx`, `app/(app)/loading.tsx`, `app/(app)/actions.ts`, `app/(app)/termine/page.tsx`, `app/(app)/termine/actions.ts`, `app/(app)/profil/page.tsx`, `app/(app)/profil/profile-form.tsx`, `app/(app)/profil/actions.ts`, `components/user-nav.tsx`, `components/termin-card.tsx`, `components/signup-button.tsx`, `components/staffing-badge.tsx`, `app/error.tsx`
- Modify: `lib/dal/profiles.ts` (add `updateOwnProfile`)

**Interfaces:**
- Consumes: `requireUser`, `getCurrentUser`, `mutateStaffing`, `appendSignup`, `removeSignup`, `rankSignups`, `staffingStatus`, `todayInVienna`, `isPastDate`, `runAction`, the schemas, `createSupabaseServerClient`.
- Produces:
  - In `lib/dal/read-model.ts`:
    - `type SignupView = { profileId: string; fullName: string; rank: number; role: Role }`
    - `type AdminSignupView = SignupView & { email: string; phone: string | null }`
    - `type TerminView<S = SignupView> = { id: string; kursId: string; date: string; startTime: string; endTime: string; topic: string; location: string | null; signups: S[]; trainerCount: number; backupCount: number; status: StaffingStatus; isFull: boolean; isPast: boolean }`
    - `type KursView<S = SignupView> = { id: string; title: string; description: string; trainersNeeded: number; backupsNeeded: number; termine: TerminView<S>[] }`, with Termine sorted by date, then start time
    - `getUpcomingKurse(): Promise<KursView[]>` requires a user. It includes only Termine with `date >= todayInVienna()`, drops Kurse with no upcoming Termine, sorts Kurse by their first Termin date, and strips contact fields.
    - The internal `loadKursViews(filter): Promise<KursView<AdminSignupView>[]>` runs three queries (kurse, termine, signups joined with profiles) and assembles them with `rankSignups`. Task 8 adds admin getters on top of it.
  - In `lib/dal/signups.ts`: `signUpSelf(terminId: string): Promise<void>` and `withdrawSelf(terminId: string): Promise<void>`. Both require a user, throw `termin-vorbei` if `isPastDate`, and go through `mutateStaffing`.
  - In `lib/dal/profiles.ts`: `updateOwnProfile(input: { fullName: string; phone: string | null }): Promise<void>` (requires a user).
  - Actions:
    - `signUp(prev, fd)` and `withdraw(prev, fd)` in `app/(app)/termine/actions.ts`, with success messages "Du bist eingetragen." and "Du bist ausgetragen."
    - `saveProfile(prev, fd)` with the message "Gespeichert."
    - `logout()` in `app/(app)/actions.ts`: `signOut()`, then `redirect("/login")`.

- [ ] **Step 1: Implement `read-model.ts`, the self signup functions, and `updateOwnProfile`.**
- [ ] **Step 2: Build the layout.**
  - The `(app)/layout.tsx` header shows "Kurseinteilung" (linked to `/termine`) and nav links "Termine" and "Profil" as static content.
  - `<Suspense fallback={null}><UserNav /></Suspense>`: `UserNav` shows the user's name, an "Admin" link if `isAdmin`, and an "Abmelden" button (a form posting to `logout`).
  - The main content is `{children}`. `(app)/loading.tsx` renders a simple skeleton.
  - `app/error.tsx` shows "Etwas ist schiefgelaufen." with a "Nochmal versuchen" button that calls `reset`.
- [ ] **Step 3: Build `/termine`.**
  - It shows the heading "Termine" and a toggle link between "Alle" and "Meine Termine" (`?meine=1`). Under `meine=1`, it only shows Termine where the current user is signed up.
  - Each Kurs is a section with its title and description, containing one `TerminCard` per Termin.
  - `TerminCard` shows `formatTerminWhen`, the topic, the location if set, and a `StaffingBadge`. It lists names in rank order, grouped as "Trainer", "Backup" and "Überzählig" (the last group only if non-empty), marking the current user with "(du)". It ends with a `SignupButton`.
  - `SignupButton` is a client component taking `{ terminId, state: "eintragen" | "abmelden" | "ausgebucht" }` and using `useActionState`. "ausgebucht" renders a disabled button. Errors show with `FormMessage`.
  - `StaffingBadge` shows `Trainer {t}/{n} · Backup {b}/{m}` with a colored dot: green for `voll`, amber for `backup-fehlt`, red for `trainer-fehlt`.
  - If there are no Termine, show "Aktuell sind keine Termine geplant."
- [ ] **Step 4: Build `/profil`.** A form with name and phone, plus the email shown read-only.
- [ ] **Step 5: Seed test data for the manual checks** (an admin UI only arrives in Task 8):

```sql
insert into app.kurse (title, description, trainers_needed, backups_needed)
  values ('Erste-Hilfe Grundkurs', '16h Grundkurs', 1, 1) returning id;
-- then, with that id, a Termin for today and one in the future:
insert into app.termine (kurs_id, date, start_time, end_time, topic)
  values ('<id>', current_date, '09:00', '17:00', 'Grundlagen & Notruf'),
         ('<id>', current_date + 7, '09:00', '17:00', 'Reanimation & AED');
```

- [ ] **Step 6: Manual check, Review Focus #2.** Use three accounts: admin `lucas@base3.at`, and `trainer1@` and `trainer2@` registered through the invite link, each in its own browser profile or private window.
  1. trainer1 clicks "Eintragen" on the future Termin and becomes Trainer. trainer2 does the same and becomes Backup. For the admin the Termin now shows "ausgebucht".
  2. trainer1 clicks "Abmelden". Expected: trainer2 is now listed as Trainer. The server console shows a "Neue Rolle" email to trainer2 (Backup → Trainer) and an "Abmeldung" email to `lucas@base3.at`. Nothing is sent to trainer1.
  3. `select position from app.signups` shows `1` for trainer2.
  4. The Termin dated today is listed and can be signed up for.
  5. "Meine Termine" filters correctly, and "Abmelden" in the header logs out.
- [ ] **Step 7: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A && git commit -m "feat: trainer termine list with self signup, profile, app shell"
```

---

### Task 8: Admin Kurse and Termine management

**Files:**
- Create: `lib/dal/kurse.ts`, `app/(app)/admin/page.tsx`, `app/(app)/admin/kurse/neu/page.tsx`, `app/(app)/admin/kurse/[id]/page.tsx`, `app/(app)/admin/kurse/actions.ts`, `components/kurs-form.tsx`, `components/termin-form.tsx`, `components/confirm-dialog.tsx`
- Modify: `lib/dal/read-model.ts` (add the admin getters)

**Interfaces:**
- Consumes: `requireAdmin`, `mutateStaffing`, `loadKursViews`, `kursSchema`, `terminSchema`, `runAction`.
- Produces:
  - In `lib/dal/read-model.ts`, both requiring admin:
    - `getAdminKurse(opts: { includePast: boolean }): Promise<KursView<AdminSignupView>[]>` includes Kurse without Termine, sorted by title.
    - `getAdminKurs(id: string): Promise<KursView<AdminSignupView>>` calls `notFound()` if the Kurs is missing.
  - In `lib/dal/kurse.ts` (all require admin):
    - `type KursInput = z.infer<typeof kursSchema>` and `type TerminInput = z.infer<typeof terminSchema>`
    - `createKurs(input: KursInput): Promise<string>` and `updateKurs(id: string, input: KursInput): Promise<void>`. `updateKurs` goes through `mutateStaffing`, with `terminIds` set to all Termine of the Kurs.
    - `deleteKurs(id: string): Promise<void>` (via `mutateStaffing`)
    - `createTermin(kursId: string, input: TerminInput): Promise<void>` and `updateTermin(id: string, input: TerminInput): Promise<void>`. Neither changes roles, so they're plain updates.
    - `deleteTermin(id: string): Promise<{ kursId: string }>` (via `mutateStaffing`)
  - `ConfirmDialog({ triggerLabel, title, description, confirmLabel, action, fields }: { …; action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>; fields: Record<string, string> })` is a client component. It wraps a shadcn `AlertDialog` (Base UI, `render` prop) around a form with hidden `fields`, and uses `useActionState` to show errors.
  - Actions in `admin/kurse/actions.ts`:
    - `saveKurs` creates or updates depending on a hidden `id`. After a create it redirects to `/admin/kurse/{id}`. Message: "Kurs gespeichert."
    - `removeKurs` redirects to `/admin`.
    - `addTermin` ("Termin angelegt."), `saveTermin` ("Termin gespeichert."), and `removeTermin`, which redirects to `/admin/kurse/{kursId}`.

- [ ] **Step 1: Implement the admin getters and `kurse.ts`.**
- [ ] **Step 2: Build the pages.**
  - **`/admin`** has the heading "Übersicht", a button "Neuer Kurs", and a toggle "Vergangene anzeigen" (`?alle=1`). Each Kurs gets a table with the columns Datum, Thema, Besetzung (`StaffingBadge`) and a "Verwalten" link to `/admin/termine/{id}`. Past rows are muted. The Kurs title links to `/admin/kurse/{id}`.
  - **`/admin/kurse/neu`** shows `KursForm` with the fields "Titel", "Beschreibung", "Trainer pro Termin" and "Backups pro Termin".
  - **`/admin/kurse/[id]`** shows `KursForm` prefilled, then a "Termine" list (`formatTerminWhen`, topic, badge, and a link to `/admin/termine/{id}`), then a "Termin hinzufügen" `TerminForm` with "Datum", "Beginn", "Ende", "Thema" and "Ort (optional)", using native `date` and `time` inputs. At the bottom is a `ConfirmDialog` with "Kurs löschen" and the description "Alle Termine und Eintragungen dieses Kurses werden gelöscht. Eingetragene Personen werden per E-Mail informiert."
  - Every admin page awaits `requireAdmin()` (through its DAL getter) inside the Suspense boundary that `(app)/loading.tsx` provides.
- [ ] **Step 3: Manual check, Review Focus #4.**
  1. Create the Kurs "Kindernotfall" with 2 trainers and 1 backup, plus a future Termin. Have trainer1, trainer2 and the admin sign up in that order: two Trainers and one Backup.
  2. Edit the Kurs to 1 trainer and 0 backups. Expected: trainer2 and the admin show as "Überzählig". The console shows a "Neue Rolle" email to trainer2 (Trainer → Überzählig). The admin made the change, so the admin gets no email.
  3. Set it back to 2 and 1. Expected: the roles are restored and trainer2 gets "Überzählig → Trainer".
  4. As trainer1, `/admin` redirects to `/termine`.
  5. Delete the Termin. Expected: trainer1 and trainer2 each get an "Ausgetragen" email in the console.
- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A && git commit -m "feat: admin overview and kurs/termin management"
```

---

### Task 9: Admin signup management, people, and invite link

**Files:**
- Create: `app/(app)/admin/termine/[id]/page.tsx`, `app/(app)/admin/termine/actions.ts`, `app/(app)/admin/personen/page.tsx`, `app/(app)/admin/personen/actions.ts`, `app/(app)/admin/einstellungen/page.tsx`, `app/(app)/admin/einstellungen/actions.ts`, `app/(app)/admin/einstellungen/copy-button.tsx`
- Modify: `lib/dal/signups.ts` (admin functions), `lib/dal/profiles.ts` (people functions), `lib/dal/read-model.ts` (`getAdminTermin`)

**Interfaces:**
- Consumes: `requireAdmin`, `mutateStaffing`, `appendSignup`, `removeSignup`, `supabaseService`, `getInviteToken`, `regenerateInviteToken`, `ConfirmDialog`, `TerminForm`, `saveTermin`, `removeTermin`.
- Produces:
  - In `lib/dal/read-model.ts`: `getAdminTermin(id: string): Promise<{ kurs: KursView<AdminSignupView>; termin: TerminView<AdminSignupView> }>`, which calls `notFound()` if the Termin is missing.
  - In `lib/dal/signups.ts` (all require admin, all via `mutateStaffing`, past Termine allowed):
    - `adminAddSignup(terminId: string, profileId: string): Promise<void>`
    - `adminRemoveSignup(terminId: string, profileId: string): Promise<void>`
    - `adminMoveSignup(terminId: string, profileId: string, direction: "up" | "down"): Promise<void>` swaps `position` with the neighbor in rank order and does nothing at either end.
  - In `lib/dal/profiles.ts` (all require admin):
    - `type PersonView = { id: string; fullName: string; email: string; phone: string | null; isAdmin: boolean; isEnvAdmin: boolean; upcomingSignups: number }`
    - `listPeople(): Promise<PersonView[]>`, sorted by name
    - `setAdmin(profileId: string, isAdmin: boolean): Promise<void>` throws `admin-aus-env` for env admins. It throws `letzter-admin` when demoting would leave zero admins, counting env admins who have a profile.
    - `removePerson(profileId: string): Promise<void>` throws `selbst-entfernen` or `admin-aus-env`. Inside `mutateStaffing`, with `terminIds` set to the person's Termine, it removes each signup with `removeSignup` and then deletes the profile. After commit it calls `supabaseService.auth.admin.deleteUser(id)` and logs a failure without rethrowing.
  - Actions:
    - `addSignup` ("Eingetragen."), `removeSignupAction` ("Ausgetragen."), `moveSignup`
    - `toggleAdmin` ("Gespeichert."), `deletePerson` ("Person entfernt.")
    - `newInviteLink` ("Neuer Einladungslink erstellt. Der alte Link funktioniert nicht mehr.")

- [ ] **Step 1: Implement the DAL functions.**
- [ ] **Step 2: Build `/admin/termine/[id]`.**
  - A breadcrumb links back to the Kurs, followed by `TerminForm` prefilled with `saveTermin`.
  - An "Eintragungen" table has the columns #, Name, Rolle, E-Mail, Telefon and actions (↑, ↓, "Austragen" as a `ConfirmDialog`).
  - An "Person hinzufügen" form uses a native `<select>` of people not yet on this Termin and is disabled when the Termin is full ("ausgebucht – erhöhe zuerst die Besetzung im Kurs").
  - At the bottom is a `ConfirmDialog` "Termin löschen" with the description "Eingetragene Personen werden per E-Mail informiert."
- [ ] **Step 3: Build `/admin/personen`.** A table with Name, E-Mail, Telefon, Admin, "Kommende Termine", and actions: an admin toggle button, disabled with the tooltip "fix eingetragen" for env admins, and "Entfernen" as a `ConfirmDialog` with "Die Person und alle ihre Eintragungen werden gelöscht." The admin's own row shows no remove button.
- [ ] **Step 4: Build `/admin/einstellungen`.** A heading "Einladungslink", the text "Schick diesen Link an neue Trainer:innen. Wer ihn hat, kann sich registrieren.", a read-only input with `{APP_URL}/einladung/{token}`, a `CopyButton` (a client component using `navigator.clipboard.writeText` that briefly shows "Kopiert!"), and a `ConfirmDialog` "Neuen Link erzeugen" with "Der bisherige Link funktioniert danach nicht mehr."
- [ ] **Step 5: Manual check**
  1. On a Termin with 1 trainer and 1 backup, add trainer1 and then trainer2 from the select. Each gets an "Eingetragen" email in the console.
  2. Move trainer2 up. Both get "Neue Rolle" emails (swapped roles).
  3. Click "Austragen" on the Trainer. They get "Ausgetragen", and the Backup gets "Backup → Trainer".
  4. Make trainer1 an admin, then remove the admin role again. Trying to demote `lucas@base3.at` shows the `admin-aus-env` error.
  5. Remove trainer2. Their signups disappear, the remaining people move up, the auth user is gone (`select count(*) from auth.users where email = 'trainer2@example.com'` returns 0), and trainer2 gets no email.
  6. Regenerate the invite link. The old `/einladung/<old>` shows "ungültig" and the new link works.
- [ ] **Step 6: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm build`

```bash
git add -A && git commit -m "feat: admin signup management, people, invite link settings"
```

---

### Task 10: Keepalive, deployment config, and README

**Files:**
- Create: `app/api/keepalive/route.ts`, `vercel.json`, `README.md` (replace the generated one)

**Interfaces:**
- Consumes: `db`, `env`.
- Produces: `GET /api/keepalive`. It returns 401 unless the header `authorization` equals `Bearer ${env.CRON_SECRET}`. Otherwise it runs `await connection()` and then `db.execute(sql\`select 1\`)`, and returns `{ ok: true }`.

- [ ] **Step 1: Implement the route.** Create `vercel.json` as `{ "crons": [{ "path": "/api/keepalive", "schedule": "0 6 * * *" }] }`. Vercel sends `CRON_SECRET` as a Bearer token automatically when the env var is set.
- [ ] **Step 2: Write `README.md`** (in German, short), covering:
  - **Lokale Entwicklung:** Docker, `pnpm install`, `pnpm sb:start`, creating `.env.local` from `supabase status -o env`, `pnpm db:migrate`, `pnpm dev`, and Mailpit at `http://127.0.0.1:54324`.
  - **Deployment:** the spec's four manual setup steps in detail:
    - Cloudflare domain.
    - Resend: domain and DNS records, then an API key.
    - Supabase project:
      - Under Auth → Sign In / Providers, set "Allow new users to sign up" to off and keep Email enabled.
      - Under Auth → SMTP, use Resend (`smtp.resend.com:465`, user `resend`, password = API key).
      - Under Auth → Email Templates, set "Magic Link" to the content of `supabase/templates/magic-link.html` with the subject from `config.toml`.
      - Under Auth → URL Configuration, set the Site URL to `https://<domain>` and the redirect URLs to `https://<domain>/auth/confirm`.
      - Under Auth → Rate Limits, raise the email limit to e.g. 100/h.
      - Under Settings → Data API, switch it off.
      - Copy the transaction pooler URL (port 6543) for `DATABASE_URL`.
    - Vercel: import the repo, set all env vars, add the domain, and add the CNAME at Cloudflare.
    - Migrations against production: `DATABASE_URL=<session-pooler-url> pnpm db:migrate`.
  - **Hinweise:** the two free-tier caveats from the spec.
- [ ] **Step 3: Verify Review Focus #5 and the keepalive route**

Run: `grep -rn "toISOString" lib app components`
Expected: no hits that derive a calendar date.

Run: `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/keepalive` and `curl -s -H "authorization: Bearer dev-secret" localhost:3000/api/keepalive`
Expected: `401`, then `{"ok":true}`.

- [ ] **Step 4: Final full check**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all pass. The build shows the static shell for `/login` and partial prerendering for the app routes.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: keepalive cron, vercel config, setup README"
```
