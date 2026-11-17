import type { Opportunity, StudentProfile } from "../types.ts";

// Family Decision Kit: is it worth it after rent, food and travel?
// Every default is an editable assumption, shown to the family as such.

export interface CostAssumptions {
  rent: number;
  food: number;
  travelHome: number;
  dailyCommute: number;
}

export interface TrueCost {
  livesAtHome: boolean;
  stipend: number;
  govtSupport: { label: string; monthly: number; includedInStipend: boolean }[];
  costs: CostAssumptions;
  net: number;
  safety: { hostel: boolean; womenStaffed: boolean; verified: boolean; epf: boolean; distanceKm: number; goingTogether: number };
  safetyScore: number; // 0-5, for a simple star display
}

export const COMMUTE_KM = 40;

export function defaultAssumptions(o: Opportunity): CostAssumptions {
  const km = o.distanceKmFromHub ?? 0;
  if (km <= COMMUTE_KM) {
    // Bus fare approximated at Rs 1.2/km each way for 26 working days.
    return { rent: 0, food: 0, travelHome: 0, dailyCommute: Math.round(km * 2 * 1.2 * 26) };
  }
  return {
    rent: o.hostel ? 1500 : 3500,
    food: o.hostel ? 1500 : 3000,
    travelHome: Math.round(km * 2 * 1.2 * 2), // two trips home a month
    dailyCommute: 0,
  };
}

export function trueCost(o: Opportunity, p: StudentProfile, goingTogether = 0, overrides: Partial<CostAssumptions> = {}): TrueCost {
  const costs = { ...defaultAssumptions(o), ...overrides };
  const stipend = o.stipendMonthly ?? 0;
  const govtSupport: TrueCost["govtSupport"] = [];

  // NAPS-2: govt pays 25% of the stipend (max Rs 1,500/month) straight to the
  // apprentice by DBT; the employer pays the rest. It is part of the stipend, not
  // extra, so it is shown for transparency but not added to the total.
  if (o.schemeIds.includes("naps") && o.kind === "apprenticeship") {
    govtSupport.push({ label: "NAPS-2 share, paid by DBT (included in stipend)", monthly: Math.min(1500, Math.round(stipend * 0.25)), includedInStipend: true });
  }
  // PM-VBRY: up to Rs 15,000 on top of salary for a first EPF job.
  if (o.epfRegistered && o.kind === "job" && o.schemeIds.includes("pm-vbry")) {
    govtSupport.push({ label: "PM-VBRY first-job incentive (spread over 12 months)", monthly: Math.round(15000 / 12), includedInStipend: false });
  }
  const support = govtSupport.filter((g) => !g.includedInStipend).reduce((s, g) => s + g.monthly, 0);
  const net = stipend + support - costs.rent - costs.food - costs.travelHome - costs.dailyCommute;

  const km = o.distanceKmFromHub ?? 0;
  const safety = { hostel: o.hostel, womenStaffed: o.womenStaffed, verified: o.employerVerified, epf: o.epfRegistered, distanceKm: km, goingTogether };
  const safetyScore =
    Number(o.employerVerified) + Number(o.epfRegistered) + Number(o.hostel || km <= COMMUTE_KM) +
    Number(p.gender !== "female" || o.womenStaffed) + Number(goingTogether > 0);

  return { livesAtHome: km <= COMMUTE_KM, stipend, govtSupport, costs, net, safety, safetyScore };
}
