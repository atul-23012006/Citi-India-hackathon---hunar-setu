import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Lang, StudentProfile } from "../shared/types.ts";
import { kb } from "../shared/kb/index.ts";
import { pick } from "../shared/i18n/strings.ts";
import { rankCareers, buildPathway } from "../shared/engine/careers.ts";
import { checkAll } from "../shared/engine/eligibility.ts";
import { paperworkPlan } from "../shared/engine/paperwork.ts";
import { checkOffer, type CommunityReport } from "../shared/engine/offerCheck.ts";

// "The LLM converses; the graph decides." Claude talks with the student and
// fills in the profile, but every career, scheme, eligibility verdict and offer
// verdict comes from the deterministic engine via a tool, with its source.

const MODEL = "claude-opus-5-5";
const LANG_NAME: Record<Lang, string> = { en: "simple Indian English", hi: "Hindi (Devanagari script)", ta: "Tamil (Tamil script)", kn: "Kannada (Kannada script)" };

// The SDK resolves credentials per request, so we probe with a free models call.
// No credentials or no network: the app runs on the offline guided flow instead.
let client: Anthropic | null = null;
let lastProbe = 0;

export async function probeAi(): Promise<boolean> {
  if (Date.now() - lastProbe < 60_000) return client !== null;
  lastProbe = Date.now();
  try {
    const c = new Anthropic();
    await c.models.list({ limit: 1 });
    client = c;
  } catch {
    client = null;
  }
  return client !== null;
}

export function aiClient(): Anthropic | null {
  return client;
}

export function markAiDown() {
  client = null;
  lastProbe = Date.now();
}

function systemPrompt(lang: Lang): string {
  return `You are Hunar Setu, a warm career and livelihood guide for students in rural India, from Class 9 to graduation. Students may have low literacy, so everything you write is read aloud by text-to-speech.

Speak only in ${LANG_NAME[lang]}. Keep each reply to two or three short spoken sentences, with no lists, markdown, emojis or abbreviations a listener could not follow. Ask one question at a time.

Your job is to learn about the student (name, age, class, whether still studying, state, what they enjoy and are good at, whether they can move for work, and, only if needed for money, family category, income band and which documents they have) and record it with update_profile as soon as you learn it. Once you know their class and at least two interests, call suggest_careers. When they pick a route, call get_pathway. When they ask about money, scholarships or schemes, call check_schemes. If they mention any job offer, especially abroad, call check_offer before saying anything about it.

Ground rules:
- Never state a career fact, course, exam, scheme, amount, eligibility or deadline unless it came from a tool result in this conversation. If a tool does not have it, say you will ask their facilitator.
- Eligibility is decided only by check_schemes. Relay "yes", "not yet, because" or "not for you" exactly as it says, with the next step.
- Always help them see routes beyond army, police, teacher and doctor, without dismissing those.
- Never suggest careers by gender. Talk about safety only when discussing a specific opportunity.
- Do not ask for Aadhaar numbers, phone numbers, addresses or bank details. Ask category and income only when checking schemes, and say why.
- If the student is under 18, mention that a parent should hear the plan; the app has a button to play it for them.
- The interface shows cards for careers, pathways and schemes, so you do not need to read out every item: name the top one or two and invite them to tap.`;
}

