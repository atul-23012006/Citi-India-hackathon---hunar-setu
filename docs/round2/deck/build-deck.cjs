// Builds the Round 2 deck (10 min talk + 5 min Q&A) in the order Citi asked for:
// title, agenda, team, problem (goals, approach, success measures), architecture +
// POC + tech stack, data points + demo, risks, outcomes + lessons.
//
//   cd docs/round2/deck && npm install && npm run build
//
// Numbers come from ../data-points.json (npm run data:points at the repo root) and
// screenshots from ../screens, so a rebuild picks up new measurements.

const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");

const ROOT = path.join(__dirname, "..");
const dp = JSON.parse(fs.readFileSync(path.join(ROOT, "data-points.json"), "utf8"));
const shot = (name) => path.join(ROOT, "screens", `${name}.png`);
const OUT = path.join(ROOT, "HunarSetu_Round2_AgentSmiths.pptx");

const TEAM = {
  college: "Vellore Institute of Technology (VIT), Vellore",
  team: "Agent Smiths",
  program: "Citi India Hackathon",
  theme: "Reimagining Education & Economic Empowerment for Rural India",
  members: [
    { name: "Atul Bharadwaj", role: "Team lead" },
    { name: "Shanmitha Gandra", role: "Team member" },
    { name: "Sucheta Bhowmick", role: "Team member" },
    { name: "Sai Lokesh", role: "Team member" },
    { name: "Sanath M Koushik", role: "Team member" },
  ],
  mentor: "‹Mentor name›", // fill in before presenting
  repo: "github.com/atul-23012006/Citi-India-hackathon---hunar-setu",
};

// Palette taken from the app itself: bridge green, marigold, warm ink.
const G = "0B6E4F"; // brand green
const GD = "06402E"; // deep green (dark slides)
const GS = "E3F1EA"; // soft green
const M = "F2A541"; // marigold accent
const MS = "FDF0DC"; // soft marigold
const INK = "1F2A24";
const MUTED = "5B6B63";
const LINE = "D5DED9";
const WHITE = "FFFFFF";
const RED = "B03A2E";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.author = "Team Agent Smiths";
pres.company = "VIT Vellore";
pres.title = "Hunar Setu - Round 2";
pres.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };

const W = 13.333;
const X0 = 0.6;
const CW = W - 2 * X0; // content width 12.133

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: WHITE },
  objects: [
    { text: { text: `Hunar Setu · Team ${TEAM.team} · VIT Vellore`, options: { x: X0, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: W - X0 - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: MUTED, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: GD }, objects: [] });

const tb = (o) => ({ isTextBox: true, margin: 0, valign: "top", color: INK, fontSize: 14, ...o });

function header(slide, n, kicker, title) {
  slide.addShape(pres.shapes.OVAL, { x: X0, y: 0.42, w: 0.42, h: 0.42, fill: { color: M }, line: { color: M }, objectName: "section-dot" });
  slide.addText(String(n), tb({ x: X0, y: 0.42, w: 0.42, h: 0.42, align: "center", valign: "middle", fontSize: 14, bold: true, color: GD }));
  slide.addText(kicker.toUpperCase(), tb({ x: X0 + 0.58, y: 0.42, w: 9, h: 0.42, valign: "middle", fontSize: 12, bold: true, color: G, charSpacing: 2 }));
  slide.addText(title, tb({ x: X0, y: 0.95, w: CW, h: 0.75, fontSize: 30, bold: true, valign: "middle" }));
}

function card(slide, x, y, w, h, fill = "F5F8F6") {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill } });
}

function dot(slide, x, y, label, d = 0.5, fill = G, color = WHITE, size = 14) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  slide.addText(String(label), tb({ x, y, w: d, h: d, align: "center", valign: "middle", fontSize: size, bold: true, color }));
}

function phone(slide, file, x, y, h) {
  const w = h * (720 / 1520);
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.15, fill: { color: INK }, line: { color: INK } });
  slide.addImage({ path: file, x, y, w, h, altText: path.basename(file, ".png") });
  return w;
}

const fmt = (n) => n.toLocaleString("en-IN");

