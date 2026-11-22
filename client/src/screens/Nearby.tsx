import { useEffect, useState } from "preact/hooks";
import type { Lang, StudentProfile } from "../../../shared/types.ts";
import { pick, rupees, t, type StringKey } from "../../../shared/i18n/strings.ts";
import { kb, translate } from "../../../shared/kb/index.ts";
import { stateName, type Place } from "../../../shared/geo.ts";
import { clustersFor, msme, rankRegional, searchTerms, type MsmeCluster, type RegionalMatch } from "../../../shared/engine/regional.ts";
import { activeProfile, enqueue, updateActive, useStore } from "../store.ts";
import { savePlaceToAccount } from "../account.ts";
import { OCC_ICON, Speak } from "../ui.tsx";
import { PlacePicker } from "./PlacePicker.tsx";

// "Near me": live openings from job boards, verified Hunar Setu listings and
// the MSME clusters that hire locally. Verified listings and clusters are
// ranked on the phone, so this screen still works with no signal.

interface LiveJob {
  id: string; source: "adzuna" | "jooble"; title: string; company?: string; location?: string;
  salaryMin?: number; salaryMax?: number; salaryText?: string; salaryEstimated?: boolean;
  url: string; postedAt?: string; snippet?: string; check: { verdict: "danger" | "caution" | "ok"; flags: string[] };
}
interface SourceStatus { id: string; ok: boolean; count: number; error?: string }
interface Regional {
  terms: string[];
  live: { jobs: LiveJob[]; sources: SourceStatus[] } | null; // null: offline, ranked on the phone
  curated: RegionalMatch[];
  clusters: (MsmeCluster & { inDistrict: boolean })[];
}

const SOURCE_NAME: Record<string, string> = { adzuna: "Adzuna", jooble: "Jooble" };
const SECTOR_ICON: Record<string, string> = {
  textiles: "🧵", engineering: "⚙️", auto: "🚗", electronics: "🔌", food: "🥫", crafts: "🏺", leather: "👞", pharma: "💊", ceramics: "🏺", marine: "🐟", printing: "🖨️", minerals: "🪨",
};
const KIND_ICON: Record<string, string> = { apprenticeship: "🛠️", internship: "🎓", job: "💼", mentor: "🧑‍🏫", training: "📚" };

const placeOf = (p: StudentProfile): Place | null => (p.state ? { state: p.state, stateName: stateName(p.state) ?? p.state, district: p.district, pincode: p.pincode } : null);
const profileBits = (p: StudentProfile) => ({ interests: p.interests, chosenOccupation: p.chosenOccupation, education: p.education, gender: p.gender, canRelocate: p.canRelocate, needsHostel: p.needsHostel });

function local(p: StudentProfile, place: Place, q: string): Regional {
  return { terms: searchTerms(p, place, q), live: null, curated: rankRegional(kb.opportunities, place, p).slice(0, 12), clusters: clustersFor(place) };
}

function salary(j: LiveJob, lang: Lang) {
  if (j.salaryText) return j.salaryText;
  if (!j.salaryMin && !j.salaryMax) return "";
  const lakh = (n: number) => (n / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 });
  const [lo, hi] = [j.salaryMin ?? j.salaryMax!, j.salaryMax ?? j.salaryMin!];
  // Job-board salaries in India are annual.
  const range = hi >= 100000 ? `₹${lakh(lo)}${hi !== lo ? `–${lakh(hi)}` : ""} lakh` : `₹${rupees(lo)}${hi !== lo ? `–${rupees(hi)}` : ""}`;
  return `${range} ${t(lang, "near.year")}${j.salaryEstimated ? ` (${t(lang, "near.estimate")})` : ""}`;
}

function posted(iso: string | undefined, lang: Lang) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  return days <= 0 ? t(lang, "near.today") : t(lang, "near.daysAgo", { n: days });
}

