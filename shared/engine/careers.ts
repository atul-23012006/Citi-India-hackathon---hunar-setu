import type { Course, EducationLevel, Exam, Lang, Occupation, Opportunity, StudentProfile } from "../types.ts";
import { kb } from "../kb/index.ts";
import { pick, t } from "../i18n/strings.ts";
import { checkAll, EDU_ORDER, meetsEducation, type EligibilityResult } from "./eligibility.ts";

// The four answers rural teens most often give (ASER 2023). We never hide them,
// but the shortlist must also show routes the student has not heard of.
export const COMMON_ASPIRATIONS = new Set(["army-agniveer", "police-constable", "school-teacher", "doctor"]);

export interface CareerMatch {
  occupation: Occupation;
  score: number;
  why: string[]; // short, explainable reasons - shown and spoken
  wider: boolean; // outside the common four; shown as "New for you"
  reachable: boolean; // student already meets the minimum education
}

const eduRank = (e?: EducationLevel) => (e ? EDU_ORDER.indexOf(e) : -1);

export function scoreCareer(o: Occupation, p: StudentProfile): CareerMatch {
  const why: string[] = [];
  let score = 0;

  const overlap = o.interests.filter((i) => p.interests.includes(i));
  if (overlap.length) {
    score += overlap.length * 3 + (overlap.length / o.interests.length) * 2;
    why.push(`interest:${overlap.join(",")}`);
  }

  // Demonstrated beats declared: a task the student actually did counts double.
  for (const d of p.demonstrated) {
    if (o.interests.includes(d.task as never) || d.task === o.id) {
      score += 2 + d.score * 2;
      why.push(`demonstrated:${d.task}`);
    }
  }
  if (p.skills.some((s) => s === o.id || o.interests.includes(s as never))) score += 1;

  const reachable = meetsEducation(p.education, o.minEducation);
  if (reachable) score += 1.5;
  else {
    const gap = eduRank(o.minEducation) - eduRank(p.education);
    score -= gap > 3 ? 2 : 0.5;
    why.push(`needs:${o.minEducation}`);
  }

  // Can't move? Favour routes that exist in every block.
  if (p.canRelocate === false && ["self_employed", "agri", "care", "digital", "green"].includes(o.track)) {
    score += 1;
    why.push("local");
  }
  if (o.demandNote) score += 0.5;

  // Gender is deliberately NOT a scoring input: we do not steer girls to tailoring
  // or boys to welding. Safety is handled later, per opportunity, with the family.
  return { occupation: o, score, why, wider: !COMMON_ASPIRATIONS.has(o.id), reachable };
}

/**
 * Diversity rule: at most 2 routes per track, at most 2 of the common four
 * aspirations, and at least `minWider` routes from outside them.
 */
export function rankCareers(p: StudentProfile, n = 6, minWider = 3): CareerMatch[] {
  const all = kb.occupations.map((o) => scoreCareer(o, p)).sort((a, b) => b.score - a.score);
  const picked: CareerMatch[] = [];
  const perTrack = new Map<string, number>();
  let common = 0;

  const tryAdd = (m: CareerMatch) => {
    if (picked.includes(m) || picked.length >= n) return;
    if ((perTrack.get(m.occupation.track) ?? 0) >= 2) return;
    if (!m.wider && common >= 2) return;
    const widerSoFar = picked.filter((x) => x.wider).length;
    const slotsLeft = n - picked.length;
    if (!m.wider && minWider - widerSoFar >= slotsLeft) return;
    picked.push(m);
    perTrack.set(m.occupation.track, (perTrack.get(m.occupation.track) ?? 0) + 1);
    if (!m.wider) common++;
  };

  for (const m of all) tryAdd(m);
  return picked;
}

export interface PathwayStepView {
  label: string;
  duration?: string;
  course?: Course;
}

