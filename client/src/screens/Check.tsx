import { useState } from "preact/hooks";
import { t } from "../../../shared/i18n/strings.ts";
import { checkOffer, type OfferCheckResult } from "../../../shared/engine/offerCheck.ts";
import { activeProfile, enqueue, getState, useStore } from "../store.ts";
import { Mic, Speak } from "../ui.tsx";
import { speak } from "../voice.ts";

const SAMPLE = "Urgent hiring! Data entry job in Bangkok, Thailand. Salary Rs 1,20,000. No experience needed. Free flight, tourist visa, work permit later. Pay Rs 25,000 registration fee. WhatsApp +66 812345678";

export function Check() {
  useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const [text, setText] = useState("");
  const [res, setRes] = useState<OfferCheckResult | null>(null);
  const [reported, setReported] = useState(false);

  const run = (txt = text) => {
    if (!txt.trim()) return;
    const r = checkOffer(txt, lang, getState().scamReports);
    setRes(r);
    setReported(false);
    const head = r.verdict === "danger" ? t(lang, "check.danger") : r.verdict === "caution" ? t(lang, "check.caution") : t(lang, "check.ok");
    speak(`${head}. ${r.flags.map((f) => f.explain).join(" ")}`, lang);
  };

  const tone = res?.verdict === "danger" ? "no" : res?.verdict === "caution" ? "wait" : "yes";

  return (
    <div>
      <div class="row"><h1 class="grow">🛡️ {t(lang, "check.title")}</h1><Speak text={`${t(lang, "check.title")} ${t(lang, "check.hint")}`} lang={lang} /></div>
      <p class="muted">{t(lang, "check.hint")}</p>
      <Mic lang={lang} onHeard={(h) => { setText(h); run(h); }} />
      <textarea value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="WhatsApp / SMS / poster text" />
      <div class="row" style="margin-top:10px">
        <button class="btn" onClick={() => run()}>{t(lang, "check.run")}</button>
        <button class="btn quiet" onClick={() => { setText(SAMPLE); run(SAMPLE); }}>Try a sample</button>
      </div>

      {res && (
        <div class={`card ${tone}`} style="margin-top:16px" role="status">
          <div class="verdict">{res.verdict === "danger" ? "⛔ " + t(lang, "check.danger") : res.verdict === "caution" ? "⚠️ " + t(lang, "check.caution") : "✅ " + t(lang, "check.ok")}</div>
          {res.verifiedEmployer && <p>✓ {t(lang, "check.verified")}: {res.verifiedEmployer.employer}</p>}
          {res.communityHits.length > 0 && <p><strong>👥 {t(lang, "check.community", { n: res.communityHits.reduce((s, h) => s + h.count, 0) })}</strong></p>}
          {res.flags.map((f) => (
            <div key={f.id + f.matched.join()} style="margin:8px 0">
              <span class={`chip ${f.severity === "low" ? "" : "bad"}`}>{f.severity}</span> {f.explain}
            </div>
          ))}
          {res.verdict !== "ok" && <p class="small"><strong>{t(lang, "check.helpline")}</strong></p>}
          {res.verdict !== "ok" && !reported && (
            <button class="btn danger" onClick={() => { enqueue("scam_report", { text, district: p.district ?? p.state ?? "unknown" }); setReported(true); speak(t(lang, "check.reported"), lang); }}>
              📢 {t(lang, "check.report")}
            </button>
          )}
          {reported && <p class="pill">{t(lang, "check.reported")}</p>}
          <p class="source">Rules work offline. Sources: MEA advisories on fake overseas job offers; eMigrate register of recruiting agents; scam reports from {getState().scamReports.length} numbers/links on the network.</p>
        </div>
      )}
    </div>
  );
}