// ---------- 1. Title ----------
{
  const s = pres.addSlide({ masterName: "DARK" });
  s.addText("ROUND 2 · " + TEAM.program.toUpperCase(), tb({ x: X0, y: 0.7, w: CW, h: 0.4, fontSize: 14, bold: true, color: M, charSpacing: 3 }));
  s.addText([
    { text: "Hunar Setu", options: { bold: true, fontSize: 60, color: WHITE, breakLine: true } },
    { text: "हुनर सेतु · a bridge from skill to livelihood", options: { fontSize: 24, color: "CFE6DA" } },
  ], tb({ x: X0, y: 1.5, w: CW, h: 1.9 }));
  s.addText("A voice-first, offline-first platform that carries a rural student from “what am I good at?” to money in their own bank account.",
    tb({ x: X0, y: 3.55, w: 9.2, h: 0.9, fontSize: 18, color: WHITE }));
  const rows = [["Program", `${TEAM.program}: ${TEAM.theme}`], ["Team", TEAM.team], ["College", TEAM.college]];
  rows.forEach(([k, v], i) => {
    s.addText(k.toUpperCase(), tb({ x: X0, y: 4.95 + i * 0.55, w: 1.6, h: 0.45, fontSize: 12, bold: true, color: M, valign: "middle" }));
    s.addText(v, tb({ x: X0 + 1.7, y: 4.95 + i * 0.55, w: 10.4, h: 0.45, fontSize: 16, color: WHITE, valign: "middle" }));
  });
  s.addNotes("0:00-0:15. Hunar Setu means 'bridge of skill'. We are Team Agent Smiths from VIT Vellore. One line: a voice-first, offline-first platform that takes a rural student from 'what am I good at' to money in their own account.");
}

// ---------- 2. Agenda ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 2, "Agenda", "Ten minutes, eight stops");
  const items = [
    ["Title", "0:15"], ["Agenda", "0:15"], ["Meet the team", "0:30"], ["Problem: goals, approach, success measures", "2:00"],
    ["Architecture, wireframe / POC, tech stack", "2:30"], ["Data points and live demo", "2:30"], ["Risks and challenges", "1:00"], ["Outcomes, benefits, impact, lessons", "1:00"],
  ];
  items.forEach(([label, time], i) => {
    const col = i < 4 ? 0 : 1;
    const x = X0 + col * 6.2;
    const y = 2.0 + (i % 4) * 1.1;
    card(s, x, y, 5.9, 0.85, i === 5 ? MS : "F5F8F6");
    dot(s, x + 0.2, y + 0.17, i + 1, 0.5, i === 5 ? M : G, i === 5 ? GD : WHITE);
    s.addText(label, tb({ x: x + 0.9, y: y + 0.1, w: 3.9, h: 0.65, valign: "middle", fontSize: 16, bold: true }));
    s.addText(time, tb({ x: x + 4.8, y: y + 0.1, w: 0.9, h: 0.65, valign: "middle", align: "right", fontSize: 14, color: MUTED }));
  });
  s.addText("Then 5 minutes of Q&A.", tb({ x: X0, y: 6.45, w: CW, h: 0.35, fontSize: 14, italic: true, color: MUTED }));
  s.addNotes("0:15-0:30. Eight stops, as in the Round 2 template. The demo is optional this round, but we will show it because the prototype runs.");
}

// ---------- 3. Meet the team ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 3, "Meet the team", `Team ${TEAM.team}`);
  const people = [...TEAM.members, { name: TEAM.mentor, role: "Mentor", mentor: true }];
  const w = 1.88, gap = (CW - 6 * w) / 5;
  people.forEach((p, i) => {
    const x = X0 + i * (w + gap);
    card(s, x, 2.0, w, 3.4, p.mentor ? MS : GS);
    const initials = p.mentor ? "M" : p.name.split(" ").filter((t) => t.length > 1).slice(0, 2).map((t) => t[0]).join("");
    dot(s, x + (w - 1.1) / 2, 2.35, initials, 1.1, p.mentor ? M : G, p.mentor ? GD : WHITE, 24);
    s.addText(p.name, tb({ x: x + 0.1, y: 3.65, w: w - 0.2, h: 0.85, align: "center", valign: "middle", fontSize: 16, bold: true }));
    s.addText(p.role, tb({ x: x + 0.1, y: 4.55, w: w - 0.2, h: 0.5, align: "center", fontSize: 13, color: p.mentor ? "8A5A12" : G, bold: true }));
  });
  s.addText(TEAM.college, tb({ x: X0, y: 5.85, w: CW, h: 0.4, fontSize: 16, color: MUTED }));
  s.addNotes("0:30-1:00. Introduce each member and our mentor.");
}

