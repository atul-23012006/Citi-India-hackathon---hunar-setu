import { useState } from "preact/hooks";
import type { Lang } from "../../../shared/types.ts";
import { pick, rupees, t } from "../../../shared/i18n/strings.ts";
import { kb } from "../../../shared/kb/index.ts";
import { matchOpportunities } from "../../../shared/engine/careers.ts";
import { trueCost, type CostAssumptions, type TrueCost } from "../../../shared/engine/trueCost.ts";
import { activeProfile, useStore } from "../store.ts";
import { Speak } from "../ui.tsx";
import { speak } from "../voice.ts";

function parentScript(lang: Lang, title: string, employer: string, c: TrueCost): string {
  const parts = [
    `${title}, ${employer}.`,
    `${t(lang, "family.stipend")}: ₹${rupees(c.stipend)}.`,
    `${t(lang, "family.net")}: ₹${rupees(c.net)}.`,
    c.safety.hostel ? t(lang, "family.hostel") + "." : "",
    c.safety.womenStaffed ? t(lang, "family.women") + "." : "",
    c.safety.epf ? t(lang, "family.epf") + "." : "",
    c.safety.goingTogether > 0 ? t(lang, "family.together", { n: c.safety.goingTogether }) + "." : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function Family({ oppId, setOppId }: { oppId: string | null; setOppId: (id: string) => void }) {
  const s = useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const [over, setOver] = useState<Partial<CostAssumptions>>({});
  const options = matchOpportunities(p, p.chosenOccupation).filter((m) => m.opportunity.kind !== "mentor");
  const opp = kb.opportunities.find((o) => o.id === oppId) ?? options[0]?.opportunity;

  if (!opp) return <div><h1>{t(lang, "family.title")}</h1><p>{t(lang, "path.pick")}</p></div>;

  const c = trueCost(opp, p, Math.max(0, (s.requestCounts[opp.id] ?? 0) - 1), over);
  const field = (k: keyof CostAssumptions, label: string) => (
    <div class="money-line">
      <span>{label}</span>
      <span>− ₹<input type="number" inputMode="numeric" value={c.costs[k]} onInput={(e) => setOver({ ...over, [k]: Number((e.target as HTMLInputElement).value) || 0 })} /></span>
    </div>
  );
  const script = parentScript(lang, opp.title, opp.employer, c);

  return (
    <div>
      <h1>👪 {t(lang, "family.title")}</h1>
      <label class="field">
        <span>{t(lang, "family.pick")}</span>
        <select value={opp.id} onChange={(e) => { setOver({}); setOppId((e.target as HTMLSelectElement).value); }}>
          {options.map((m) => <option key={m.opportunity.id} value={m.opportunity.id}>{m.opportunity.title} · {m.opportunity.district}</option>)}
        </select>
      </label>

      <div class="hero" style={c.net < 0 ? "background:var(--no);color:#fff" : ""}>
        <div class="small" style="opacity:.85">{t(lang, "family.net")}</div>
        <div class="num">{c.net < 0 ? "−" : ""}₹{rupees(Math.abs(c.net))}</div>
        <div class="small">{opp.employer} · {opp.district}{opp.distanceKmFromHub ? ` · ${opp.distanceKmFromHub} km` : ""}</div>
      </div>
      <button class="btn block" onClick={() => speak(script, lang)}>🔊 {t(lang, "family.explain")}</button>

      <div class="card">
        <div class="money-line"><strong>{t(lang, "family.stipend")}</strong><strong>₹{rupees(c.stipend)}</strong></div>
        {c.govtSupport.map((g) => (
          <div class="money-line small" key={g.label}><span>↳ {g.label}</span><span>{g.includedInStipend ? `(₹${rupees(g.monthly)})` : `+ ₹${rupees(g.monthly)}`}</span></div>
        ))}
        {c.livesAtHome ? field("dailyCommute", "🚌 Daily bus") : (
          <>
            {field("rent", `🏠 ${t(lang, "family.rent")}`)}
            {field("food", `🍲 ${t(lang, "family.food")}`)}
            {field("travelHome", `🚌 ${t(lang, "family.travel")}`)}
          </>
        )}
        <p class="source">Costs are editable estimates (bus ₹1.2/km; hostel or room rates for the district). Change them to what your family knows.</p>
      </div>

      <h2>{t(lang, "family.safety")} <span class="stars" aria-label={`${c.safetyScore} of 5`}>{"★".repeat(c.safetyScore)}{"☆".repeat(5 - c.safetyScore)}</span></h2>
      <div class="card">
        {[
          [c.safety.verified, "✓ Employer verified on the network"],
          [c.safety.epf, t(lang, "family.epf")],
          [c.safety.hostel || c.livesAtHome, c.livesAtHome ? "Lives at home (daily commute)" : t(lang, "family.hostel")],
          [c.safety.womenStaffed, t(lang, "family.women")],
          [c.safety.goingTogether > 0, t(lang, "family.together", { n: c.safety.goingTogether })],
        ].map(([ok, label]) => (
          <div class="money-line" key={String(label)}><span>{label}</span><span>{ok ? "✅" : "—"}</span></div>
        ))}
      </div>
      <div class="row"><p class="grow small muted">{script}</p><Speak text={script} lang={lang} /></div>
      {p.chosenOccupation && <p class="source">{pick(lang, kb.occupations.find((o) => o.id === p.chosenOccupation)!.name)} · demo listing</p>}
    </div>
  );
}
