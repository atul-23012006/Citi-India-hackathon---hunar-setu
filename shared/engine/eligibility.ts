import type { Condition, DocKey, EducationLevel, Lang, Scheme, StudentProfile } from "../types.ts";
import { kb } from "../kb/index.ts";
import { pick, rupees, t } from "../i18n/strings.ts";

// Deterministic eligibility. The LLM never decides eligibility: it only relays
// what this function returns, with the citation attached.

export type Verdict = "eligible" | "near_miss" | "not_eligible" | "unknown";

export interface ConditionResult {
  condition: Condition;
  pass: boolean | null; // null = profile does not say yet
  fixable: boolean; // a document the student can still get
  reason: string;
}

export interface EligibilityResult {
  schemeId: string;
  schemeName: string;
  verdict: Verdict;
  results: ConditionResult[];
  missingDocs: DocKey[];
  unknownFields: string[];
  benefit: string;
  benefitRupeesPerYear?: number;
  applyAt: string;
  source: { name: string; url?: string; asOf: string };
  notes?: string;
}

export const EDU_ORDER: EducationLevel[] = ["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"];

const EDU_RANK: Record<EducationLevel, number> = {
  class8: 1, class9: 2, class10: 3, class11: 4, class12: 5, iti: 5, diploma: 6, ug: 7, pg: 8,
};

// ITI is a parallel track after Class 10, so "needs ITI" is not met by Class 12.
export function meetsEducation(have: EducationLevel | undefined, need: EducationLevel): boolean {
  if (!have) return false;
  if (need === "iti") return have === "iti" || have === "diploma";
  return EDU_RANK[have] >= EDU_RANK[need];
}

function evalCondition(c: Condition, p: StudentProfile, lang: Lang): ConditionResult {
  const r = (pass: boolean | null, reason: string, fixable = false): ConditionResult => ({ condition: c, pass, fixable, reason });
  switch (c.kind) {
    case "age": {
      const range = c.max ? `${c.min ?? 0}-${c.max}` : `${c.min}+`;
      if (p.age == null) return r(null, t(lang, "r.unknown", { what: t(lang, "q.age") }));
      return r((c.min == null || p.age >= c.min) && (c.max == null || p.age <= c.max), t(lang, "r.age", { range }));
    }
    case "education": {
      const list = c.anyOf.map((e) => t(lang, `e.${e}` as const)).join(", ");
      if (!p.education) return r(null, t(lang, "r.unknown", { what: t(lang, "q.education") }));
      return r(c.anyOf.includes(p.education), t(lang, "r.education", { list }));
    }
    case "inEducation":
      if (p.inEducation == null) return r(null, t(lang, "r.unknown", { what: t(lang, "q.studying") }));
      return r(p.inEducation === c.value, t(lang, c.value ? "r.inEducation.true" : "r.inEducation.false"));
    case "category":
      if (!p.category) return r(null, t(lang, "r.unknown", { what: t(lang, "q.category") }));
      return r(c.anyOf.includes(p.category), t(lang, "r.category", { list: c.anyOf.join(", ") }));
    case "minority":
      if (p.minority == null) return r(null, t(lang, "r.unknown", { what: t(lang, "r.minority") }));
      return r(p.minority === true, t(lang, "r.minority"));
    case "gender": {
      const list = c.anyOf.map((g) => t(lang, `g.${g}` as const)).join(", ");
      if (!p.gender) return r(null, t(lang, "r.unknown", { what: t(lang, "q.gender") }));
      return r(c.anyOf.includes(p.gender), t(lang, "r.gender", { list }));
    }
    case "incomeMax":
      if (p.familyIncome == null) return r(null, t(lang, "r.unknown", { what: t(lang, "q.income") }));
      return r(p.familyIncome <= c.value, t(lang, "r.incomeMax", { v: rupees(c.value) }));
    case "marksMin":
      if (p.marksPercent == null) return r(null, t(lang, "r.unknown", { what: t(lang, "q.marks") }));
      return r(p.marksPercent >= c.value, t(lang, "r.marksMin", { v: c.value }));
    case "disabilityMin":
      return r((p.disabilityPercent ?? 0) >= c.value, t(lang, "r.disabilityMin", { v: c.value }));
    case "state":
      if (!p.state) return r(null, t(lang, "r.unknown", { what: t(lang, "q.state") }));
      return r(c.anyOf.includes(p.state), t(lang, "r.state", { list: c.anyOf.join(", ") }));
    case "noGovtEmployeeInFamily":
      return r(p.govtEmployeeInFamily !== true, t(lang, "r.noGovtEmployeeInFamily"));
    case "doc": {
      const doc = kb.docs.find((d) => d.key === c.doc);
      const has = p.docs[c.doc] === true;
      return r(has, t(lang, "r.doc", { doc: doc ? pick(lang, doc.name) : c.doc }), !has);
    }
  }
}