// ---------- 4a. Problem: six leaks ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 4, "Problem statement", "Rural learning leaks away before it becomes a livelihood");
  const leaks = [
    ["Aspiration", "Boys say army (13.8%) or police (13.6%); girls say teacher (16%) or doctor (14.8%). India lists ~3,600 occupations."],
    ["Literacy", "About 1 in 4 rural 14-18 year-olds cannot fluently read a Class 2 text. Every portal assumes they can."],
    ["Access", "49 internet subscriptions per 100 people in rural India vs 129 urban. Only 26.9% of girls own a smartphone."],
    ["Entitlement", "In one state audit, 2,41,870 of 3,12,823 post-matric scholarship accounts were not Aadhaar-seeded for DBT."],
    ["Trust", "467 Indians flown home from Myanmar's KK Park scam hub in Nov 2025. PMKVY placements found unverifiable."],
    ["Last mile", "Only ~1 in 5 PM Internship offers became a joining. Relocation, wages and family safety decide it."],
  ];
  const w = 3.9, h = 2.15, gx = (CW - 3 * w) / 2;
  leaks.forEach(([name, text], i) => {
    const x = X0 + (i % 3) * (w + gx);
    const y = 1.95 + Math.floor(i / 3) * (h + 0.25);
    card(s, x, y, w, h, i === 3 || i === 4 ? MS : "F5F8F6");
    dot(s, x + 0.25, y + 0.25, i + 1, 0.5, i === 3 || i === 4 ? M : G, i === 3 || i === 4 ? GD : WHITE);
    s.addText(`${name} leak`, tb({ x: x + 0.9, y: y + 0.25, w: w - 1.1, h: 0.5, valign: "middle", fontSize: 18, bold: true }));
    s.addText(text, tb({ x: x + 0.25, y: y + 0.9, w: w - 0.5, h: h - 1.05, fontSize: 14 }));
  });
  s.addText("Sources: ASER 2023 & 2024; NCO-2015; TRAI (June 2026); CAG state audit and Report 20 of 2025; MEA / Indian Embassy Bangkok; Business Standard (Sep 2026).",
    tb({ x: X0, y: 6.6, w: CW, h: 0.3, fontSize: 10, color: MUTED }));
  s.addNotes("1:00-2:00. The problem is not one gap but a pipeline with six leaks. Each one is measured. The two in marigold, entitlement and trust, are where money is lost or stolen, and almost no platform touches them.");
}

