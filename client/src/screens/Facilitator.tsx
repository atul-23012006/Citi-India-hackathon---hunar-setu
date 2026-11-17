import { useEffect, useState } from "preact/hooks";
import type { Lang } from "../../../shared/types.ts";
import { LANGS, rupees } from "../../../shared/i18n/strings.ts";
import { kb } from "../../../shared/kb/index.ts";
import { getState, setState, useStore } from "../store.ts";
import { syncNow } from "../sync.ts";

// Facilitator mode: one teacher, many students. Spot talent from demonstrated
// tasks (not self-report), see who is one document away from money, endorse
// students into openings, and author paid or free micro-modules.

interface CohortStudent {
  id: string; name: string; age?: number; gender?: string; education?: string; district?: string; updatedAt: string;
  topCareers: { id: string; name: string; wider: boolean }[];
  eligible: string[]; nearMiss: { scheme: string; missing: string[] }[]; claimableRupees: number;
  talents: { task: string; score: number }[]; talentSignal: boolean;
  requests: { opportunityId: string; status: string }[]; credentials: number;
}

interface ModuleView {
  id: string; title: string; lang: string; occupationId?: string; lessons: { title: string; text: string }[];
  pricing: { model: "free" | "per_module" | "subscription"; rupees: number }; learnersCount: number; completionsCount: number; earningsRupees: number;
  pending: { studentId: string; name: string }[];
}

type Funnel = { requested: number; endorsed: number; joined: number; joinRate: number };
interface ImpactView {
  reach: { students: number; byGender: Record<string, number>; districts: number; facilitators: number };
  verifiedOutcomes: { total: number; byGender: Record<string, number> };
  rupees: { claimablePerYear: number; studentsWithMoney: number; studentsOneDocAway: number; dbtSeedingGaps: number };
  aspiration: { widenIndex: number; widenIndexGirls: number; chosenOutsideCommonFour: number; studentsWhoChose: number };
  scams: { fingerprints: number; reports: number; districtsWarned: number; seenInMoreThanOneDistrict: number };
  offerToJoining: Record<"all" | "female" | "male", Funnel>;
  facilitators: { total: number; earning: number; moduleEarningsRupees: number; learners: number; completionsCertified: number };
  credentials: { total: number; skillDemonstrations: number };
  sync: { opsApplied: number };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${getState().facilitatorToken}`, ...(init.headers ?? {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [district, setDistrict] = useState("Vellore");
  const [state, setStateCode] = useState("TN");
  const [err, setErr] = useState("");
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr("");
    try {
      const body = mode === "login" ? { name, pin } : { name, pin, district, state };
      const res = await fetch(`/api/facilitator/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setState({ facilitatorToken: data.token, facilitatorName: data.name });
    } catch (e) {
      setErr(navigator.onLine ? (e as Error).message : "Connect to the hub (hotspot) to sign in.");
    }
  };
  return (
    <form onSubmit={submit}>
      <h1>🧑‍🏫 Facilitator</h1>
      <div class="options">
        <button type="button" class="opt" aria-pressed={mode === "login" ? "true" : "false"} onClick={() => setMode("login")}>Sign in</button>
        <button type="button" class="opt" aria-pressed={mode === "register" ? "true" : "false"} onClick={() => setMode("register")}>New facilitator</button>
      </div>
      <label class="field"><span>Name</span><input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
      <label class="field"><span>PIN (4-6 digits)</span><input type="password" inputMode="numeric" value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value)} /></label>
      {mode === "register" && (
        <div class="row">
          <label class="field grow"><span>District</span><input type="text" value={district} onInput={(e) => setDistrict((e.target as HTMLInputElement).value)} /></label>
          <label class="field" style="width:90px"><span>State</span><input type="text" maxLength={2} value={state} onInput={(e) => setStateCode((e.target as HTMLInputElement).value.toUpperCase())} /></label>
        </div>
      )}
      {err && <p style="color:var(--no)">{err}</p>}
      <button class="btn block" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
    </form>
  );
}

