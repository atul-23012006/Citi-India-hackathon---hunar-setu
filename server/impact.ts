import type { StudentProfile } from "../shared/types.ts";
import { checkAll, claimableRupees } from "../shared/engine/eligibility.ts";
import { COMMON_ASPIRATIONS } from "../shared/engine/careers.ts";
import type { HubData } from "./store.ts";

// The six key metrics from our Round 1 canvas, computed live from what the hub
// actually holds. Aggregates only: no names, no ids. None of them counts downloads.

type Gender = "female" | "male" | "other" | "unknown";
const genderOf = (s?: StudentProfile): Gender => s?.gender ?? "unknown";

export interface Funnel { requested: number; endorsed: number; joined: number; joinRate: number }

export interface ImpactReport {
  generatedAt: string;
  reach: { students: number; byGender: Record<Gender, number>; districts: number; facilitators: number };
  // 1. North star: a placement counts only with student-shared proof of first pay.
  verifiedOutcomes: { total: number; byGender: Record<Gender, number> };
  // 2. Entitlements: money a student is eligible for now, and money one document away.
  rupees: { claimablePerYear: number; studentsWithMoney: number; studentsOneDocAway: number; dbtSeedingGaps: number };
  // 3. Distinct occupations chosen per 100 students, and the share outside the common four.
  aspiration: { widenIndex: number; widenIndexGirls: number; chosenOutsideCommonFour: number; studentsWhoChose: number };
  // 4. Community scam intelligence.
  scams: { fingerprints: number; reports: number; districtsWarned: number; seenInMoreThanOneDistrict: number };
  // 5. Last-mile leak, split by gender.
  offerToJoining: Record<Gender | "all", Funnel>;
  // 6. Facilitators who earn, and proof of skill issued.
  facilitators: { total: number; earning: number; moduleEarningsRupees: number; learners: number; completionsCertified: number };
  credentials: { total: number; skillDemonstrations: number };
  // Guardrail: offline integrity, seen from the hub side.
  sync: { opsApplied: number };
}

const zeroG = (): Record<Gender, number> => ({ female: 0, male: 0, other: 0, unknown: 0 });
const per100 = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function impactReport(db: HubData): ImpactReport {
  const students = Object.values(db.students);
  const reqs = Object.values(db.requests);

  const byGender = zeroG();
  for (const s of students) byGender[genderOf(s)] += 1;

  const outcomesByGender = zeroG();
  for (const r of reqs) if (r.status === "joined") outcomesByGender[genderOf(db.students[r.studentId])] += 1;

  let claimable = 0, withMoney = 0, oneDocAway = 0, dbtGaps = 0;
  for (const s of students) {
    const res = checkAll(s, "en");
    const rs = claimableRupees(res, ["eligible"]);
    claimable += rs;
    if (rs > 0) withMoney += 1;
    if (res.some((r) => r.verdict === "near_miss")) oneDocAway += 1;
    if (res.some((r) => r.verdict === "eligible") && !s.docs.aadhaar_seeded) dbtGaps += 1;
  }

  const chosen = students.filter((s) => s.chosenOccupation);
  const girlsChosen = chosen.filter((s) => s.gender === "female");
  const distinct = (xs: StudentProfile[]) => new Set(xs.map((s) => s.chosenOccupation)).size;

  const funnel = (filter: (s?: StudentProfile) => boolean): Funnel => {
    const mine = reqs.filter((r) => filter(db.students[r.studentId]));
    const endorsed = mine.filter((r) => r.status === "endorsed" || r.status === "applied" || r.status === "joined").length;
    const joined = mine.filter((r) => r.status === "joined").length;
    return { requested: mine.length, endorsed, joined, joinRate: mine.length ? Math.round((joined / mine.length) * 100) / 100 : 0 };
  };

  const scamRecords = Object.values(db.scamReports);
  const modules = Object.values(db.modules);
  const earningsBy = new Map<string, number>();
  for (const m of modules) {
    const e = m.pricing.model === "free" ? 0 : m.pricing.rupees * m.learners.length;
    earningsBy.set(m.facilitatorId, (earningsBy.get(m.facilitatorId) ?? 0) + e);
  }
  const creds = Object.values(db.credentials);

  return {
    generatedAt: new Date().toISOString(),
    reach: { students: students.length, byGender, districts: new Set(students.map((s) => s.district).filter(Boolean)).size, facilitators: Object.keys(db.facilitators).length },
    verifiedOutcomes: { total: Object.values(outcomesByGender).reduce((a, b) => a + b, 0), byGender: outcomesByGender },
    rupees: { claimablePerYear: claimable, studentsWithMoney: withMoney, studentsOneDocAway: oneDocAway, dbtSeedingGaps: dbtGaps },
    aspiration: {
      widenIndex: per100(distinct(chosen), chosen.length),
      widenIndexGirls: per100(distinct(girlsChosen), girlsChosen.length),
      chosenOutsideCommonFour: chosen.length ? Math.round((chosen.filter((s) => !COMMON_ASPIRATIONS.has(s.chosenOccupation!)).length / chosen.length) * 100) / 100 : 0,
      studentsWhoChose: chosen.length,
    },
    scams: {
      fingerprints: scamRecords.length,
      reports: scamRecords.reduce((a, r) => a + r.count, 0),
      districtsWarned: new Set(scamRecords.flatMap((r) => r.districts)).size,
      seenInMoreThanOneDistrict: scamRecords.filter((r) => r.districts.length > 1).length,
    },
    offerToJoining: {
      all: funnel(() => true),
      female: funnel((s) => genderOf(s) === "female"),
      male: funnel((s) => genderOf(s) === "male"),
      other: funnel((s) => genderOf(s) === "other"),
      unknown: funnel((s) => genderOf(s) === "unknown"),
    },
    facilitators: {
      total: Object.keys(db.facilitators).length,
      earning: [...earningsBy.values()].filter((e) => e > 0).length,
      moduleEarningsRupees: [...earningsBy.values()].reduce((a, b) => a + b, 0),
      learners: modules.reduce((a, m) => a + m.learners.length, 0),
      completionsCertified: modules.reduce((a, m) => a + (m.certified?.length ?? 0), 0),
    },
    credentials: { total: creds.length, skillDemonstrations: creds.filter((c) => c.jws && c.kind === "SkillDemonstration").length },
    sync: { opsApplied: Object.keys(db.appliedOps).length },
  };
}
