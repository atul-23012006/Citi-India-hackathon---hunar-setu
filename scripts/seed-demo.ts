// Fill a running hub with a synthetic demo cohort, so the facilitator console
// and Impact screen have something to show. Every name is fictional and every
// listing is already labelled "demo". Talks to the hub over its public API only.
//
//   npm run dev  (or npm run hub)   then   node scripts/seed-demo.ts [hubUrl]
//
// Facilitator login afterwards: name "Demo Facilitator", PIN 2468.

const HUB = process.argv[2] ?? "http://localhost:8787";

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const uid = () => crypto.randomUUID();

async function call(path: string, body?: unknown, token?: string) {
  const res = await fetch(HUB + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const GIRLS = ["Meena", "Kavya", "Priya", "Lakshmi", "Divya", "Anitha", "Sangeetha", "Fathima", "Revathi", "Pooja", "Nandini", "Asha"];
const BOYS = ["Arun", "Karthik", "Ravi", "Suresh", "Imran", "Vijay", "Manoj", "Prakash", "Dinesh", "Sathish", "Rahul", "Ganesh"];
const DISTRICTS = ["Vellore", "Tiruvannamalai", "Krishnagiri"];
const ROUTES = ["solar-pv-technician", "electrician", "general-duty-assistant", "mobile-repair", "tailor-designer", "ev-mechanic", "accounts-assistant", "drone-pilot", "anganwadi-ecce", "csc-vle", "dairy-entrepreneur", "army-agniveer", "school-teacher", "police-constable"];
const INTERESTS = ["hands_on", "nature", "caring", "numbers", "creative", "talking", "computers", "uniform", "cooking"];

async function main() {
  const status = await call("/api/status").catch(() => null);
  if (!status) throw new Error(`No hub at ${HUB}. Start it with npm run dev first.`);

  let f = await call("/api/facilitator/register", { name: "Demo Facilitator", pin: "2468", district: "Vellore", state: "TN" });
  if (f.status === 409) f = await call("/api/facilitator/login", { name: "Demo Facilitator", pin: "2468" });
  const token: string = f.data.token;

  const now = new Date().toISOString();
  const students = Array.from({ length: 36 }, (_, i) => {
    const girl = i % 2 === 0;
    const age = 15 + Math.floor(rnd() * 7);
    return {
      id: `s-demo-${i}`, name: `${pick(girl ? GIRLS : BOYS)} (demo)`, lang: pick(["hi", "ta", "kn", "en"]), age,
      gender: girl ? "female" : "male", education: age < 16 ? "class10" : age < 18 ? "class12" : pick(["iti", "class12", "ug"]),
      inEducation: age < 19, state: "TN", district: pick(DISTRICTS), category: pick(["GEN", "OBC", "OBC", "SC", "ST"]),
      familyIncome: pick([90000, 150000, 240000]), interests: [pick(INTERESTS), pick(INTERESTS)], skills: [], demonstrated: [],
      chosenOccupation: pick(ROUTES), consent: { at: now, guardian: age < 18 },
      docs: { aadhaar: true, bank_account: rnd() < 0.8, aadhaar_seeded: rnd() < 0.55, income_cert: rnd() < 0.5, caste_cert: rnd() < 0.6, marksheet_10: true },
      updatedAt: now,
    };
  });
  const op = (kind: string, payload: Record<string, unknown>) => ({ opId: uid(), kind, payload, at: now });
  // Half the cohort did the circuit puzzle on their phones.
  const did = new Set(students.filter(() => rnd() < 0.5).map((s) => s.id));
  for (const s of students) if (did.has(s.id)) (s.demonstrated as unknown[]).push({ task: "hands_on", score: 0.8, at: now });

  const ops = [
    ...students.map((s) => op("student_upsert", s)),
    ...students.filter((s) => did.has(s.id)).map((s) => op("task_result", { studentId: s.id, task: "circuit", score: 0.7 + rnd() * 0.3, label: "Circuit puzzle" })),
    ...students.slice(0, 20).map((s) => op("request", { studentId: s.id, opportunityId: pick(["opp-solar-vlr", "opp-garment-krg", "opp-ev-hosur"]) })),
    op("scam_report", { text: "Data entry job in Bangkok. Pay Rs 30000 processing fee. Call +66 812345678", district: "Vellore" }),
    op("scam_report", { text: "Data entry job in Bangkok. Pay Rs 30000 processing fee. Call +66 812345678", district: "Krishnagiri" }),
    op("scam_report", { text: "Work from home, like videos and earn daily. Telegram t.me/easyjobs-demo", district: "Tiruvannamalai" }),
  ];
  const sync = await call("/api/sync", { deviceId: "seed-demo", studentIds: students.map((s) => s.id), ops });
  console.log(`synced ${sync.data.applied?.length ?? 0} ops`);

  // Endorse some requests, then record joinings with proof of first pay.
  const requests = students.slice(0, 20).map((s) => ({ s, opp: ops.find((o) => o.kind === "request" && o.payload.studentId === s.id)!.payload.opportunityId as string }));
  for (const { s, opp } of requests.slice(0, 12)) await call("/api/facilitator/endorse", { studentId: s.id, opportunityId: opp, note: "Showed up to every session" }, token);
  const outcomes = requests.slice(0, 7).map(({ s, opp }) => op("outcome", { studentId: s.id, opportunityId: opp, proof: pick(["stipend_credit", "epf_credit"]) }));

  // A paid module, some learners, some finished and certified.
  const m = await call("/api/facilitator/modules", {
    title: "Safe house wiring basics", occupationId: "electrician", lang: "ta",
    lessons: [{ title: "Earthing", text: "Why the third pin matters." }, { title: "MCB", text: "What trips, and why." }],
    pricing: { model: "per_module", rupees: 49 },
  }, token);
  const learners = students.slice(10, 28);
  const moduleOps = learners.flatMap((s, i) => [op("module_enroll", { studentId: s.id, moduleId: m.data.id }), ...(i < 10 ? [op("module_complete", { studentId: s.id, moduleId: m.data.id })] : [])]);
  await call("/api/sync", { deviceId: "seed-demo", studentIds: students.map((s) => s.id), ops: [...outcomes, ...moduleOps] });
  for (const s of learners.slice(0, 6)) await call(`/api/facilitator/modules/${m.data.id}/certify`, { studentId: s.id }, token);

  const impact = await call("/api/facilitator/impact", undefined, token);
  console.log(JSON.stringify(impact.data, null, 2));
  console.log('\nSign in as facilitator "Demo Facilitator", PIN 2468.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
