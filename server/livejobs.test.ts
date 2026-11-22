import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { adzuna, jooble, searchLive, clearLiveCache } from "./livejobs.ts";

// Provider parsing and merging, with the job boards stubbed out: CI has no keys
// and must never call a real API.

const place = { state: "TN", stateName: "Tamil Nadu", district: "Vellore" };
const realFetch = globalThis.fetch;
let calls: { url: string; body?: string }[] = [];

const stub = (handler: (url: string) => unknown) => {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body as string | undefined });
    const out = handler(url);
    if (out instanceof Error) throw out;
    if (typeof out === "number") return new Response("nope", { status: out });
    return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
};

const adzunaJob = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, redirect_url: `https://adzuna.example/${id}`, created: `2026-11-${10 + id}T00:00:00Z`,
  company: { display_name: "Suryodaya Solar" }, location: { display_name: "Vellore, Tamil Nadu" },
  description: "<strong>Install</strong> rooftop panels&nbsp;&amp; wiring", salary_min: 14000, salary_max: 18000, salary_is_predicted: "1", ...extra,
});

beforeEach(() => {
  calls = [];
  clearLiveCache();
  process.env.ADZUNA_APP_ID = "id";
  process.env.ADZUNA_APP_KEY = "key";
  process.env.JOOBLE_API_KEY = "jkey";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
  delete process.env.JOOBLE_API_KEY;
});

test("Adzuna listings are parsed, cleaned and searched by district in India", async () => {
  stub(() => ({ results: Array.from({ length: 6 }, (_, i) => adzunaJob(i, `Solar technician ${i}`)) }));
  const r = await searchLive(["solar technician"], place, "en", [], [adzuna]);
  assert.deepEqual(r.sources, [{ id: "adzuna", ok: true, count: 6 }]);
  const j = r.jobs.find((x) => x.title === "Solar technician 1")!;
  assert.equal(j.snippet, "Install rooftop panels & wiring");
  assert.equal(j.salaryMin, 14000);
  assert.equal(j.salaryEstimated, true);
  const u = new URL(calls[0].url);
  assert.equal(u.pathname, "/v1/api/jobs/in/search/1");
  assert.equal(u.searchParams.get("where"), "Vellore");
  assert.equal(calls.length, 1, "enough results in the district: no state-wide search");
});

test("few results in the district widens the search to the state", async () => {
  stub((url) => ({ results: new URL(url).searchParams.get("where") === "Vellore" ? [adzunaJob(1, "Electrician")] : [adzunaJob(2, "Wireman"), adzunaJob(1, "Electrician")] }));
  const r = await searchLive(["electrician"], place, "en", [], [adzuna]);
  assert.deepEqual(calls.map((c) => new URL(c.url).searchParams.get("where")), ["Vellore", "Tamil Nadu"]);
  assert.deepEqual(r.jobs.map((j) => j.title).sort(), ["Electrician", "Wireman"], "the same opening is listed once");
});

test("Jooble is a POST with the key in the path, and duplicates across boards merge", async () => {
  stub((url) =>
    url.includes("jooble")
      ? { jobs: [{ id: 9, title: "Solar technician 1", company: "Suryodaya Solar", link: "https://jooble.example/9", salary: "₹15,000", snippet: "<b>Day shift</b>" }, { id: 10, title: "Tailor", company: "Krishna Garments", link: "https://jooble.example/10", location: "Vellore" }] }
      : { results: Array.from({ length: 5 }, (_, i) => adzunaJob(i, `Solar technician ${i}`)) },
  );
  const r = await searchLive(["solar technician", "tailor"], place, "en", []);
  const j = calls.find((c) => c.url.includes("jooble"))!;
  assert.equal(j.url, "https://jooble.org/api/jkey");
  assert.deepEqual(JSON.parse(j.body!).location, "Vellore");
  assert.equal(r.jobs.filter((x) => x.title === "Solar technician 1").length, 1);
  assert.ok(r.jobs.some((x) => x.source === "jooble" && x.title === "Tailor" && x.location === "Vellore"));
  assert.ok(!r.jobs.some((x) => x.snippet?.includes("<")), "HTML is stripped from snippets");
});

test("a scam listing is flagged and sinks below honest ones", async () => {
  stub(() => ({ results: [
    adzunaJob(1, "Data entry job in Thailand", { description: "Pay registration fee Rs 50000, visa free, call +66 812345678", created: "2026-11-30T00:00:00Z" }),
    ...Array.from({ length: 5 }, (_, i) => adzunaJob(i + 2, `Fitter ${i}`)),
  ] }));
  const r = await searchLive(["fitter"], place, "en", [], [adzuna]);
  const last = r.jobs.at(-1)!;
  assert.equal(last.title, "Data entry job in Thailand");
  assert.equal(last.check.verdict, "danger");
  assert.ok(last.check.flags.length > 0);
});

test("missing keys, timeouts and refusals are reported per board, never thrown", async () => {
  delete process.env.JOOBLE_API_KEY;
  stub(() => Object.assign(new Error("slow"), { name: "TimeoutError" }));
  let r = await searchLive(["welder"], place, "en");
  assert.deepEqual(r.sources, [
    { id: "adzuna", ok: false, count: 0, error: "timeout" },
    { id: "jooble", ok: false, count: 0, error: "not_configured" },
  ]);
  stub(() => 401);
  r = await searchLive(["welder"], place, "en", [], [adzuna]);
  assert.equal(r.sources[0].error, "rejected");
  stub(() => ({ unexpected: true }));
  r = await searchLive(["welder"], place, "en", [], [adzuna]);
  assert.equal(r.sources[0].error, "bad_response");
});

test("results are cached, so a busy hub doesn't burn the API quota", async () => {
  stub(() => ({ results: Array.from({ length: 5 }, (_, i) => adzunaJob(i, `Plumber ${i}`)) }));
  await searchLive(["plumber"], place, "en", [], [adzuna]);
  await searchLive(["plumber"], place, "en", [], [adzuna]);
  assert.equal(calls.length, 1);
});
