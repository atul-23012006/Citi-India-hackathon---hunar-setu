# Architecture

```
 Student phone (PWA, offline-first)                 Facilitator hub (laptop / Pi / state node)
 ┌───────────────────────────────────┐   hotspot   ┌─────────────────────────────────────────────┐
 │ Preact UI · Web Speech voice      │◀──────────▶│ Express API                                 │
 │ shared/engine  (same code as hub) │  /api/sync  │  ├ sync: idempotent outbox ops, LWW profiles │
 │  careers · eligibility · paperwork│             │  ├ Claude counsellor (tools → shared/engine) │
 │  offerCheck · trueCost · vc verify│             │  ├ facilitator: cohort, endorse, modules     │
 │ KB JSON bundled + precached       │             │  ├ issuer: Ed25519 did:key → W3C VC (JWS)    │
 │ IndexedDB: profiles, outbox, creds│             │  ├ partners API (X-Partner-Key)              │
 └───────────────────────────────────┘             │  ├ /beckn/search (ONEST/DSEP-style catalog)  │
                                                    │  └ /api/openapi.json                         │
                                                    └──────────────┬──────────────────────────────┘
                                                                   │ when signal appears
                                                          Claude API · (prod) Bhashini, DigiLocker,
                                                          NPCI mapper, Sunbird RC, APAAR, Beckn gateway
```

## Key decisions

**One engine, two places.** `shared/engine` is pure TypeScript with no I/O. The phone runs it offline; the hub runs it for APIs and as Claude's tools. Eligibility can never disagree between online and offline.

**LLM converses, graph decides.** Claude (`claude-opus-5-5`, low effort for spoken latency) has six tools: `update_profile`, `suggest_careers`, `search_occupations`, `get_pathway`, `check_schemes`, `check_offer`. The system prompt forbids stating any fact not returned by a tool. Profile fields are validated with zod before they are applied.
Conversations are **append-only** on the hub: the system prompt and tools stay frozen per session, and app-side profile edits are *appended* as context, never patched into history. This keeps thinking blocks valid under the preserved-thinking check and keeps the prompt cache warm. Server-side `fallbacks: "default"` re-runs a refused turn on a recommended model. With no credentials, `/api/chat` returns 503 and the app switches to the guided interview.

**Rules as data.** Each scheme is a list of typed conditions (`age`, `education`, `category`, `incomeMax`, `doc`, …). A failed `doc` condition is *fixable*, so the verdict is "near miss" with a paperwork task. A failed hard condition is "not eligible", with same-type alternatives that do fit. Missing profile data gives "unknown" plus the question to ask, never a guess.

**Offline sync.** Every change is an outbox op with a UUID. The hub records applied op IDs, so replays after a dropped connection are harmless. Profile upserts are applied before other ops in a batch. An op that references a student the hub hasn't seen yet is left un-applied, so the device retries it.

**Privacy (DPDP Act 2023 / Rules 2025).** Consent screen with a guardian checkbox (production: DigiLocker virtual token, Rule 10). PINs are hashed on the device with PBKDF2 and stripped before sync. No ads, no analytics. Claude is told not to ask for Aadhaar, phone or bank numbers. Data stays on the phone and the facilitator's hub.

**Modules and certification.** Facilitator modules reach phones with sync, lessons included, so they can be read or heard offline. Enrolling and finishing are outbox ops (`module_enroll`, `module_complete`). The hub records them, and only the module's own facilitator can certify a completion (`POST /api/facilitator/modules/:id/certify`), which issues the ModuleCompletion credential. No route signs a credential on a student device's say-so.

**Impact.** `server/impact.ts` computes the six key metrics from the hub's data: verified outcomes, rupees eligible now, aspiration widening, scams, offer-to-joining by gender, and earning facilitators. It returns aggregates only, with no names or ids. Scheme money is never double counted: one central scholarship, state scholarships on top, and one of internship or apprenticeship.

**Facilitator auth.** Names are unique per hub. Five wrong PINs lock that name for 15 minutes.

**Credentials.** VC 2.0 JSON signed as compact JWS (EdDSA). The issuer is a `did:key`, so the public key is inside the credential and any phone can verify a QR with WebCrypto and no registry lookup. Production: Sunbird RC as registry, holder linked to APAAR / ABC.

## Real vs. simulated in this prototype

| Area | Prototype | Production path |
|---|---|---|
| Speech | Browser Web Speech API (Android's Google speech: hi/ta/kn) | Bhashini ULCA pipelines online; AI4Bharat IndicConformer (MIT) on the hub for offline ASR |
| Opportunities | 11 synthetic listings, labelled *demo*; partner API adds more | NCS, NAPS portal, PM Internship via Beckn/ONEST network |
| Beckn | Synchronous `/beckn/search` → `on_search` catalog shape | Full BPP with gateway registry and async callbacks |
| DigiLocker / NPCI mapper | Student self-declares documents and seeding | DigiLocker pull API; NPCI Aadhaar-mapper status check |
| Credentials | Hub `did:key` issuer | Sunbird RC registry; APAAR ID linkage |
| Store | JSON file per hub | Postgres per state node, same function boundaries |
| Payments for modules | Earnings computed, no money moves | UPI collect via CSC / facilitator wallet |

## Testing

- `npm test`: 18 engine unit tests and 5 HTTP tests against a throwaway hub (sync idempotency, retry of ops for unknown students, PIN lockout, module certification rights, impact aggregates).
- GitHub Actions runs typecheck, tests, `kb:check` and the build on every push.
- `npm run kb:check`: KB referential integrity, 4-digit NCO codes, sources on every record, translation coverage.
- During development, a manual end-to-end Playwright run (360×760 phone viewport, Hindi; script not in the repo) covered 19 checks across onboarding, guided interview, skill task, pathway, eligibility, offer check, family cost, credential issue and verification, a full offline reload, and facilitator endorse/modules.
