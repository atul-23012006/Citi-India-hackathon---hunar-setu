import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import type { Category, EducationLevel, Interest, StudentProfile } from "../shared/types.ts";
import { kb } from "../shared/kb/index.ts";
import { checkAll, claimableRupees } from "../shared/engine/eligibility.ts";
import { COMMON_ASPIRATIONS, rankCareers, scoreCareer } from "../shared/engine/careers.ts";
import { paperworkPlan } from "../shared/engine/paperwork.ts";
import { checkOffer } from "../shared/engine/offerCheck.ts";

// Data points for the Round 2 deck, measured by running the real engine over a
// synthetic cohort. Nothing here is field data: the cohort is generated with a
// fixed seed so the numbers are reproducible, and the deck labels them as such.
//
//   node scripts/data-points.ts [N]     -> prints a table, writes docs/round2/data-points.json

const N = Number(process.argv[2] ?? 1000);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// mulberry32: small, deterministic PRNG
let seed = 20261117;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pickOne = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const weighted = <T>(xs: readonly [T, number][]) => {
  let r = rnd() * xs.reduce((a, [, w]) => a + w, 0);
  for (const [x, w] of xs) if ((r -= w) <= 0) return x;
  return xs[xs.length - 1][0];
};

const INTERESTS: Interest[] = ["hands_on", "nature", "caring", "numbers", "creative", "talking", "computers", "uniform", "cooking"];
const eduForAge = (age: number): EducationLevel =>
  age <= 14 ? "class9" : age === 15 ? "class10" : age === 16 ? "class11" : age === 17 ? "class12" : weighted<EducationLevel>([["class12", 4], ["iti", 2], ["diploma", 1], ["ug", 3], ["class10", 2]]);

function synthStudent(i: number): StudentProfile {
  const age = 14 + Math.floor(rnd() * 9); // 14-22, Class 9 to graduation
  const education = eduForAge(age);
  const interests = [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pickOne(INTERESTS)))];
  const has = (p: number) => rnd() < p;
  return {
    id: `synth-${i}`, name: "", lang: pickOne(["hi", "ta", "kn", "en"] as const),
    age, education, inEducation: has(0.8), gender: weighted([["female", 48], ["male", 50], ["other", 2]]),
    marksPercent: Math.round(40 + rnd() * 55),
    state: pickOne(["TN", "KA", "UP", "BR", "MH", "RJ"]), district: "synthetic",
    category: weighted<Category>([["GEN", 25], ["EWS", 5], ["OBC", 42], ["SC", 19], ["ST", 9]]),
    minority: has(0.15), familyIncome: weighted([[80_000, 30], [150_000, 30], [240_000, 20], [450_000, 15], [900_000, 5]]),
    govtEmployeeInFamily: has(0.05), interests, skills: [], demonstrated: [],
    canRelocate: has(0.5),
    docs: { aadhaar: has(0.95), bank_account: has(0.8), aadhaar_seeded: has(0.6), income_cert: has(0.4), caste_cert: has(0.5), marksheet_10: age >= 16 && has(0.85), domicile_cert: has(0.3) },
    updatedAt: new Date(0).toISOString(),
  };
}

const cohort = Array.from({ length: N }, (_, i) => synthStudent(i));
const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];

// 1. Aspiration widening: our ranking (diversity rule) vs a plain top-6 by score.
let widerOurs = 0, widerNaive = 0, tracksOurs = 0, tracksNaive = 0, hasCommonOurs = 0;
// Students whose interests point at the common four (uniform, caring, talking):
// how many of the six slots do army/police/teacher/doctor take?
let commonStudents = 0, commonSlotsOurs = 0, commonSlotsNaive = 0;
const surfaced = new Set<string>();
const genderSame: boolean[] = [];
const timings: number[] = [];
for (const p of cohort) {
  const t0 = performance.now();
  const ours = rankCareers(p);
  const elig = checkAll(p);
  paperworkPlan(elig);
  timings.push(performance.now() - t0);

  const naive = kb.occupations.map((o) => scoreCareer(o, p)).sort((a, b) => b.score - a.score).slice(0, 6);
  widerOurs += ours.filter((m) => m.wider).length;
  widerNaive += naive.filter((m) => m.wider).length;
  if (p.interests.some((i) => i === "uniform" || i === "caring" || i === "talking")) {
    commonStudents++;
    commonSlotsOurs += ours.filter((m) => !m.wider).length;
    commonSlotsNaive += naive.filter((m) => !m.wider).length;
  }
  tracksOurs += new Set(ours.map((m) => m.occupation.track)).size;
  tracksNaive += new Set(naive.map((m) => m.occupation.track)).size;
  if (ours.some((m) => COMMON_ASPIRATIONS.has(m.occupation.id))) hasCommonOurs++;
  ours.forEach((m) => surfaced.add(m.occupation.id));

  const flipped = { ...p, gender: p.gender === "female" ? ("male" as const) : ("female" as const) };
  genderSame.push(rankCareers(flipped).map((m) => m.occupation.id).join() === ours.map((m) => m.occupation.id).join());
}

