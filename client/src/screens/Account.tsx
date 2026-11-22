import { useState } from "preact/hooks";
import type { EducationLevel, Lang } from "../../../shared/types.ts";
import { t, type StringKey } from "../../../shared/i18n/strings.ts";
import type { Place } from "../../../shared/geo.ts";
import { changePassword, deleteAccount, login, passwordChecks, register, signOut, type Result } from "../account.ts";
import { activeProfile, useStore } from "../store.ts";
import { Speak } from "../ui.tsx";
import { PlacePicker } from "./PlacePicker.tsx";

const EDU: EducationLevel[] = ["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"];

function errorText(lang: Lang, r: Result<unknown>) {
  return r.ok ? "" : t(lang, r.error, { n: r.minutes ?? 15 });
}

function PasswordInput({ lang, label, value, onInput, autocomplete, id }: { lang: Lang; label: string; value: string; onInput: (v: string) => void; autocomplete: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <label class="field" for={id}>
      <span>{label}</span>
      <div class="pw">
        <input id={id} type={(show ? "text" : "password") as "text"} value={value} autocomplete={autocomplete} maxLength={128} required
          onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
        <button type="button" class="pw-toggle" aria-pressed={show ? "true" : "false"} onClick={() => setShow(!show)}>{t(lang, show ? "acc.hide" : "acc.show")}</button>
      </div>
    </label>
  );
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  return <li class={ok ? "ok" : ""}><span aria-hidden="true">{ok ? "✓" : "○"}</span> {children}</li>;
}

export function Login({ lang, prefill, onRegister, onBack }: { lang: Lang; prefill?: string; onRegister: () => void; onBack: () => void }) {
  const [loginId, setLoginId] = useState(prefill ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await login(loginId, password);
    setBusy(false);
    if (!r.ok) setErr(errorText(lang, r)); // on success the store switches to the student's space
  };

  return (
    <main>
      <div class="row"><h1 class="grow">🔐 {t(lang, "acc.title.login")}</h1><Speak text={t(lang, "acc.title.login")} lang={lang} /></div>
      <form class="form" onSubmit={submit} noValidate>
        <label class="field">
          <span>{t(lang, "acc.login")}</span>
          <input type="text" inputMode="email" autocomplete="username" value={loginId} required autoFocus={!prefill}
            onInput={(e) => setLoginId((e.target as HTMLInputElement).value)} />
        </label>
        <PasswordInput lang={lang} id="login-pw" label={t(lang, "acc.password")} value={password} onInput={setPassword} autocomplete="current-password" />
        {err && <p class="form-error" role="alert">{err}</p>}
        <button class="btn block" type="submit" disabled={busy || !loginId.trim() || !password}>{busy ? t(lang, "acc.wait") : t(lang, "acc.submit.login")}</button>
      </form>
      <button class="btn quiet block" style="margin-top:12px" onClick={onRegister}>{t(lang, "acc.new")}</button>
      <button class="btn quiet block" style="margin-top:8px" onClick={onBack}>{t(lang, "back")}</button>
    </main>
  );
}

const ageFrom = (dob: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
};

