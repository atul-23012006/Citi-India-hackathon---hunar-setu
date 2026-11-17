// Validates cross-references in the knowledge base. Run: npm run kb:check
// Partners (states, NGOs) edit JSON, not code; this keeps their edits safe.
import { kb } from "../shared/kb/index.ts";

const errors: string[] = [];
const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
const courses = ids(kb.courses), exams = ids(kb.exams), schemes = ids(kb.schemes), occs = ids(kb.occupations);
const docs = new Set(kb.docs.map((d) => d.key));

for (const list of [kb.occupations, kb.schemes, kb.courses, kb.exams, kb.opportunities]) {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.id)) errors.push(`duplicate id ${x.id}`);
    seen.add(x.id);
  }
}
for (const o of kb.occupations) {
  if (!/^\d{4}$/.test(o.nco)) errors.push(`${o.id}: NCO unit group must be 4 digits`);
  if (!o.sources.length) errors.push(`${o.id}: no source`);
  for (const l of ["hi", "ta", "kn"] as const) if (!o.name[l] || !o.summary[l]) errors.push(`${o.id}: missing ${l} translation`);
  for (const s of o.steps) {
    if (s.courseId && !courses.has(s.courseId)) errors.push(`${o.id}: unknown course ${s.courseId}`);
    for (const l of ["hi", "ta", "kn"] as const) if (!s.label[l]) errors.push(`${o.id}: step "${s.label.en}" missing ${l} (run npm run kb:translate)`);
  }
  for (const e of o.exams) if (!exams.has(e)) errors.push(`${o.id}: unknown exam ${e}`);
  for (const s of o.schemes) if (!schemes.has(s)) errors.push(`${o.id}: unknown scheme ${s}`);
}
for (const d of kb.docs) for (const l of ["hi", "ta", "kn"] as const) if (!d.howTo[l]) errors.push(`doc ${d.key}: howTo missing ${l}`);
for (const s of kb.schemes) {
  if (!s.sources.length) errors.push(`${s.id}: no source`);
  for (const c of s.conditions) if (c.kind === "doc" && !docs.has(c.doc)) errors.push(`${s.id}: unknown doc ${c.doc}`);
}
for (const o of kb.opportunities) {
  if (o.demo !== true) errors.push(`${o.id}: prototype listings must be marked demo`);
  for (const id of o.occupationIds) if (!occs.has(id)) errors.push(`${o.id}: unknown occupation ${id}`);
  for (const id of o.schemeIds) if (!schemes.has(id)) errors.push(`${o.id}: unknown scheme ${id}`);
}

const counts = Object.entries(kb).map(([k, v]) => `${v.length} ${k}`).join(", ");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`KB OK: ${counts}`);
