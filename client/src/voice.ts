import type { Lang } from "../../shared/types.ts";
import { LANGS } from "../../shared/i18n/strings.ts";

// Voice in and out through the browser's Web Speech API, which on Android uses
// the phone's own Google speech services (Hindi, Tamil, Kannada and more).
// On the hub, the same interface is meant to be backed by Bhashini online and
// AI4Bharat IndicConformer offline; see docs/ARCHITECTURE.md.

const speechCode = (lang: Lang) => LANGS.find((l) => l.code === lang)?.speech ?? "en-IN";

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (!canSpeak() || !text) return onEnd?.();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechCode(lang);
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 0.95; // a little slower for new listeners
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
};

function Recognizer(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen() {
  return typeof window !== "undefined" && Recognizer() !== null;
}

export function listen(lang: Lang): { result: Promise<string>; stop: () => void } {
  const R = Recognizer();
  if (!R) return { result: Promise.reject(new Error("unsupported")), stop: () => {} };
  stopSpeaking();
  const r = new R();
  r.lang = speechCode(lang);
  r.interimResults = false;
  r.maxAlternatives = 1;
  const result = new Promise<string>((resolve, reject) => {
    let heard = "";
    r.onresult = (e) => {
      heard = e.results[0][0].transcript;
    };
    r.onerror = (e) => reject(new Error(e.error));
    r.onend = () => (heard ? resolve(heard) : reject(new Error("no-speech")));
  });
  r.start();
  return { result, stop: () => r.abort() };
}

// Spoken numbers in the pilot languages, for answers like age or marks.
const NUMBER_WORDS: Record<string, number> = {
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "तेरह": 13, "चौदह": 14, "पंद्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
  "பதிமூன்று": 13, "பதினான்கு": 14, "பதினைந்து": 15, "பதினாறு": 16, "பதினேழு": 17, "பதினெட்டு": 18, "பத்தொன்பது": 19, "இருபது": 20,
  "ಹದಿಮೂರು": 13, "ಹದಿನಾಲ್ಕು": 14, "ಹದಿನೈದು": 15, "ಹದಿನಾರು": 16, "ಹದಿನೇಳು": 17, "ಹದಿನೆಂಟು": 18, "ಹತ್ತೊಂಬತ್ತು": 19, "ಇಪ್ಪತ್ತು": 20,
};

export function parseNumber(heard: string): number | null {
  const digits = /\d+/.exec(heard.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d))));
  if (digits) return Number(digits[0]);
  const lower = heard.toLowerCase();
  for (const [w, n] of Object.entries(NUMBER_WORDS)) if (lower.includes(w)) return n;
  return null;
}

// Pick the option whose label (in any language) best matches what was heard.
export function matchOption<T>(heard: string, options: { value: T; labels: string[] }[]): T | null {
  const h = heard.toLowerCase();
  let best: { value: T; score: number } | null = null;
  for (const o of options) {
    for (const label of o.labels) {
      const words = label.toLowerCase().split(/[\s,/]+/).filter((w) => w.length > 1);
      const score = words.filter((w) => h.includes(w)).length / Math.max(words.length, 1);
      if (score > 0 && (!best || score > best.score)) best = { value: o.value, score };
    }
  }
  return best?.value ?? null;
}
