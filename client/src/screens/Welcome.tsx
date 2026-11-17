import { useEffect, useState } from "preact/hooks";
import type { Lang, StudentProfile } from "../../../shared/types.ts";
import { LANGS, t } from "../../../shared/i18n/strings.ts";
import { getState, hashPin, newProfile, saveProfile, setState, useStore, verifyPin } from "../store.ts";
import { Logo, Speak } from "../ui.tsx";
import { speak } from "../voice.ts";

export function LangPicker({ lang, onPick }: { lang: Lang; onPick: (l: Lang) => void }) {
  return (
    <div class="options" role="radiogroup" aria-label={t(lang, "lang.choose")}>
      {LANGS.map((l) => (
        <button class="opt" key={l.code} aria-pressed={l.code === lang ? "true" : "false"} onClick={() => onPick(l.code)} style="font-size:20px">
          {l.label}
        </button>
      ))}
    </div>
  );
}

function PinPad({ lang, title, onDone, error }: { lang: Lang; title: string; onDone: (pin: string) => void; error?: string }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (pin.length === 4) {
      onDone(pin);
      setPin("");
    }
  }, [pin]);
  return (
    <div>
      <div class="row" style="justify-content:center">
        <h2 style="margin:8px 0">{title}</h2>
        <Speak text={title} lang={lang} />
      </div>
      <div class="dots" aria-label={`${pin.length} of 4`}>
        {[0, 1, 2, 3].map((i) => <span key={i} class={i < pin.length ? "on" : ""} />)}
      </div>
      {error && <p style="text-align:center;color:var(--no)">{error}</p>}
      <div class="pin">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) =>
          k === "" ? <span key="blank" /> : (
            <button key={k} aria-label={k === "⌫" ? "delete" : k} onClick={() => setPin((p) => (k === "⌫" ? p.slice(0, -1) : (p + k).slice(0, 4)))}>{k}</button>
          ),
        )}
      </div>
    </div>
  );
}

type Step = { kind: "home" } | { kind: "unlock"; profile: StudentProfile } | { kind: "consent" } | { kind: "name" } | { kind: "setpin"; name: string; guardian: boolean };

export function Welcome({ onFacilitator }: { onFacilitator: () => void }) {
  const s = useStore();
  const lang = s.uiLang;
  const [step, setStep] = useState<Step>({ kind: "home" });
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [agree, setAgree] = useState(false);

  const enter = (p: StudentProfile) => setState({ activeId: p.id, uiLang: p.lang });

  if (step.kind === "unlock") {
    return (
      <main>
        <PinPad
          lang={lang}
          title={`${step.profile.name} - ${t(lang, "pin.enter")}`}
          error={err}
          onDone={async (pin) => {
            if (!step.profile.pinHash || (await verifyPin(pin, step.profile.pinHash))) enter(step.profile);
            else setErr(t(lang, "pin.wrong"));
          }}
        />
        <button class="btn quiet block" onClick={() => setStep({ kind: "home" })}>{t(lang, "back")}</button>
      </main>
    );
  }

  if (step.kind === "consent") {
    return (
      <main>
        <h1>{t(lang, "consent.title")}</h1>
        <div class="card card-row">
          <p class="grow" style="margin:0">{t(lang, "consent.body")}</p>
          <Speak text={t(lang, "consent.body")} lang={lang} />
        </div>
        <label class="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree((e.target as HTMLInputElement).checked)} />{t(lang, "consent.agree")}</label>
        <label class="check"><input type="checkbox" checked={guardian} onChange={(e) => setGuardian((e.target as HTMLInputElement).checked)} />{t(lang, "consent.guardian")}</label>
        <p class="small muted">DPDP Act 2023 &amp; Rules 2025. In production, guardian consent uses a DigiLocker virtual token.</p>
        <button class="btn block" disabled={!agree} onClick={() => setStep({ kind: "name" })}>{t(lang, "next")}</button>
      </main>
    );
  }

  if (step.kind === "name") {
    return (
      <main>
        <div class="row"><h1 class="grow">{t(lang, "q.name")}</h1><Speak text={t(lang, "q.name")} lang={lang} /></div>
        <input type="text" value={name} autoFocus autocomplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <div style="height:12px" />
        <button class="btn block" disabled={!name.trim()} onClick={() => setStep({ kind: "setpin", name: name.trim(), guardian })}>{t(lang, "next")}</button>
      </main>
    );
  }

  if (step.kind === "setpin") {
    return (
      <main>
        <PinPad
          lang={lang}
          title={t(lang, "pin.set")}
          onDone={async (pin) => {
            const p = newProfile(lang);
            p.name = step.name;
            p.pinHash = await hashPin(pin);
            p.consent = { at: new Date().toISOString(), guardian: step.guardian };
            const st = getState();
            if (st.facilitatorToken) p.facilitatorId = st.facilitatorToken.split(".")[0]; // assisted session
            enter(saveProfile(p));
          }}
        />
      </main>
    );
  }

  return (
    <main>
      <div style="text-align:center;margin:18px 0 6px;color:var(--brand)">
        <div style="width:64px;height:64px;margin:0 auto"><Logo /></div>
        <h1 style="margin:6px 0 2px">Hunar Setu</h1>
        <p class="muted" style="margin:0">{t(lang, "app.tagline")}</p>
      </div>
      <h2>{t(lang, "lang.choose")}</h2>
      <LangPicker lang={lang} onPick={(l) => { setState({ uiLang: l }); speak(t(l, "app.tagline"), l); }} />

      <h2>{t(lang, "who.title")}</h2>
      <div class="options">
        {s.profiles.map((p) => (
          <button class="opt" key={p.id} onClick={() => { setErr(""); setStep({ kind: "unlock", profile: p }); }}>
            <span class="avatar" style="display:grid;place-items:center">{p.name.slice(0, 1).toUpperCase() || "?"}</span>
            {p.name}
          </button>
        ))}
        <button class="opt" onClick={() => setStep({ kind: "consent" })}><span class="big">➕</span>{t(lang, "who.new")}</button>
        <button class="opt" onClick={onFacilitator}><span class="big">🧑‍🏫</span>{t(lang, "who.facilitator")}</button>
      </div>
    </main>
  );
}
