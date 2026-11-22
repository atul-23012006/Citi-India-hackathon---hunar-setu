import type { Lang } from "../shared/types.ts";
import type { Place } from "../shared/geo.ts";
import { checkOffer, type CommunityReport, type OfferVerdict } from "../shared/engine/offerCheck.ts";

// Real-time openings from public job boards, searched by the student's district.
// Each provider is optional and switched on by its API key; with none set, the
// app still shows verified Hunar Setu listings and the local MSME clusters.
//   Adzuna:  ADZUNA_APP_ID + ADZUNA_APP_KEY  (free at developer.adzuna.com)
//   Jooble:  JOOBLE_API_KEY                  (free at in.jooble.org/api/about)
// Every listing is run through the offer checker, because a job board is
// exactly where trafficking and fee-for-job scams advertise.

export interface LiveJob {
  id: string;
  source: "adzuna" | "jooble";
  title: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string;
  salaryEstimated?: boolean;
  url: string;
  postedAt?: string;
  snippet?: string;
  contract?: string;
  check: { verdict: OfferVerdict; flags: string[] };
}

export interface SourceStatus {
  id: LiveJob["source"];
  ok: boolean;
  count: number;
  error?: "not_configured" | "timeout" | "unreachable" | "rejected" | "bad_response";
}

type Raw = Omit<LiveJob, "check">;
interface Provider {
  id: LiveJob["source"];
  configured: () => boolean;
  search: (terms: string[], where: string) => Promise<Raw[]>;
}

const TIMEOUT_MS = 8000;
const TTL_MS = 15 * 60_000;
const cache = new Map<string, { at: number; jobs: Raw[] }>();

const stripHtml = (s?: string) => s?.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);

class ProviderError extends Error {
  kind: NonNullable<SourceStatus["error"]>;
  constructor(kind: NonNullable<SourceStatus["error"]>) {
    super(kind);
    this.kind = kind;
  }
}

async function call(url: string, init: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError((err as Error).name === "TimeoutError" ? "timeout" : "unreachable");
  }
  if (!res.ok) throw new ProviderError("rejected");
  try {
    return await res.json();
  } catch {
    throw new ProviderError("bad_response");
  }
}

interface AdzunaResult {
  id: string | number; title?: string; description?: string; redirect_url?: string; created?: string;
  company?: { display_name?: string }; location?: { display_name?: string };
  salary_min?: number; salary_max?: number; salary_is_predicted?: string | number; contract_time?: string;
}

export const adzuna: Provider = {
  id: "adzuna",
  configured: () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  async search(terms, where) {
    const q = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID!, app_key: process.env.ADZUNA_APP_KEY!,
      results_per_page: "20", what_or: terms.join(" "), where, distance: "40", max_days_old: "30", sort_by: "date",
    });
    const data = (await call(`https://api.adzuna.com/v1/api/jobs/in/search/1?${q}`, { headers: { accept: "application/json" } })) as { results?: AdzunaResult[] };
    if (!Array.isArray(data?.results)) throw new ProviderError("bad_response");
    return data.results
      .filter((r) => r.title && r.redirect_url)
      .map((r) => ({
        id: `adzuna-${r.id}`, source: "adzuna" as const, title: stripHtml(r.title)!, company: r.company?.display_name, location: r.location?.display_name,
        salaryMin: num(r.salary_min), salaryMax: num(r.salary_max), salaryEstimated: String(r.salary_is_predicted) === "1",
        url: r.redirect_url!, postedAt: r.created, snippet: stripHtml(r.description)?.slice(0, 280), contract: r.contract_time,
      }));
  },
};

interface JoobleJob { id?: string | number; title?: string; location?: string; snippet?: string; salary?: string; type?: string; link?: string; company?: string; updated?: string }

export const jooble: Provider = {
  id: "jooble",
  configured: () => !!process.env.JOOBLE_API_KEY,
  async search(terms, where) {
    const data = (await call(`https://jooble.org/api/${encodeURIComponent(process.env.JOOBLE_API_KEY!)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keywords: terms.join(", "), location: where, radius: "40", page: "1" }),
    })) as { jobs?: JoobleJob[] };
    if (!Array.isArray(data?.jobs)) throw new ProviderError("bad_response");
    return data.jobs
      .filter((j) => j.title && j.link)
      .map((j) => ({
        id: `jooble-${j.id ?? j.link}`, source: "jooble" as const, title: stripHtml(j.title)!, company: j.company || undefined, location: j.location,
        salaryText: j.salary || undefined, url: j.link!, postedAt: j.updated, snippet: stripHtml(j.snippet)?.slice(0, 280), contract: j.type || undefined,
      }));
  },
};

export const PROVIDERS: Provider[] = [adzuna, jooble];

async function cached(p: Provider, terms: string[], where: string): Promise<Raw[]> {
  const key = `${p.id}|${terms.join(",").toLowerCase()}|${where.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.jobs;
  const jobs = await p.search(terms, where);
  cache.set(key, { at: Date.now(), jobs });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return jobs;
}

export function clearLiveCache() {
  cache.clear();
}

export async function searchLive(terms: string[], place: Place, lang: Lang, reports: CommunityReport[] = [], providers = PROVIDERS): Promise<{ jobs: LiveJob[]; sources: SourceStatus[] }> {
  const sources: SourceStatus[] = [];
  const all: Raw[] = [];
  await Promise.all(
    providers.map(async (p) => {
      if (!p.configured()) return sources.push({ id: p.id, ok: false, count: 0, error: "not_configured" });
      try {
        // District first; a small district often has few listings, so widen to the state.
        let jobs = place.district ? await cached(p, terms, place.district) : [];
        if (jobs.length < 5) jobs = [...jobs, ...(await cached(p, terms, place.stateName))];
        all.push(...jobs);
        sources.push({ id: p.id, ok: true, count: jobs.length });
      } catch (err) {
        sources.push({ id: p.id, ok: false, count: 0, error: err instanceof ProviderError ? err.kind : "unreachable" });
      }
    }),
  );

  // The same opening is often on both boards, and on the district and state pages.
  const seen = new Set<string>();
  const jobs = all
    .filter((j) => {
      const key = `${j.title}|${j.company ?? ""}`.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key) || seen.has(j.id)) return false;
      seen.add(key).add(j.id);
      return true;
    })
    .map((j) => {
      const r = checkOffer([j.title, j.company, j.snippet, j.salaryText].filter(Boolean).join(". "), lang, reports);
      return { ...j, check: { verdict: r.verdict, flags: r.flags.map((f) => f.explain) } };
    })
    // Risky listings stay visible (with the warning) but never on top.
    .sort((a, b) => Number(a.check.verdict === "danger") - Number(b.check.verdict === "danger") || (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));

  sources.sort((a, b) => a.id.localeCompare(b.id));
  return { jobs: jobs.slice(0, 30), sources };
}
