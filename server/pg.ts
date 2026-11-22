import pg from "pg";

// Accounts live in Postgres. The offline hub (store.ts) keeps working without
// it: a school laptop with no DATABASE_URL still syncs, it just can't take
// formal sign-ups. A district or state node sets DATABASE_URL.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  phone          text,
  full_name      text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'jobseeker')),
  date_of_birth  date,
  gender         text CHECK (gender IN ('female', 'male', 'other')),
  education      text,
  lang           text NOT NULL DEFAULT 'en',
  state          text,
  district       text,
  pincode        text, -- GPS is resolved to a district on request and never stored
  student_id     text NOT NULL UNIQUE,
  consent_at     timestamptz NOT NULL,
  guardian_consent boolean NOT NULL DEFAULT false,
  failed_logins  integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users (phone) WHERE phone IS NOT NULL;

-- Only a SHA-256 of each session token is stored, so a leaked table can't be replayed.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
`;

let pool: pg.Pool | null = null;
let migrated: Promise<void> | null = null;

export const accountsEnabled = () => !!process.env.DATABASE_URL;

// Connect and migrate lazily, on the first account request, so importing the
// app (tests, the offline hub) never opens a connection it doesn't need.
export async function sql(): Promise<pg.Pool> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, allowExitOnIdle: true });
  migrated ??= pool.query(SCHEMA).then(() => undefined, (err) => { migrated = null; throw err; });
  await migrated;
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = null;
  migrated = null;
}
