import express, { type Request as Req, type Response as Res, type NextFunction } from "express";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { Opportunity, StudentProfile } from "../shared/types.ts";
import { kb } from "../shared/kb/index.ts";
import { pick } from "../shared/i18n/strings.ts";
import { checkAll, claimableRupees } from "../shared/engine/eligibility.ts";
import { rankCareers } from "../shared/engine/careers.ts";
import { paperworkPlan } from "../shared/engine/paperwork.ts";
import { checkOffer, extractFingerprints, type CommunityReport } from "../shared/engine/offerCheck.ts";
import { verifyCredential } from "../shared/vc.ts";
import { db, save, logOp, type Module, type Request } from "./store.ts";
import { aiClient, chat, probeAi, markAiDown } from "./claude.ts";
import { getIssuer, issue, hashPin, checkPin, tokenFor, facilitatorFromToken } from "./issuer.ts";
import type { TalentClaim } from "../shared/vc.ts";
import { impactReport } from "./impact.ts";
import { becknSearch } from "./beckn.ts";
import { openapi } from "./openapi.ts";
import { accounts } from "./accounts.ts";
import { fromCoords, fromPincode } from "./location.ts";
import { searchLive } from "./livejobs.ts";
import { clustersFor, msme, rankRegional, searchTerms } from "../shared/engine/regional.ts";
import { PINCODE, STATES, stateName } from "../shared/geo.ts";

export const app = express();
app.use(express.json({ limit: "256kb" }));

const nowIso = () => new Date().toISOString();
const reports = (): CommunityReport[] => Object.values(db.scamReports);
const allOpportunities = (): Opportunity[] => [...kb.opportunities, ...Object.values(db.partnerOpportunities)];

// Profiles arrive from devices that may have been offline for days; accept what
// is valid and ignore unknown fields rather than reject a whole sync.
const Profile = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().max(60).default(""),
    lang: z.enum(["en", "hi", "ta", "kn"]),
    interests: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    demonstrated: z.array(z.object({ task: z.string(), score: z.number(), at: z.string() })).default([]),
    docs: z.record(z.string(), z.boolean()).default({}),
    updatedAt: z.string(),
  })
  .passthrough();

const asProfile = (v: unknown): StudentProfile => {
  const p = Profile.parse(v) as unknown as StudentProfile;
  delete p.pinHash; // the PIN never leaves the phone
  return p;
};

// Issue a credential to a student and keep it on the hub for the next sync.
async function award(s: StudentProfile, claim: TalentClaim, id: string = randomUUID()): Promise<string> {
  const jws = await issue(s.id, s.name, claim);
  db.credentials[id] = { id, studentId: s.id, kind: claim.type, jws, createdAt: nowIso() };
  logOp("credential", id);
  return jws;
}

const wrap = (fn: (req: Req, res: Res) => Promise<unknown> | unknown) => (req: Req, res: Res, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

// ---------- status & knowledge base ----------

app.get("/api/status", wrap(async (_req, res) => {
  const i = await getIssuer();
  res.json({ ok: true, ai: await probeAi(), hub: i.name, issuerDid: i.did, students: Object.keys(db.students).length, version: "0.1.0" });
}));

app.get("/api/kb", (_req, res) => {
  res.json({ ...kb, opportunities: allOpportunities(), scamReports: reports() });
});

// ---------- AI counsellor ----------

app.post("/api/chat", wrap(async (req, res) => {
  const body = z.object({ sessionId: z.string().min(8).max(64), text: z.string().min(1).max(2000), profile: z.unknown() }).parse(req.body);
  if (!aiClient()) return res.status(503).json({ error: "ai_unavailable", fallback: "guided" });
  try {
    res.json(await chat({ sessionId: body.sessionId, text: body.text, profile: asProfile(body.profile), reports: reports() }));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      markAiDown();
      return res.status(503).json({ error: "ai_unavailable", fallback: "guided" });
    }
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "busy", fallback: "guided" });
    if (err instanceof Anthropic.APIConnectionError) return res.status(503).json({ error: "ai_unreachable", fallback: "guided" });
    throw err;
  }
}));

// ---------- engine APIs (for colleges, NGOs, state systems) ----------

app.post("/api/eligibility", (req, res) => {
  const p = asProfile(req.body.profile);
  const results = checkAll(p, p.lang);
  res.json({ results, claimableRupeesPerYear: claimableRupees(results), paperworkPlan: paperworkPlan(results) });
});