export function Register({ lang, onLogin, onBack }: { lang: Lang; onLogin: () => void; onBack: () => void }) {
  const [f, setF] = useState({
    fullName: "", email: "", phone: "", dateOfBirth: "", gender: "" as "" | "female" | "male" | "other",
    education: "" as "" | EducationLevel, role: "student" as "student" | "jobseeker", password: "", confirm: "",
  });
  const [place, setPlace] = useState<Place | null>(null);
  const [consent, setConsent] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });

  const age = ageFrom(f.dateOfBirth);
  const minor = age !== null && age < 18;
  const rules = passwordChecks(f.password, f.confirm);
  const phoneOk = !f.phone || /^[6-9]\d{9}$/.test(f.phone);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  const ready = f.fullName.trim().length >= 2 && emailOk && phoneOk && age !== null && age >= 13 && age <= 70 &&
    rules.length && rules.letter && rules.number && rules.match && consent && (!minor || guardian);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!ready) return setErr(t(lang, !rules.match ? "err.mismatch" : age === null || age < 13 || age > 70 ? "err.age" : minor && !guardian ? "err.guardian" : "err.invalid"));
    setBusy(true);
    setErr("");
    const r = await register({
      fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone || undefined, password: f.password, role: f.role,
      dateOfBirth: f.dateOfBirth, gender: f.gender || undefined, education: f.education || undefined, lang,
      state: place?.state, district: place?.district, pincode: place?.pincode, consent: true, guardianConsent: guardian,
    });
    setBusy(false);
    if (!r.ok) setErr(errorText(lang, r));
  };

  return (
    <main>
      <div class="row"><h1 class="grow">📝 {t(lang, "acc.title.register")}</h1><Speak text={t(lang, "acc.title.register")} lang={lang} /></div>
      <form class="form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>{t(lang, "acc.section.you")}</legend>
          <label class="field">
            <span>{t(lang, "acc.fullName")}</span>
            <input type="text" autocomplete="name" maxLength={80} value={f.fullName} onInput={set("fullName")} required autoFocus />
          </label>
          <div class="two-col">
            <label class="field">
              <span>{t(lang, "acc.dob")}</span>
              <input type="date" autocomplete="bday" value={f.dateOfBirth} onInput={set("dateOfBirth")} required max={new Date().toISOString().slice(0, 10)}
                aria-invalid={!!f.dateOfBirth && (age === null || age < 13 || age > 70)} />
            </label>
            <label class="field">
              <span>{t(lang, "acc.gender")}</span>
              <select value={f.gender} onChange={set("gender")}>
                <option value="">{t(lang, "acc.choose")}</option>
                <option value="female">{t(lang, "g.female")}</option>
                <option value="male">{t(lang, "g.male")}</option>
                <option value="other">{t(lang, "g.other")}</option>
              </select>
            </label>
          </div>
          <div class="two-col">
            <label class="field">
              <span>{t(lang, "acc.education")}</span>
              <select value={f.education} onChange={set("education")}>
                <option value="">{t(lang, "acc.choose")}</option>
                {EDU.map((e) => <option key={e} value={e}>{t(lang, `e.${e}` as StringKey)}</option>)}
              </select>
            </label>
            <label class="field">
              <span>{t(lang, "acc.role")}</span>
              <select value={f.role} onChange={set("role")}>
                <option value="student">{t(lang, "acc.role.student")}</option>
                <option value="jobseeker">{t(lang, "acc.role.jobseeker")}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t(lang, "acc.section.contact")}</legend>
          <label class="field">
            <span>{t(lang, "acc.email")}</span>
            <input type="email" autocomplete="email" inputMode="email" maxLength={254} value={f.email} onInput={set("email")} required aria-invalid={!!f.email && !emailOk} />
          </label>
          <label class="field">
            <span>{t(lang, "acc.phone")}</span>
            <input type="tel" autocomplete="tel-national" inputMode="numeric" maxLength={10} value={f.phone} aria-invalid={!phoneOk}
              onInput={(e) => setF({ ...f, phone: (e.target as HTMLInputElement).value.replace(/\D/g, "") })} />
          </label>
        </fieldset>

        <fieldset>
          <legend>{t(lang, "loc.title")}</legend>
          <PlacePicker lang={lang} compact onPick={setPlace} />
        </fieldset>

        <fieldset>
          <legend>{t(lang, "acc.section.password")}</legend>
          <PasswordInput lang={lang} id="reg-pw" label={t(lang, "acc.password")} value={f.password} onInput={(v) => setF({ ...f, password: v })} autocomplete="new-password" />
          <PasswordInput lang={lang} id="reg-pw2" label={t(lang, "acc.confirm")} value={f.confirm} onInput={(v) => setF({ ...f, confirm: v })} autocomplete="new-password" />
          <ul class="rules" aria-live="polite">
            <Rule ok={rules.length}>{t(lang, "acc.rule.length")}</Rule>
            <Rule ok={rules.letter}>{t(lang, "acc.rule.letter")}</Rule>
            <Rule ok={rules.number}>{t(lang, "acc.rule.number")}</Rule>
            <Rule ok={rules.match}>{t(lang, "acc.rule.match")}</Rule>
          </ul>
          <p class="small muted">🔒 {t(lang, "acc.secure")}</p>
        </fieldset>

        <div class="card">
          <p style="margin:0 0 8px">{t(lang, "consent.body")}</p>
          <label class="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent((e.target as HTMLInputElement).checked)} />{t(lang, "consent.agree")}</label>
          {minor && <label class="check"><input type="checkbox" checked={guardian} onChange={(e) => setGuardian((e.target as HTMLInputElement).checked)} />{t(lang, "consent.guardian")}</label>}
          <p class="small muted" style="margin:4px 0 0">DPDP Act 2023 &amp; Rules 2025.</p>
        </div>

        {err && <p class="form-error" role="alert">{err}</p>}
        <button class="btn block" type="submit" disabled={busy}>{busy ? t(lang, "acc.wait") : t(lang, "acc.submit.register")}</button>
      </form>
      <button class="btn quiet block" style="margin-top:12px" onClick={onLogin}>{t(lang, "acc.have")}</button>
      <button class="btn quiet block" style="margin-top:8px" onClick={onBack}>{t(lang, "back")}</button>
    </main>
  );
}

