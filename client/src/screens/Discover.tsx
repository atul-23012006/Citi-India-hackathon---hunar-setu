import { useEffect, useRef, useState } from "preact/hooks";
import type { EducationLevel, Interest, StudentProfile } from "../../../shared/types.ts";
import { LANGS, pick, t, type StringKey } from "../../../shared/i18n/strings.ts";
import { rankCareers } from "../../../shared/engine/careers.ts";
import { activeProfile, getState, updateActive, useStore } from "../store.ts";
import { INTEREST_ICON, Mic, OCC_ICON, Option, Speak, TRACK_ICON } from "../ui.tsx";
import { matchOption, parseNumber, speak } from "../voice.ts";
import { Tasks } from "./Tasks.tsx";

const EDU: EducationLevel[] = ["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug"];
const INTERESTS: Interest[] = ["hands_on", "nature", "caring", "numbers", "creative", "talking", "computers", "uniform", "cooking"];
const STATES = [
  { code: "TN", name: "Tamil Nadu" }, { code: "KA", name: "Karnataka" }, { code: "UP", name: "Uttar Pradesh" }, { code: "BR", name: "Bihar" },
  { code: "MH", name: "Maharashtra" }, { code: "AP", name: "Andhra Pradesh" }, { code: "TS", name: "Telangana" }, { code: "OD", name: "Odisha" },
];
const allLabels = (key: StringKey) => LANGS.map((l) => t(l.code, key));

type QId = "age" | "gender" | "education" | "studying" | "state" | "interests" | "relocate";
const ORDER: QId[] = ["age", "gender", "education", "studying", "state", "interests", "relocate"];
const QKEY: Record<QId, StringKey> = { age: "q.age", gender: "q.gender", education: "q.education", studying: "q.studying", state: "q.state", interests: "q.interests", relocate: "q.relocate" };

function answered(p: StudentProfile, q: QId) {
  switch (q) {
    case "age": return p.age != null;
    case "gender": return !!p.gender;
    case "education": return !!p.education;
    case "studying": return p.inEducation != null;
    case "state": return !!p.state;
    case "interests": return p.interests.length > 0;
    case "relocate": return p.canRelocate != null;
  }
}

// ---------- Guided interview: works with no network and no AI ----------

