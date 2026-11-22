// Fills missing translations in shared/kb/translations.json using Claude.
// Run when you add a language to LANGS or new KB text:  npm run kb:translate
// Output is written for human review (git diff) before it ships; nothing is
// translated at runtime, so phones never depend on the network for language.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { LANGS } from "../shared/i18n/strings.ts";

const here = dirname(fileURLToPath(import.meta.url));
const KB = join(here, "..", "shared", "kb");
const FILE = join(KB, "translations.json");
const LANG_NAMES: Record<string, string> = { hi: "Hindi", ta: "Tamil", kn: "Kannada", te: "Telugu", mr: "Marathi", bn: "Bengali", or: "Odia", gu: "Gujarati", ml: "Malayalam", pa: "Punjabi" };

const translations: Record<string, Record<string, string>> = JSON.parse(readFileSync(FILE, "utf8"));
const occupations = JSON.parse(readFileSync(join(KB, "occupations.json"), "utf8")) as { steps: { label: { en: string } }[] }[];
const docs = JSON.parse(readFileSync(join(KB, "docs.json"), "utf8")) as { howTo: string }[];
const msme = JSON.parse(readFileSync(join(KB, "msme.json"), "utf8")) as { supports: { forWhom: string; what: string; numbers: string }[]; challenges: string[]; national: { notes: string } };
const msmeTexts = [...msme.supports.flatMap((s) => [s.forWhom, s.what, s.numbers]), ...msme.challenges, msme.national.notes].filter(Boolean);

const targets = LANGS.map((l) => l.code).filter((c) => c !== "en");
const sources = [...new Set([...occupations.flatMap((o) => o.steps.map((s) => s.label.en)), ...docs.map((d) => d.howTo), ...msmeTexts])];
const missing = sources.filter((en) => targets.some((l) => !translations[en]?.[l]));

if (!missing.length) {
  console.log("All KB strings are translated for", targets.join(", "));
  process.exit(0);
}
console.log(`${missing.length} strings need translation into ${targets.join(", ")}`);

const client = new Anthropic();
const schema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { type: "object", properties: Object.fromEntries(["en", ...targets].map((k) => [k, { type: "string" }])), required: ["en", ...targets], additionalProperties: false },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

for (let i = 0; i < missing.length; i += 40) {
  const batch = missing.slice(i, i + 40);
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system:
      "You translate short career-guidance phrases for rural Indian students with low literacy. Use everyday spoken words, not formal or Sanskritised vocabulary. Keep acronyms and scheme or exam names (ITI, NAPS, PMEGP, CUET, DigiLocker) in Latin script. Return the English text unchanged in `en`.",
    messages: [{ role: "user", content: `Translate each phrase into ${targets.map((l) => LANG_NAMES[l] ?? l).join(", ")}:\n${JSON.stringify(batch)}` }],
  } as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") throw new Error("translation request was declined");
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "{}";
  for (const item of (JSON.parse(text) as { items: Record<string, string>[] }).items) {
    const { en, ...rest } = item;
    if (batch.includes(en)) translations[en] = { ...rest, ...translations[en] };
  }
  console.log(`translated ${Math.min(i + 40, missing.length)}/${missing.length}`);
}

writeFileSync(FILE, JSON.stringify(translations, null, 2) + "\n");
console.log("Wrote", FILE, "- review the diff before committing.");
