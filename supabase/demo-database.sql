-- Local demo database only (see README, "Demo-Instanz"): a stand-in for Supabase's
-- auth.users, so the demo can live next to the dev data in the same local Postgres.
-- Hosted Supabase projects already have this table.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email varchar(255),
  phone text unique,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