function LiveCard({ j, lang }: { j: LiveJob; lang: Lang }) {
  const pay = salary(j, lang);
  return (
    <article class={`card ${j.check.verdict === "danger" ? "no" : j.check.verdict === "caution" ? "wait" : ""}`}>
      <h3>{j.title}</h3>
      <div class="small">{[j.company, j.location].filter(Boolean).join(" · ")}</div>
      {pay && <div style="font-weight:800;margin-top:4px">{pay}</div>}
      {j.snippet && <p class="small muted clamp">{j.snippet}</p>}
      {j.check.verdict !== "ok" && (
        <div class="small" style={`font-weight:700;color:var(--${j.check.verdict === "danger" ? "no" : "wait"})`}>
          ⚠️ {t(lang, j.check.verdict === "danger" ? "near.scam" : "near.caution")}
          {j.check.flags[0] && <div style="font-weight:400">{j.check.flags[0]}</div>}
        </div>
      )}
      <div class="row" style="margin-top:8px;justify-content:space-between">
        <span class="small muted">🔗 {SOURCE_NAME[j.source]}{j.postedAt ? ` · ${posted(j.postedAt, lang)}` : ""}</span>
        <a class="btn ghost" href={j.url} target="_blank" rel="noopener noreferrer nofollow">{t(lang, "near.open")} ↗</a>
      </div>
    </article>
  );
}

function VerifiedCard({ m, p }: { m: RegionalMatch; p: StudentProfile }) {
  const s = useStore();
  const lang = p.lang;
  const op = m.opportunity;
  const asked = s.requests.find((r) => r.studentId === p.id && r.opportunityId === op.id)?.status ??
    (s.outbox.some((o) => o.kind === "request" && o.payload.studentId === p.id && o.payload.opportunityId === op.id) ? "requested" : null);
  return (
    <article class="card">
      <div class="card-row">
        <span class="emoji" style="font-size:28px" aria-hidden="true">{KIND_ICON[op.kind]}</span>
        <div class="grow">
          <h3>{op.title}</h3>
          <div class="small">{op.employer} · {op.district}</div>
          {op.stipendMonthly ? <div style="font-weight:800;margin-top:4px">₹{rupees(op.stipendMonthly)} / month</div> : null}
          <div>
            {m.reasons.map((r) => <span key={r} class={`chip ${r === "needs_education" ? "bad" : "good"}`}>{t(lang, `r.${r}`)}</span>)}
            {op.demo && <span class="chip">demo listing</span>}
          </div>
          {m.cluster && <div class="source">🏭 {m.cluster}</div>}
        </div>
      </div>
      <div class="row" style="margin-top:10px">
        {asked ? <span class="pill">✓ {t(lang, "path.asked")}</span> : <button class="btn" disabled={!m.eligibleNow} onClick={() => enqueue("request", { studentId: p.id, opportunityId: op.id })}>{t(lang, "path.ask")}</button>}
      </div>
    </article>
  );
}

function ClusterCard({ c, lang, onSearch }: { c: MsmeCluster & { inDistrict: boolean }; lang: Lang; onSearch: () => void }) {
  const occs = c.occupations.map((id) => kb.occupations.find((o) => o.id === id)).filter((o) => !!o);
  return (
    <article class={`card ${c.inDistrict ? "yes" : ""}`}>
      <div class="card-row">
        <span class="emoji" style="font-size:28px" aria-hidden="true">{SECTOR_ICON[c.sector] ?? "🏭"}</span>
        <div class="grow">
          <h3>{c.name}{c.inDistrict && <span class="badge">{t(lang, "near.msme.yours")}</span>}</h3>
          <div class="small muted">📍 {c.district}</div>
          <div>{occs.map((o) => <span key={o.id} class="chip">{OCC_ICON[o.id] ?? ""} {pick(lang, o.name)}</span>)}</div>
        </div>
      </div>
      <button class="btn quiet" style="margin-top:8px" onClick={onSearch}>🔎 {t(lang, "near.msme.search")}</button>
    </article>
  );
}