export function checkScheme(scheme: Scheme, p: StudentProfile, lang: Lang = p.lang): EligibilityResult {
  const results = scheme.conditions.map((c) => evalCondition(c, p, lang));
  const hardFail = results.some((r) => r.pass === false && !r.fixable);
  const unknown = results.filter((r) => r.pass === null);
  const missingDocs = results
    .filter((r) => r.fixable && r.pass === false)
    .map((r) => (r.condition as Extract<Condition, { kind: "doc" }>).doc);

  let verdict: Verdict;
  if (hardFail) verdict = "not_eligible";
  else if (unknown.length) verdict = "unknown";
  else if (missingDocs.length) verdict = "near_miss";
  else verdict = "eligible";

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    verdict,
    results,
    missingDocs,
    unknownFields: unknown.map((u) => u.condition.kind),
    benefit: pick(lang, scheme.benefit),
    benefitRupeesPerYear: scheme.benefitRupeesPerYear,
    applyAt: scheme.applyAt,
    source: scheme.sources[0],
    notes: scheme.notes,
  };
}

const RANK: Record<Verdict, number> = { eligible: 0, near_miss: 1, unknown: 2, not_eligible: 3 };

export function checkAll(p: StudentProfile, lang: Lang = p.lang, schemeIds?: string[]): EligibilityResult[] {
  const list = schemeIds ? kb.schemes.filter((s) => schemeIds.includes(s.id)) : kb.schemes;
  return list
    .map((s) => checkScheme(s, p, lang))
    .sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || (b.benefitRupeesPerYear ?? 0) - (a.benefitRupeesPerYear ?? 0));
}

// "You miss this by a hard rule - but this other one fits today."
export function alternativesFor(failed: EligibilityResult, all: EligibilityResult[]): EligibilityResult[] {
  const failedType = kb.schemes.find((s) => s.id === failed.schemeId)?.type;
  return all.filter(
    (r) => r.schemeId !== failed.schemeId && r.verdict === "eligible" && kb.schemes.find((s) => s.id === r.schemeId)?.type === failedType,
  );
}

// Benefits that cannot be held together count once: a student gets one central
// scholarship (NSP allows one), state scholarships stack on top, and an internship
// and an apprenticeship are alternatives. Summing everything would promise money
// that can never land.
function stackGroup(schemeId: string): string {
  const s = kb.schemes.find((x) => x.id === schemeId);
  if (!s) return schemeId;
  if (s.type === "scholarship") return s.conditions.some((c) => c.kind === "state") ? `scholarship:state:${schemeId}` : "scholarship:central";
  if (s.type === "internship" || s.type === "apprenticeship") return "placement";
  return s.type;
}

export function claimableRupees(results: EligibilityResult[], include: Verdict[] = ["eligible", "near_miss"]): number {
  const best = new Map<string, number>();
  for (const r of results) {
    if (!include.includes(r.verdict)) continue;
    const g = stackGroup(r.schemeId);
    best.set(g, Math.max(best.get(g) ?? 0, r.benefitRupeesPerYear ?? 0));
  }
  return [...best.values()].reduce((a, b) => a + b, 0);
}