function Cohort() {
  const [list, setList] = useState<CohortStudent[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = () => api<CohortStudent[]>("/api/facilitator/cohort").then(setList).catch((e) => setErr(e.message));
  useEffect(() => { syncNow().finally(load); }, []);

  const endorse = async (studentId: string, opportunityId?: string) => {
    setBusy(studentId + (opportunityId ?? ""));
    try {
      await api("/api/facilitator/endorse", { method: "POST", body: JSON.stringify({ studentId, opportunityId, note: "Demonstrated skills in cohort session" }) });
      await load();
    } finally {
      setBusy("");
    }
  };

  if (err) return <p style="color:var(--no)">{err}</p>;
  if (!list) return <p class="muted">Loading cohort…</p>;
  const talent = list.filter((s) => s.talentSignal).length;
  const money = list.reduce((sum, s) => sum + s.claimableRupees, 0);
  const oneDocAway = list.filter((s) => s.nearMiss.length > 0).length;

  return (
    <div>
      <div class="hero">
        <div class="row" style="justify-content:space-between">
          <div><div class="num">{list.length}</div><div class="small">students</div></div>
          <div><div class="num">{talent}</div><div class="small">⭐ talent shown</div></div>
          <div><div class="num">{money >= 100000 ? `₹${(money / 100000).toFixed(1)}L` : `₹${rupees(money)}`}</div><div class="small">eligible now / yr</div></div>
        </div>
        <div class="small" style="margin-top:6px">{oneDocAway} students are one document away from scheme money.</div>
      </div>
      {list.length === 0 && <p class="muted">No students synced yet. Use “Add a student on this phone”, or let students' phones sync over your hotspot.</p>}
      {list
        .sort((a, b) => Number(b.talentSignal) - Number(a.talentSignal) || b.requests.length - a.requests.length)
        .map((s) => (
          <div class="card" key={s.id}>
            <div class="card-row">
              <span class="avatar" style="display:grid;place-items:center;flex:none">{s.name.slice(0, 1).toUpperCase()}</span>
              <div class="grow">
                <h3>{s.name} {s.talentSignal && <span class="badge">⭐ talent</span>}</h3>
                <div class="small muted">{[s.age && `${s.age}y`, s.gender, s.education, s.district].filter(Boolean).join(" · ")}</div>
                <div class="small" style="margin-top:4px">{s.topCareers.map((c) => `${c.name}${c.wider ? " ✦" : ""}`).join(" · ")}</div>
                {s.talents.map((tk) => <span class="chip good" key={tk.task}>{tk.task} {Math.round(tk.score * 100)}%</span>)}
                {s.eligible.length > 0 && <div class="small" style="margin-top:4px">✅ {s.eligible.length} schemes{s.claimableRupees > 0 ? ` · ₹${rupees(s.claimableRupees)}/yr` : ""}</div>}
                {s.nearMiss.slice(0, 2).map((n) => <div class="small" key={n.scheme}>🟡 {n.scheme}: needs {n.missing.join(", ").replace(/_/g, " ")}</div>)}
                {s.requests.map((r) => {
                  const opp = kb.opportunities.find((o) => o.id === r.opportunityId);
                  return (
                    <div class="row small" key={r.opportunityId} style="margin-top:6px">
                      <span class="grow">🙋 {opp?.title ?? r.opportunityId} — <strong>{r.status}</strong></span>
                      {r.status === "requested" && <button class="btn" style="min-height:40px" disabled={!!busy} onClick={() => endorse(s.id, r.opportunityId)}>Endorse</button>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div class="row" style="margin-top:8px">
              <button class="btn quiet" disabled={!!busy} onClick={() => endorse(s.id)}>⭐ Endorse skills</button>
              <span class="small muted">{s.credentials} credentials</span>
            </div>
          </div>
        ))}
    </div>
  );
}

function Modules() {
  const [list, setList] = useState<ModuleView[]>([]);
  const [title, setTitle] = useState("");
  const [occ, setOcc] = useState("electrician");
  const [lang, setLang] = useState<Lang>(getState().uiLang);
  const [lessons, setLessons] = useState("");
  const [model, setModel] = useState<"free" | "per_module" | "subscription">("per_module");
  const [price, setPrice] = useState(49);
  const [msg, setMsg] = useState("");
  const load = () => api<ModuleView[]>("/api/facilitator/modules").then(setList).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async (e: Event) => {
    e.preventDefault();
    const parsed = lessons.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
      const [first, ...rest] = block.split("\n");
      return { title: first.slice(0, 120), text: rest.join("\n") || first };
    });
    try {
      await api("/api/facilitator/modules", { method: "POST", body: JSON.stringify({ title, occupationId: occ, lang, lessons: parsed, pricing: { model, rupees: model === "free" ? 0 : price } }) });
      setTitle(""); setLessons(""); setMsg("Module published to students on this hub.");
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const certify = async (moduleId: string, studentId: string) => {
    try {
      await api(`/api/facilitator/modules/${moduleId}/certify`, { method: "POST", body: JSON.stringify({ studentId }) });
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const total = list.reduce((s, m) => s + m.earningsRupees, 0);
  return (
    <div>
      <div class="hero"><div class="small">Your earnings from modules</div><div class="num">₹{rupees(total)}</div><div class="small">{list.reduce((s, m) => s + m.learnersCount, 0)} learners · {list.length} modules</div></div>
      {list.map((m) => (
        <div class="card" key={m.id}>
          <h3>📘 {m.title}</h3>
          <div class="small muted">{m.lessons.length} lessons · {LANGS.find((l) => l.code === m.lang)?.label} · {m.pricing.model === "free" ? "Free" : `₹${m.pricing.rupees} ${m.pricing.model === "subscription" ? "/ month" : "per module"}`}</div>
          <div class="small">{m.learnersCount} learners · {m.completionsCount} completed · ₹{rupees(m.earningsRupees)}</div>
          {m.pending.map((x) => (
            <div class="row small" key={x.studentId} style="margin-top:6px">
              <span class="grow">✅ {x.name} finished</span>
              <button class="btn" style="min-height:40px" onClick={() => certify(m.id, x.studentId)}>🎖️ Certify</button>
            </div>
          ))}
        </div>
      ))}
      <h2>New module</h2>
      <form onSubmit={create}>
        <label class="field"><span>Title</span><input type="text" required minLength={3} value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="Safe house wiring basics" /></label>
        <label class="field"><span>For which route?</span>
          <select value={occ} onChange={(e) => setOcc((e.target as HTMLSelectElement).value)}>{kb.occupations.map((o) => <option key={o.id} value={o.id}>{o.name.en}</option>)}</select>
        </label>
        <label class="field"><span>Language</span>
          <select value={lang} onChange={(e) => setLang((e.target as HTMLSelectElement).value as Lang)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        </label>
        <label class="field"><span>Lessons (first line = lesson title, blank line between lessons)</span><textarea required value={lessons} onInput={(e) => setLessons((e.target as HTMLTextAreaElement).value)} /></label>
        <div class="options" style="grid-template-columns:repeat(3,1fr)">
          {(["free", "per_module", "subscription"] as const).map((m) => (
            <button type="button" class="opt" key={m} aria-pressed={model === m ? "true" : "false"} onClick={() => setModel(m)}>{m === "free" ? "Free" : m === "per_module" ? "Pay per module" : "Subscription"}</button>
          ))}
        </div>
        {model !== "free" && <label class="field"><span>Price (₹{model === "subscription" ? " / month" : ""})</span><input type="number" min={1} max={5000} value={price} onInput={(e) => setPrice(Number((e.target as HTMLInputElement).value))} /></label>}
        <button class="btn block" type="submit">Publish</button>
        {msg && <p class="pill" style="margin-top:8px">{msg}</p>}
      </form>
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Stat({ n, label }: { n: string | number; label: string }) {
  return <div><div class="num">{n}</div><div class="small">{label}</div></div>;
}

// The six key metrics from our canvas, live from this hub. A funder or a state
// partner sees the same numbers through GET /api/facilitator/impact.
function Impact() {
  const [r, setR] = useState<ImpactView | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { syncNow().finally(() => api<ImpactView>("/api/facilitator/impact").then(setR).catch((e) => setErr(e.message))); }, []);
  if (err) return <p style="color:var(--no)">{err}</p>;
  if (!r) return <p class="muted">Loading impact…</p>;
  const f = r.offerToJoining;
  return (
    <div>
      <div class="hero">
        <div class="small" style="font-weight:700">⭐ Verified livelihood outcomes (proof of first pay)</div>
        <div class="row" style="justify-content:space-between;margin-top:6px">
          <Stat n={r.verifiedOutcomes.total} label="total" />
          <Stat n={r.verifiedOutcomes.byGender.female ?? 0} label="girls" />
          <Stat n={r.reach.students} label="students" />
          <Stat n={r.reach.districts} label="districts" />
        </div>
      </div>
      <div class="card">
        <h3>💰 Rupees for students</h3>
        <div class="small">₹{rupees(r.rupees.claimablePerYear)} / yr claimable now, for {r.rupees.studentsWithMoney} students</div>
        <div class="small">{r.rupees.studentsOneDocAway} students one document away · {r.rupees.dbtSeedingGaps} need DBT seeding before money can land</div>
      </div>
      <div class="card">
        <h3>🧭 Aspiration widening</h3>
        <div class="small">{r.aspiration.widenIndex} distinct routes per 100 students (girls: {r.aspiration.widenIndexGirls})</div>
        <div class="small">{pct(r.aspiration.chosenOutsideCommonFour)} chose a route beyond army, police, teacher, doctor ({r.aspiration.studentsWhoChose} chose)</div>
      </div>
      <div class="card">
        <h3>🛡️ Scams intercepted</h3>
        <div class="small">{r.scams.reports} reports · {r.scams.fingerprints} numbers/links flagged · {r.scams.districtsWarned} districts · {r.scams.seenInMoreThanOneDistrict} seen in 2+ districts</div>
      </div>
      <div class="card">
        <h3>🚪 Offer to joining</h3>
        {(["all", "female", "male"] as const).map((g) => (
          <div class="small" key={g}>{g === "all" ? "All" : g === "female" ? "Girls" : "Boys"}: {f[g].requested} asked → {f[g].endorsed} endorsed → {f[g].joined} joined ({pct(f[g].joinRate)})</div>
        ))}
      </div>
      <div class="card">
        <h3>🧑‍🏫 Facilitators and proof</h3>
        <div class="small">{r.facilitators.earning} of {r.facilitators.total} facilitators earning · ₹{rupees(r.facilitators.moduleEarningsRupees)} from {r.facilitators.learners} learners · {r.facilitators.completionsCertified} certified</div>
        <div class="small">{r.credentials.total} credentials issued ({r.credentials.skillDemonstrations} from demonstrated skills) · {r.sync.opsApplied} offline changes synced</div>
      </div>
      <p class="source">Aggregates only. No names leave this screen.</p>
    </div>
  );
}

export function Facilitator({ onAddStudent, onExit }: { onAddStudent: () => void; onExit: () => void }) {
  const s = useStore();
  const [tab, setTab] = useState<"cohort" | "modules" | "impact">("cohort");
  if (!s.facilitatorToken) return <main><Login /><button class="btn quiet block" style="margin-top:12px" onClick={onExit}>Back</button></main>;
  return (
    <main>
      <div class="row"><h1 class="grow">🧑‍🏫 {s.facilitatorName}</h1><button class="btn quiet" onClick={() => setState({ facilitatorToken: null, facilitatorName: null })}>Sign out</button></div>
      <div class="options" style="grid-template-columns:repeat(3,1fr)">
        <button class="opt" aria-pressed={tab === "cohort" ? "true" : "false"} onClick={() => setTab("cohort")}>👥 Cohort</button>
        <button class="opt" aria-pressed={tab === "modules" ? "true" : "false"} onClick={() => setTab("modules")}>📘 Modules</button>
        <button class="opt" aria-pressed={tab === "impact" ? "true" : "false"} onClick={() => setTab("impact")}>📊 Impact</button>
      </div>
      <button class="btn ghost block" onClick={onAddStudent}>➕ Add a student on this phone (assisted session)</button>
      {tab === "cohort" ? <Cohort /> : tab === "modules" ? <Modules /> : <Impact />}
      <button class="btn quiet block" style="margin-top:16px" onClick={onExit}>Back to students</button>
    </main>
  );
}
