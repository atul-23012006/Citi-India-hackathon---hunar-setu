import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { hashPassword, verifyPassword, needsRehash, passwordProblem } from "./password.ts";

// Password hashing runs everywhere. The account API needs a throwaway Postgres
// database (TEST_DATABASE_URL); without one those tests are skipped, not failed.

test("passwords are salted scrypt hashes, never the password itself", async () => {
  const a = await hashPassword("Kaveri2026river");
  const b = await hashPassword("Kaveri2026river");
  assert.match(a, /^scrypt\$32768\$8\$3\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{88}$/);
  assert.notEqual(a, b, "a fresh salt each time");
  assert.ok(!a.includes("Kaveri"));
  assert.equal(await verifyPassword("Kaveri2026river", a), true);
  assert.equal(await verifyPassword("kaveri2026river", a), false);
  assert.equal(await verifyPassword("anything", "md5$abc"), false, "unknown formats never verify");
  assert.equal(needsRehash(a), false);
  assert.equal(needsRehash("scrypt$16384$8$1$c2FsdA==$aGFzaA=="), true);
});

test("password policy: length, a letter, a number, nothing obvious", () => {
  assert.equal(passwordProblem("Ab1"), "too_short");
  assert.equal(passwordProblem("abcdefgh"), "needs_number");
  assert.equal(passwordProblem("12345678"), "needs_letter");
  assert.equal(passwordProblem("Password1"), "too_common");
  assert.equal(passwordProblem("meena2026x", ["meena"]), "contains_personal");
  assert.equal(passwordProblem("बिजली2026"), null, "Indian scripts count as letters");
  assert.equal(passwordProblem("Kaveri2026river", ["meena"]), null);
});

const DB = process.env.TEST_DATABASE_URL;
const skip = DB ? false : "set TEST_DATABASE_URL to run the account API tests";

let server: Server;
let base = "";
let dir = "";
before(async () => {
  if (!DB) return;
  dir = mkdtempSync(join(tmpdir(), "hunar-auth-"));
  process.env.HUB_DATA_DIR = dir;
  process.env.DATABASE_URL = DB;
  const { sql } = await import("./pg.ts");
  await (await sql()).query("TRUNCATE users, sessions");
  const { app } = await import("./app.ts");
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  if (!DB) return;
  server.close();
  const { closePool } = await import("./pg.ts");
  await closePool();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const meena = {
  fullName: "Meena Kumari", email: "Meena.K@example.com", phone: "9876543210", password: "Kaveri2026river",
  dateOfBirth: "2005-03-14", gender: "female", education: "class12", lang: "ta", state: "TN", district: "Vellore", pincode: "632014", consent: true,
};

let token = "";
test("register stores the account in Postgres with a hashed password", { skip }, async () => {
  const r = await call("POST", "/api/auth/register", meena);
  assert.equal(r.status, 201);
  token = r.body.token;
  assert.equal(r.body.account.email, "meena.k@example.com", "emails are stored lower-case");
  assert.equal(r.body.account.dateOfBirth, "2005-03-14");
  assert.match(r.body.account.studentId, /^s-/);
  assert.equal(r.body.account.password_hash, undefined, "the hash never leaves the server");
  const { sql } = await import("./pg.ts");
  const { rows } = await (await sql()).query("SELECT password_hash FROM users WHERE email = $1", ["meena.k@example.com"]);
  assert.match(rows[0].password_hash, /^scrypt\$/);
  const { rows: s } = await (await sql()).query("SELECT token_hash FROM sessions");
  assert.ok(s.every((x) => !x.token_hash.equals(Buffer.from(token))), "only a hash of the session token is stored");
});

test("registration rejects duplicates, weak passwords and missing guardian consent", { skip }, async () => {
  assert.deepEqual((await call("POST", "/api/auth/register", { ...meena, email: "MEENA.K@example.com", phone: undefined })).body, { error: "email_taken" });
  assert.deepEqual((await call("POST", "/api/auth/register", { ...meena, email: "other@example.com" })).body, { error: "phone_taken" });
  assert.deepEqual((await call("POST", "/api/auth/register", { ...meena, email: "x@example.com", phone: undefined, password: "meenakumari1" })).body, { error: "weak_password", reason: "contains_personal" });
  const minor = { ...meena, email: "minor@example.com", phone: undefined, dateOfBirth: `${new Date().getFullYear() - 15}-01-01` };
  assert.deepEqual((await call("POST", "/api/auth/register", minor)).body, { error: "guardian_consent_required" });
  assert.equal((await call("POST", "/api/auth/register", { ...minor, guardianConsent: true })).status, 201);
  assert.equal((await call("POST", "/api/auth/register", { ...meena, email: "y@example.com", phone: undefined, consent: false })).status, 400);
  assert.equal((await call("POST", "/api/auth/register", { ...meena, email: "not-an-email", phone: undefined })).status, 400);
});

test("login by email or phone; wrong passwords lock the account", { skip }, async () => {
  assert.equal((await call("POST", "/api/auth/login", { login: "MEENA.K@example.com", password: meena.password })).status, 200);
  assert.equal((await call("POST", "/api/auth/login", { login: "9876543210", password: meena.password })).status, 200);
  assert.deepEqual((await call("POST", "/api/auth/login", { login: "nobody@example.com", password: "whatever1" })).body, { error: "wrong_login" }, "same answer whether or not the account exists");

  for (let i = 0; i < 5; i++) assert.equal((await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: "wrong-guess1" })).status, 401);
  const locked = await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: meena.password });
  assert.equal(locked.status, 429, "even the right password waits out the lock");
  assert.equal(locked.body.retryAfterMinutes, 15);

  const { sql } = await import("./pg.ts");
  await (await sql()).query("UPDATE users SET locked_until = now() - interval '1 second' WHERE email = 'meena.k@example.com'");
  assert.equal((await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: "wrong-guess1" })).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: meena.password })).status, 200, "an expired lock starts the count again");
});