// ---------- 4b. Goals + approach ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 4, "Goals and approach", "The LLM converses; the graph decides");
  s.addText("GOALS", tb({ x: X0, y: 1.95, w: 4.6, h: 0.35, fontSize: 13, bold: true, color: G, charSpacing: 2 }));
  const goals = [
    ["Widen", "Every student hears at least 3 routes beyond army, police, teacher, doctor, by voice, in their language."],
    ["Land the money", "Every eligible rupee reaches the bank: eligibility, then paperwork, then DBT seeding."],
    ["Keep them safe", "Every offer can be checked for fraud; a placement counts only with proof of first pay."],
  ];
  goals.forEach(([k, v], i) => {
    const y = 2.4 + i * 1.4;
    dot(s, X0, y, i + 1, 0.5);
    s.addText(k, tb({ x: X0 + 0.7, y, w: 3.9, h: 0.4, fontSize: 17, bold: true }));
    s.addText(v, tb({ x: X0 + 0.7, y: y + 0.42, w: 3.9, h: 0.9, fontSize: 14, color: MUTED }));
  });

  const ax = 5.75;
  s.addText("APPROACH", tb({ x: ax, y: 1.95, w: 6.9, h: 0.35, fontSize: 13, bold: true, color: G, charSpacing: 2 }));
  const steps = [
    ["Discover", "Spoken profile; picture tasks prove skills; diversity-ruled shortlist from 35 NCO-2015 routes"],
    ["Learn", "Pathway with real courses and exams, one action this week, teacher modules offline"],
    ["Opportunity", "20 schemes as rules: “yes”, or “not yet, because X”, plus paperwork plan"],
    ["Connect & earn", "Openings, offer safety check, family cost and safety, signed proof"],
  ];
  const sw = 1.62, sg = (CW - (ax - X0) - 4 * sw) / 3;
  steps.forEach(([k, v], i) => {
    const x = ax + i * (sw + sg);
    card(s, x, 2.4, sw, 2.75, GS);
    s.addText(k, tb({ x: x + 0.12, y: 2.52, w: sw - 0.24, h: 0.6, fontSize: 15, bold: true, color: GD }));
    s.addText(v, tb({ x: x + 0.12, y: 3.12, w: sw - 0.24, h: 1.95, fontSize: 13 }));
    if (i < 3) s.addText("›", tb({ x: x + sw, y: 3.4, w: sg, h: 0.6, align: "center", valign: "middle", fontSize: 26, bold: true, color: M }));
  });
  card(s, ax, 5.4, CW - (ax - X0), 1.25, MS);
  s.addText([
    { text: "Claude talks with the student. ", options: { bold: true } },
    { text: "Every career, scheme and verdict comes from a deterministic engine over cited data, and the same engine runs on the phone with no network. A facilitator's laptop or Pi is the sync hub for a whole class." },
  ], tb({ x: ax + 0.2, y: 5.5, w: CW - (ax - X0) - 0.4, h: 1.05, fontSize: 14, valign: "middle" }));
  s.addNotes("2:00-2:45. Three goals. The approach follows the brief: Discover, Learn, Opportunity, Connect and earn. The key design choice is that the LLM never decides. It can only answer through tools that query our rules engine, so eligibility is testable and the same code runs offline on the phone.");
}

// ---------- 4c. Success measures ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 4, "Defined success measures", "Six metrics, and none of them counts downloads");
  const hdr = { bold: true, color: WHITE, fill: { color: G }, fontSize: 13 };
  const rows = [
    [{ text: "Metric", options: hdr }, { text: "Year-1 pilot target (3 districts)", options: hdr }, { text: "How the prototype measures it today", options: hdr }],
    ["1  Verified livelihood outcomes (north star)", "2,000 students in an apprenticeship, internship, job or enterprise", "Counts only with student-shared proof of first stipend, salary or EPF credit"],
    ["2  Rupees that landed", "Track every claimable rupee to the account", "Eligible now · one document away · DBT-seeding gaps, per cohort"],
    ["3  Aspiration widening index", "40+ distinct routes per 100 students (baseline under 10)", "Distinct chosen occupations per 100, girls reported separately"],
    ["4  Scams intercepted", "Every reported scam reaches every hub on next sync", "Reports, flagged numbers / links, districts warned"],
    ["5  Offer-to-joining rate", "Beat today's ~1 in 5, held at 90 days", "Asked → endorsed → joined funnel, split by gender"],
    ["6  Cost per outcome · earning facilitators", "Cost per outcome falls every quarter", "Module learners, certified completions, facilitator earnings"],
  ].map((r, i) => (i === 0 ? r : r.map((c, j) => ({ text: c, options: { fontSize: 13, bold: j === 0, color: INK, fill: { color: i % 2 ? "F5F8F6" : WHITE } } }))));
  s.addTable(rows, { x: X0, y: 1.95, w: CW, colW: [3.6, 3.9, 4.633], border: { type: "solid", pt: 0.75, color: LINE }, margin: [0.06, 0.1, 0.06, 0.1], valign: "middle", rowH: 0.58 });
  s.addText([
    { text: "Guardrail: ", options: { bold: true, color: GD } },
    { text: "over 60% of sessions finished with no live connection and over 99% sync success. All six are live in the facilitator's Impact screen and at GET /api/facilitator/impact." },
  ], tb({ x: X0, y: 6.2, w: CW, h: 0.6, fontSize: 14 }));
  s.addNotes("2:45-3:00. These are the six key metrics from our Round 1 canvas. What is new since Round 1: they are now computed live by the prototype, on the facilitator's Impact tab and over an API a funder or state can call.");
}

