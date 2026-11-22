# Hunar Setu (हुनर सेतु) — prototype

**A voice-first, offline-first bridge from learning to livelihood for rural students (Class 9 to graduation).**
Citi India Hackathon — *Reimagining Education & Economic Empowerment for Rural India*. Team Agent Smiths, VIT Vellore.

> "The LLM converses; the graph decides." Claude talks with the student in their language.
> Every career, scheme, eligibility verdict and offer verdict comes from a deterministic engine over cited data, and that engine also runs on the phone with no network.

## Run it

```bash
npm install
npm run dev            # API on :8787 + app on :5173 (open on a phone on the same Wi-Fi)
```

Hub mode, the way a facilitator would run it on a laptop or Raspberry Pi with students joining over hotspot:

```bash
npm run hub            # builds the PWA and serves app + API on :8787 (0.0.0.0)
```

**Accounts (Postgres).** Formal sign-up and sign-in need PostgreSQL 13+. Create a role and database, then put the URL in `.env` (the server scripts load it):

```bash
psql -U postgres -c "CREATE ROLE hunar_setu LOGIN PASSWORD 'choose-one'" \
                 -c "CREATE DATABASE hunar_setu OWNER hunar_setu" \
                 -c "CREATE DATABASE hunar_setu_test OWNER hunar_setu"
cp .env.example .env   # then set DATABASE_URL and TEST_DATABASE_URL
```

Tables are created on the first account request. Without `DATABASE_URL` the hub runs as before (offline PIN profiles); the sign-up screen just says accounts are unavailable.

**Live job search (optional).** "Near me" searches job boards by the student's district when a key is set: `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (free at developer.adzuna.com) and/or `JOOBLE_API_KEY` (free at in.jooble.org/api/about). Without keys it shows verified Hunar Setu listings and local MSME clusters.

**AI counsellor (optional).** Set `ANTHROPIC_API_KEY` (or log in with `ant auth login`) before starting.
The hub probes credentials at start-up and every minute. Without them, the app uses the guided voice interview, and everything else works the same.

```bash
npm test               # 44 tests: engine, regional ranking, job-board parsing, HTTP API, accounts on Postgres (needs TEST_DATABASE_URL)
npm run data:points    # measure the engine over 1,000 synthetic students -> docs/round2/data-points.json
npm run seed:demo      # fill a running hub with a synthetic demo cohort (facilitator: "Demo Facilitator", PIN 2468)
npm run kb:check       # knowledge-base integrity + translation coverage
npm run kb:translate   # fill missing translations with Claude (for new languages / new KB text)
npm run typecheck
```

## What the prototype does

**New: accounts, "Near me" and MSME**
- **Register and sign in** with email or mobile and a password. Accounts live in PostgreSQL. Passwords are hashed with salted scrypt, and session tokens are stored only as SHA-256. Five wrong tries lock the account for 15 minutes. Under-18s need guardian consent (DPDP Act). Students can change their password (which signs out other devices) or erase their account.
- **Near me** asks where the student is (GPS, pincode, or picking the state) and stores only the district. It shows live openings from job boards, each run through the scam checker; verified Hunar Setu listings ranked for the student; and the MSME industry clusters in their state. Ranking runs on the phone, so verified listings and clusters still work offline.
- **India's MSME sector:** headline figures, Udyam job growth, help to start a business, and the 2025 size classes, all sourced. Full write-up in [docs/MSME_INDIA.md](docs/MSME_INDIA.md).