const ProfilePatch = z
  .object({
    name: z.string().max(60),
    age: z.number().int().min(10).max(40),
    gender: z.enum(["female", "male", "other"]),
    education: z.enum(["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"]),
    inEducation: z.boolean(),
    marksPercent: z.number().min(0).max(100),
    state: z.string().length(2),
    district: z.string().max(60),
    category: z.enum(["GEN", "EWS", "OBC", "SC", "ST"]),
    minority: z.boolean(),
    familyIncome: z.number().int().min(0),
    govtEmployeeInFamily: z.boolean(),
    interests: z.array(z.enum(["hands_on", "nature", "caring", "numbers", "creative", "talking", "computers", "uniform", "cooking"])),
    skills: z.array(z.string()),
    canRelocate: z.boolean(),
    needsHostel: z.boolean(),
    goals: z.string().max(300),
    docs: z.record(z.enum(["aadhaar", "bank_account", "aadhaar_seeded", "income_cert", "caste_cert", "domicile_cert", "disability_cert", "marksheet_10", "marksheet_12", "bonafide"]), z.boolean()),
  })
  .partial();

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "update_profile",
    description:
      "Record facts the student has told you. Send only the fields you learned this turn. Interests use fixed tags: hands_on (fixing/building), nature (farms/animals), caring (health/helping), numbers (money/business), creative (art/craft/sewing), talking (teaching/people), computers, uniform (forces/sports/discipline), cooking. State is a 2-letter code like TN, KA, UP. Family income is annual rupees; if they give a band, use its midpoint.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" }, age: { type: "integer" }, gender: { type: "string", enum: ["female", "male", "other"] },
        education: { type: "string", enum: ["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"] },
        inEducation: { type: "boolean" }, marksPercent: { type: "number" }, state: { type: "string" }, district: { type: "string" },
        category: { type: "string", enum: ["GEN", "EWS", "OBC", "SC", "ST"] }, minority: { type: "boolean" },
        familyIncome: { type: "integer" }, govtEmployeeInFamily: { type: "boolean" },
        interests: { type: "array", items: { type: "string", enum: ["hands_on", "nature", "caring", "numbers", "creative", "talking", "computers", "uniform", "cooking"] } },
        skills: { type: "array", items: { type: "string" } }, canRelocate: { type: "boolean" }, needsHostel: { type: "boolean" },
        goals: { type: "string" },
        docs: { type: "object", description: "Documents the student has: aadhaar, bank_account, aadhaar_seeded, income_cert, caste_cert, domicile_cert, disability_cert, marksheet_10, marksheet_12, bonafide", additionalProperties: { type: "boolean" } },
      },
    },
  },
  { name: "suggest_careers", description: "Rank careers for the student's current profile from the Aspiration Graph. Applies the diversity rule. Returns ids, names, reasons and sources.", input_schema: { type: "object", properties: {} } },
  { name: "search_occupations", description: "Find occupations in the graph matching something the student said they want (for example 'work with animals' or 'drive a tractor').", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_pathway", description: "Get the step-by-step learning pathway, exams, schemes and openings for one occupation id, plus one action for this week.", input_schema: { type: "object", properties: { occupation_id: { type: "string" } }, required: ["occupation_id"] } },
  { name: "check_schemes", description: "Run the deterministic eligibility rules over every scholarship and scheme for the current profile. Returns eligible, near-miss (with missing documents and a paperwork plan), unknown (with what to ask) and cited sources.", input_schema: { type: "object", properties: {} } },
  { name: "check_offer", description: "Check a job or training offer the student received for fraud signals, verified employers and scam reports from other villages.", input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
];

interface Session {
  lang: Lang;
  messages: Anthropic.Beta.BetaMessageParam[]; // append-only: never edited
  lastProfileJson: string;
  updatedAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export interface ChatCard {
  type: "careers" | "pathway" | "schemes" | "offer";
  data: unknown;
}

export interface ChatResult {
  reply: string;
  profilePatch: Partial<StudentProfile>;
  cards: ChatCard[];
  sessionId: string;
  servedBy?: string;
}

function compactProfile(p: StudentProfile) {
  const { id: _id, pinHash: _pin, demonstrated, updatedAt: _u, facilitatorId: _f, ...rest } = p;
  return { ...rest, demonstrated: demonstrated.map((d) => `${d.task}:${d.score}`) };
}

function runTool(name: string, input: unknown, profile: StudentProfile, lang: Lang, reports: CommunityReport[], cards: ChatCard[], patch: Partial<StudentProfile>): string {
  switch (name) {
    case "update_profile": {
      const parsed = ProfilePatch.safeParse(input);
      if (!parsed.success) return JSON.stringify({ error: "invalid fields", issues: parsed.error.issues.map((i) => i.path.join(".")) });
      const v = parsed.data;
      if (v.docs) v.docs = { ...profile.docs, ...patch.docs, ...v.docs };
      if (v.interests) v.interests = [...new Set([...(patch.interests ?? profile.interests), ...v.interests])];
      Object.assign(patch, v);
      Object.assign(profile, v);
      return JSON.stringify({ ok: true, recorded: Object.keys(v) });
    }
    case "suggest_careers": {
      const list = rankCareers(profile);
      cards.push({ type: "careers", data: list.map((m) => m.occupation.id) });
      return JSON.stringify(
        list.map((m) => ({ id: m.occupation.id, name: pick(lang, m.occupation.name), summary: pick(lang, m.occupation.summary), track: m.occupation.track, newForStudent: m.wider, reachableNow: m.reachable, why: m.why, demand: m.occupation.demandNote, source: m.occupation.sources[0] })),
      );
    }
    case "search_occupations": {
      const q = String((input as { query?: string }).query ?? "").toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const hits = kb.occupations
        .map((o) => {
          const hay = [o.id, ...Object.values(o.name), ...Object.values(o.summary), ...o.interests, o.track].join(" ").toLowerCase();
          return { o, n: words.filter((w) => hay.includes(w)).length };
        })
        .filter((h) => h.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 5);
      return JSON.stringify(hits.map(({ o }) => ({ id: o.id, name: pick(lang, o.name), summary: pick(lang, o.summary) })));
    }
    case "get_pathway": {
      const id = String((input as { occupation_id?: string }).occupation_id ?? "");
      const path = buildPathway(profile, id, lang);
      if (!path) return JSON.stringify({ error: `unknown occupation ${id}`, known: kb.occupations.map((o) => o.id) });
      cards.push({ type: "pathway", data: id });
      return JSON.stringify({
        occupation: pick(lang, path.occupation.name),
        steps: path.steps.map((s) => ({ step: s.label, duration: s.duration, course: s.course && `${s.course.name} (${s.course.provider}, ${s.course.cost})` })),
        exams: path.exams.map((e) => `${e.name}: ${e.forWhat}${e.typicalMonth ? `, usually ${e.typicalMonth}` : ""}`),
        schemes: path.schemes.map((s) => ({ name: s.schemeName, verdict: s.verdict, missingDocs: s.missingDocs })),
        openings: path.opportunities.slice(0, 3).map((o) => ({ title: o.opportunity.title, district: o.opportunity.district, stipend: o.opportunity.stipendMonthly, demoListing: true })),
        thisWeek: path.thisWeek,
        source: path.occupation.sources[0],
      });
    }
    case "check_schemes": {
      const results = checkAll(profile, lang);
      cards.push({ type: "schemes", data: null });
      const relevant = results.filter((r) => r.verdict !== "not_eligible");
      return JSON.stringify({
        results: relevant.map((r) => ({ scheme: r.schemeName, verdict: r.verdict, benefit: r.benefit, missingDocs: r.missingDocs, ask: r.results.filter((c) => c.pass === null).map((c) => c.reason), source: r.source })),
        notEligibleCount: results.length - relevant.length,
        paperworkPlan: paperworkPlan(results).map((t) => ({ doc: t.doc.name.en, typicalDays: t.doc.typicalDays, unlocks: t.unlocks, inDigiLocker: t.fromDigiLocker })),
      });
    }
    case "check_offer": {
      const text = String((input as { text?: string }).text ?? "");
      const r = checkOffer(text, lang, reports);
      cards.push({ type: "offer", data: text });
      return JSON.stringify({ verdict: r.verdict, flags: r.flags.map((f) => ({ severity: f.severity, why: f.explain })), verifiedEmployer: r.verifiedEmployer?.employer, communityReports: r.communityHits.length });
    }
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}

export async function chat(opts: { sessionId: string; text: string; profile: StudentProfile; reports: CommunityReport[] }): Promise<ChatResult> {
  const ai = aiClient();
  if (!ai) throw new Error("AI_UNAVAILABLE");

  const profile: StudentProfile = structuredClone(opts.profile);
  const lang = profile.lang;
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);

  let session = sessions.get(opts.sessionId);
  if (!session || session.lang !== lang) {
    session = { lang, messages: [], lastProfileJson: "", updatedAt: now };
    sessions.set(opts.sessionId, session);
  }

  // Profile edits made in the app (possibly offline) are appended as context to
  // this turn, never patched into earlier turns, so history stays append-only.
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const profileJson = JSON.stringify(compactProfile(profile));
  if (profileJson !== session.lastProfileJson) {
    content.push({ type: "text", text: `[What the app currently knows about the student: ${profileJson}]` });
    session.lastProfileJson = profileJson;
  }
  content.push({ type: "text", text: opts.text });
  session.messages.push({ role: "user", content });

  const cards: ChatCard[] = [];
  const patch: Partial<StudentProfile> = {};
  let reply = "";
  let servedBy: string | undefined;

  for (let i = 0; i < 6; i++) {
    const response = await ai.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: systemPrompt(lang), cache_control: { type: "ephemeral" } }],
      tools,
      messages: session.messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    servedBy = response.model;

    session.messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });

    if (response.stop_reason === "refusal") {
      reply = lang === "en" ? "Let me pass this to your facilitator." : "";
      break;
    }

    const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join(" ").trim();
    if (text) reply = text;

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || !toolUses.length) break;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
      try {
        return { type: "tool_result", tool_use_id: tu.id, content: runTool(tu.name, tu.input, profile, lang, opts.reports, cards, patch) };
      } catch (err) {
        return { type: "tool_result", tool_use_id: tu.id, content: String(err), is_error: true };
      }
    });
    session.messages.push({ role: "user", content: results });
  }

  // Keep our record of what the model has seen in step with tool-made changes.
  session.lastProfileJson = JSON.stringify(compactProfile(profile));
  session.updatedAt = Date.now();
  return { reply, profilePatch: patch, cards, sessionId: opts.sessionId, servedBy };
}