// ---------- 5a. Architecture ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 5, "Architecture", "One engine, two places: the phone and the hub");
  const box = (x, w, fill, title, lines) => {
    card(s, x, 1.95, w, 3.45, fill);
    s.addText(title, tb({ x: x + 0.2, y: 2.05, w: w - 0.4, h: 0.6, fontSize: 15, bold: true, color: GD, valign: "middle" }));
    s.addText(lines.map((l, i) => ({ text: l, options: { bullet: true, breakLine: i < lines.length - 1 } })),
      tb({ x: x + 0.2, y: 2.7, w: w - 0.4, h: 2.6, fontSize: 13, paraSpaceAfter: 4 }));
  };
  box(X0, 3.65, GS, "Student phone · PWA, offline-first", [
    "Preact UI, voice in and out, 4 languages",
    "shared/engine: careers, eligibility, paperwork, offer check, true cost",
    "Knowledge base bundled and precached",
    "IndexedDB: profiles, outbox, credentials",
    "Verifies credentials with WebCrypto",
  ]);
  box(5.3, 4.0, "F1F3F2", "Facilitator hub · laptop, Pi or state node", [
    "Express API with idempotent /api/sync",
    "Claude counsellor, tools into the same engine",
    "Cohort, endorse, modules, certify, impact",
    "Ed25519 did:key issuer for W3C VCs",
    "Partner API, Beckn /search, OpenAPI 3.1",
  ]);
  box(10.05, CW - (10.05 - X0), MS, "When signal appears", [
    "Claude API",
    "Bhashini / IndicConformer",
    "DigiLocker, NPCI mapper",
    "Sunbird RC, APAAR / ABC",
    "Beckn / ONEST gateway",
  ]);
  const arrow = (x1, x2, label) => {
    s.addShape(pres.shapes.LINE, { x: x1, y: 3.7, w: x2 - x1, h: 0, line: { color: M, width: 2.5, beginArrowType: "triangle", endArrowType: "triangle" } });
    s.addText(label, tb({ x: x1 - 0.1, y: 3.8, w: x2 - x1 + 0.2, h: 0.6, fontSize: 11, align: "center", color: MUTED }));
  };
  arrow(4.3, 5.25, "hotspot sync");
  arrow(9.35, 10.0, "online");
  const keys = [
    ["LLM converses, graph decides", "Claude has six tools and may not state a fact a tool did not return. No credentials: guided voice interview."],
    ["Rules as data", "Each scheme is typed conditions with source and date. A state fixes a rule without a release."],
    ["Sync that survives bad signal", "Every change is an op with an id; replays are harmless; unknown students retry."],
  ];
  const kw = (CW - 2 * 0.3) / 3;
  keys.forEach(([k, v], i) => {
    const x = X0 + i * (kw + 0.3);
    s.addText(k, tb({ x, y: 5.6, w: kw, h: 0.4, fontSize: 14, bold: true, color: G }));
    s.addText(v, tb({ x, y: 6.0, w: kw, h: 0.85, fontSize: 12, color: MUTED }));
  });
  s.addNotes("3:00-4:00. Left: the phone runs the whole engine offline. Middle: a facilitator's laptop or Raspberry Pi is the hub; phones sync over its hotspot with idempotent operations, so a dropped connection is harmless. Right: services we call when signal appears. Bhashini, DigiLocker, NPCI, Sunbird RC and APAAR are the production path; the prototype simulates them and says so.");
}

// ---------- 5b. Wireframe / POC ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 5, "Wireframe / POC", "A working prototype, not a mock-up");
  const shots = [
    ["02-discover-en", "Discover", "Routes marked “New for you”"],
    ["04-module-en", "Learn", "Teacher's module, certified"],
    ["09-money-ta", "Money (Tamil)", "₹ claimable, DBT check"],
    ["06-check-en", "Offer check", "Scam flagged by 2 people"],
    ["11-impact", "Facilitator", "Live impact metrics"],
  ];
  const h = 4.25, w = h * (720 / 1520), gap = (CW - 5 * w - 0.12 * 5) / 4;
  shots.forEach(([f, k, v], i) => {
    const x = X0 + 0.06 + i * (w + 0.12 + gap);
    phone(s, shot(f), x, 1.95, h);
    s.addText(k, tb({ x: x - 0.1, y: 6.3, w: w + 0.2, h: 0.32, align: "center", fontSize: 14, bold: true }));
    s.addText(v, tb({ x: x - 0.3, y: 6.6, w: w + 0.6, h: 0.3, align: "center", fontSize: 11, color: MUTED }));
  });
  s.addNotes("4:00-4:45. Real screenshots from the running PWA at phone size. Every card has a speaker button, every question a mic. The Tamil screen shows the same engine in another language. The last screen is the facilitator's Impact tab. Student names are synthetic, labelled 'demo'.");
}