app.post("/api/careers", (req, res) => {
  const p = asProfile(req.body.profile);
  res.json(rankCareers(p).map((m) => ({ id: m.occupation.id, nco: m.occupation.nco, name: pick(p.lang, m.occupation.name), score: m.score, wider: m.wider, why: m.why })));
});

app.post("/api/offer-check", (req, res) => {
  const { text, lang } = z.object({ text: z.string().min(1).max(5000), lang: z.enum(["en", "hi", "ta", "kn"]).default("en") }).parse(req.body);
  res.json(checkOffer(text, lang, reports()));
});

function recordScam(text: string, district: string) {
  for (const fp of extractFingerprints(text)) {
    const r = db.scamReports[fp] ?? { fingerprint: fp, count: 0, firstSeenDistrict: district, districts: [] };
    r.count += 1;
    if (!r.districts.includes(district)) r.districts.push(district);
    db.scamReports[fp] = r;
    logOp("scam_report", fp);
  }
}

app.post("/api/scam-reports", (req, res) => {
  const { text, district } = z.object({ text: z.string().min(1).max(5000), district: z.string().max(60).default("unknown") }).parse(req.body);
  recordScam(text, district);
  res.json({ ok: true, reports: reports().length });
});

app.post("/api/credentials/verify", wrap(async (req, res) => {
  const { jws } = z.object({ jws: z.string().min(20).max(8000) }).parse(req.body);
  res.json(await verifyCredential(jws));
}));

// ---------- offline-first sync ----------

const Op = z.object({
  opId: z.string().min(8).max(80),
  kind: z.enum(["student_upsert", "request", "scam_report", "outcome", "task_result", "module_enroll", "module_complete"]),
  payload: z.record(z.string(), z.unknown()),
  at: z.string(),
});

const countBy = (reqs: Request[]) => {
  const out: Record<string, number> = {};
  for (const r of reqs) out[r.opportunityId] = (out[r.opportunityId] ?? 0) + 1;
  return out;
};

app.post("/api/sync", wrap(async (req, res) => {
  const body = z.object({ deviceId: z.string().min(4).max(80), since: z.number().int().min(0).default(0), studentIds: z.array(z.string()).max(50).default([]), ops: z.array(Op).max(500).default([]) }).parse(req.body);
  const applied: string[] = [];
  // Profiles first: the device's outbox may hold a task result queued before the
  // latest profile upsert, and the hub must know the student before acting on it.
  const ops = [...body.ops.filter((o) => o.kind === "student_upsert"), ...body.ops.filter((o) => o.kind !== "student_upsert")];

  for (const op of ops) {
    if (db.appliedOps[op.opId]) {
      applied.push(op.opId); // already applied: idempotent replay after a dropped connection
      continue;
    }
    switch (op.kind) {
      case "student_upsert": {
        const p = asProfile(op.payload);
        const existing = db.students[p.id];
        if (!existing || existing.updatedAt <= p.updatedAt) db.students[p.id] = { ...existing, ...p }; // last writer wins
        logOp("student", p.id);
        break;
      }
      case "request": {
        const { studentId, opportunityId } = z.object({ studentId: z.string(), opportunityId: z.string() }).parse(op.payload);
        const id = `${studentId}:${opportunityId}`;
        db.requests[id] ??= { id, studentId, opportunityId, status: "requested", createdAt: op.at };
        logOp("request", id);
        break;
      }
      case "scam_report": {
        const { text, district } = z.object({ text: z.string().max(5000), district: z.string().default("unknown") }).parse(op.payload);
        recordScam(text, district);
        break;
      }
      case "outcome": {
        // A placement counts only when the student shares proof of first pay.
        const o = z.object({ studentId: z.string(), opportunityId: z.string(), proof: z.enum(["epf_credit", "stipend_credit", "salary_credit"]) }).parse(op.payload);
        const s = db.students[o.studentId];
        const opp = allOpportunities().find((x) => x.id === o.opportunityId);
        if (!s) continue;
        if (opp) {
          await award(s, { type: "VerifiedPlacement", name: `${opp.title} at ${opp.employer}`, occupation: opp.occupationIds[0], evidence: `student-shared ${o.proof}` });
          const rid = `${o.studentId}:${o.opportunityId}`;
          if (db.requests[rid]) db.requests[rid].status = "joined";
        }
        break;
      }
      case "task_result": {
        const t = z.object({ studentId: z.string(), task: z.string(), score: z.number().min(0).max(1), label: z.string() }).parse(op.payload);
        const s = db.students[t.studentId];
        if (!s) continue; // not applied: the device keeps it and retries after the profile arrives
        if (t.score >= 0.7) await award(s, { type: "SkillDemonstration", name: t.label, evidence: `in-app task ${t.task}, score ${Math.round(t.score * 100)}%` });
        break;
      }
      case "module_enroll":
      case "module_complete": {
        // Learning happens offline on the phone; the hub only records it. A
        // completion earns a credential once the module's facilitator certifies it.
        const m2 = z.object({ studentId: z.string(), moduleId: z.string() }).parse(op.payload);
        const m = db.modules[m2.moduleId];
        if (!m) break; // module withdrawn: nothing to record, but don't retry forever
        if (!db.students[m2.studentId]) continue;
        if (!m.learners.includes(m2.studentId)) m.learners.push(m2.studentId);
        if (op.kind === "module_complete" && !m.completions.includes(m2.studentId)) m.completions.push(m2.studentId);
        break;
      }
    }
    db.appliedOps[op.opId] = true;
    applied.push(op.opId);
  }
  save();

  const mine = new Set(body.studentIds);
  res.json({
    applied,
    cursor: db.seq,
    scamReports: reports(),
    partnerOpportunities: Object.values(db.partnerOpportunities),
    credentials: Object.values(db.credentials).filter((c) => mine.has(c.studentId)),
    requests: Object.values(db.requests).filter((r) => mine.has(r.studentId)),
    // "Go together": how many students on this hub want each opening.
    requestCounts: countBy(Object.values(db.requests)),
    modules: Object.values(db.modules).map(({ learners: _l, completions: _c, certified: _x, ...m }) => m),
  });
}));