test("a session reads and updates the profile, and logout ends it", { skip }, async () => {
  assert.equal((await call("GET", "/api/auth/me")).status, 401);
  assert.equal((await call("GET", "/api/auth/me", undefined, "x".repeat(43))).status, 401);
  const me = await call("GET", "/api/auth/me", undefined, token);
  assert.equal(me.body.account.fullName, "Meena Kumari");

  const moved = await call("PATCH", "/api/auth/me", { state: "KA", district: "Mysuru", pincode: "570001" }, token);
  assert.equal(moved.body.account.state, "KA");
  assert.equal((await call("PATCH", "/api/auth/me", { state: "XX" }, token)).status, 400);
  assert.equal((await call("PATCH", "/api/auth/me", { email: "steal@example.com" }, token)).status, 400, "email isn't editable here");

  assert.equal((await call("POST", "/api/auth/logout", {}, token)).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, token)).status, 401);
});

test("changing the password signs out other devices; deleting the account erases it", { skip }, async () => {
  const phone = (await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: meena.password })).body.token;
  const laptop = (await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: meena.password })).body.token;
  assert.equal((await call("POST", "/api/auth/password", { current: "nope", next: "Godavari2027" }, phone)).status, 401);
  assert.equal((await call("POST", "/api/auth/password", { current: meena.password, next: "Godavari2027" }, phone)).status, 200);
  assert.equal((await call("GET", "/api/auth/me", undefined, laptop)).status, 401);
  assert.equal((await call("GET", "/api/auth/me", undefined, phone)).status, 200);
  assert.equal((await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: meena.password })).status, 401);

  assert.equal((await call("DELETE", "/api/auth/me", { password: "wrong" }, phone)).status, 401);
  assert.equal((await call("DELETE", "/api/auth/me", { password: "Godavari2027" }, phone)).status, 200);
  assert.equal((await call("POST", "/api/auth/login", { login: "meena.k@example.com", password: "Godavari2027" })).status, 401);
  const { sql } = await import("./pg.ts");
  const { rows } = await (await sql()).query("SELECT count(*)::int AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'meena.k@example.com'");
  assert.equal(rows[0].n, 0, "sessions go with the account");
});