| Requirement (problem statement) | Where it is |
|---|---|
| **Discover**: voice/text profile in local language, careers incl. non-STEM & vocational | `client/src/screens/Discover.tsx`: Claude chat (online) or guided voice interview (offline); `shared/engine/careers.ts` ranks 35 NCO-2015 occupations with a **diversity rule** (≤2 per track, ≤2 of army/police/teacher/doctor, ≥3 "New for you"); gender is never a ranking input |
| Show, don't tell | `screens/Tasks.tsx`: picture tasks (circuit, shop maths, patterns, first aid); demonstrated skills outrank declared interests and earn a signed credential |
| **Learn**: personal pathway, exams, widen options | `buildPathway()`: steps with real courses (ITI/NCVT, PMKVY, SWAYAM, SIDH, NIOS, DGCA RPC, Suryamitra), exams filtered by age, one action for this week |
| **Opportunity**: scholarships, schemes, apprenticeships, mentors, employers | `shared/engine/eligibility.ts`: 20 central/state schemes as **rules-as-data** → eligible / *not yet, because X* / unknown, with citation; **near-miss** alternatives; **Paperwork Autopilot** (longest lead time first, DBT seeding first) |
| Connect & earn: mentors, corporates, NGOs, apply | Openings + mentors matched per route; "Ask for this" → facilitator endorses → status syncs back; partner API for employers/NGOs |
| Facilitator enablement | `screens/Facilitator.tsx`: cohort view, talent spotting from *demonstrated* tasks, "one document away from money" count, endorsements (issue credentials), assisted sessions on one phone |
| Sustainability | Facilitators author micro-modules: free, pay-per-module or subscription. Students read or listen to them offline in **My path**; "I finished" syncs, and the facilitator **certifies** it into a credential. Learners and earnings are tracked |
| Defined success measures | **Impact** tab in facilitator mode and `GET /api/facilitator/impact`: the six Round 1 key metrics (verified outcomes, rupees, aspiration widening, scams, offer-to-joining by gender, earning facilitators), aggregates only |
| Local language voice in/out, low literacy | Hindi, Tamil, Kannada, English UI + KB; every card has 🔊; mic on every question; emoji icons; ≥56px targets; ≤3 taps deep |
| Low-end Android, offline, sync | PWA ~290 KB precached; IndexedDB; outbox of idempotent ops; hub = sync target; app reloads and works with no network (tested) |
| Facilitator mode: one teacher, many students | Shared-phone PIN profiles (PBKDF2 on device, never sent), assisted sessions, cohort console |
| AI grounded in real data | Claude can only recommend through tools that query the graph and rules engine; system prompt forbids facts not returned by a tool |
| Open source, extensible | MIT; occupations, schemes, courses, exams, docs, translations, scam patterns are JSON; `kb:check` keeps partner edits safe |
| Standards-based APIs | REST + OpenAPI 3.1 (`/api/openapi.json`), Beckn/ONEST-style `/beckn/search`, W3C VC 2.0 credentials (EdDSA JWS, `did:key`) |

Beyond the brief, closing the "leaks" from our Round 1 canvas:
- **Offer Safety Check** ("Truecaller for job offers"): works offline. It flags upfront fees, tourist-visa jobs, the MEA-flagged South-East Asia scam corridor and +66/+95/+856/+855 numbers. A scam reported in one village warns every village after sync.
- **Family Decision Kit**: true monthly cost (stipend − rent − food − travel, NAPS-2 share shown but never double-counted, PM-VBRY), a safety score, "go together" counts, and a spoken explainer for parents.
- **Talent Passport**: credentials verified *on the phone* with WebCrypto, with a QR anyone can check offline. A placement counts only when the student shares proof of first pay (EPF/stipend credit).

## Demo script (5 minutes)

1. Open in Hindi. Tap **मैं नया/नई हूँ**, give consent (with the guardian checkbox), choose a name and PIN.
2. Answer by voice or tap: age 17, girl, Class 12, Tamil Nadu, "fixing things" + "phones and computers". Six routes appear, at least three marked **आपके लिए नया**.
3. Do the circuit puzzle, then open **Solar panel technician**: the steps, this week's action, and openings with stipend, EPF and hostel flags.
4. **मेरे लिए पैसा**: choose SC, ₹1-2.5 lakh, Class 10 marksheet and caste certificate. You'll see ₹ claimable per year, the DBT warning, the paperwork plan, and "not yet, because…".
5. **ऑफ़र जाँचें** → *Try a sample*. It shows **ख़तरा** with reasons and helplines. Report it.
6. **परिवार**: true cost and safety, then *Play for parents*.
7. Turn on airplane mode and reload. The app still works; eligibility and offer checks run offline.
8. Switch user to **शिक्षक**, create a facilitator, see the cohort with ⭐ talent, endorse, and publish a ₹49 module.
9. Back as the student, open the module in **मेरा रास्ता**, listen to a lesson and tap "I finished". As the facilitator, **Certify** it, then open **📊 Impact**.
10. Back as the student, open **मेरा प्रमाण**: credentials with "signature valid" and a QR.

## Round 2

The presentation, talk track, Q&A prep and the measured data points are in [`docs/round2/`](docs/round2/README.md).

## Layout

```
shared/   types, i18n strings, KB (JSON), engine (eligibility, careers, paperwork, offerCheck, trueCost), vc.ts
server/   hub: Express API, Claude counsellor (claude.ts), sync, facilitator, partners, Beckn, OpenAPI, issuer keys
client/   Preact PWA (screens/, store.ts = IndexedDB + outbox, sync.ts, voice.ts = Web Speech)
scripts/  kb-check, translate-kb, data-points, seed-demo
docs/     ARCHITECTURE.md, round2/ (deck, screenshots, data points)
```

**Data honesty.** Every opportunity listing is synthetic and labelled *demo listing*. Scheme rules are checked against official or secondary sources (`sources` + `asOf` on each record). Where a rule is a proxy (CSSS uses ≥80% marks for "80th percentile"; INSPIRE uses ≥90% for "top 1%") the record says so.
Always confirm on the official portal before applying.
