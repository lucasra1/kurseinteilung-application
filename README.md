# Kurseinteilung

Trainer:innen tragen sich selbst für Kurs-Termine ein. Ein Admin legt Kurse und Termine an, verschickt einen Einladungslink und sieht auf einen Blick, wo noch Trainer oder Backups fehlen.

- Spezifikation: [`docs/superpowers/specs/2026-10-26-kurseinteilung-design.md`](docs/superpowers/specs/2026-10-26-kurseinteilung-design.md)
- Stack: Next.js 16 (Cache Components), Supabase (Postgres + Magic-Link-Login), Drizzle, Resend, Vercel

## Lokale Entwicklung

Voraussetzungen: Node 22+, pnpm, Docker.

```bash
pnpm install
pnpm sb:start                          # lokales Supabase in Docker
pnpm exec supabase status -o env       # Werte für .env.local
cp .env.example .env.local             # und ausfüllen (siehe Kommentare)
pnpm db:migrate                        # Tabellen im Schema "app" anlegen
pnpm dev                               # http://localhost:3000
```

- Login-Mails landen lokal in **Mailpit**: http://127.0.0.1:54324
- Benachrichtigungs-Mails werden lokal (ohne `RESEND_API_KEY`) in der Konsole ausgegeben.
- Die E-Mail in `ADMIN_EMAILS` kann sich direkt unter `/login` anmelden und ist Admin.
- Den Einladungslink für weitere Personen findest du als Admin unter **Admin → Einstellungen**.

Weitere Befehle: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm db:generate` (nach Änderungen an `lib/db/schema.ts`), `pnpm sb:stop`.

## Deployment

Alles läuft in den Gratis-Tarifen. Diese Schritte kann nur der Eigentümer der Accounts machen.

### 1. Domain (Cloudflare Registrar)

Domain bei Cloudflare kaufen, z. B. `kurseinteilung.org`. Den Namen „Rotes Kreuz“ und das Emblem nicht verwenden (gesetzlich geschützt).

### 2. Resend (E-Mail-Versand)

1. Account auf resend.com anlegen, **Domains → Add Domain** (am besten eine Subdomain wie `mail.<domain>`).
2. Die angezeigten DNS-Einträge (SPF, DKIM, ggf. MX) in Cloudflare unter **DNS** anlegen und verifizieren lassen.
3. Unter **API Keys** einen Key erstellen. Er wird zweimal gebraucht: als SMTP-Passwort in Supabase und als `RESEND_API_KEY` in Vercel.

### 3. Supabase-Projekt

1. Neues Projekt auf supabase.com anlegen und über **Integrations → Vercel** mit dem Vercel-Projekt verbinden. Die Integration legt in Vercel u. a. `POSTGRES_URL` (App), `POSTGRES_URL_NON_POOLING` (Migrationen), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` und `SUPABASE_SECRET_KEY` an. Die Region muss zu `regions` in [`vercel.json`](vercel.json) passen (derzeit `dub1` ↔ Supabase `eu-west-1`).
2. **Authentication → Sign In / Providers**: „Allow new users to sign up“ **aus**. Den Provider **Email** eingeschaltet lassen (sonst gehen keine Magic Links).
3. **Authentication → Emails → SMTP Settings**: Custom SMTP an, Host `smtp.resend.com`, Port `465`, User `resend`, Passwort = Resend-API-Key, Absender z. B. `noreply@mail.<domain>`.
4. **Authentication → Emails → Templates → Magic Link**: Betreff `Dein Login-Link für die Kurseinteilung`, Inhalt aus [`supabase/templates/magic-link.html`](supabase/templates/magic-link.html) kopieren.
5. **Authentication → URL Configuration**: Site URL `https://<domain>`, Redirect URL `https://<domain>/auth/confirm`.
6. **Authentication → Rate Limits**: E-Mail-Limit auf z. B. 100 pro Stunde erhöhen.
7. **Data API** in den Projekteinstellungen ausschalten (die App greift direkt auf Postgres zu; die Tabellen liegen ohnehin im nicht freigegebenen Schema `app`).

Migrationen laufen bei jedem Vercel-Build automatisch (`buildCommand` in [`vercel.json`](vercel.json)).

### 4. Vercel

1. Auf vercel.com **Add New → Project**, das GitHub-Repo importieren (Framework: Next.js).
2. Zusätzlich zu den Variablen der Supabase-Integration setzen (siehe [`.env.example`](.env.example)):
   `RESEND_API_KEY`, `EMAIL_FROM` (z. B. `Kurseinteilung <noreply@mail.<domain>>`), `APP_URL` (`https://<domain>`), `ADMIN_EMAILS`, `CRON_SECRET` (beliebiger langer Zufallswert, als „Sensitive“).
3. Deployen. Jeder Push auf `main` deployt automatisch.
4. **Settings → Domains**: `<domain>` hinzufügen und den angezeigten DNS-Eintrag in Cloudflare anlegen, mit Proxy-Status **DNS only** (graue Wolke).
5. Der tägliche Cron-Job aus [`vercel.json`](vercel.json) ruft `/api/keepalive` auf. Vercel schickt `CRON_SECRET` automatisch mit.

## Hinweise

- **Supabase pausiert Gratis-Projekte nach 7 Tagen ohne Aktivität.** Der tägliche Keepalive-Cron verhindert das.
- **Vercel Hobby ist nur für nicht-kommerzielle Nutzung erlaubt.** Ein ehrenamtliches Projekt für einen gemeinnützigen Verein, an dem niemand verdient, passt. Wird die Arbeit bezahlt, auf Vercel Pro wechseln oder auf Cloudflare Workers (OpenNext) umziehen; der Code funktioniert in beiden Fällen.
