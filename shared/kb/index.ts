import type { Course, Doc, Exam, I18n, Occupation, Opportunity, Scheme } from "../types.ts";
import occupations from "./occupations.json" with { type: "json" };
import schemes from "./schemes.json" with { type: "json" };
import courses from "./courses.json" with { type: "json" };
import exams from "./exams.json" with { type: "json" };
import docs from "./docs.json" with { type: "json" };
import opportunities from "./opportunities.json" with { type: "json" };
import scams from "./scam-patterns.json" with { type: "json" };
import translations from "./translations.json" with { type: "json" };

// Translations are data keyed by the English text, so a new language or a
// corrected phrase is a JSON edit (or `npm run kb:translate`), never a code change.
const tr = translations as Record<string, Omit<I18n, "en">>;
export const translate = (en: string): I18n => ({ ...tr[en], en });
const withTranslations = (v: I18n): I18n => ({ ...tr[v.en], ...v });

for (const o of occupations as Occupation[]) for (const s of o.steps) s.label = withTranslations(s.label);
const docsTranslated: Doc[] = (docs as unknown as (Omit<Doc, "howTo"> & { howTo: string })[]).map((d) => ({ ...d, howTo: translate(d.howTo) }));

export interface ScamPattern {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  requiresAny?: string[];
  explain: { en: string; hi?: string; ta?: string; kn?: string };
}

export interface KB {
  occupations: Occupation[];
  schemes: Scheme[];
  courses: Course[];
  exams: Exam[];
  docs: Doc[];
  opportunities: Opportunity[];
  scamPatterns: ScamPattern[];
}

// The KB ships inside the app bundle so every engine works with no network.
// The hub can push newer opportunities and scam reports through sync.
export const kb: KB = {
  occupations: occupations as Occupation[],
  schemes: schemes as Scheme[],
  courses: courses as Course[],
  exams: exams as Exam[],
  docs: docsTranslated,
  opportunities: opportunities as Opportunity[],
  scamPatterns: scams.patterns as ScamPattern[],
};

export const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id);
