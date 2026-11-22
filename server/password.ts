import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Account passwords: scrypt (memory-hard) with a per-user random salt.
// N=2^15, r=8, p=3 is one of OWASP's recommended scrypt settings (32 MiB per
// hash), light enough for a Raspberry Pi hub. The parameters are stored with
// the hash, so raising them later only needs needsRehash() on login.
const N = 2 ** 15, R = 8, P = 3, KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

const derive = (password: string, salt: Buffer, n: number, r: number, p: number, len: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const opts: ScryptOptions = { N: n, r, p, maxmem: MAXMEM };
    scrypt(password.normalize("NFKC"), salt, len, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p), want.length);
  return timingSafeEqual(got, want);
}

export function needsRehash(stored: string): boolean {
  const [, n, r, p] = stored.split("$");
  return Number(n) !== N || Number(r) !== R || Number(p) !== P;
}

// Checked against when the email is unknown, so a login takes the same time
// whether or not the account exists (no account enumeration by timing).
export const DUMMY_HASH = await hashPassword(randomBytes(12).toString("hex"));

// Policy kept short enough to explain aloud: 8+ characters, a letter and a
// number, and not something trivially guessable from the form itself.
const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "india123", "abcd1234", "admin123", "welcome1", "password123"]);

export type PasswordProblem = "too_short" | "too_long" | "needs_letter" | "needs_number" | "too_common" | "contains_personal";

export function passwordProblem(password: string, personal: string[] = []): PasswordProblem | null {
  if (password.length < 8) return "too_short";
  if (password.length > 128) return "too_long";
  if (!/\p{L}/u.test(password)) return "needs_letter";
  if (!/\d/.test(password)) return "needs_number";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "too_common";
  if (personal.some((x) => x.length >= 4 && lower.includes(x.toLowerCase()))) return "contains_personal";
  return null;
}
