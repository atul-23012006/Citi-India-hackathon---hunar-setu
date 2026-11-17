import type { Doc, DocKey } from "../types.ts";
import { kb } from "../kb/index.ts";
import type { EligibilityResult } from "./eligibility.ts";

// Paperwork Autopilot: work backwards from what the student qualifies for to the
// certificates they still need, longest lead time first, DBT seeding before all.

export interface PaperTask {
  doc: Doc;
  unlocks: string[]; // scheme names this document unlocks
  rupeesUnlocked: number;
  startBy: string; // ISO date
  readyBy: string; // ISO date, indicative
  fromDigiLocker: boolean;
  priority: number;
}

export function paperworkPlan(results: EligibilityResult[], today = new Date()): PaperTask[] {
  const need = new Map<DocKey, { unlocks: string[]; rupees: number }>();
  for (const r of results) {
    if (r.verdict !== "near_miss") continue;
    for (const d of r.missingDocs) {
      const e = need.get(d) ?? { unlocks: [], rupees: 0 };
      e.unlocks.push(r.schemeName);
      e.rupees += r.benefitRupeesPerYear ?? 0;
      need.set(d, e);
    }
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [...need.entries()]
    .map(([key, v]) => {
      const doc = kb.docs.find((d) => d.key === key)!;
      const ready = new Date(today.getTime() + doc.typicalDays * 86_400_000);
      // DBT seeding first: CAG found sanctioned money bouncing for want of it.
      const priority = (key === "aadhaar_seeded" ? 1000 : 0) + doc.typicalDays * 10 + v.unlocks.length;
      return {
        doc,
        unlocks: v.unlocks,
        rupeesUnlocked: v.rupees,
        startBy: iso(today),
        readyBy: iso(ready),
        fromDigiLocker: doc.inDigiLocker,
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

export function needsDbtCheck(results: EligibilityResult[], seeded: boolean | undefined): boolean {
  if (seeded) return false;
  return results.some((r) => (r.verdict === "eligible" || r.verdict === "near_miss") && kb.schemes.find((s) => s.id === r.schemeId)?.dbt);
}