function Guided({ p, onDone }: { p: StudentProfile; onDone: () => void }) {
  const lang = p.lang;
  const q = ORDER.find((x) => !answered(p, x));
  const [picked, setPicked] = useState<Interest[]>(p.interests);

  useEffect(() => {
    if (!q) onDone();
    else speak(t(lang, QKEY[q]), lang);
  }, [q]);
  if (!q) return null;

  const yesNo = (onAnswer: (v: boolean) => void) => ({
    heard: (h: string) => {
      const v = matchOption(h, [{ value: true, labels: allLabels("yes") }, { value: false, labels: allLabels("no") }]);
      if (v != null) onAnswer(v);
    },
    ui: (
      <div class="options">
        <Option icon="👍" onClick={() => onAnswer(true)}>{t(lang, "yes")}</Option>
        <Option icon="✋" onClick={() => onAnswer(false)}>{t(lang, "no")}</Option>
      </div>
    ),
  });

  let body: { heard: (h: string) => void; ui: preact.JSX.Element };
  switch (q) {
    case "age":
      body = {
        heard: (h) => { const n = parseNumber(h); if (n && n >= 10 && n <= 40) updateActive({ age: n }); },
        ui: (
          <div class="options" style="grid-template-columns:repeat(4,1fr)">
            {Array.from({ length: 13 }, (_, i) => 13 + i).map((n) => <Option key={n} onClick={() => updateActive({ age: n })}>{n}</Option>)}
          </div>
        ),
      };
      break;
    case "gender":
      body = {
        heard: (h) => { const g = matchOption(h, (["female", "male", "other"] as const).map((v) => ({ value: v, labels: allLabels(`g.${v}`) }))); if (g) updateActive({ gender: g }); },
        ui: (
          <div class="options">
            <Option icon="👧" onClick={() => updateActive({ gender: "female" })}>{t(lang, "g.female")}</Option>
            <Option icon="👦" onClick={() => updateActive({ gender: "male" })}>{t(lang, "g.male")}</Option>
            <Option icon="🧑" onClick={() => updateActive({ gender: "other" })}>{t(lang, "g.other")}</Option>
          </div>
        ),
      };
      break;
    case "education":
      body = {
        heard: (h) => {
          const n = parseNumber(h);
          const byNum: Record<number, EducationLevel> = { 8: "class8", 9: "class9", 10: "class10", 11: "class11", 12: "class12" };
          const e = (n && byNum[n]) || matchOption(h, EDU.map((v) => ({ value: v, labels: allLabels(`e.${v}`) })));
          if (e) updateActive({ education: e });
        },
        ui: <div class="options">{EDU.map((e) => <Option key={e} onClick={() => updateActive({ education: e })}>{t(lang, `e.${e}`)}</Option>)}</div>,
      };
      break;
    case "studying":
      body = yesNo((v) => updateActive({ inEducation: v }));
      break;
    case "state":
      body = {
        heard: (h) => { const s = matchOption(h, STATES.map((x) => ({ value: x.code, labels: [x.name] }))); if (s) updateActive({ state: s }); },
        ui: <div class="options">{STATES.map((x) => <Option key={x.code} onClick={() => updateActive({ state: x.code })}>{x.name}</Option>)}</div>,
      };
      break;
    case "interests": {
      const toggle = (i: Interest) => setPicked((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
      body = {
        heard: (h) => {
          const hits = INTERESTS.filter((i) => matchOption(h, [{ value: i, labels: allLabels(`i.${i}`) }]));
          if (hits.length) setPicked((cur) => [...new Set([...cur, ...hits])]);
        },
        ui: (
          <>
            <div class="options">
              {INTERESTS.map((i) => <Option key={i} icon={INTEREST_ICON[i]} pressed={picked.includes(i)} onClick={() => toggle(i)}>{t(lang, `i.${i}`)}</Option>)}
            </div>
            <button class="btn block" disabled={!picked.length} onClick={() => updateActive({ interests: picked })}>{t(lang, "next")}</button>
          </>
        ),
      };
      break;
    }
    case "relocate":
      body = yesNo((v) => updateActive({ canRelocate: v, needsHostel: v }));
      break;
  }

  return (
    <div>
      <p class="small muted">{ORDER.indexOf(q) + 1} / {ORDER.length} · {t(lang, "discover.mode.offline")}</p>
      <div class="row"><h1 class="grow" style="margin:4px 0">{t(lang, QKEY[q])}</h1><Speak text={t(lang, QKEY[q])} lang={lang} /></div>
      <Mic lang={lang} onHeard={body.heard} />
      {body.ui}
    </div>
  );
}

// ---------- AI conversation (Claude, through the hub) ----------

interface Msg { who: "me" | "ai"; text: string }
const sessions = new Map<string, string>();

function Chat({ p, onCareers }: { p: StudentProfile; onCareers: () => void }) {
  const lang = p.lang;
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "ai", text: t(lang, "discover.hello") }]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [fellBack, setFellBack] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  if (!sessions.has(p.id)) sessions.set(p.id, crypto.randomUUID());

  useEffect(() => { speak(t(lang, "discover.hello"), lang); }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs, busy]);

  const send = async (said: string) => {
    if (!said.trim() || busy) return;
    setText("");
    setMsgs((m) => [...m, { who: "me", text: said }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessions.get(p.id), text: said, profile: activeProfile() }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (Object.keys(data.profilePatch ?? {}).length) updateActive(data.profilePatch);
      if (data.reply) {
        setMsgs((m) => [...m, { who: "ai", text: data.reply }]);
        speak(data.reply, lang);
      }
      if (data.cards?.some((c: { type: string }) => c.type === "careers")) onCareers();
    } catch {
      setFellBack(true); // network dropped or AI unavailable: continue offline
    } finally {
      setBusy(false);
    }
  };

  if (fellBack) return <Guided p={activeProfile()!} onDone={onCareers} />;

  return (
    <div>
      <p class="small muted">✨ {t(lang, "discover.mode.ai")}</p>
      <div class="chat">
        {msgs.map((m, i) => (
          <div key={i} class={`bubble ${m.who}`}>
            {m.text}
            {m.who === "ai" && <div style="margin-top:6px"><Speak text={m.text} lang={lang} /></div>}
          </div>
        ))}
        {busy && <div class="bubble ai typing">…</div>}
        <div ref={end} />
      </div>
      <Mic lang={lang} onHeard={send} />
      <form class="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input type="text" class="grow" style="flex:1" placeholder={t(lang, "or.type")} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button class="btn" type="submit" disabled={busy}>{t(lang, "send")}</button>
      </form>
    </div>
  );
}

