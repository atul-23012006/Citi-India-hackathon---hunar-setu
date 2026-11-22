import type { EducationLevel, Lang, StudentProfile } from "../../shared/types.ts";
import type { StringKey } from "../../shared/i18n/strings.ts";
import { getState, newProfile, saveProfile, setState, activeProfile } from "./store.ts";

// Formal accounts (Postgres on the hub). Unlike the offline PIN profiles these
// need the network, so every call reports a translatable error key instead of
// throwing; the screen says it aloud in the student's language.

export interface Account {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: "student" | "jobseeker";
  dateOfBirth: string | null;
  gender: "female" | "male" | "other" | null;
  education: EducationLevel | null;
  lang: Lang;
  state: string | null;
  district: string | null;
  pincode: string | null;
  studentId: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: StringKey; minutes?: number };

const ERRORS: Record<string, StringKey> = {
  email_taken: "err.email_taken", phone_taken: "err.phone_taken", wrong_login: "err.wrong_login", locked: "err.locked",
  guardian_consent_required: "err.guardian", age_out_of_range: "err.age", accounts_unavailable: "err.unavailable", "invalid request": "err.invalid",
  too_short: "err.too_short", too_long: "err.too_long", needs_letter: "err.needs_letter", needs_number: "err.needs_number",
  too_common: "err.too_common", contains_personal: "err.contains_personal",
};

export async function api<T>(method: string, path: string, body?: unknown, token?: string): Promise<Result<T>> {
  if (!navigator.onLine) return { ok: false, error: "err.offline" };
  try {
    const res = await fetch(path, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data };
    if (res.status === 401 && token) signOutLocally(); // session expired or revoked elsewhere
    return { ok: false, error: ERRORS[data.reason] ?? ERRORS[data.error] ?? "err.generic", minutes: data.retryAfterMinutes };
  } catch {
    return { ok: false, error: "err.offline" };
  }
}

const ageFrom = (dob: string | null) => {
  if (!dob) return undefined;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
};

// The account becomes an ordinary profile on the phone, so every screen (and
// offline use) works the same; what the account knows fills in the interview.
function enter(token: string, a: Account) {
  const existing = getState().profiles.find((p) => p.id === a.studentId);
  const p: StudentProfile = {
    ...(existing ?? newProfile(a.lang)),
    id: a.studentId,
    accountId: a.id,
    name: a.fullName.split(/\s+/)[0],
    lang: existing?.lang ?? a.lang,
    age: ageFrom(a.dateOfBirth) ?? existing?.age,
    gender: a.gender ?? existing?.gender,
    education: a.education ?? existing?.education,
    state: a.state ?? existing?.state,
    district: a.district ?? existing?.district,
    pincode: a.pincode ?? existing?.pincode,
    consent: existing?.consent ?? { at: new Date().toISOString(), guardian: false },
  };
  delete p.pinHash;
  const saved = saveProfile(p);
  setState({ account: { token, id: a.id, email: a.email, studentId: a.studentId }, activeId: saved.id, uiLang: saved.lang });
}

export interface RegisterInput {
  fullName: string; email: string; phone?: string; password: string; role: "student" | "jobseeker"; dateOfBirth: string;
  gender?: "female" | "male" | "other"; education?: EducationLevel; lang: Lang; state?: string; district?: string; pincode?: string;
  consent: true; guardianConsent: boolean;
}

export async function register(input: RegisterInput): Promise<Result<Account>> {
  const r = await api<{ token: string; account: Account }>("POST", "/api/auth/register", input);
  if (!r.ok) return r;
  enter(r.data.token, r.data.account);
  return { ok: true, data: r.data.account };
}

export async function login(loginId: string, password: string): Promise<Result<Account>> {
  const r = await api<{ token: string; account: Account }>("POST", "/api/auth/login", { login: loginId.trim(), password });
  if (!r.ok) return r;
  enter(r.data.token, r.data.account);
  return { ok: true, data: r.data.account };
}

function signOutLocally() {
  setState({ account: null, activeId: null });
}

// On a shared phone, leaving an account profile signs it out: the next person
// must not walk into someone else's account.
export async function signOut() {
  const acc = getState().account;
  signOutLocally();
  if (acc) await api("POST", "/api/auth/logout", {}, acc.token);
}

export async function changePassword(current: string, next: string): Promise<Result<unknown>> {
  return api("POST", "/api/auth/password", { current, next }, getState().account?.token);
}

export async function deleteAccount(password: string): Promise<Result<unknown>> {
  const acc = getState().account;
  const r = await api("DELETE", "/api/auth/me", { password }, acc?.token);
  if (r.ok) setState({ profiles: getState().profiles.filter((p) => p.accountId !== acc?.id), account: null, activeId: null });
  return r;
}

// Keep the account's district in step when the student changes place on the phone.
export async function savePlaceToAccount(place: { state: string; district?: string; pincode?: string }) {
  const acc = getState().account;
  const p = activeProfile();
  if (!acc || p?.accountId !== acc.id) return;
  await api("PATCH", "/api/auth/me", { state: place.state, district: place.district ?? null, pincode: place.pincode ?? null }, acc.token);
}

// Mirrors the hub's policy so the student sees what's missing as they type.
export function passwordChecks(pw: string, confirm: string) {
  return { length: pw.length >= 8, letter: /\p{L}/u.test(pw), number: /\d/.test(pw), match: pw.length > 0 && pw === confirm };
}
