// OpenAPI 3.1 description of the hub API, served at /api/openapi.json.
const profileRef = { $ref: "#/components/schemas/StudentProfile" };
const json = (schema: object) => ({ content: { "application/json": { schema } } });

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Hunar Setu Hub API",
    version: "0.1.0",
    description:
      "Open APIs for colleges, employers, NGOs and state systems to plug into Hunar Setu. Eligibility, career ranking and offer checks are deterministic and cite their sources. Licensed MIT.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/status": { get: { summary: "Hub status, AI availability and issuer DID", responses: { 200: { description: "OK" } } } },
    "/api/kb": { get: { summary: "Full knowledge base: occupations (NCO-2015), schemes with eligibility rules, courses, exams, documents, opportunities, scam reports", responses: { 200: { description: "OK" } } } },
    "/api/eligibility": {
      post: {
        summary: "Run every scheme's eligibility rules for a profile",
        description: "Returns eligible / near_miss / unknown / not_eligible per scheme, with the condition that decided it, the missing documents, a paperwork plan and the source.",
        requestBody: json({ type: "object", properties: { profile: profileRef }, required: ["profile"] }),
        responses: { 200: { description: "Eligibility results" } },
      },
    },
    "/api/careers": {
      post: { summary: "Rank occupations for a profile (diversity rule applied)", requestBody: json({ type: "object", properties: { profile: profileRef } }), responses: { 200: { description: "Ranked occupations" } } },
    },
    "/api/offer-check": {
      post: {
        summary: "Check a job or training offer for fraud signals",
        requestBody: json({ type: "object", properties: { text: { type: "string" }, lang: { type: "string", enum: ["en", "hi", "ta", "kn"] } }, required: ["text"] }),
        responses: { 200: { description: "Verdict (danger / caution / ok) with flags" } },
      },
    },
    "/api/scam-reports": { post: { summary: "Report a scam offer; phone numbers, URLs and handles are shared across the network", requestBody: json({ type: "object", properties: { text: { type: "string" }, district: { type: "string" } } }), responses: { 200: { description: "Recorded" } } } },
    "/api/chat": {
      post: {
        summary: "AI counsellor turn (Claude). Returns reply text, profile updates and UI cards. 503 with fallback=guided when AI is unavailable.",
        requestBody: json({ type: "object", properties: { sessionId: { type: "string" }, text: { type: "string" }, profile: profileRef }, required: ["sessionId", "text", "profile"] }),
        responses: { 200: { description: "Reply" }, 503: { description: "AI unavailable; use guided mode" } },
      },
    },
    "/api/sync": {
      post: {
        summary: "Offline-first sync. Devices push an outbox of idempotent ops and pull network updates since a cursor.",
        requestBody: json({
          type: "object",
          properties: {
            deviceId: { type: "string" }, since: { type: "integer" }, studentIds: { type: "array", items: { type: "string" } },
            ops: { type: "array", items: { type: "object", properties: { opId: { type: "string" }, kind: { type: "string", enum: ["student_upsert", "request", "scam_report", "outcome", "task_result", "module_enroll", "module_complete"] }, payload: { type: "object" }, at: { type: "string" } } } },
          },
        }),
        responses: { 200: { description: "Applied op ids, cursor, credentials, requests, scam reports, partner opportunities" } },
      },
    },
    "/api/credentials/verify": { post: { summary: "Verify a Talent Passport credential (W3C VC 2.0, EdDSA JWS, did:key issuer)", requestBody: json({ type: "object", properties: { jws: { type: "string" } } }), responses: { 200: { description: "valid / invalid with reason" } } } },
    "/api/partners/opportunities": {
      post: {
        summary: "Employer / NGO / mentor posts an opportunity (header X-Partner-Key). Starts unverified.",
        parameters: [{ name: "X-Partner-Key", in: "header", required: true, schema: { type: "string" } }],
        requestBody: json({ $ref: "#/components/schemas/OpportunityInput" }),
        responses: { 201: { description: "Created" }, 401: { description: "Bad partner key" } },
      },
    },
    "/api/facilitator/register": { post: { summary: "Register a facilitator (name, PIN, district, state)", responses: { 200: { description: "Token" } } } },
    "/api/facilitator/login": { post: { summary: "Facilitator login with name and PIN", responses: { 200: { description: "Token" } } } },
    "/api/facilitator/cohort": { get: { summary: "Cohort with top careers, eligibility, missing documents and talent signals", security: [{ bearer: [] }], responses: { 200: { description: "Students" } } } },
    "/api/facilitator/endorse": { post: { summary: "Endorse a student (optionally for an opportunity); issues a credential", security: [{ bearer: [] }], responses: { 200: { description: "JWS credential" } } } },
    "/api/facilitator/modules": {
      get: { summary: "My training modules with learners and earnings", security: [{ bearer: [] }], responses: { 200: { description: "Modules" } } },
      post: { summary: "Create a module: free, per-module price or subscription", security: [{ bearer: [] }], responses: { 200: { description: "Module" } } },
    },
    "/api/facilitator/modules/{id}/certify": { post: { summary: "Certify a student's module completion (recorded via sync); issues a ModuleCompletion credential. Module owner only.", security: [{ bearer: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: json({ type: "object", properties: { studentId: { type: "string" } } }), responses: { 200: { description: "JWS credential" }, 409: { description: "Student has not finished the module" } } } },
    "/api/facilitator/impact": { get: { summary: "Key metrics (aggregates only): verified outcomes, rupees claimable, aspiration widening, scams intercepted, offer-to-joining by gender, earning facilitators", security: [{ bearer: [] }], responses: { 200: { description: "Impact report" } } } },
    "/beckn/search": { post: { summary: "Beckn / ONEST-style search; replies with on_search catalogue of opportunities", responses: { 200: { description: "on_search" } } } },
  },
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    schemas: {
      StudentProfile: {
        type: "object",
        required: ["id", "lang", "updatedAt"],
        properties: {
          id: { type: "string" }, name: { type: "string" }, lang: { type: "string", enum: ["en", "hi", "ta", "kn"] }, age: { type: "integer" },
          gender: { type: "string", enum: ["female", "male", "other"] },
          education: { type: "string", enum: ["class8", "class9", "class10", "class11", "class12", "iti", "diploma", "ug", "pg"] },
          inEducation: { type: "boolean" }, marksPercent: { type: "number" }, state: { type: "string", description: "2-letter code" },
          category: { type: "string", enum: ["GEN", "EWS", "OBC", "SC", "ST"] }, minority: { type: "boolean" }, disabilityPercent: { type: "number" },
          familyIncome: { type: "integer", description: "Annual, INR" }, govtEmployeeInFamily: { type: "boolean" },
          interests: { type: "array", items: { type: "string" } }, docs: { type: "object", additionalProperties: { type: "boolean" } },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OpportunityInput: {
        type: "object",
        required: ["kind", "title", "employer", "district", "state", "occupationIds", "minEducation", "seats"],
        properties: {
          kind: { type: "string", enum: ["apprenticeship", "internship", "job", "mentor", "training"] }, title: { type: "string" }, employer: { type: "string" },
          district: { type: "string" }, state: { type: "string" }, stipendMonthly: { type: "integer" }, hostel: { type: "boolean" },
          womenStaffed: { type: "boolean" }, epfRegistered: { type: "boolean" }, occupationIds: { type: "array", items: { type: "string" } },
          minEducation: { type: "string" }, schemeIds: { type: "array", items: { type: "string" } }, seats: { type: "integer" },
        },
      },
    },
  },
};
