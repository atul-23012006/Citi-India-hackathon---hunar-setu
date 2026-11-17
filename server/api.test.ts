import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// End-to-end over HTTP against a throwaway hub. The store reads HUB_DATA_DIR at
// import time, so set it before loading the app.
const dir = mkdtempSync(join(tmpdir(), "hunar-hub-"));
process.env.HUB_DATA_DIR = dir;
delete process.env.ANTHROPIC_API_KEY;
const { app } = await import("./app.ts");

let server: Server;
let base = "";
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (path: string, body?: unknown, token?: string) => {
  const res = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text };
};

let n = 0;
const op = (kind: string, payload: Record<string, unknown>) => ({ opId: `op-${++n}-${kind}`, kind, payload, at: new Date().toISOString() });
const student = (id: string, extra: Record<string, unknown> = {}) => ({
  id, name: id, lang: "en", interests: ["hands_on"], skills: [], demonstrated: [], docs: {}, updatedAt: new Date().toISOString(), ...extra,
});

test("sync is idempotent and never stores the PIN hash", async () => {
  const o = op("student_upsert", student("s-a", { pinHash: "salt:secret", gender: "female" }));
  const first = await call("/api/sync", { deviceId: "dev-1", studentIds: ["s-a"], ops: [o] });
  assert.deepEqual(first.body.applied, [o.opId]);
  const again = await call("/api/sync", { deviceId: "dev-1", studentIds: ["s-a"], ops: [o] });
  assert.deepEqual(again.body.applied, [o.opId], "replay after a dropped connection is acknowledged, not re-applied");
  const { db } = await import("./store.ts");
  assert.equal(db.students["s-a"].pinHash, undefined);
});

test("an op for a student the hub has not seen is kept for retry", async () => {
  const o = op("task_result", { studentId: "s-unknown", task: "circuit", score: 0.9, label: "Circuit" });
  const r = await call("/api/sync", { deviceId: "dev-1", ops: [o] });
  assert.deepEqual(r.body.applied, []);
});

let token = "";
test("facilitator names are unique, and wrong PINs lock the name", async () => {
  const reg = await call("/api/facilitator/register", { name: "Meena", pin: "4821", district: "Vellore", state: "TN" });
  assert.equal(reg.status, 200);
  token = reg.body.token;
  assert.equal((await call("/api/facilitator/register", { name: "meena", pin: "1111", district: "Vellore", state: "TN" })).status, 409);

  await call("/api/facilitator/register", { name: "Ravi", pin: "1234", district: "Vellore", state: "TN" });
  for (let i = 0; i < 5; i++) assert.equal((await call("/api/facilitator/login", { name: "Ravi", pin: "0000" })).status, 401);
  assert.equal((await call("/api/facilitator/login", { name: "Ravi", pin: "1234" })).status, 429, "even the right PIN waits out the lock");
  assert.equal((await call("/api/facilitator/login", { name: "Meena", pin: "4821" })).status, 200, "other names are unaffected");
});

test("module completion needs the module's facilitator to certify it", async () => {
  const m = await call("/api/facilitator/modules", { title: "Safe wiring", occupationId: "electrician", lang: "en", lessons: [{ title: "Earthing", text: "Why the third pin matters." }], pricing: { model: "per_module", rupees: 49 } }, token);
  const id = m.body.id;

  // The old unauthenticated route that signed credentials for anyone is gone.
  assert.equal((await call(`/api/modules/${id}/complete`, { studentId: "s-a" })).status, 404);
  assert.equal((await call(`/api/facilitator/modules/${id}/certify`, { studentId: "s-a" })).status, 401);
  assert.equal((await call(`/api/facilitator/modules/${id}/certify`, { studentId: "s-a" }, token)).status, 409, "not finished yet");

  const sync = await call("/api/sync", { deviceId: "dev-1", studentIds: ["s-a"], ops: [op("module_enroll", { studentId: "s-a", moduleId: id }), op("module_complete", { studentId: "s-a", moduleId: id })] });
  assert.equal(sync.body.applied.length, 2);
  assert.ok(sync.body.modules[0].lessons, "lessons reach the phone for offline reading");
  assert.equal(sync.body.modules[0].learners, undefined, "learner lists stay on the hub");

  const list = await call("/api/facilitator/modules", undefined, token);
  assert.deepEqual(list.body[0].pending, [{ studentId: "s-a", name: "s-a" }]);
  assert.equal(list.body[0].earningsRupees, 49);

  const ravi = (await call("/api/facilitator/register", { name: "Ravi Two", pin: "5555", district: "Vellore", state: "TN" })).body.token;
  assert.equal((await call(`/api/facilitator/modules/${id}/certify`, { studentId: "s-a" }, ravi)).status, 404, "another facilitator cannot certify");

  const ok = await call(`/api/facilitator/modules/${id}/certify`, { studentId: "s-a" }, token);
  assert.equal(ok.status, 200);
  const v = await call("/api/credentials/verify", { jws: ok.body.jws });
  assert.equal(v.body.valid, true);
  assert.equal(v.body.credential.credentialSubject.achievement.type, "ModuleCompletion");
});

test("impact report counts outcomes by gender, without names", async () => {
  await call("/api/sync", {
    deviceId: "dev-2",
    ops: [
      op("student_upsert", student("s-b", { gender: "male", chosenOccupation: "army-agniveer" })),
      op("request", { studentId: "s-a", opportunityId: "opp-solar-vlr" }),
      op("request", { studentId: "s-b", opportunityId: "opp-solar-vlr" }),
      op("outcome", { studentId: "s-a", opportunityId: "opp-solar-vlr", proof: "stipend_credit" }),
      op("scam_report", { text: "Data entry job in Thailand, pay Rs 50000 fee, call +66 812345678", district: "Vellore" }),
    ],
  });
  const r = await call("/api/facilitator/impact", undefined, token);
  assert.equal(r.status, 200);
  assert.equal(r.body.reach.students, 2);
  assert.equal(r.body.offerToJoining.female.requested, 1);
  assert.equal(r.body.offerToJoining.male.joined, 0);
  assert.ok(r.body.scams.reports >= 1);
  assert.equal(r.body.facilitators.completionsCertified, 1);
  assert.ok(!JSON.stringify(r.body).includes("s-a"), "no student ids in the report");
  assert.equal((await call("/api/facilitator/impact")).status, 401);
});