export interface Pathway {
  occupation: Occupation;
  steps: PathwayStepView[];
  exams: Exam[];
  schemes: EligibilityResult[];
  opportunities: OpportunityMatch[];
  thisWeek: string;
}

export function buildPathway(p: StudentProfile, occupationId: string, lang: Lang = p.lang): Pathway | null {
  const o = kb.occupations.find((x) => x.id === occupationId);
  if (!o) return null;

  const steps: PathwayStepView[] = [];
  if (!meetsEducation(p.education, o.minEducation) && o.minEducation !== "iti") {
    const open = o.minEducation === "class10" ? "nios-secondary" : "diksha-class9-10";
    steps.push({
      label: `${t(lang, `e.${o.minEducation}` as const)} - NIOS / ${t(lang, "e.class10")}`,
      course: kb.courses.find((c) => c.id === open),
    });
  }
  for (const s of o.steps) {
    steps.push({ label: pick(lang, s.label), duration: s.duration, course: s.courseId ? kb.courses.find((c) => c.id === s.courseId) : undefined });
  }

  const exams = o.exams
    .map((id) => kb.exams.find((e) => e.id === id))
    .filter((e): e is Exam => !!e && (e.ageMax == null || p.age == null || p.age <= e.ageMax));

  const schemes = checkAll(p, lang, o.schemes).filter((r) => r.verdict !== "not_eligible");
  const opportunities = matchOpportunities(p, o.id);

  return { occupation: o, steps, exams, schemes, opportunities, thisWeek: thisWeekAction(p, steps, schemes, opportunities, lang) };
}

function thisWeekAction(p: StudentProfile, steps: PathwayStepView[], schemes: EligibilityResult[], opps: OpportunityMatch[], lang: Lang): string {
  const nearMiss = schemes.find((s) => s.verdict === "near_miss");
  if (nearMiss) {
    const doc = kb.docs.find((d) => d.key === nearMiss.missingDocs[0]);
    if (doc) return `${t(lang, "money.startnow", { d: doc.typicalDays })}: ${pick(lang, doc.name)} → ${nearMiss.schemeName}`;
  }
  const freeOnline = steps.find((s) => s.course?.cost === "free" && s.course.mode === "online");
  if (freeOnline?.course) return `${freeOnline.course.name} (${freeOnline.course.provider}) - free`;
  const mentor = opps.find((o) => o.opportunity.kind === "mentor");
  if (mentor) return mentor.opportunity.title;
  return steps[0]?.label ?? "";
}

// ---- Opportunities ----

export interface OpportunityMatch {
  opportunity: Opportunity;
  score: number;
  eligibleNow: boolean;
  flags: ("verified" | "epf" | "hostel" | "women" | "near" | "far")[];
}

export function matchOpportunities(p: StudentProfile, occupationId?: string): OpportunityMatch[] {
  const maxKm = p.maxDistanceKm ?? (p.canRelocate === false ? 40 : 200);
  return kb.opportunities
    .filter((o) => !occupationId || o.occupationIds.includes(occupationId))
    .map((o) => {
      const flags: OpportunityMatch["flags"] = [];
      const km = o.distanceKmFromHub ?? 0;
      const add = (flag: OpportunityMatch["flags"][number], when: boolean, points: number) => {
        if (!when) return 0;
        flags.push(flag);
        return points;
      };
      let score =
        add("verified", o.employerVerified, 2) +
        add("epf", o.epfRegistered, 1) +
        add("hostel", o.hostel, p.needsHostel ? 2 : 0.5) +
        add("women", o.womenStaffed, p.gender === "female" ? 1.5 : 0) +
        add("near", km <= 40, 1.5) +
        add("far", km > maxKm && !o.hostel, -3);
      if (p.state && o.state === p.state) score += 0.5;
      const eligibleNow = meetsEducation(p.education, o.minEducation);
      if (!eligibleNow) score -= 2;
      return { opportunity: o, score, eligibleNow, flags };
    })
    .sort((a, b) => b.score - a.score);
}
