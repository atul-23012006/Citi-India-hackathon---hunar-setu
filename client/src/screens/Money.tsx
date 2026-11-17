import { useState } from "preact/hooks";
import type { Category, DocKey } from "../../../shared/types.ts";
import { pick, rupees, t } from "../../../shared/i18n/strings.ts";
import { kb } from "../../../shared/kb/index.ts";
import { alternativesFor, checkAll, claimableRupees, type EligibilityResult } from "../../../shared/engine/eligibility.ts";
import { needsDbtCheck, paperworkPlan } from "../../../shared/engine/paperwork.ts";
import { activeProfile, updateActive } from "../store.ts";
import { Option, Speak } from "../ui.tsx";

const INCOME_BANDS = [
  { key: "inc.1", value: 75000 }, { key: "inc.2", value: 175000 }, { key: "inc.3", value: 350000 }, { key: "inc.4", value: 600000 }, { key: "inc.5", value: 1000000 },
] as const;
const CATEGORIES: Category[] = ["GEN", "EWS", "OBC", "SC", "ST"];

export function Money() {
  const p = activeProfile()!;
  const lang = p.lang;
  const [editing, setEditing] = useState(p.familyIncome == null || p.category == null);
  const results = checkAll(p, lang);
  const groups = {
    eligible: results.filter((r) => r.verdict === "eligible"),
    near: results.filter((r) => r.verdict === "near_miss"),
    unknown: results.filter((r) => r.verdict === "unknown"),
    no: results.filter((r) => r.verdict === "not_eligible"),
  };
  const plan = paperworkPlan(results);
  const total = claimableRupees(results);
  const toggleDoc = (k: DocKey) => updateActive({ docs: { ...p.docs, [k]: !p.docs[k] } });

  if (editing) {
    return (
      <div>
        <h1>{t(lang, "tab.money")}</h1>
        <p class="small muted">We ask this only to check schemes. It stays on this phone and your facilitator's hub.</p>

        <div class="row"><h2 class="grow">{t(lang, "q.category")}</h2><Speak text={t(lang, "q.category")} lang={lang} /></div>
        <div class="options" style="grid-template-columns:repeat(3,1fr)">
          {CATEGORIES.map((c) => <Option key={c} pressed={p.category === c} onClick={() => updateActive({ category: c })}>{c}</Option>)}
        </div>
        <label class="check"><input type="checkbox" checked={!!p.minority} onChange={() => updateActive({ minority: !p.minority })} />Minority community</label>

        <div class="row"><h2 class="grow">{t(lang, "q.income")}</h2><Speak text={t(lang, "q.income")} lang={lang} /></div>
        <div class="options">
          {INCOME_BANDS.map((b) => <Option key={b.key} pressed={p.familyIncome === b.value} onClick={() => updateActive({ familyIncome: b.value })}>{t(lang, b.key)}</Option>)}
        </div>

        <div class="row"><h2 class="grow">{t(lang, "q.marks")}</h2><Speak text={t(lang, "q.marks")} lang={lang} /></div>
        <input type="number" inputMode="numeric" min={0} max={100} value={p.marksPercent ?? ""} onInput={(e) => { const v = Number((e.target as HTMLInputElement).value); updateActive({ marksPercent: Number.isFinite(v) && v > 0 ? Math.min(v, 100) : undefined }); }} />

        <div class="row"><h2 class="grow">{t(lang, "q.docs")}</h2><Speak text={t(lang, "q.docs")} lang={lang} /></div>
        {kb.docs.map((d) => (
          <label class="check" key={d.key}><input type="checkbox" checked={!!p.docs[d.key]} onChange={() => toggleDoc(d.key)} />{pick(lang, d.name)}</label>
        ))}
        <button class="btn block" style="margin-top:12px" onClick={() => setEditing(false)}>{t(lang, "next")}</button>
      </div>
    );
  }

  const spoken = `${t(lang, "money.total", { v: rupees(total) })}. ${groups.eligible.map((r) => r.schemeName).join(", ")}`;

  return (
    <div>
      <div class="row"><h1 class="grow">{t(lang, "tab.money")}</h1><Speak text={spoken} lang={lang} /></div>
      <div class="hero">
        <div class="num">₹{rupees(total)}</div>
        <div>{t(lang, "money.total", { v: rupees(total) })}</div>
        <div class="small" style="opacity:.85;margin-top:4px">{groups.eligible.length} ✅ · {groups.near.length} 🟡 · {groups.unknown.length} ❔</div>
      </div>

      {needsDbtCheck(results, p.docs.aadhaar_seeded) && (
        <div class="card wait card-row">
          <span class="emoji">🏦</span>
          <div class="grow"><strong>{t(lang, "money.dbt")}</strong><div class="source">CAG found 2,41,870 of 3,12,823 post-matric scholarship accounts in one state not Aadhaar-seeded.</div></div>
          <Speak text={t(lang, "money.dbt")} lang={lang} />
        </div>
      )}

      {groups.eligible.length > 0 && <h2>✅ {t(lang, "money.yes")}</h2>}
      {groups.eligible.map((r) => <SchemeCard key={r.schemeId} r={r} />)}

      {plan.length > 0 && (
        <>
          <h2>📋 {t(lang, "money.autopilot")}</h2>
          <ol class="steps">
            {plan.map((task) => (
              <li key={task.doc.key}>
                <strong>{pick(lang, task.doc.name)}</strong>
                <div class="small">{t(lang, "money.startnow", { d: task.doc.typicalDays })} · {task.doc.issuer}</div>
                <div class="small muted">{pick(lang, task.doc.howTo)}</div>
                {task.fromDigiLocker && <span class="chip good">DigiLocker: {t(lang, "money.digilocker")}</span>}
                <div class="small" style="margin-top:4px">→ {task.unlocks.join(", ")}</div>
                <button class="btn quiet" style="margin-top:6px" onClick={() => updateActive({ docs: { ...p.docs, [task.doc.key]: true } })}>✓ Got it</button>
              </li>
            ))}
          </ol>
        </>
      )}

      {groups.near.length > 0 && <h2>🟡 {t(lang, "money.notyet")}</h2>}
      {groups.near.map((r) => <SchemeCard key={r.schemeId} r={r} />)}

      {groups.unknown.length > 0 && <h2>❔ {t(lang, "money.unknown")}</h2>}
      {groups.unknown.map((r) => <SchemeCard key={r.schemeId} r={r} />)}

      {groups.no.length > 0 && (
        <details style="margin-top:16px">
          <summary class="muted">{t(lang, "money.no")} ({groups.no.length})</summary>
          {groups.no.map((r) => <SchemeCard key={r.schemeId} r={r} alts={alternativesFor(r, results)} />)}
        </details>
      )}

      <button class="btn quiet block" style="margin-top:16px" onClick={() => setEditing(true)}>✏️ {t(lang, "q.docs")}</button>
      <p class="source">Rules are data (shared/kb/schemes.json): a state can correct one without an app release. Always confirm on the official portal before applying.</p>
    </div>
  );
}

