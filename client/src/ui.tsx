import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Interest, Lang, Occupation } from "../../shared/types.ts";
import { t } from "../../shared/i18n/strings.ts";
import { canListen, listen, speak } from "./voice.ts";

export function Speak({ text, lang }: { text: string; lang: Lang }) {
  return (
    <button class="speak" aria-label={t(lang, "listen")} onClick={(e) => { e.stopPropagation(); speak(text, lang); }}>
      🔊
    </button>
  );
}

export function Mic({ lang, onHeard, label }: { lang: Lang; onHeard: (text: string) => void; label?: string }) {
  const [live, setLive] = useState(false);
  const [err, setErr] = useState("");
  if (!canListen()) return <p class="small muted">{t(lang, "mic.unsupported")}</p>;
  const go = async () => {
    setErr("");
    setLive(true);
    try {
      onHeard(await listen(lang).result);
    } catch (e) {
      if ((e as Error).message !== "no-speech" && (e as Error).message !== "aborted") setErr((e as Error).message);
    } finally {
      setLive(false);
    }
  };
  return (
    <div class="mic-wrap">
      <button class={`mic ${live ? "live" : ""}`} onClick={go} aria-label={t(lang, "mic.tap")}>🎤</button>
      <span class="small muted">{live ? t(lang, "mic.listening") : label ?? t(lang, "mic.tap")}</span>
      {err && <span class="small" style="color:var(--no)">{err === "network" ? t(lang, "offline") : err}</span>}
    </div>
  );
}

export function Option({ pressed, onClick, icon, children }: { pressed?: boolean; onClick: () => void; icon?: string; children: ComponentChildren }) {
  return (
    <button class="opt" aria-pressed={pressed ? "true" : "false"} onClick={onClick}>
      {icon && <span class="big" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export const INTEREST_ICON: Record<Interest, string> = {
  hands_on: "🔧", nature: "🌾", caring: "🩺", numbers: "💰", creative: "🎨", talking: "🗣️", computers: "💻", uniform: "🎖️", cooking: "🍳",
};

export const TRACK_ICON: Record<Occupation["track"], string> = {
  vocational: "🛠️", degree: "🎓", service: "🎖️", self_employed: "🏪", green: "☀️", care: "🩺", agri: "🌾", digital: "📱", creative: "🎨",
};

export const OCC_ICON: Record<string, string> = {
  "solar-pv-technician": "☀️", electrician: "💡", "ac-technician": "❄️", "mobile-repair": "📱", "ev-mechanic": "🛵", welder: "🔥", plumber: "🚰",
  carpenter: "🪚", "tailor-designer": "🧵", beautician: "💇", "general-duty-assistant": "🩹", nurse: "👩‍⚕️", "lab-technician": "🧪",
  "anganwadi-ecce": "🧸", "school-teacher": "👩‍🏫", "drone-pilot": "🛸", "dairy-entrepreneur": "🐄", "agri-field-officer": "🌱", "fish-farmer": "🐟",
  "baker-food-processing": "🥖", chef: "🍳", "csc-vle": "🖥️", "bank-correspondent": "🏦", "accounts-assistant": "🧾", "web-developer": "💻",
  "graphic-designer": "🎨", "local-journalist": "🎙️", "civil-technician": "📐", "vet-assistant": "🐐", "retail-associate": "🛒",
  "army-agniveer": "🪖", "police-constable": "👮", "railway-technician": "🚆", doctor: "🩺", "potter-artisan": "🏺",
};

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 22 Q16 6 29 22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
      <path d="M7 22v5M16 14v13M25 22v5M3 27h26" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="16" cy="9" r="2.6" fill="#f2a541" />
    </svg>
  );
}

export function Notice({ children }: { children: ComponentChildren }) {
  return <p class="notice">{children}</p>;
}