// ---------- facilitator ----------

const auth = (req: Req, res: Res, next: NextFunction) => {
  const id = facilitatorFromToken(req.header("authorization"));
  if (!id || !db.facilitators[id]) return res.status(401).json({ error: "login required" });
  res.locals.facilitatorId = id;
  next();
};

// Login is by name, so names must be unique on a hub, and a 4-6 digit PIN needs
// a lockout: 5 wrong tries locks that name for 15 minutes.
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60_000;
const failures = new Map<string, { n: number; until: number }>();

app.post("/api/facilitator/register", (req, res) => {
  const b = z.object({ name: z.string().trim().min(2).max(60), pin: z.string().regex(/^\d{4,6}$/), district: z.string().max(60), state: z.string().length(2) }).parse(req.body);
  if (Object.values(db.facilitators).some((f) => f.name.toLowerCase() === b.name.toLowerCase())) return res.status(409).json({ error: "that name is taken on this hub" });
  const id = `f-${randomUUID().slice(0, 8)}`;
  db.facilitators[id] = { id, name: b.name, pinHash: hashPin(b.pin), district: b.district, state: b.state };
  save();
  res.json({ id, token: tokenFor(id), name: b.name });
});

app.post("/api/facilitator/login", (req, res) => {
  const b = z.object({ name: z.string().trim().max(60), pin: z.string().max(6) }).parse(req.body);
  const key = b.name.toLowerCase();
  const fail = failures.get(key);
  if (fail && fail.n >= LOCK_AFTER && fail.until > Date.now()) return res.status(429).json({ error: "too many tries, wait 15 minutes" });
  const f = Object.values(db.facilitators).find((x) => x.name.toLowerCase() === key);
  if (!f || !checkPin(b.pin, f.pinHash)) {
    const n = fail && fail.until > Date.now() ? fail.n + 1 : 1;
    failures.set(key, { n, until: Date.now() + LOCK_MS });
    return res.status(401).json({ error: "wrong name or PIN" });
  }
  failures.delete(key);
  res.json({ id: f.id, token: tokenFor(f.id), name: f.name });
});

app.get("/api/facilitator/cohort", auth, (_req, res) => {
  const fid = res.locals.facilitatorId as string;
  const students = Object.values(db.students).filter((s) => !s.facilitatorId || s.facilitatorId === fid);
  res.json(
    students.map((s) => {
      const elig = checkAll(s, "en");
      const talents = s.demonstrated.filter((d) => d.score >= 0.7);
      return {
        id: s.id, name: s.name, age: s.age, gender: s.gender, education: s.education, district: s.district, updatedAt: s.updatedAt,
        topCareers: rankCareers(s, 3).map((m) => ({ id: m.occupation.id, name: m.occupation.name.en, wider: m.wider })),
        eligible: elig.filter((r) => r.verdict === "eligible").map((r) => r.schemeName),
        nearMiss: elig.filter((r) => r.verdict === "near_miss").map((r) => ({ scheme: r.schemeName, missing: r.missingDocs })),
        claimableRupees: claimableRupees(elig, ["eligible"]), // eligible now, matching the ✅ count shown with it
        talents,
        talentSignal: talents.length > 0, // "spot talent": demonstrated, not declared
        requests: Object.values(db.requests).filter((r) => r.studentId === s.id),
        credentials: Object.values(db.credentials).filter((c) => c.studentId === s.id).length,
      };
    }),
  );
});

