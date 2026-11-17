import type { Opportunity } from "../../../shared/types.ts";
import { pick, rupees, t } from "../../../shared/i18n/strings.ts";
import { buildPathway } from "../../../shared/engine/careers.ts";
import { activeProfile, enqueue, useStore } from "../store.ts";
import { OCC_ICON, Speak } from "../ui.tsx";
import { Learn } from "./Learn.tsx";

const KIND_ICON: Record<Opportunity["kind"], string> = { apprenticeship: "🛠️", internship: "💼", job: "🏢", mentor: "🤝", training: "🎯" };

export function Path({ goDiscover, goMoney, goFamily }: { goDiscover: () => void; goMoney: () => void; goFamily: (oppId: string) => void }) {
  const s = useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const path = p.chosenOccupation ? buildPathway(p, p.chosenOccupation, lang) : null;

  if (!path) {
    return (
      <div>
        <h1>{t(lang, "tab.path")}</h1>
        <p>{t(lang, "path.pick")}</p>
        <button class="btn block" onClick={goDiscover}>🧭 {t(lang, "tab.discover")}</button>
      </div>
    );
  }

  const o = path.occupation;
  const spoken = `${t(lang, "path.title")} ${pick(lang, o.name)}. ${t(lang, "path.thisweek")}: ${path.thisWeek}. ${path.steps.map((st, i) => `${i + 1}. ${st.label}`).join(". ")}`;
  const statusOf = (id: string) => s.requests.find((r) => r.opportunityId === id && r.studentId === p.id)?.status ?? (s.outbox.some((op) => op.kind === "request" && op.payload.opportunityId === id && op.payload.studentId === p.id) ? "requested" : null);

  return (
    <div>
      <div class="card-row" style="align-items:center">
        <span class="emoji">{OCC_ICON[o.id] ?? "🧭"}</span>
        <h1 class="grow" style="margin:8px 0">{t(lang, "path.title")} {pick(lang, o.name)}</h1>
        <Speak text={spoken} lang={lang} />
      </div>

      <div class="hero">
        <div class="small" style="opacity:.85;font-weight:700">⭐ {t(lang, "path.thisweek")}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px">{path.thisWeek}</div>
      </div>

      <h2>{t(lang, "path.steps")}</h2>
      <ol class="steps">
        {path.steps.map((st, i) => (
          <li key={i}>
            <strong>{st.label}</strong>
            {st.duration && <span class="muted small"> · {st.duration}</span>}
            {st.course && (
              <div>
                <span class="chip">{st.course.provider}</span>
                <span class={`chip ${st.course.cost === "free" ? "good" : ""}`}>{st.course.cost === "free" ? "Free" : st.course.cost === "stipend" ? "Stipend" : "Fee"}</span>
                <span class="chip">{st.course.mode}</span>
                {st.course.url && <a class="chip" href={st.course.url} target="_blank" rel="noopener">↗</a>}
              </div>
            )}
          </li>
        ))}
      </ol>

      {path.exams.length > 0 && (
        <>
          <h2>{t(lang, "path.exams")}</h2>
          {path.exams.map((e) => (
            <div class="card" key={e.id}>
              <h3>📝 {e.name}</h3>
              <div class="small">{e.forWhat}{e.typicalMonth ? ` · ${e.typicalMonth}` : ""}{e.ageMax ? ` · age ${e.ageMin ?? ""}-${e.ageMax}` : ""}</div>
              <div class="source">{e.body}</div>
            </div>
          ))}
        </>
      )}

      <Learn p={p} />

      {path.schemes.length > 0 && (
        <>
          <h2>{t(lang, "tab.money")}</h2>
          <button class="card tap" onClick={goMoney}>
            {path.schemes.slice(0, 4).map((r) => (
              <div key={r.schemeId} class="small" style="padding:3px 0">
                {r.verdict === "eligible" ? "✅" : r.verdict === "near_miss" ? "🟡" : "❔"} {r.schemeName}
              </div>
            ))}
            <div class="small" style="color:var(--brand);font-weight:700;margin-top:6px">→ {t(lang, "tab.money")}</div>
          </button>
        </>
      )}

      {path.opportunities.length > 0 && (
        <>
          <h2>{t(lang, "path.opps")}</h2>
          {path.opportunities.map(({ opportunity: op, flags, eligibleNow }) => {
            const status = statusOf(op.id);
            return (
              <div class="card" key={op.id}>
                <div class="card-row">
                  <span class="emoji" style="font-size:28px">{KIND_ICON[op.kind]}</span>
                  <div class="grow">
                    <h3>{op.title}</h3>
                    <div class="small">{op.employer} · {op.district}{op.distanceKmFromHub ? ` · ${op.distanceKmFromHub} km` : ""}</div>
                    {op.stipendMonthly ? <div style="font-weight:800;margin-top:4px">₹{rupees(op.stipendMonthly)} / month</div> : null}
                    <div>
                      {flags.includes("verified") ? <span class="chip good">✓ verified</span> : <span class="chip bad">not verified yet</span>}
                      {flags.includes("epf") && <span class="chip good">EPF</span>}
                      {flags.includes("hostel") && <span class="chip">🏠 hostel</span>}
                      {flags.includes("women") && <span class="chip">👩 women staff</span>}
                      {(s.requestCounts[op.id] ?? 0) > 0 && <span class="chip">👥 {s.requestCounts[op.id]}</span>}
                      {!eligibleNow && <span class="chip">→ {t(lang, `e.${op.minEducation}`)}</span>}
                      <span class="chip">demo listing</span>
                    </div>
                  </div>
                </div>
                <div class="row" style="margin-top:10px">
                  {status ? (
                    <span class="pill">{status === "endorsed" ? "⭐ endorsed" : status === "joined" ? "🎉 joined" : `✓ ${t(lang, "path.asked")}`}</span>
                  ) : (
                    <button class="btn" disabled={!eligibleNow} onClick={() => enqueue("request", { studentId: p.id, opportunityId: op.id })}>{t(lang, "path.ask")}</button>
                  )}
                  {op.kind !== "mentor" && <button class="btn ghost" onClick={() => goFamily(op.id)}>👪 {t(lang, "tab.family")}</button>}
                </div>
              </div>
            );
          })}
        </>
      )}

      <p class="source">{t(lang, "path.source")}: {o.sources.map((src) => src.name).join("; ")} · NCO-2015 {o.nco} · {o.sources[0].asOf}</p>
    </div>
  );
}
