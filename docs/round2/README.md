# Round 2: presentation kit

Round 2 gives each team **10 minutes to present and 5 minutes of Q&A**. The deck follows Citi's template in order.

| File | What it is |
|---|---|
| `HunarSetu_Round2_AgentSmiths.pptx` | The deck: 14 slides, with speaker notes and timings on every slide |
| `HunarSetu_Round2_AgentSmiths.pdf` | The same deck as a PDF (rendered with LibreOffice, so fonts may differ slightly) |
| `data-points.json` | Numbers on the Data Points slide, from `npm run data:points` |
| `screens/` | Phone-size screenshots of the running prototype used on the POC and demo slides |
| `deck/build-deck.cjs` | Rebuilds the deck from the two items above |

**Before presenting:** put the mentor's name in `TEAM.mentor` in `deck/build-deck.cjs`, then rebuild. It currently says `‹Mentor name›`.

## How the deck maps to the Round 2 template

| # | Template asks for | Slides |
|---|---|---|
| 1 | Title: college, team, program | 1 |
| 2 | Agenda | 2 (with a time budget that adds up to 10:00) |
| 3 | Meet the team, with mentor | 3 |
| 4 | Problem statement: goals, approach, defined success measures | 4 (six leaks), 5 (goals and approach), 6 (six metrics with targets) |
| 5 | Architecture, wireframe / POC, tech stack | 7, 8 (real screenshots), 9 |
| 6 | Data points and demo (optional now, mandatory in Round 3) | 10 (measured), 11 (demo script) |
| 7 | Risks and challenges | 12 |
| 8 | Outcomes, benefits, impact, lessons learnt | 13, then 14 (thank you and Q&A) |

## Talk track (10:00)

| Time | Slide | Point to land |
|---|---|---|
| 0:00 | 1 Title | One sentence: from "what am I good at?" to money in their own account |
| 0:15 | 2 Agenda | Eight stops; we will demo |
| 0:30 | 3 Team | Names, mentor |
| 1:00 | 4 Six leaks | Not one gap, a pipeline. Entitlement and trust are where money is lost or stolen |
| 2:00 | 5 Goals, approach | The LLM converses; the graph decides. The same engine runs offline on the phone |
| 2:45 | 6 Success measures | Six metrics from Round 1, now computed live in the product |
| 3:00 | 7 Architecture | Phone, hub on a hotspot, services when signal appears |
| 4:00 | 8 POC | Real screens, four languages, facilitator Impact tab |
| 4:45 | 9 Tech stack | Open, small (under 300 KB precached), W3C credentials, OpenAPI |
| 5:30 | 10 Data points | All from a script in the repo; synthetic cohort, said out loud |
| 6:15 | 11 Demo | Live, about 1:45 |
| 8:00 | 12 Risks | Each mitigation already exists in code |
| 9:00 | 13 Outcomes | Close on lessons learnt |

## Running the demo

```bash
npm install
npm run hub                                   # builds the PWA and serves it on :8787 (0.0.0.0)
node scripts/seed-demo.ts http://localhost:8787   # synthetic cohort for the facilitator screens
```

Open `http://<laptop-ip>:8787` on a phone joined to the laptop's hotspot. Facilitator login: **Demo Facilitator**, PIN **2468**.
Every seeded name ends in "(demo)", and every listing is labelled as a demo listing.

## Rebuilding

```bash
npm run build && npm run data:points          # refresh data-points.json
cd docs/round2/deck && npm install && npm run build
```

The screenshots were taken with Playwright at 360×760 (2× scale) against a seeded hub. Retake them if the UI changes.

## Likely questions

**How do you stop the AI from making things up?**
Claude can only recommend through six tools that query the knowledge base and the rules engine. The system prompt forbids facts no tool returned. Eligibility itself is deterministic code with 23 tests, and it runs with no AI at all.

**Does it really work offline?**
Yes. The whole app and knowledge base are precached (about 295 KB). Discovery, pathways, eligibility, the paperwork plan, offer checks and the cost calculator all run on the phone. Changes queue in an outbox and sync when the phone next reaches the hub.

**Isn't the problem statement out of scope for villages with no internet?**
Yes, and we respect that. Offline-first here is about *patchy* signal and one shared connection per class, which is the common case.

**How does it make money?**
The core platform is free for students and parents. A facilitator may charge for their own modules (free is always an option). Platform revenue comes from employers (apprentice pipelines, which NAPS-2 co-funds), per-verified-outcome state contracts, CSR skill vouchers, and a credential verification API. Facilitators earn from their own modules.

**Why would a state trust your numbers?**
A placement counts only with proof of first pay that the student chooses to share. Credentials are W3C Verifiable Credentials signed by the hub, which anyone can verify offline. Module credits need the teacher to certify them.

**How do you add a language or a scheme?**
Both are data. A language is a column in `shared/i18n/strings.ts` plus KB translations (`npm run kb:translate`). A scheme is a JSON record of typed conditions with a source and a date, and `npm run kb:check` validates it.

**What is real and what is simulated?**
See the "Real vs. simulated" table in `docs/ARCHITECTURE.md`. Speech uses the browser's Web Speech API, and opportunities are synthetic and labelled. DigiLocker, NPCI, Sunbird RC and APAAR integrations are the production path, not the prototype.

**Where do the data points come from?**
`scripts/data-points.ts` runs the real engine over 1,000 seeded synthetic profiles. It is not field data, and the slide says so. That script also caught a bug: the app was adding up scholarships that cannot be held together. It is now fixed and tested.