// 2. Eligibility: how often "no" becomes "not yet, because X".
const claimNow: number[] = [];
let anyEligible = 0, anyNearMiss = 0, verdicts = { eligible: 0, near_miss: 0, not_eligible: 0, unknown: 0 };
const claim: number[] = [];
for (const p of cohort) {
  const res = checkAll(p);
  for (const r of res) verdicts[r.verdict]++;
  if (res.some((r) => r.verdict === "eligible")) anyEligible++;
  if (res.some((r) => r.verdict === "near_miss")) anyNearMiss++;
  const c = claimableRupees(res);
  if (c > 0) claim.push(c);
  const now = claimableRupees(res, ["eligible"]);
  if (now > 0) claimNow.push(now);
}
const notYes = verdicts.near_miss + verdicts.not_eligible + verdicts.unknown;

// 3. Offer check runs on the phone: time it on a mixed set.
const offers = [
  "Urgent! Data entry job in Bangkok, Thailand. Salary Rs 1,20,000. Tourist visa, free flight. Contact +66 812345678 on Telegram",
  "नौकरी पक्की, बस 5000 रुपये जमा करें",
  "Apprenticeship at Suryodaya Rooftop Solar, Vellore. Stipend 9600 per month. Interview at office.",
  "Work from home, like videos and earn daily 3000. Pay registration fee 499.",
];
const ot: number[] = [];
for (let i = 0; i < 2000; i++) {
  const t0 = performance.now();
  checkOffer(offers[i % offers.length], "en");
  ot.push(performance.now() - t0);
}

// 4. What the phone downloads once (needs `npm run build` first).
const dist = join(root, "dist");
let bundle: { precacheKiB: number; jsGzipKiB: number } | null = null;
if (existsSync(dist)) {
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
  walk(dist);
  const cached = files.filter((f) => /\.(js|css|html|svg|json|webmanifest)$/.test(f) && !/sw\.js$|workbox-[^/]+\.js$/.test(f));
  bundle = {
    precacheKiB: Math.round(cached.reduce((a, f) => a + statSync(f).size, 0) / 1024),
    jsGzipKiB: Math.round(cached.filter((f) => f.endsWith(".js")).reduce((a, f) => a + gzipSync(readFileSync(f)).length, 0) / 1024),
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  note: `Engine run over ${N} synthetic student profiles (seeded, reproducible). Not field data.`,
  cohort: N,
  knowledgeBase: { occupations: kb.occupations.length, schemes: kb.schemes.length, courses: kb.courses.length, exams: kb.exams.length, scamPatterns: kb.scamPatterns.length },
  aspiration: {
    avgNewForYouRoutesInTop6: { ours: Math.round((widerOurs / N) * 10) / 10, plainRanking: Math.round((widerNaive / N) * 10) / 10 },
    commonFourSlotsOf6ForUniformCaringTalking: { students: commonStudents, ours: Math.round((commonSlotsOurs / commonStudents) * 100) / 100, plainRanking: Math.round((commonSlotsNaive / commonStudents) * 100) / 100 },
    avgDistinctTracksInTop6: { ours: Math.round((tracksOurs / N) * 10) / 10, plainRanking: Math.round((tracksNaive / N) * 10) / 10 },
    occupationsSurfacedAcrossCohort: surfaced.size,
    shortlistsStillShowingACommonFour: pct(hasCommonOurs, N),
    genderFlipIdenticalShortlist: pct(genderSame.filter(Boolean).length, N),
  },
  eligibility: {
    schemesCheckedPerStudent: kb.schemes.length,
    studentsWithAtLeastOneEligible: pct(anyEligible, N),
    studentsWithAtLeastOneNearMiss: pct(anyNearMiss, N),
    ofNonYesVerdicts: { nearMiss: pct(verdicts.near_miss, notYes), unknownWithQuestion: pct(verdicts.unknown, notYes), hardNo: pct(verdicts.not_eligible, notYes) },
    medianRupeesPerYearEligibleNow: claimNow.length ? quantile(claimNow, 0.5) : 0,
    medianRupeesPerYearIncludingOneDocAway: claim.length ? quantile(claim, 0.5) : 0,
  },
  performance: {
    fullEngineMsPerStudent: { p50: +quantile(timings, 0.5).toFixed(2), p95: +quantile(timings, 0.95).toFixed(2) },
    offerCheckMs: { p50: +quantile(ot, 0.5).toFixed(3), p95: +quantile(ot, 0.95).toFixed(3) },
    machine: `${process.platform}/${process.arch}, Node ${process.version} (a low-end phone will be several times slower)`,
  },
  bundle,
};

mkdirSync(join(root, "docs", "round2"), { recursive: true });
writeFileSync(join(root, "docs", "round2", "data-points.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
