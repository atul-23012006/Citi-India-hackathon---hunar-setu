import type { Lang, Opportunity } from "../types.ts";
import { kb, type ScamPattern } from "../kb/index.ts";
import { pick } from "../i18n/strings.ts";

// "Truecaller for job offers". Runs fully offline on rules + the network's scam
// reports (synced from the hub). Claude can add a second opinion when online, but
// the red flags below never depend on the model.

export type OfferVerdict = "danger" | "caution" | "ok";

export interface OfferFlag {
  id: string;
  severity: ScamPattern["severity"];
  explain: string;
  matched: string[];
}

export interface CommunityReport {
  fingerprint: string; // normalised phone number, URL host or recruiter name
  count: number;
  firstSeenDistrict?: string;
}

export interface OfferCheckResult {
  verdict: OfferVerdict;
  flags: OfferFlag[];
  verifiedEmployer?: Opportunity;
  communityHits: CommunityReport[];
  fingerprints: string[];
}

// Country codes for the South-East Asian scam-compound corridor MEA has warned about.
const RISKY_DIAL_CODES: Record<string, string> = { "+66": "Thailand", "+95": "Myanmar", "+856": "Laos", "+855": "Cambodia" };

export function extractFingerprints(text: string): string[] {
  const phones = [...text.matchAll(/(\+\d{2,3}[\s-]?)?\d[\d\s-]{8,13}\d/g)].map((m) => m[0].replace(/[\s-]/g, ""));
  const hosts = [...text.matchAll(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?/gi)].map((m) => m[1].toLowerCase());
  const tg = [...text.matchAll(/@[a-z0-9_]{4,}/gi)].map((m) => m[0].toLowerCase());
  return [...new Set([...phones, ...hosts, ...tg])];
}

export function checkOffer(text: string, lang: Lang, reports: CommunityReport[] = []): OfferCheckResult {
  const lower = text.toLowerCase();
  const flags: OfferFlag[] = [];

  for (const p of kb.scamPatterns) {
    const matched = p.keywords.filter((k) => lower.includes(k.toLowerCase()));
    if (!matched.length) continue;
    if (p.requiresAny && !p.requiresAny.some((k) => lower.includes(k))) continue;
    flags.push({ id: p.id, severity: p.severity, explain: pick(lang, p.explain), matched });
  }

  for (const [code, country] of Object.entries(RISKY_DIAL_CODES)) {
    if (text.replace(/\s/g, "").includes(code)) {
      flags.push({
        id: "risky-dial-code",
        severity: "high",
        explain: `${country} (${code}) phone number. ${pick(lang, kb.scamPatterns.find((s) => s.id === "sea-scam-compound")!.explain)}`,
        matched: [code],
      });
    }
  }

  // Salary that looks too high for a no-skill role.
  const pay = [...lower.matchAll(/(?:rs\.?|₹|inr)\s?([\d,]{5,})/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const lakh = /(\d+(?:\.\d+)?)\s?lakh/.exec(lower);
  if (lakh) pay.push(Number(lakh[1]) * 100_000);
  const noSkill = /(no experience|no qualification|8th pass|10th pass|freshers?)/.test(lower);
  if (noSkill && pay.some((v) => v >= 60_000)) {
    const p = kb.scamPatterns.find((s) => s.id === "too-good-pay")!;
    if (!flags.some((f) => f.id === p.id)) flags.push({ id: p.id, severity: "medium", explain: pick(lang, p.explain), matched: ["pay"] });
  }

  const fingerprints = extractFingerprints(text);
  const communityHits = reports.filter((r) => fingerprints.includes(r.fingerprint) || (r.fingerprint.length > 6 && lower.includes(r.fingerprint)));

  const verifiedEmployer = kb.opportunities.find((o) => {
    const name = o.employer.replace(/\(.*?\)/g, "").trim().toLowerCase();
    return o.employerVerified && name.length > 4 && lower.includes(name);
  });

  let verdict: OfferVerdict = "ok";
  if (flags.some((f) => f.severity === "critical" || f.severity === "high") || communityHits.some((h) => h.count >= 2)) verdict = "danger";
  else if (flags.length || communityHits.length) verdict = "caution";
  if (verdict === "caution" && verifiedEmployer && flags.every((f) => f.severity === "low")) verdict = "ok";

  return { verdict, flags, verifiedEmployer, communityHits, fingerprints };
}