// Shown in "My proof" for a signed-in account: sign out, change password, delete.
export function AccountPanel() {
  const s = useStore();
  const p = activeProfile();
  const [mode, setMode] = useState<"" | "password" | "delete">("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!p || !s.account || p.accountId !== s.account.id) return null;
  const lang = p.lang;

  const doChange = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const r = await changePassword(current, next);
    setBusy(false);
    setMsg(r.ok ? t(lang, "acc.changed") : errorText(lang, r));
    if (r.ok) { setMode(""); setCurrent(""); setNext(""); }
  };
  const doDelete = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const r = await deleteAccount(current);
    setBusy(false);
    if (!r.ok) setMsg(errorText(lang, r));
  };

  return (
    <section class="card" aria-labelledby="acc-h">
      <h3 id="acc-h">👤 {t(lang, "acc.yours")}</h3>
      <p class="small muted" style="margin:0 0 10px">{s.account.email}</p>
      {msg && <p class="small" role="status">{msg}</p>}
      {mode === "" && (
        <div class="row">
          <button class="btn ghost" onClick={() => signOut()}>{t(lang, "acc.signout")}</button>
          <button class="btn quiet" onClick={() => { setMsg(""); setMode("password"); }}>{t(lang, "acc.change")}</button>
          <button class="btn quiet" style="color:var(--no)" onClick={() => { setMsg(""); setMode("delete"); }}>{t(lang, "acc.delete")}</button>
        </div>
      )}
      {mode === "password" && (
        <form class="form" onSubmit={doChange}>
          <PasswordInput lang={lang} id="cur-pw" label={t(lang, "acc.current")} value={current} onInput={setCurrent} autocomplete="current-password" />
          <PasswordInput lang={lang} id="new-pw" label={t(lang, "acc.newPassword")} value={next} onInput={setNext} autocomplete="new-password" />
          <div class="row"><button class="btn" disabled={busy || !current || next.length < 8}>{t(lang, "acc.change")}</button><button type="button" class="btn quiet" onClick={() => setMode("")}>{t(lang, "back")}</button></div>
        </form>
      )}
      {mode === "delete" && (
        <form class="form" onSubmit={doDelete}>
          <PasswordInput lang={lang} id="del-pw" label={t(lang, "acc.delete.confirm")} value={current} onInput={setCurrent} autocomplete="current-password" />
          <div class="row"><button class="btn danger" disabled={busy || !current}>{t(lang, "acc.delete")}</button><button type="button" class="btn quiet" onClick={() => setMode("")}>{t(lang, "back")}</button></div>
        </form>
      )}
    </section>
  );
}
