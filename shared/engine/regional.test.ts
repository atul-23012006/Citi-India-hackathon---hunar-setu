import { test } from "node:test";
import assert from "node:assert/strict";
import { kb } from "../kb/index.ts";
import { STATES, stateCode } from "../geo.ts";
import { clustersFor, msme, rankRegional, searchTerms, SEARCH_TERM } from "./regional.ts";

const vellore = { state: "TN", district: "Vellore" };

test("openings in the student's own district rank first", () => {
  const r = rankRegional(kb.opportunities, vellore, { interests: ["hands_on"], education: "class10" });
  assert.equal(r[0].opportunity.district, "Vellore");
  assert.ok(r[0].reasons.includes("same_district"));
  assert.ok(r.every((m) => m.opportunity.state === "TN" || m.opportunity.hostel), "out-of-state only with a hostel");
});

test("a student who can't move sees nothing outside their state", () => {
  const r = rankRegional(kb.opportunities, { state: "KA", district: "Mysuru" }, { canRelocate: false });
  assert.ok(r.every((m) => m.opportunity.state === "KA"));
});

test("unknown education doesn't push openings down; a known gap does", () => {
  const unknown = rankRegional(kb.opportunities, vellore, {});
  assert.ok(unknown.every((m) => m.eligibleNow));
  const class8 = rankRegional(kb.opportunities, vellore, { education: "class8" });
  const iti = class8.find((m) => m.opportunity.minEducation === "iti");
  if (iti) assert.ok(iti.reasons.includes("needs_education") && !iti.eligibleNow);
});

test("a cluster only explains an opening in its own district", () => {
  for (const m of rankRegional(kb.opportunities, vellore, { interests: ["hands_on", "creative"] })) {
    if (!m.cluster) continue;
    const c = msme.states.TN.clusters.find((x) => x.name === m.cluster)!;
    assert.equal(c.district.toLowerCase(), m.opportunity.district.toLowerCase(), `${m.opportunity.id} tagged with ${m.cluster}`);
  }
});

test("search terms: the student's words, then their career, then interests", () => {
  assert.deepEqual(searchTerms({ chosenOccupation: "nurse" }, vellore, "hospital"), ["hospital", "staff nurse"]);
  const t = searchTerms({ interests: ["cooking"] }, vellore);
  assert.ok(t.includes("cook") || t.includes("food processing"));
  assert.ok(searchTerms({}, { state: "TN", district: "Tiruppur" }).includes("tailor"), "with nothing to go on, ask what the local cluster hires for");
  assert.deepEqual(searchTerms({}, vellore), ["apprentice"], "another district's cluster is no hint");
  assert.ok(t.length <= 3);
});

test("the home district's clusters come first", () => {
  const c = clustersFor({ state: "TN", district: "Tiruppur District" });
  assert.equal(c[0].name, "Tiruppur knitwear");
  assert.ok(c[0].inDistrict);
  assert.deepEqual(clustersFor({ state: "SK" }), []);
});

test("MSME data points at real careers, states and schemes", () => {
  const occs = new Set(kb.occupations.map((o) => o.id));
  const schemes = new Set(kb.schemes.map((s) => s.id));
  for (const [code, st] of Object.entries(msme.states)) {
    assert.ok(STATES.some((s) => s.code === code), `unknown state ${code}`);
    for (const c of st.clusters) for (const id of c.occupations) assert.ok(occs.has(id), `${c.name}: unknown occupation ${id}`);
  }
  for (const s of msme.supports) if (s.schemeId) assert.ok(schemes.has(s.schemeId), `${s.id}: unknown scheme ${s.schemeId}`);
  for (const id of occs) assert.ok(SEARCH_TERM[id], `no job-board search term for ${id}`);
});

test("state names from India Post and OpenStreetMap map to codes", () => {
  assert.equal(stateCode("Tamil Nadu"), "TN");
  assert.equal(stateCode("ODISHA"), "OD");
  assert.equal(stateCode("Orissa"), "OD");
  assert.equal(stateCode("Jammu & Kashmir"), "JK");
  assert.equal(stateCode("Dadra & Nagar Haveli and Daman & Diu"), "DN");
  assert.equal(stateCode("Atlantis"), undefined);
});