export function Nearby() {
  const s = useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const place = placeOf(p);
  const [picking, setPicking] = useState(!place);
  const [view, setView] = useState<"near" | "msme">("near");
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const [data, setData] = useState<Regional | null>(null);
  const [loading, setLoading] = useState(false);

  const key = `${place?.state}|${place?.district}|${q}|${s.online}|${p.chosenOccupation}|${p.interests.join(",")}`;
  useEffect(() => {
    if (!place) return;
    let live = true;
    setData(local(p, place, q)); // instant, offline-safe; the hub's answer replaces it
    if (!s.online) return;
    setLoading(true);
    fetch("/api/opportunities/regional", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ place: { state: place.state, district: place.district, pincode: place.pincode }, profile: profileBits(p), q: q || undefined, lang }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => live && setData({ terms: d.terms, live: d.live, curated: d.curated, clusters: d.msme.clusters }))
      .catch(() => {}) // keep the on-phone ranking
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [key]);

  if (view === "msme") return <MsmeIndia lang={lang} onBack={() => setView("near")} />;

  if (picking || !place) {
    return (
      <div>
        <div class="row"><h1 class="grow">📍 {t(lang, "loc.title")}</h1><Speak text={`${t(lang, "loc.title")} ${t(lang, "loc.why")}`} lang={lang} /></div>
        <PlacePicker lang={lang} initial={place ?? undefined} onPick={(pl) => {
          updateActive({ state: pl.state, district: pl.district, pincode: pl.pincode });
          savePlaceToAccount(pl);
          setPicking(false);
        }} />
        {place && <button class="btn quiet block" style="margin-top:10px" onClick={() => setPicking(false)}>{t(lang, "back")}</button>}
      </div>
    );
  }

  const where = place.district ? `${place.district}, ${place.stateName}` : place.stateName;
  const sources = data?.live?.sources ?? [];
  const allOff = sources.length > 0 && sources.every((x) => x.error === "not_configured");
  const failing = sources.filter((x) => x.error && x.error !== "not_configured");
  const stateJobs = msme.states[place.state]?.udyamJobsLakh;

  return (
    <div>
      <div class="row"><h1 class="grow">{t(lang, "near.title", { place: where })}</h1><Speak text={t(lang, "near.title", { place: where })} lang={lang} /></div>
      <button class="btn quiet" onClick={() => setPicking(true)}>📍 {t(lang, "loc.change")}</button>

      <form class="row" style="margin-top:12px;flex-wrap:nowrap" role="search" onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); }}>
        <input type="text" aria-label={t(lang, "near.search")} placeholder={t(lang, "near.search")} value={typed} style="flex:1"
          onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
        <button class="btn" type="submit">🔎</button>
      </form>
      {data && <p class="small muted" aria-live="polite">{t(lang, "near.searching", { terms: data.terms.join(", ") })}{loading ? " …" : ""}</p>}

      <h2>⚡ {t(lang, "near.live")}</h2>
      {!s.online ? (
        <p class="notice">{t(lang, "near.live.offline")}</p>
      ) : loading && !data?.live ? (
        <p class="small muted" role="status">{t(lang, "acc.wait")}</p>
      ) : allOff ? (
        <p class="notice">{t(lang, "near.live.off")}</p>
      ) : (
        <>
          {failing.map((x) => <p key={x.id} class="notice">{t(lang, "near.live.err", { source: SOURCE_NAME[x.id] ?? x.id })}</p>)}
          {data?.live && data.live.jobs.length === 0 && !failing.length && <p class="notice">{t(lang, "near.live.none")}</p>}
          {data?.live?.jobs.map((j) => <LiveCard key={j.id} j={j} lang={lang} />)}
        </>
      )}

      <h2>✅ {t(lang, "near.verified")}</h2>
      {data && data.curated.length === 0 && <p class="notice">{t(lang, "near.verified.none")}</p>}
      {data?.curated.map((m) => <VerifiedCard key={m.opportunity.id} m={m} p={p} />)}

      <h2>🏭 {t(lang, "near.msme", { state: place.stateName })}</h2>
      {stateJobs && <p class="small">{t(lang, "near.msme.jobs", { n: stateJobs })}</p>}
      {data && data.clusters.length === 0 && <p class="notice">{t(lang, "near.msme.none")}</p>}
      {data?.clusters.map((c) => (
        <ClusterCard key={c.name} c={c} lang={lang} onSearch={() => { const term = c.searchTerms[0]; setTyped(term); setQ(term); window.scrollTo(0, 0); }} />
      ))}
      <button class="btn ghost block" style="margin-top:12px" onClick={() => { setView("msme"); window.scrollTo(0, 0); }}>📊 {t(lang, "near.msme.explore")}</button>
    </div>
  );
}

