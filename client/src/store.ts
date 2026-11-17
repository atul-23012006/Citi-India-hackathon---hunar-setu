import { get, set } from "idb-keyval";
import { useEffect, useState } from "preact/hooks";
import type { Lang, Opportunity, StudentProfile } from "../../shared/types.ts";
import type { CommunityReport } from "../../shared/engine/offerCheck.ts";

// Everything lives on the phone first (IndexedDB). The hub is a sync target,
// never a requirement: a student can finish discovery, eligibility, offer checks
// and the cost calculator with no signal at all.

export interface OutboxOp {
  opId: string;
  kind: "student_upsert" | "request" | "scam_report" | "outcome" | "task_result" | "module_enroll" | "module_complete";
  payload: Record<string, unknown>;
  at: string;
}

export interface HubCredential { id: string; studentId: string; jws: string; createdAt: string }
export interface HubRequest { id: string; studentId: string; opportunityId: string; status: string }

export interface State {
  ready: boolean;
  deviceId: string;
  uiLang: Lang;
  profiles: StudentProfile[];
  activeId: string | null;
  facilitatorToken: string | null;
  facilitatorName: string | null;
  outbox: OutboxOp[];
  online: boolean;
  aiAvailable: boolean;
  lastSync: string | null;
  syncing: boolean;
  scamReports: CommunityReport[];
  partnerOpportunities: Opportunity[];
  credentials: HubCredential[];
  requests: HubRequest[];
  requestCounts: Record<string, number>;
  modules: HubModule[];
  // Per student and module, what this phone has done; the hub learns via the outbox.
  moduleProgress: Record<string, "enrolled" | "completed">;
}

export interface HubModule {
  id: string; facilitatorId: string; title: string; lang: Lang; occupationId?: string;
  lessons: { title: string; text: string }[];
  pricing: { model: "free" | "per_module" | "subscription"; rupees: number };
}

const PERSISTED: (keyof State)[] = ["deviceId", "uiLang", "profiles", "activeId", "facilitatorToken", "facilitatorName", "outbox", "lastSync", "scamReports", "partnerOpportunities", "credentials", "requests", "requestCounts", "modules", "moduleProgress"];

let state: State = {
  ready: false,
  deviceId: "",
  uiLang: "hi",
  profiles: [],
  activeId: null,
  facilitatorToken: null,
  facilitatorName: null,
  outbox: [],
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  aiAvailable: false,
  lastSync: null,
  syncing: false,
  scamReports: [],
  partnerOpportunities: [],
  credentials: [],
  requests: [],
  requestCounts: {},
  modules: [],
  moduleProgress: {},
};

const listeners = new Set<() => void>();
let version = 0;

export function getState() {
  return state;
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

export function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  notify();
  if (state.ready && PERSISTED.some((k) => k in patch)) {
    const snapshot = Object.fromEntries(PERSISTED.map((k) => [k, state[k]]));
    set("hunar-setu", snapshot).catch(() => {});
  }
}

export function useStore(): State {
  const [, force] = useState(0);
  const renderedAt = version;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // The store may have changed between render and subscribe (offline, IndexedDB
    // answers before effects run); catch up instead of missing that update.
    if (version !== renderedAt) l();
    return () => listeners.delete(l);
  }, []);
  return state;
}

export async function loadState() {
  let saved: Partial<State> | undefined;
  try {
    saved = await get("hunar-setu");
  } catch {
    saved = undefined; // private mode / blocked storage: run in memory
  }
  state = { ...state, ...saved, deviceId: saved?.deviceId || crypto.randomUUID(), ready: true };
  if (!saved) {
    // First run: start in the phone's language when it is one we support.
    const nav = navigator.language.slice(0, 2);
    if (nav === "hi" || nav === "ta" || nav === "kn" || nav === "en") state.uiLang = nav;
  }
  notify();
}

export const uid = () => crypto.randomUUID();

export function activeProfile(): StudentProfile | null {
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}

export function enqueue(kind: OutboxOp["kind"], payload: Record<string, unknown>) {
  setState({ outbox: [...state.outbox, { opId: uid(), kind, payload, at: new Date().toISOString() }] });
}

export function saveProfile(p: StudentProfile, sync = true) {
  const updated = { ...p, updatedAt: new Date().toISOString() };
  const profiles = state.profiles.some((x) => x.id === p.id) ? state.profiles.map((x) => (x.id === p.id ? updated : x)) : [...state.profiles, updated];
  // Collapse queued upserts for the same student: only the latest matters.
  const outbox = sync ? state.outbox.filter((o) => !(o.kind === "student_upsert" && o.payload.id === p.id)) : state.outbox;
  const { pinHash: _pin, ...shareable } = updated;
  setState({
    profiles,
    outbox: sync ? [...outbox, { opId: uid(), kind: "student_upsert", payload: shareable as unknown as Record<string, unknown>, at: updated.updatedAt }] : outbox,
  });
  return updated;
}

export function updateActive(patch: Partial<StudentProfile>) {
  const p = activeProfile();
  if (!p) return null;
  return saveProfile({ ...p, ...patch });
}

export function newProfile(lang: Lang): StudentProfile {
  return { id: `s-${uid().slice(0, 12)}`, name: "", lang, interests: [], skills: [], demonstrated: [], docs: {}, updatedAt: new Date().toISOString() };
}

// ---- shared-phone PINs: PBKDF2 on device, never sent to the hub ----

async function pbkdf2(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

export async function hashPin(pin: string) {
  const salt = uid();
  return `${salt}:${await pbkdf2(pin, salt)}`;
}

export async function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return (await pbkdf2(pin, salt)) === hash;
}