// ---------- 5c. Tech stack ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 5, "Tech stack", "Open source, small, and standards-based");
  const groups = [
    ["Phone app", "Preact PWA · Vite · Workbox precache · IndexedDB (idb-keyval) · Web Speech API (hi, ta, kn, en)"],
    ["Hub", "Node 24 · Express 5 · zod validation · JSON store per hub, Postgres per state node in production"],
    ["AI", "Claude (claude-opus-5-5) with 6 tools into the engine · KB translation script · guided fallback with no AI"],
    ["Language", "UI and KB in 4 languages · production: Bhashini online, AI4Bharat IndicConformer (MIT) on the hub"],
    ["Trust & privacy", "W3C VC 2.0, EdDSA JWS, did:key · offline QR verification · scrypt / PBKDF2 PINs · DPDP Rules 2025 consent"],
    ["Interoperability", "REST + OpenAPI 3.1 · Beckn / ONEST-style /beckn/search · partner API for employers, NGOs, mentors"],
    ["Quality", "23 automated tests (engine + HTTP API) · KB integrity check · GitHub Actions CI on every push"],
    ["Licence", "MIT · occupations, schemes, courses, exams, scam patterns and translations are JSON a partner can edit"],
  ];
  const w = (CW - 0.3) / 2;
  groups.forEach(([k, v], i) => {
    const x = X0 + (i % 2) * (w + 0.3);
    const y = 1.95 + Math.floor(i / 2) * 1.2;
    card(s, x, y, w, 1.0, i % 3 === 0 ? GS : "F5F8F6");
    s.addText(k, tb({ x: x + 0.2, y: y + 0.12, w: 1.75, h: 0.76, valign: "middle", fontSize: 15, bold: true, color: GD }));
    s.addText(v, tb({ x: x + 2.0, y: y + 0.12, w: w - 2.2, h: 0.76, valign: "middle", fontSize: 13 }));
  });
  s.addNotes("4:45-5:30. Deliberately boring, open technology. The whole app precaches under 300 KB. Credentials are W3C standard and verify on the phone with no registry lookup. Everything a partner would change is JSON, checked by kb:check.");
}

// ---------- 6a. Data points ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 6, "Data points", "Measured on the prototype");
  const a = dp.aspiration, e = dp.eligibility, p = dp.performance, b = dp.bundle ?? { jsGzipKiB: 0, precacheKiB: 0 };
  const stats = [
    [`${b.precacheKiB} KB`, `whole app precached once (${b.jsGzipKiB} KB gzipped JS), then it works offline`],
    [`${p.fullEngineMsPerStudent.p50} ms`, "careers + 20 eligibility checks + paperwork plan per student, on the laptop (p50)"],
    [`${a.genderFlipIdenticalShortlist}%`, "of shortlists unchanged when we flip the student's gender: gender is never a ranking input"],
    [`${a.avgDistinctTracksInTop6.ours} vs ${a.avgDistinctTracksInTop6.plainRanking}`, "distinct career tracks in a 6-route shortlist, with our diversity rule vs plain ranking"],
    [`${a.occupationsSurfacedAcrossCohort} / ${dp.knowledgeBase.occupations}`, "occupations that reached at least one shortlist, so no route is a dead entry"],
    [`${Math.round(e.studentsWithAtLeastOneNearMiss)}%`, "of students have a scheme that is “one document away”, a no that becomes a to-do"],
  ];
  const w = 3.9, h = 2.05, gx = (CW - 3 * w) / 2;
  stats.forEach(([n, l], i) => {
    const x = X0 + (i % 3) * (w + gx);
    const y = 1.95 + Math.floor(i / 3) * (h + 0.25);
    card(s, x, y, w, h, i < 3 ? GS : "F5F8F6");
    s.addText(n, tb({ x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.8, fontSize: 36, bold: true, color: G, valign: "middle" }));
    s.addText(l, tb({ x: x + 0.25, y: y + 1.05, w: w - 0.5, h: 0.9, fontSize: 13 }));
  });
  s.addText(`Engine figures: ${fmt(dp.cohort)} synthetic student profiles, fixed seed, reproducible with npm run data:points. Not field data. A low-end phone is several times slower than the laptop.`,
    tb({ x: X0, y: 6.6, w: CW, h: 0.3, fontSize: 10, color: MUTED }));
  s.addNotes("5:30-6:15. Every number here comes out of a script in the repo, run on the real engine over a thousand synthetic students. We say 'synthetic' on purpose: field numbers come from the pilot. The same script found a bug: we were adding up scholarships a student cannot hold together. We fixed it, and the app now counts one central scholarship and one placement at a time.");
}

