import { Router, type Request as Req, type Response as Res, type NextFunction } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { DatabaseError } from "pg";
import { accountsEnabled, sql } from "./pg.ts";
import { DUMMY_HASH, hashPassword, needsRehash, passwordProblem, verifyPassword } from "./password.ts";
import { PINCODE, STATES } from "../shared/geo.ts";

// Formal accounts: email + password, stored in Postgres. Errors are codes
// ("email_taken", "too_short") so the phone can say them in the student's language.

export const accounts = Router();

const SESSION_DAYS = 30;
const LOCK_AFTER = 5;

const LANG = z.enum(["en", "hi", "ta", "kn"]);
const EDUCATION = z.enum(["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"]);
const STATE = z.string().refine((s) => STATES.some((x) => x.code === s), "unknown state");
const PHONE = z.string().regex(/^[6-9]\d{9}$/, "10-digit Indian mobile number");

export interface Account {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: "student" | "jobseeker";
  dateOfBirth: string | null;
  gender: "female" | "male" | "other" | null;
  education: string | null;
  lang: string;
  state: string | null;
  district: string | null;
  pincode: string | null;
  studentId: string;
  createdAt: string;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string | null));
const toAccount = (r: Row): Account => ({
  id: r.id as string,
  email: r.email as string,
  phone: r.phone as string | null,
  fullName: r.full_name as string,
  role: r.role as Account["role"],
  // A date column comes back as local midnight; format it back without a timezone shift.
  dateOfBirth: r.date_of_birth instanceof Date ? `${r.date_of_birth.getFullYear()}-${String(r.date_of_birth.getMonth() + 1).padStart(2, "0")}-${String(r.date_of_birth.getDate()).padStart(2, "0")}` : null,
  gender: r.gender as Account["gender"],
  education: r.education as string | null,
  lang: r.lang as string,
  state: r.state as string | null,
  district: r.district as string | null,
  pincode: r.pincode as string | null,
  studentId: r.student_id as string,
  createdAt: iso(r.created_at)!,
});

export function ageOn(dob: string, today = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

async function startSession(userId: string, userAgent: string | undefined) {
  const token = randomBytes(32).toString("base64url");
  const db = await sql();
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, now() + make_interval(days => $3), $4)", [sha256(token), userId, SESSION_DAYS, userAgent?.slice(0, 200) ?? null]);
  // Opportunistic cleanup keeps the table small without a cron job.
  await db.query("DELETE FROM sessions WHERE expires_at < now()");
  return token;
}

const bearer = (req: Req) => req.header("authorization")?.match(/^Bearer\s+([\w-]{43})$/)?.[1];

const wrap = (fn: (req: Req, res: Res) => Promise<unknown>) => (req: Req, res: Res, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

// Accounts need Postgres; say so plainly instead of failing with a 500.
accounts.use((_req, res, next) => (accountsEnabled() ? next() : res.status(503).json({ error: "accounts_unavailable" })));

const authed = (req: Req, res: Res, next: NextFunction) => {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: "login_required" });
  sql()
    .then((db) => db.query("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()", [sha256(token)]))
    .then(({ rows }) => {
      if (!rows[0]) return res.status(401).json({ error: "login_required" });
      res.locals.account = toAccount(rows[0]);
      res.locals.passwordHash = rows[0].password_hash;
      res.locals.tokenHash = sha256(token);
      next();
    })
    .catch(next);
};

const Register = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email().max(254).transform((e) => e.trim().toLowerCase()),
  phone: PHONE.optional(),
  password: z.string().max(128),
  role: z.enum(["student", "jobseeker"]).default("student"),
  dateOfBirth: z.iso.date(),
  gender: z.enum(["female", "male", "other"]).optional(),
  education: EDUCATION.optional(),
  lang: LANG.default("en"),
  state: STATE.optional(),
  district: z.string().trim().max(60).optional(),
  pincode: z.string().regex(PINCODE).optional(),
  consent: z.literal(true),
  guardianConsent: z.boolean().default(false),
});

