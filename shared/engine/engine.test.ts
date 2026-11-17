import { test } from "node:test";
import assert from "node:assert/strict";
import type { StudentProfile } from "../types.ts";
import { kb } from "../kb/index.ts";
import { checkAll, checkScheme, alternativesFor, meetsEducation, claimableRupees, type EligibilityResult } from "./eligibility.ts";
import { rankCareers, buildPathway, COMMON_ASPIRATIONS } from "./careers.ts";
import { paperworkPlan } from "./paperwork.ts";
import { checkOffer } from "./offerCheck.ts";
import { trueCost } from "./trueCost.ts";

const base = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  id: "s1", name: "Meena", lang: "en", interests: [], skills: [], demonstrated: [], docs: {}, updatedAt: "2026-11-14", ...over,
});

const scheme = (id: string) => kb.schemes.find((s) => s.id === id)!;

test("SC Class 11 student with all docs is eligible for post-matric", () => {
  const p = base({ category: "SC", education: "class11", inEducation: true, familyIncome: 180000, docs: { caste_cert: true, income_cert: true, marksheet_10: true, aadhaar_seeded: true } });
  assert.equal(checkScheme(scheme("sc-post-matric"), p).verdict, "eligible");
});

test("missing income certificate is a near miss, not a rejection", () => {
  const p = base({ category: "SC", education: "class11", inEducation: true, familyIncome: 180000, docs: { caste_cert: true, marksheet_10: true, aadhaar_seeded: true } });
  const r = checkScheme(scheme("sc-post-matric"), p);
  assert.equal(r.verdict, "near_miss");
  assert.deepEqual(r.missingDocs, ["income_cert"]);
});

test("income above the cap is a hard no, even with missing docs", () => {
  const p = base({ category: "SC", education: "class11", inEducation: true, familyIncome: 300000 });
  assert.equal(checkScheme(scheme("sc-post-matric"), p).verdict, "not_eligible");
});

test("unknown fields produce 'unknown', never a guess", () => {
  const p = base({ category: "SC", education: "class11" });
  const r = checkScheme(scheme("sc-post-matric"), p);
  assert.equal(r.verdict, "unknown");
  assert.ok(r.unknownFields.includes("incomeMax"));
});

test("PM Internship 2026 rules: 18-25, income under 8 lakh, no govt employee", () => {
  const p = base({ age: 19, education: "class12", familyIncome: 400000, docs: { aadhaar_seeded: true } });
  assert.equal(checkScheme(scheme("pm-internship"), p).verdict, "eligible");
  assert.equal(checkScheme(scheme("pm-internship"), { ...p, govtEmployeeInFamily: true }).verdict, "not_eligible");
  assert.equal(checkScheme(scheme("pm-internship"), { ...p, age: 26 }).verdict, "not_eligible");
});

test("near-miss engine offers an alternative of the same type", () => {
  const p = base({ state: "TN", gender: "female", category: "GEN", education: "ug", inEducation: true, marksPercent: 70, familyIncome: 200000, docs: { bonafide: true, aadhaar_seeded: true, income_cert: true, marksheet_12: true } });
  const all = checkAll(p);
  const csss = all.find((r) => r.schemeId === "csss")!;
  assert.equal(csss.verdict, "not_eligible"); // marks below proxy cut-off
  const alts = alternativesFor(csss, all).map((a) => a.schemeId);
  assert.ok(alts.includes("tn-pudhumai-penn"), `expected Pudhumai Penn, got ${alts}`);
});

test("ITI requirement is not met by Class 12", () => {
  assert.equal(meetsEducation("class12", "iti"), false);
  assert.equal(meetsEducation("iti", "class10"), true);
  assert.equal(meetsEducation("ug", "class12"), true);
});

test("diversity rule: shortlist widens beyond the common four aspirations", () => {
  const p = base({ age: 16, education: "class10", interests: ["uniform", "caring", "talking"] });
  const list = rankCareers(p);
  assert.equal(list.length, 6);
  const common = list.filter((m) => COMMON_ASPIRATIONS.has(m.occupation.id)).length;
  assert.ok(common <= 2, `at most 2 common aspirations, got ${common}`);
  assert.ok(list.filter((m) => m.wider).length >= 3);
  const tracks = new Map<string, number>();
  for (const m of list) tracks.set(m.occupation.track, (tracks.get(m.occupation.track) ?? 0) + 1);
  assert.ok([...tracks.values()].every((n) => n <= 2));
});

