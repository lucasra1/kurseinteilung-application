<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project

Kurseinteilung: Instruktoren and Praxisanleiter sign up for Kurs-Termine; see `docs/superpowers/specs/2026-10-26-kurseinteilung-design.md` (spec, roles superseded by `2026-10-27-qualifikationen.md`), `docs/superpowers/specs/2026-10-27-ui-redesign.md` and `docs/superpowers/plans/2026-10-26-kurseinteilung.md` (plan).

- `pnpm dev` / `pnpm build` / `pnpm typecheck` / `pnpm lint` (Biome) / `pnpm format`
- `pnpm sb:start` / `pnpm sb:stop`: local Supabase in Docker (Mailpit at http://127.0.0.1:54324)
- `pnpm db:generate` / `pnpm db:migrate`: Drizzle migrations (schema in `lib/db/schema.ts`, tables in Postgres schema `app`)
- All data access and authorization live in `lib/dal/` (server-only). No RLS, no Postgres functions.
- UI copy is German ("du" form).