// ---------- India's MSME sector, explained ----------

function Bars({ rows, max, unit }: { rows: { label: string; value: number }[]; max: number; unit: string }) {
  return (
    <div class="bars" role="list">
      {rows.map((r) => (
        <div class="bar-row" role="listitem" key={r.label}>
          <span class="bar-label">{r.label}</span>
          <span class="bar-track"><span class="bar-fill" style={`width:${(r.value / max) * 100}%`} /></span>
          <span class="bar-value">{r.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

export function MsmeIndia({ lang, onBack }: { lang: Lang; onBack: () => void }) {
  const n = msme.national;
  const tr = (en: string) => pick(lang, translate(en));
  const jobsMax = Math.max(...n.udyamJobsCrore.map((x) => x.value));
  const sec = n.udyamJobsBySectorCrore;
  return (
    <div>
      <button class="btn quiet" onClick={onBack}>← {t(lang, "back")}</button>
      <div class="row"><h1 class="grow">📊 {t(lang, "msme.title")}</h1><Speak text={`${t(lang, "msme.title")}. ${t(lang, "msme.intro")}`} lang={lang} /></div>
      <p>{t(lang, "msme.intro")}</p>

      <div class="stats">
        <div class="stat"><span class="num">{n.gdpSharePct}%</span><span>{t(lang, "msme.gdp")}</span></div>
        <div class="stat"><span class="num">{n.exportSharePct}%</span><span>{t(lang, "msme.exports")}</span></div>
        <div class="stat"><span class="num">{n.manufacturingSharePct}%</span><span>{t(lang, "msme.mfg")}</span></div>
        <div class="stat"><span class="num">{n.employmentCrore}</span><span>{t(lang, "msme.jobs")}</span></div>
        <div class="stat"><span class="num">{n.registrationsCrore}</span><span>{t(lang, "msme.reg")}</span></div>
      </div>

      <h2>{t(lang, "msme.growth")}</h2>
      <Bars rows={n.udyamJobsCrore.map((x) => ({ label: x.year.replace("FY ", ""), value: x.value }))} max={jobsMax} unit="" />

      <h2>{t(lang, "msme.sectors")}</h2>
      <Bars max={Math.max(sec.trading, sec.services, sec.manufacturing)} unit="" rows={[
        { label: t(lang, "msme.trading"), value: sec.trading },
        { label: t(lang, "msme.services"), value: sec.services },
        { label: t(lang, "msme.manufacturing"), value: sec.manufacturing },
      ]} />

      <h2>🚀 {t(lang, "msme.start")}</h2>
      {msme.supports.map((x) => (
        <article class="card" key={x.id}>
          <h3>{x.name}</h3>
          <div class="small muted">{tr(x.forWhom)}</div>
          <p class="small" style="margin:6px 0">{tr(x.what)}</p>
          {x.numbers && <div class="source">📈 {tr(x.numbers)}</div>}
          <a class="small" href={x.url} target="_blank" rel="noopener noreferrer">{x.url.replace(/^https?:\/\/(www\.)?/, "")} ↗</a>
        </article>
      ))}

      <h2>{t(lang, "msme.size")}</h2>
      <table class="tbl">
        <thead><tr><th /><th>{t(lang, "msme.investment")}</th><th>{t(lang, "msme.turnover")}</th></tr></thead>
        <tbody>
          {msme.classification.rows.map((r) => (
            <tr key={r.size}>
              <th scope="row">{t(lang, `msme.${r.size}` as StringKey)}</th>
              <td>{t(lang, "msme.crore", { n: r.investmentCrore })}</td>
              <td>{t(lang, "msme.crore", { n: r.turnoverCrore })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{t(lang, "msme.challenges")}</h2>
      <ul class="small">{msme.challenges.map((c) => <li key={c}>{tr(c)}</li>)}</ul>
      <p class="small muted">{tr(n.notes)}</p>

      <h2>{t(lang, "msme.sources")}</h2>
      <ul class="source">
        {[...n.sources, msme.classification.source, msme.clusterSource].map((src) => (
          <li key={src.name}><a href={src.url} target="_blank" rel="noopener noreferrer">{src.name}</a> ({src.asOf})</li>
        ))}
      </ul>
    </div>
  );
}