function SchemeCard({ r, alts }: { r: EligibilityResult; alts?: EligibilityResult[] }) {
  const lang = activeProfile()!.lang;
  const tone = r.verdict === "eligible" ? "yes" : r.verdict === "near_miss" ? "wait" : r.verdict === "not_eligible" ? "no" : "";
  const blocking = r.results.filter((c) => c.pass !== true);
  const spoken = `${r.schemeName}. ${r.benefit}. ${blocking.map((c) => c.reason).join(". ")}`;
  return (
    <div class={`card ${tone}`}>
      <div class="card-row">
        <div class="grow">
          <h3>{r.schemeName}</h3>
          <div class="small">{r.benefit}</div>
          {blocking.map((c, i) => (
            <div key={i} class="small" style="margin-top:4px">{c.pass === null ? "❔" : c.fixable ? "📄" : "✋"} {c.reason}</div>
          ))}
          {alts && alts.length > 0 && (
            <div class="small" style="margin-top:6px"><strong>{t(lang, "money.alsofits")}</strong> {alts.map((a) => a.schemeName).join(", ")}</div>
          )}
          {r.notes && <div class="source">{r.notes}</div>}
          <div class="source">
            {t(lang, "path.source")}: {r.source.url ? <a href={r.source.url} target="_blank" rel="noopener">{r.source.name}</a> : r.source.name} · {r.source.asOf}
            {r.verdict !== "not_eligible" && <> · <a href={r.applyAt} target="_blank" rel="noopener">Apply ↗</a></>}
          </div>
        </div>
        <Speak text={spoken} lang={lang} />
      </div>
    </div>
  );
}