// ---------- 6b. Demo ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 6, "Live demo", "Three minutes on a phone-sized screen");
  const steps = [
    "Open in Hindi, give consent with the guardian box, set a PIN",
    "Answer by voice or tap: six routes, at least three “new for you”",
    "Do the circuit puzzle; open Electrician: steps, this week's action, teacher's module",
    "Money for me: eligible now, “not yet, because X”, paperwork plan, DBT check",
    "Offer check on a Bangkok “data entry” job: danger, report it to the network",
    "Airplane mode, reload: eligibility and offer check still work",
    "Facilitator: endorse a student, certify a module, open Impact",
  ];
  steps.forEach((t, i) => {
    const y = 1.95 + i * 0.66;
    dot(s, X0, y + 0.04, i + 1, 0.46, i === 5 ? M : G, i === 5 ? GD : WHITE, 13);
    s.addText(t, tb({ x: X0 + 0.65, y, w: 6.6, h: 0.56, valign: "middle", fontSize: 15 }));
  });
  phone(s, shot("06-check-en"), 8.05, 1.95, 4.5);
  phone(s, shot("10-cohort"), 10.45, 1.95, 4.5);
  s.addText("Backup if the network fails: the same flow runs from the hub on a laptop hotspot (npm run hub, then npm run seed:demo).",
    tb({ x: X0, y: 6.6, w: CW, h: 0.3, fontSize: 11, color: MUTED }));
  s.addNotes("6:15-8:00. Live demo. If the venue network is bad, that is the point: run the hub on the laptop, connect the phone to its hotspot, and the demo is identical. seed:demo fills a synthetic cohort so the facilitator screens have data.");
}

// ---------- 7. Risks ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 7, "Risks and challenges", "What could go wrong, and what we already do about it");
  const hdr = { bold: true, color: WHITE, fill: { color: G }, fontSize: 13 };
  const rows = [
    ["AI invents a scheme or a verdict", "Claude can only answer through tools over cited data; unknown fields give “unknown” plus a question, never a guess"],
    ["Scheme rules go stale", "Rules are data with source and as-of date; kb:check guards every edit; a state corrects a rule without an app release"],
    ["Speech fails on dialects or low literacy", "Tap-only answers and picture tasks everywhere; production adds Bhashini online and IndicConformer on the hub"],
    ["Minors' data on shared phones (DPDP Rules 2025)", "PINs hashed on the device and never synced; guardian consent; no ads or analytics; Impact shows aggregates only"],
    ["Fake certificates and fake placements", "Hub-signed W3C credentials verify offline; module credits need the teacher to certify; placements need proof of first pay"],
    ["Adoption and facilitator burn-out", "Facilitators earn from their own modules; reach through schools, ITIs and CSCs; one teacher runs a whole cohort"],
  ].map((r, i) => r.map((c, j) => ({ text: c, options: { fontSize: 13, bold: j === 0, color: j === 0 ? GD : INK, fill: { color: i % 2 ? WHITE : "F5F8F6" } } })));
  s.addTable([[{ text: "Risk", options: hdr }, { text: "Mitigation in the prototype", options: hdr }], ...rows],
    { x: X0, y: 1.95, w: CW, colW: [3.9, 8.233], border: { type: "solid", pt: 0.75, color: LINE }, margin: [0.06, 0.12, 0.06, 0.12], valign: "middle", rowH: 0.6 });
  s.addText([
    { text: "Challenges we hit: ", options: { bold: true, color: GD } },
    { text: "sync ordering when a phone queued a task before its profile (fixed: profiles first, unknown students retry); an unauthenticated route that could mint module credentials (fixed: teacher certification); over-counted scheme money (fixed: non-stacking rule)." },
  ], tb({ x: X0, y: 6.3, w: CW, h: 0.6, fontSize: 13 }));
  s.addNotes("8:00-9:00. Six risks, each with a mitigation that already exists in code, not a promise. And three real challenges we hit, all with tests now.");
}