test("gender does not change career ranking", () => {
  const p = base({ age: 17, education: "class10", interests: ["hands_on", "computers"] });
  const girl = rankCareers({ ...p, gender: "female" }).map((m) => m.occupation.id);
  const boy = rankCareers({ ...p, gender: "male" }).map((m) => m.occupation.id);
  assert.deepEqual(girl, boy);
});

test("demonstrated skill outranks a declared one", () => {
  const p = base({ education: "class10", interests: ["creative"], demonstrated: [{ task: "hands_on", score: 1, at: "2026-11-14" }] });
  const top = rankCareers(p)[0];
  assert.ok(top.occupation.interests.includes("hands_on"));
});

test("pathway puts NIOS first when education is short, and gives one action", () => {
  const p = base({ age: 17, education: "class9", inEducation: false, interests: ["hands_on"] });
  const path = buildPathway(p, "electrician")!;
  assert.match(path.steps[0].label, /NIOS/);
  assert.ok(path.thisWeek.length > 0);
});

test("paperwork plan puts DBT seeding first", () => {
  const p = base({ category: "SC", education: "class11", inEducation: true, familyIncome: 100000, docs: { marksheet_10: true } });
  const plan = paperworkPlan(checkAll(p));
  assert.equal(plan[0].doc.key, "aadhaar_seeded");
  assert.ok(plan.some((t) => t.doc.key === "caste_cert"));
});

test("offer check: South-East Asia data-entry job is danger", () => {
  const r = checkOffer("Urgent! Data entry job in Bangkok, Thailand. Salary Rs 1,20,000. Tourist visa, free flight. Contact +66 812345678 on Telegram", "en");
  assert.equal(r.verdict, "danger");
  assert.ok(r.flags.some((f) => f.id === "sea-scam-compound"));
  assert.ok(r.flags.some((f) => f.id === "risky-dial-code"));
});

test("offer check: upfront fee is danger, Hindi keywords work", () => {
  assert.equal(checkOffer("नौकरी पक्की, बस 5000 रुपये जमा करें", "hi").verdict, "danger");
});

test("offer check: verified employer with no flags is ok", () => {
  const r = checkOffer("Apprenticeship at Suryodaya Rooftop Solar, Vellore. Stipend 9600 per month. Interview at office.", "en");
  assert.equal(r.verdict, "ok");
  assert.ok(r.verifiedEmployer);
});

test("offer check: community reports escalate", () => {
  const r = checkOffer("Call 9876543210 for warehouse job", "en", [{ fingerprint: "9876543210", count: 3 }]);
  assert.equal(r.verdict, "danger");
});

test("true cost: NAPS share is shown but not double counted", () => {
  const o = kb.opportunities.find((x) => x.id === "opp-garment-krg")!;
  const c = trueCost(o, base({ gender: "female" }), 1);
  assert.equal(c.livesAtHome, false);
  assert.equal(c.govtSupport[0].includedInStipend, true);
  assert.equal(c.net, 9600 - c.costs.rent - c.costs.food - c.costs.travelHome);
  assert.equal(c.safetyScore, 5);
});

test("claimable rupees never stack benefits that can't be held together", () => {
  const r = (schemeId: string, benefitRupeesPerYear: number, verdict: EligibilityResult["verdict"] = "eligible") => ({ schemeId, benefitRupeesPerYear, verdict }) as EligibilityResult;
  // Two central scholarships: only the larger counts. A state one stacks on top.
  assert.equal(claimableRupees([r("aicte-pragati", 50000), r("csss", 12000), r("tn-pudhumai-penn", 12000)]), 62000);
  // Internship and apprenticeship are alternatives.
  assert.equal(claimableRupees([r("pm-internship", 108000), r("naps", 18000)]), 108000);
  // "Eligible now" can be asked for on its own.
  assert.equal(claimableRupees([r("csss", 12000), r("aicte-pragati", 50000, "near_miss")], ["eligible"]), 12000);
});