// ---------- Career shortlist ----------

export function CareerList({ p, onPick }: { p: StudentProfile; onPick: (id: string) => void }) {
  const lang = p.lang;
  const list = rankCareers(p);
  return (
    <div>
      <div class="row"><p class="grow" style="margin:0">{t(lang, "discover.done")}</p><Speak text={t(lang, "discover.done") + " " + list.slice(0, 3).map((m) => pick(lang, m.occupation.name)).join(", ")} lang={lang} /></div>
      {list.map((m) => (
        <button key={m.occupation.id} class="card tap" onClick={() => onPick(m.occupation.id)}>
          <div class="card-row">
            <span class="emoji" aria-hidden="true">{OCC_ICON[m.occupation.id] ?? TRACK_ICON[m.occupation.track]}</span>
            <div class="grow">
              <h3>
                {pick(lang, m.occupation.name)}
                {m.wider && <span class="badge">{t(lang, "discover.wider")}</span>}
              </h3>
              <div class="small">{pick(lang, m.occupation.summary)}</div>
              {!m.reachable && <span class="chip">→ {t(lang, `e.${m.occupation.minEducation}`)}</span>}
              {m.occupation.demandNote && <div class="source">📈 {m.occupation.demandNote}</div>}
            </div>
            <Speak text={`${pick(lang, m.occupation.name)}. ${pick(lang, m.occupation.summary)}`} lang={lang} />
          </div>
        </button>
      ))}
    </div>
  );
}

export function Discover({ goPath }: { goPath: () => void }) {
  const s = useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const complete = ORDER.every((q) => answered(p, q));
  const [view, setView] = useState<"talk" | "careers" | "tasks">(complete ? "careers" : "talk");
  const ai = s.online && s.aiAvailable;

  const restart = () => {
    updateActive({ age: undefined, gender: undefined, education: undefined, inEducation: undefined, state: undefined, interests: [], canRelocate: undefined });
    setView("talk");
  };

  if (view === "tasks") return <Tasks p={p} onDone={() => setView("careers")} />;

  if (view === "talk") {
    return ai ? <Chat p={p} onCareers={() => setView("careers")} /> : <Guided p={p} onDone={() => setView("careers")} />;
  }

  return (
    <div>
      <h1>{p.name ? `${p.name}, ` : ""}{t(lang, "tab.discover")}</h1>
      <button class="card tap" style="background:var(--brand-soft)" onClick={() => setView("tasks")}>
        <div class="card-row">
          <span class="emoji">🧩</span>
          <div class="grow"><h3>{t(lang, "q.task")}</h3><div class="small muted">{p.demonstrated.length} ✓</div></div>
        </div>
      </button>
      <CareerList p={p} onPick={(id) => { updateActive({ chosenOccupation: id }); goPath(); }} />
      <div class="row" style="margin-top:12px">
        {ai && <button class="btn ghost" onClick={() => setView("talk")}>✨ {t(lang, "discover.mode.ai")}</button>}
        <button class="btn quiet" onClick={restart}>{t(lang, "discover.restart")}</button>
      </div>
      {getState().outbox.length > 0 && <p class="small muted">{t(lang, "sync.pending", { n: getState().outbox.length })}</p>}
    </div>
  );
}
