import { useState } from "preact/hooks";
import type { Lang } from "../../shared/types.ts";
import { LANGS, t, type StringKey } from "../../shared/i18n/strings.ts";
import { activeProfile, setState, updateActive, useStore } from "./store.ts";
import { Logo } from "./ui.tsx";
import { stopSpeaking } from "./voice.ts";
import { Welcome } from "./screens/Welcome.tsx";
import { Discover } from "./screens/Discover.tsx";
import { Path } from "./screens/Path.tsx";
import { Money } from "./screens/Money.tsx";
import { Check } from "./screens/Check.tsx";
import { Family } from "./screens/Family.tsx";
import { Passport } from "./screens/Passport.tsx";
import { Facilitator } from "./screens/Facilitator.tsx";
import { Nearby } from "./screens/Nearby.tsx";
import { signOut } from "./account.ts";

type Tab = "discover" | "near" | "path" | "money" | "check" | "family" | "passport";
const TABS: { id: Tab; icon: string; key: StringKey }[] = [
  { id: "discover", icon: "🧭", key: "tab.discover" },
  { id: "near", icon: "📍", key: "tab.near" },
  { id: "path", icon: "🛤️", key: "tab.path" },
  { id: "money", icon: "💰", key: "tab.money" },
  { id: "check", icon: "🛡️", key: "tab.check" },
  { id: "family", icon: "👪", key: "tab.family" },
  { id: "passport", icon: "🎖️", key: "tab.passport" },
];

function Header({ lang }: { lang: Lang }) {
  const s = useStore();
  const p = activeProfile();
  const pending = s.outbox.length;
  const status = s.online ? (pending ? `⟳ ${pending}` : `● ${t(lang, "online")}`) : "○";
  return (
    <>
    <header class={`top ${p ? "signed-in" : ""}`}>
      <span class="logo"><Logo /><span class="word">Hunar Setu</span></span>
      <span class="spacer" />
      <span class={`pill ${s.online ? "" : "off"}`} role="status" title={pending ? t(lang, "sync.pending", { n: pending }) : undefined}>{status}</span>
      {p && (
        <select aria-label={t(lang, "lang.choose")} value={p.lang} onChange={(e) => { const l = (e.target as HTMLSelectElement).value as Lang; updateActive({ lang: l }); setState({ uiLang: l }); }}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      )}
      {p && <button class="avatar" aria-label="Switch user" title="Switch user" onClick={() => { stopSpeaking(); if (p.accountId) signOut(); else setState({ activeId: null }); }}>{p.name.slice(0, 1).toUpperCase() || "?"}</button>}
    </header>
    {!s.online && <div class="offline-bar" role="status">{t(lang, "offline")}{pending ? ` · ${t(lang, "sync.pending", { n: pending })}` : ""}</div>}
    </>
  );
}

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("discover");
  const [facilitator, setFacilitator] = useState(false);
  const [familyOpp, setFamilyOpp] = useState<string | null>(null);
  const go = (next: Tab) => { stopSpeaking(); setTab(next); window.scrollTo(0, 0); };

  if (!s.ready) return <div class="app"><main><p class="muted">…</p></main></div>;

  if (facilitator) {
    return (
      <div class="app">
        <Header lang={s.uiLang} />
        <Facilitator onAddStudent={() => { setState({ activeId: null }); setFacilitator(false); }} onExit={() => setFacilitator(false)} />
      </div>
    );
  }

  const p = activeProfile();
  if (!p) {
    return (
      <div class="app">
        <Header lang={s.uiLang} />
        <Welcome onFacilitator={() => setFacilitator(true)} />
      </div>
    );
  }

  const lang = p.lang;
  return (
    <div class="app">
      <Header lang={lang} />
      <main>
        {tab === "discover" && <Discover goPath={() => go("path")} />}
        {tab === "near" && <Nearby />}
        {tab === "path" && <Path goDiscover={() => go("discover")} goMoney={() => go("money")} goFamily={(id) => { setFamilyOpp(id); go("family"); }} />}
        {tab === "money" && <Money />}
        {tab === "check" && <Check />}
        {tab === "family" && <Family oppId={familyOpp} setOppId={setFamilyOpp} />}
        {tab === "passport" && <Passport />}
      </main>
      <nav class="tabs" aria-label="Sections">
        <div class="tabs-inner">
          {TABS.map((x) => (
            <button key={x.id} class="tab" aria-current={tab === x.id ? "page" : undefined} onClick={() => go(x.id)}>
              <span class="ic" aria-hidden="true">{x.icon}</span>
              {t(lang, x.key)}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