// ---------- 8. Outcomes ----------
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  header(s, 8, "Outcomes, benefits, impact, lessons learnt", "What we built, who gains, and what we learnt");
  const quads = [
    ["Outcomes", GS, [
      "Working PWA in Hindi, Tamil, Kannada and English",
      "Six student flows, facilitator console, Impact tab",
      `${dp.knowledgeBase.occupations} occupations, ${dp.knowledgeBase.schemes} schemes, ${dp.knowledgeBase.courses} courses, ${dp.knowledgeBase.exams} exams, all cited`,
      "OpenAPI, Beckn search, partner API; 23 tests and CI",
    ]],
    ["Benefits", "F5F8F6", [
      "Students: wider routes, money, safety, portable proof",
      "Families: true monthly cost and a safety score",
      "Facilitators: talent spotting and their own income",
      "Employers and states: verified pipeline, scheme integrity",
    ]],
    ["Impact (Year-1 pilot targets)", MS, [
      "2,000 verified livelihoods across 3 districts",
      "Aspiration widening index from under 10 to 40+",
      "Offer-to-joining above today's 1 in 5, girls tracked",
      "Every reported scam on every hub at next sync",
    ]],
    ["Lessons learnt", "F5F8F6", [
      "Let the LLM talk, never decide: it made answers testable",
      "Offline-first is a design choice, not a cache",
      "Measure outcomes in the product, not in a report",
      "Run your own numbers: ours caught a money bug",
    ]],
  ];
  const w = (CW - 0.3) / 2, h = 2.25;
  quads.forEach(([title, fill, items], i) => {
    const x = X0 + (i % 2) * (w + 0.3);
    const y = 1.95 + Math.floor(i / 2) * (h + 0.25);
    card(s, x, y, w, h, fill);
    s.addText(title, tb({ x: x + 0.25, y: y + 0.15, w: w - 0.5, h: 0.45, fontSize: 17, bold: true, color: GD }));
    s.addText(items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
      tb({ x: x + 0.25, y: y + 0.7, w: w - 0.5, h: h - 0.8, fontSize: 15, paraSpaceAfter: 5 }));
  });
  s.addNotes("9:00-10:00. Close on the lessons. The biggest one: keeping the LLM out of decisions is what let us test the product and run it offline. Then hand over to Q&A.");
}

// ---------- Close ----------
{
  const s = pres.addSlide({ masterName: "DARK" });
  s.addText("Thank you", tb({ x: X0, y: 1.6, w: CW, h: 1.2, fontSize: 56, bold: true, color: WHITE }));
  s.addText("Questions for the next five minutes.", tb({ x: X0, y: 2.85, w: CW, h: 0.6, fontSize: 22, color: "CFE6DA" }));
  s.addText([
    { text: "Code (MIT)  ", options: { bold: true, color: M } },
    { text: TEAM.repo, options: { color: WHITE, breakLine: true } },
    { text: "Run it  ", options: { bold: true, color: M } },
    { text: "npm install && npm run dev", options: { color: WHITE, fontFace: "Courier New" } },
  ], tb({ x: X0, y: 4.3, w: CW, h: 1.0, fontSize: 16, paraSpaceAfter: 6 }));
  s.addText(`Team ${TEAM.team} · ${TEAM.college}`, tb({ x: X0, y: 6.3, w: CW, h: 0.4, fontSize: 14, color: "CFE6DA" }));
  s.addNotes("Q&A. Likely questions and answers are in docs/round2/README.md.");
}

// pptxgenjs writes folder entries into the zip, which some cloud viewers refuse.
(async () => {
  await pres.writeFile({ fileName: OUT });
  const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  // delete the entry itself: zip.remove() on a folder would drop everything inside it
  for (const n of Object.keys(zip.files)) if (zip.files[n].dir) delete zip.files[n];
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote", OUT);
})();