app.post("/api/facilitator/endorse", auth, wrap(async (req, res) => {
  const b = z.object({ studentId: z.string(), opportunityId: z.string().optional(), note: z.string().max(500).default("") }).parse(req.body);
  const s = db.students[b.studentId];
  if (!s) return res.status(404).json({ error: "student not synced yet" });
  const f = db.facilitators[res.locals.facilitatorId as string];
  const opp = b.opportunityId ? allOpportunities().find((o) => o.id === b.opportunityId) : undefined;
  const id = randomUUID();
  const jws = await award(s, {
    type: "FacilitatorEndorsement",
    name: opp ? `Recommended for ${opp.title}` : "Recommended by facilitator",
    occupation: opp?.occupationIds[0],
    evidence: `${f.name}, ${f.district}: ${b.note}`.slice(0, 300),
  }, id);
  db.endorsements[id] = { id, studentId: s.id, facilitatorId: f.id, opportunityId: b.opportunityId, note: b.note, credentialJws: jws, createdAt: nowIso() };
  if (b.opportunityId) {
    const rid = `${s.id}:${b.opportunityId}`;
    db.requests[rid] = { ...(db.requests[rid] ?? { id: rid, studentId: s.id, opportunityId: b.opportunityId, createdAt: nowIso() }), status: "endorsed" };
  }
  logOp("endorsement", id);
  res.json({ ok: true, jws });
}));

const ModuleBody = z.object({
  title: z.string().min(3).max(120),
  occupationId: z.string().optional(),
  lang: z.enum(["en", "hi", "ta", "kn"]),
  lessons: z.array(z.object({ title: z.string().max(120), text: z.string().max(4000) })).min(1).max(30),
  pricing: z.object({ model: z.enum(["free", "per_module", "subscription"]), rupees: z.number().int().min(0).max(5000) }),
});

const earnings = (m: Module) => (m.pricing.model === "free" ? 0 : m.pricing.rupees * m.learners.length);

app.get("/api/facilitator/modules", auth, (_req, res) => {
  const fid = res.locals.facilitatorId as string;
  const mine = Object.values(db.modules).filter((m) => m.facilitatorId === fid);
  res.json(
    mine.map((m) => ({
      ...m,
      learnersCount: m.learners.length,
      completionsCount: m.completions.length,
      earningsRupees: earnings(m),
      // Finished on a phone, not yet certified: the facilitator's to-do list.
      pending: m.completions.filter((id) => !m.certified?.includes(id)).map((id) => ({ studentId: id, name: db.students[id]?.name ?? id })),
    })),
  );
});

app.post("/api/facilitator/modules", auth, (req, res) => {
  const b = ModuleBody.parse(req.body);
  const id = `m-${randomUUID().slice(0, 8)}`;
  db.modules[id] = { id, facilitatorId: res.locals.facilitatorId as string, ...b, learners: [], completions: [], certified: [], createdAt: nowIso() };
  save();
  res.json(db.modules[id]);
});

// Only the module's own facilitator can turn a completion into a credential.
// Before this, any device could ask the hub to sign a ModuleCompletion for anyone.
app.post("/api/facilitator/modules/:id/certify", auth, wrap(async (req, res) => {
  const m = db.modules[String(req.params.id)];
  const { studentId } = z.object({ studentId: z.string() }).parse(req.body);
  if (!m || m.facilitatorId !== res.locals.facilitatorId) return res.status(404).json({ error: "no such module" });
  const s = db.students[studentId];
  if (!s || !m.completions.includes(studentId)) return res.status(409).json({ error: "student has not finished this module" });
  m.certified ??= [];
  if (m.certified.includes(studentId)) return res.json({ ok: true, already: true });
  const jws = await award(s, { type: "ModuleCompletion", name: m.title, occupation: m.occupationId, evidence: `module ${m.id}, certified by ${db.facilitators[m.facilitatorId]?.name}` });
  m.certified.push(studentId);
  save();
  res.json({ ok: true, jws });
}));

