import { useState } from "preact/hooks";
import { LANGS, t } from "../../../shared/i18n/strings.ts";
import type { StudentProfile } from "../../../shared/types.ts";
import { enqueue, getState, setState, useStore, type HubModule } from "../store.ts";
import { Speak } from "../ui.tsx";

// Micro-modules written by facilitators. They arrive with sync and are read (or
// listened to) offline; "I finished" is queued and the facilitator certifies it,
// which is what turns it into a credential in My proof.

const claimOf = (jws: string) => {
  try {
    const b64 = jws.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    return JSON.parse(json).credentialSubject?.achievement as { type?: string; evidence?: string } | undefined;
  } catch {
    return undefined;
  }
};

function price(m: HubModule, lang: StudentProfile["lang"]) {
  if (m.pricing.model === "free") return t(lang, "learn.free");
  return t(lang, m.pricing.model === "subscription" ? "learn.subscription" : "learn.per_module", { n: m.pricing.rupees });
}

export function Learn({ p }: { p: StudentProfile }) {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const lang = p.lang;
  if (!s.modules.length) return null;

  // The student's route first, then modules in their language, then the rest.
  const rank = (m: HubModule) => (m.occupationId === p.chosenOccupation ? 0 : 2) + (m.lang === lang ? 0 : 1);
  const list = [...s.modules].sort((a, b) => rank(a) - rank(b)).slice(0, 5);

  const mark = (m: HubModule, status: "enrolled" | "completed") => {
    const key = `${p.id}:${m.id}`;
    setState({ moduleProgress: { ...getState().moduleProgress, [key]: status } });
    enqueue(status === "enrolled" ? "module_enroll" : "module_complete", { studentId: p.id, moduleId: m.id });
  };
  const certified = (m: HubModule) =>
    s.credentials.some((c) => c.studentId === p.id && claimOf(c.jws)?.type === "ModuleCompletion" && claimOf(c.jws)?.evidence?.startsWith(`module ${m.id},`));

  return (
    <>
      <h2>{t(lang, "learn.title")}</h2>
      {list.map((m) => {
        const status = s.moduleProgress[`${p.id}:${m.id}`];
        const isOpen = open === m.id;
        return (
          <div class="card" key={m.id}>
            <div class="card-row">
              <span class="emoji" style="font-size:28px">📘</span>
              <div class="grow">
                <h3>{m.title}</h3>
                <div class="small">
                  {t(lang, "learn.lessons", { n: m.lessons.length })} · {LANGS.find((l) => l.code === m.lang)?.label} · <strong>{price(m, lang)}</strong>
                </div>
              </div>
            </div>
            {!status && <button class="btn" style="margin-top:10px" onClick={() => { mark(m, "enrolled"); setOpen(m.id); }}>{t(lang, "learn.start")}</button>}
            {status && !isOpen && status === "enrolled" && <button class="btn ghost" style="margin-top:10px" onClick={() => setOpen(m.id)}>📖 {m.lessons[0]?.title}</button>}
            {isOpen && (
              <ol class="steps">
                {m.lessons.map((l, i) => (
                  <li key={i}>
                    <div class="row"><strong class="grow">{l.title}</strong><Speak text={`${l.title}. ${l.text}`} lang={m.lang} /></div>
                    <div class="small">{l.text}</div>
                  </li>
                ))}
              </ol>
            )}
            {status === "enrolled" && isOpen && <button class="btn block" onClick={() => { mark(m, "completed"); setOpen(null); }}>✅ {t(lang, "learn.done")}</button>}
            {status === "completed" && <p class="pill" style="margin-top:8px">{certified(m) ? `🎖️ ${t(lang, "learn.certified")}` : `⏳ ${t(lang, "learn.waiting")}`}</p>}
          </div>
        );
      })}
    </>
  );
}
