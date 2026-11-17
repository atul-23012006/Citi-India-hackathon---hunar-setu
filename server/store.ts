import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Opportunity, StudentProfile } from "../shared/types.ts";
import type { CommunityReport } from "../shared/engine/offerCheck.ts";

// The hub's store: one JSON file, written atomically. A hub is a laptop or a
// Raspberry Pi in a school serving ~30-300 students, so this is plenty; a state
// node would swap this module for Postgres behind the same functions.

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.HUB_DATA_DIR ?? join(here, "..", "data");
const FILE = join(DATA_DIR, "hub.json");

export interface Facilitator {
  id: string;
  name: string;
  pinHash: string;
  district: string;
  state: string;
}

export interface Module {
  id: string;
  facilitatorId: string;
  title: string;
  occupationId?: string;
  lang: string;
  lessons: { title: string; text: string }[];
  pricing: { model: "free" | "per_module" | "subscription"; rupees: number };
  learners: string[]; // student ids enrolled
  completions: string[]; // finished on the phone, waiting for the facilitator
  certified?: string[]; // completions the facilitator certified (credential issued)
  createdAt: string;
}

export interface Endorsement {
  id: string;
  studentId: string;
  facilitatorId: string;
  opportunityId?: string;
  note: string;
  credentialJws: string;
  createdAt: string;
}

export interface Request {
  id: string;
  studentId: string;
  opportunityId: string;
  status: "requested" | "endorsed" | "applied" | "joined" | "declined";
  createdAt: string;
}

export interface Credential {
  id: string;
  studentId: string;
  kind?: string; // TalentClaim type, for aggregate reporting
  jws: string;
  createdAt: string;
}

export interface SyncOp {
  seq: number;
  kind: "student" | "request" | "scam_report" | "credential" | "opportunity" | "endorsement";
  id: string;
  at: string;
}

export interface HubData {
  students: Record<string, StudentProfile>;
  facilitators: Record<string, Facilitator>;
  modules: Record<string, Module>;
  endorsements: Record<string, Endorsement>;
  requests: Record<string, Request>;
  credentials: Record<string, Credential>;
  partnerOpportunities: Record<string, Opportunity>;
  scamReports: Record<string, CommunityReport & { districts: string[] }>;
  appliedOps: Record<string, true>; // idempotency: client op ids already applied
  log: SyncOp[];
  seq: number;
}

const empty = (): HubData => ({
  students: {}, facilitators: {}, modules: {}, endorsements: {}, requests: {}, credentials: {},
  partnerOpportunities: {}, scamReports: {}, appliedOps: {}, log: [], seq: 0,
});

export const db: HubData = existsSync(FILE) ? { ...empty(), ...JSON.parse(readFileSync(FILE, "utf8")) } : empty();

let timer: NodeJS.Timeout | undefined;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE + ".tmp", JSON.stringify(db));
    renameSync(FILE + ".tmp", FILE);
  }, 200);
}

export function logOp(kind: SyncOp["kind"], id: string) {
  db.seq += 1;
  db.log.push({ seq: db.seq, kind, id, at: new Date().toISOString() });
  if (db.log.length > 5000) db.log.splice(0, db.log.length - 5000);
  save();
}

export const dataDir = DATA_DIR;