// Key metrics for funders and state partners: aggregates only, no names or ids.
app.get("/api/facilitator/impact", auth, (_req, res) => res.json(impactReport(db)));

// ---------- partners: employers, NGOs, mentors ----------

const PARTNER_KEYS = new Set((process.env.PARTNER_KEYS ?? "demo-partner-key").split(","));

app.post("/api/partners/opportunities", (req, res) => {
  if (!PARTNER_KEYS.has(req.header("x-partner-key") ?? "")) return res.status(401).json({ error: "partner key required" });
  const b = z
    .object({
      kind: z.enum(["apprenticeship", "internship", "job", "mentor", "training"]),
      title: z.string().min(3).max(120), employer: z.string().min(2).max(120), district: z.string().max(60), state: z.string().length(2),
      distanceKmFromHub: z.number().min(0).max(5000).optional(), stipendMonthly: z.number().int().min(0).max(500000).optional(),
      hostel: z.boolean().default(false), womenStaffed: z.boolean().default(false), epfRegistered: z.boolean().default(false),
      occupationIds: z.array(z.string()).min(1), minEducation: z.enum(["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"]),
      schemeIds: z.array(z.string()).default([]), seats: z.number().int().min(1).max(10000),
    })
    .parse(req.body);
  const unknown = b.occupationIds.filter((id) => !kb.occupations.some((o) => o.id === id));
  if (unknown.length) return res.status(400).json({ error: "unknown occupation ids", unknown });
  const id = `p-${randomUUID().slice(0, 8)}`;
  // New partners start unverified; a facilitator or state admin verifies them.
  db.partnerOpportunities[id] = { id, ...b, employerVerified: false, demo: true, postedBy: "partner-api" };
  logOp("opportunity", id);
  res.status(201).json(db.partnerOpportunities[id]);
});

// ---------- accounts (Postgres) ----------

app.use("/api/auth", accounts);

// ---------- regional opportunities ----------

app.post("/api/location/resolve", wrap(async (req, res) => {
  const b = z.union([
    z.object({ pincode: z.string().regex(PINCODE) }),
    // India's bounding box, so a typo can't send a lookup to the other side of the world.
    z.object({ lat: z.number().min(6).max(38), lon: z.number().min(68).max(98) }),
  ]).parse(req.body);
  try {
    const place = "pincode" in b ? await fromPincode(b.pincode) : await fromCoords(b.lat, b.lon);
    if (!place) return res.status(404).json({ error: "not_found" });
    res.json(place);
  } catch {
    res.status(502).json({ error: "lookup_unavailable" }); // the phone falls back to picking the state by hand
  }
}));

const RegionalBody = z.object({
  place: z.object({
    state: z.string().refine((s) => STATES.some((x) => x.code === s), "unknown state"),
    district: z.string().trim().max(60).optional(),
    pincode: z.string().regex(PINCODE).optional(),
  }),
  profile: z.object({
    interests: z.array(z.string()).max(20).default([]),
    chosenOccupation: z.string().max(60).optional(),
    education: z.enum(["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"]).optional(),
    gender: z.enum(["female", "male", "other"]).optional(),
    canRelocate: z.boolean().optional(),
    needsHostel: z.boolean().optional(),
  }).default({ interests: [] }),
  q: z.string().trim().max(80).optional(),
  lang: z.enum(["en", "hi", "ta", "kn"]).default("en"),
});

app.post("/api/opportunities/regional", wrap(async (req, res) => {
  const b = RegionalBody.parse(req.body);
  const place = { ...b.place, stateName: stateName(b.place.state)! };
  const profile = b.profile as Partial<StudentProfile>;
  const terms = searchTerms(profile, place, b.q);
  const live = await searchLive(terms, place, b.lang, reports());
  res.json({
    place,
    terms,
    live,
    curated: rankRegional(allOpportunities(), place, profile).slice(0, 12),
    msme: { udyamJobsLakh: msme.states[place.state]?.udyamJobsLakh ?? null, clusters: clustersFor(place) },
    fetchedAt: nowIso(),
  });
}));

app.get("/api/msme", (_req, res) => res.json(msme));

// ---------- interoperability ----------

app.post("/beckn/search", (req, res) => res.json(becknSearch(req.body, allOpportunities())));
app.get("/api/openapi.json", (_req, res) => res.json(openapi));

// ---------- static app (hub mode) ----------

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|beckn).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

app.use((err: unknown, _req: Req, res: Res, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "invalid request", issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  console.error(err);
  res.status(500).json({ error: "server error" });
});
