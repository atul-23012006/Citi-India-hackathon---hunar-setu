import type { Opportunity, StudentProfile } from "../types.ts";
import type { Place } from "../geo.ts";
import { kb } from "../kb/index.ts";
import msmeData from "../kb/msme.json" with { type: "json" };
import { meetsEducation } from "./eligibility.ts";

// Regional recommendations: what is open near the student, and which local MSME
// clusters hire for the careers they're drawn to. Pure functions, so the phone
// can rank offline and the hub ranks the same way.

export interface MsmeCluster {
  name: string;
  district: string;
  sector: string;
  occupations: string[];
  searchTerms: string[];
}

export interface StateMsme {
  udyamJobsLakh?: number;
  clusters: MsmeCluster[];
}

export interface MsmeSupport {
  id: string;
  name: string;
  what: string;
  numbers: string;
  url: string;
  forWhom: string;
  schemeId?: string;
}

export type MsmeKb = typeof msmeData & { states: Record<string, StateMsme>; supports: MsmeSupport[] };
export const msme = msmeData as MsmeKb;

// Every English sentence on the MSME screen; each is translated through
// translations.json like the rest of the knowledge base.
export const msmeTexts = (): string[] =>
  [...msme.supports.flatMap((s) => [s.forWhom, s.what, s.numbers]), ...msme.challenges, msme.national.notes].filter(Boolean);

const sameName =(a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase().replace(/\s+district$/, "") === b.trim().toLowerCase().replace(/\s+district$/, "");

// Clusters in the student's state, their own district first.
export function clustersFor(place: Pick<Place, "state" | "district">): (MsmeCluster & { inDistrict: boolean })[] {
  const st = msme.states[place.state];
  if (!st) return [];
  return st.clusters
    .map((c) => ({ ...c, inDistrict: sameName(c.district, place.district) }))
    .sort((a, b) => Number(b.inDistrict) - Number(a.inDistrict));
}

// Words a job board understands, per career ("Solar PV technician" finds less than "solar technician").
export const SEARCH_TERM: Record<string, string> = {
  "solar-pv-technician": "solar technician", electrician: "electrician", "ac-technician": "AC technician", "mobile-repair": "mobile repair",
  "ev-mechanic": "EV technician", welder: "welder", plumber: "plumber", carpenter: "carpenter", "tailor-designer": "tailor",
  beautician: "beautician", "general-duty-assistant": "patient care assistant", nurse: "staff nurse", "lab-technician": "lab technician",
  "anganwadi-ecce": "preschool teacher", "school-teacher": "teacher", "drone-pilot": "drone pilot", "dairy-entrepreneur": "dairy",
  "agri-field-officer": "agriculture field officer", "fish-farmer": "aquaculture", "baker-food-processing": "food processing", chef: "cook",
  "csc-vle": "data entry", "bank-correspondent": "bank correspondent", "accounts-assistant": "accounts assistant", "web-developer": "web developer",
  "graphic-designer": "graphic designer", "local-journalist": "reporter", "civil-technician": "site supervisor", "vet-assistant": "veterinary assistant",
  "retail-associate": "retail sales", "army-agniveer": "security guard", "police-constable": "security guard", "railway-technician": "technician",
  doctor: "medical officer", "potter-artisan": "handicraft",
};

// What to ask the live job boards for: the student's own words first, then
// their chosen career, then careers that fit their interests, then what the
// local cluster hires for. Kept short because each term costs an API call.
export function searchTerms(p: Partial<StudentProfile>, place: Pick<Place, "state" | "district">, q?: string): string[] {
  const out: string[] = [];
  const add = (s?: string) => { if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s); };
  add(q?.trim() || undefined);
  if (p.chosenOccupation) add(SEARCH_TERM[p.chosenOccupation]);
  const interests = p.interests ?? [];
  for (const o of kb.occupations) if (interests.includes(o.interests[0]) && out.length < 3) add(SEARCH_TERM[o.id]);
  // A cluster in another district says nothing about work here (Tiruppur
  // knitwear is no hint for Vellore), so only the home district's counts.
  const local = clustersFor(place).find((c) => c.inDistrict);
  if (local) add(local.searchTerms[0]);
  if (!out.length) add("apprentice");
  return out.slice(0, 3);
}

export type RegionalReason = "same_district" | "same_state" | "fits_career" | "fits_interests" | "msme_cluster" | "verified" | "hostel" | "women_staff" | "needs_education";

export interface RegionalMatch {
  opportunity: Opportunity;
  score: number;
  eligibleNow: boolean;
  reasons: RegionalReason[];
  cluster?: string;
}

export function rankRegional(opps: Opportunity[], place: Pick<Place, "state" | "district">, p: Partial<StudentProfile>): RegionalMatch[] {
  const clusters = clustersFor(place);
  const interests = p.interests ?? [];
  return opps
    // Out of state only counts when there's a hostel and the student said they can move.
    .filter((o) => o.state === place.state || (o.hostel && p.canRelocate !== false))
    .map((o) => {
      const reasons: RegionalReason[] = [];
      let score = 0;
      const add = (r: RegionalReason, when: boolean, pts: number) => { if (when) { reasons.push(r); score += pts; } };
      add("same_district", sameName(o.district, place.district), 5);
      add("same_state", o.state === place.state && !sameName(o.district, place.district), 2);
      add("fits_career", !!p.chosenOccupation && o.occupationIds.includes(p.chosenOccupation), 4);
      const occs = o.occupationIds.map((id) => kb.occupations.find((x) => x.id === id)).filter((x) => !!x);
      add("fits_interests", !reasons.includes("fits_career") && occs.some((x) => x.interests.some((i) => interests.includes(i))), 2);
      // A cluster only explains an opening in its own district.
      const cluster = clusters.find((c) => sameName(c.district, o.district) && c.occupations.some((id) => o.occupationIds.includes(id)));
      add("msme_cluster", !!cluster, 1.5);
      add("verified", o.employerVerified, 1);
      add("hostel", o.hostel && !!p.needsHostel, 1);
      add("women_staff", o.womenStaffed && p.gender === "female", 1);
      // Not told yet is not the same as not qualified: only a known gap ranks lower.
      const eligibleNow = !p.education || meetsEducation(p.education, o.minEducation);
      add("needs_education", !eligibleNow, -3);
      return { opportunity: o, score, eligibleNow, reasons, cluster: cluster?.name };
    })
    .sort((a, b) => b.score - a.score);
}