accounts.post("/register", wrap(async (req, res) => {
  const b = Register.parse(req.body);
  const age = ageOn(b.dateOfBirth);
  if (age < 13 || age > 70) return res.status(400).json({ error: "age_out_of_range" });
  // DPDP Act: a person under 18 needs a parent or guardian's consent.
  if (age < 18 && !b.guardianConsent) return res.status(400).json({ error: "guardian_consent_required" });
  const problem = passwordProblem(b.password, [b.email.split("@")[0], ...b.fullName.split(/\s+/), b.phone ?? ""]);
  if (problem) return res.status(400).json({ error: "weak_password", reason: problem });

  const db = await sql();
  const hash = await hashPassword(b.password);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, phone, full_name, password_hash, role, date_of_birth, gender, education, lang, state, district, pincode, student_id, consent_at, guardian_consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), $14) RETURNING *`,
      [b.email, b.phone ?? null, b.fullName, hash, b.role, b.dateOfBirth, b.gender ?? null, b.education ?? null, b.lang, b.state ?? null, b.district ?? null, b.pincode ?? null, `s-${randomUUID().slice(0, 12)}`, b.guardianConsent],
    );
    const token = await startSession(rows[0].id, req.header("user-agent"));
    res.status(201).json({ token, account: toAccount(rows[0]) });
  } catch (err) {
    if (err instanceof DatabaseError && err.code === "23505") {
      return res.status(409).json({ error: err.constraint === "users_phone_key" ? "phone_taken" : "email_taken" });
    }
    throw err;
  }
}));

accounts.post("/login", wrap(async (req, res) => {
  const b = z.object({ login: z.string().trim().min(3).max(254), password: z.string().max(128) }).parse(req.body);
  const db = await sql();
  const { rows } = await db.query("SELECT * FROM users WHERE lower(email) = lower($1) OR phone = $1 LIMIT 1", [b.login]);
  const u = rows[0];
  if (u?.locked_until && u.locked_until > new Date()) return res.status(429).json({ error: "locked", retryAfterMinutes: Math.ceil((u.locked_until.getTime() - Date.now()) / 60_000) });

  // Always run one scrypt, account or not, so timing doesn't reveal which emails exist.
  const ok = (await verifyPassword(b.password, u?.password_hash ?? DUMMY_HASH)) && !!u;
  if (!ok) {
    if (u) {
      // An expired lock starts the count again; the fifth miss in a row locks for 15 minutes.
      await db.query(
        `UPDATE users SET
           failed_logins = CASE WHEN locked_until < now() THEN 1 ELSE failed_logins + 1 END,
           locked_until = CASE WHEN locked_until < now() THEN NULL
                               WHEN failed_logins + 1 >= $2 THEN now() + interval '15 minutes'
                               ELSE locked_until END
         WHERE id = $1`,
        [u.id, LOCK_AFTER],
      );
    }
    return res.status(401).json({ error: "wrong_login" });
  }
  const rehash = needsRehash(u.password_hash) ? await hashPassword(b.password) : null;
  const { rows: [fresh] } = await db.query(
    "UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now(), password_hash = COALESCE($2, password_hash) WHERE id = $1 RETURNING *",
    [u.id, rehash],
  );
  res.json({ token: await startSession(u.id, req.header("user-agent")), account: toAccount(fresh) });
}));

accounts.get("/me", authed, (_req, res) => res.json({ account: res.locals.account }));

const Patch = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  phone: PHONE.nullable().optional(),
  gender: z.enum(["female", "male", "other"]).nullable().optional(),
  education: EDUCATION.nullable().optional(),
  lang: LANG.optional(),
  state: STATE.nullable().optional(),
  district: z.string().trim().max(60).nullable().optional(),
  pincode: z.string().regex(PINCODE).nullable().optional(),
}).strict();

const COLUMN: Record<keyof z.infer<typeof Patch>, string> = {
  fullName: "full_name", phone: "phone", gender: "gender", education: "education", lang: "lang", state: "state", district: "district", pincode: "pincode",
};

accounts.patch("/me", authed, wrap(async (req, res) => {
  const b = Patch.parse(req.body);
  const keys = Object.keys(b) as (keyof typeof b)[];
  if (!keys.length) return res.json({ account: res.locals.account });
  const sets = keys.map((k, i) => `${COLUMN[k]} = $${i + 2}`).join(", ");
  const db = await sql();
  try {
    const { rows } = await db.query(`UPDATE users SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [res.locals.account.id, ...keys.map((k) => b[k] ?? null)]);
    res.json({ account: toAccount(rows[0]) });
  } catch (err) {
    if (err instanceof DatabaseError && err.code === "23505") return res.status(409).json({ error: "phone_taken" });
    throw err;
  }
}));

// Changing the password signs out every other device.
accounts.post("/password", authed, wrap(async (req, res) => {
  const b = z.object({ current: z.string().max(128), next: z.string().max(128) }).parse(req.body);
  const a = res.locals.account as Account;
  if (!(await verifyPassword(b.current, res.locals.passwordHash))) return res.status(401).json({ error: "wrong_login" });
  const problem = passwordProblem(b.next, [a.email.split("@")[0], ...a.fullName.split(/\s+/), a.phone ?? ""]);
  if (problem) return res.status(400).json({ error: "weak_password", reason: problem });
  const db = await sql();
  await db.query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [a.id, await hashPassword(b.next)]);
  await db.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [a.id, res.locals.tokenHash]);
  res.json({ ok: true });
}));

accounts.post("/logout", authed, wrap(async (_req, res) => {
  await (await sql()).query("DELETE FROM sessions WHERE token_hash = $1", [res.locals.tokenHash]);
  res.json({ ok: true });
}));

// DPDP right to erasure: the password confirms it's really the owner.
accounts.delete("/me", authed, wrap(async (req, res) => {
  const { password } = z.object({ password: z.string().max(128) }).parse(req.body);
  if (!(await verifyPassword(password, res.locals.passwordHash))) return res.status(401).json({ error: "wrong_login" });
  await (await sql()).query("DELETE FROM users WHERE id = $1", [res.locals.account.id]);
  res.json({ ok: true });
}));

// Postgres down or unreachable: tell the phone accounts are unavailable (it
// keeps working offline) rather than reporting a server error.
accounts.use((err: unknown, _req: Req, res: Res, next: NextFunction) => {
  const code = (err as { code?: string })?.code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" || code === "57P03" || code === "28P01" || code === "3D000") {
    console.error("accounts database unavailable:", code);
    return res.status(503).json({ error: "accounts_unavailable" });
  }
  next(err);
});
