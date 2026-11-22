# India's MSME sector: growth and opportunities for rural youth

*Research note for Hunar Setu, November 2026. The figures are also in [`shared/kb/msme.json`](../shared/kb/msme.json), which the app's "Near me" and MSME screens read. Sources are at the end.*

## Why MSMEs matter for Hunar Setu

Most rural young people won't get a job at a large company. They are far more likely to work in, supply, or start a small enterprise: a garment unit in Tiruppur, an auto-parts shop in Hosur, a food-processing unit in Muzaffarpur, or their own repair shop. After agriculture, micro, small and medium enterprises (MSMEs) are India's biggest employer. Hunar Setu should therefore point students toward the MSMEs near them, not only toward national job portals.

## The sector in numbers

| Indicator | Figure | As of | Source |
|---|---|---|---|
| Share of GDP | **31.1%** | Jan 2026 data | PIB factsheet, 26 Jun 2026; Economic Survey 2025-26 |
| Share of manufacturing output | **35.4%** | Jan 2026 data | PIB factsheet |
| Share of exports | **48.58%** | Jan 2026 data | PIB factsheet |
| People employed | **38.9 crore** (PIB); ~32.8 crore (Economic Survey) | 2026 | see note |
| Registered MSMEs (Udyam + Udyam Assist) | **8.7 crore** | Jun 2026 | PIB factsheet |
| Jobs reported on Udyam, FY 2025-26 | **8.04 crore** | Jul 2026 | Lok Sabha reply (as reported) |

**Note on employment.** Official sources disagree: PIB's June 2026 factsheet says 38.9 crore and the Economic Survey says about 32.8 crore. The Udyam figure (8.04 crore) counts only jobs that registered enterprises *declare*. It is not a census. The app shows the PIB figure and spells out the difference.

## Growth

- **Jobs reported on Udyam** rose from 5.45 crore (FY24) to 6.91 crore (FY25, +27%) and 8.04 crore (FY26, +16%).
- **Registrations** rose from 5.93 crore (Feb 2025) to 8.7 crore (Jun 2026), about +47% in 16 months. Much of the rise is informal micro-units joining through the Udyam Assist platform. That is formalisation, not necessarily new businesses.
- **Export share** rose from 45.73% (2023-24, Budget 2025 note) to 48.58% (Jan 2026).
- **GDP share** rose from 30.1% (cited July 2025) to 31.1% (Jan 2026).
- **Credit** expanded: CGTMSE approved 29.03 lakh guarantees worth Rs 3.77 lakh crore between January and November 2025. The guarantee ceiling doubled from Rs 5 crore to Rs 10 crore.
- **Size limits were revised** from 1 April 2025, so firms can grow without losing MSME benefits:

| | Investment up to | Turnover up to |
|---|---|---|
| Micro | Rs 2.5 crore | Rs 10 crore |
| Small | Rs 25 crore | Rs 100 crore |
| Medium | Rs 125 crore | Rs 500 crore |

**Where the FY 2025-26 jobs are.** By sector: trading 2.98 crore, services 2.57 crore, manufacturing 2.50 crore. By state, the top five are Uttar Pradesh (1.18 crore), Maharashtra (67.97 lakh), Tamil Nadu (61.47 lakh), Telangana (60.56 lakh) and Bihar (55.54 lakh). Some states declined from FY25 to FY26: Andhra Pradesh (70.08 to 36.66 lakh), Karnataka (65.57 to 50.87 lakh) and Punjab (28.60 to 14.96 lakh). Changes in how units register may explain part of this.

## Opportunities for the students Hunar Setu serves

1. **Apprenticeships and first jobs in local clusters.** Manufacturing MSMEs report 2.5 crore jobs. Clusters hire technicians, machine operators, welders and tailors, which are the vocational careers Hunar Setu already maps (NCO-2015). NAPS pays part of an apprentice's stipend at an MSME as it would at a large firm. In the app, "Near me" names the clusters in the student's state and searches job boards for what the home-district cluster hires.
2. **Services and trading.** These account for about 5.5 crore Udyam jobs: retail, repair, logistics, digital services and CSC centres. Many need only Class 10 or 12 plus a short course.
3. **Starting a business.** This is the route that brings income to the village itself:
   - **PMEGP:** 10.84 lakh enterprises funded, Rs 29,623 crore in margin-money subsidy, more than 97 lakh jobs (May 2026). Applications are now accepted in 19 regional languages.
   - **PM Vishwakarma:** passed its 30 lakh registration target in two years; 24 lakh trained; Rs 5,133 crore in collateral-free loans to 5.98 lakh artisans.
   - **MUDRA** loans up to Rs 20 lakh (Tarun Plus); the **Udyam credit card** with a Rs 5 lakh limit for micro-units; **Stand-Up India** loans of Rs 10 lakh to Rs 1 crore for women and SC/ST founders.
   - **ASPIRE** rural incubators: 109 incubators, 1.23 lakh people trained, 32,085 placed in jobs.
4. **Skills that MSMEs pay for.** MSME Technology Centres (18 existing, 20 more plus 100 extension centres planned) trained 53,963 youth at extension centres by November 2025. These are free or low-cost, industry-linked courses Hunar Setu can add to pathways.
5. **Export-linked work.** Nearly half of India's exports come from MSMEs, in clusters such as Tiruppur knitwear, Surat textiles, Rajkot and Ludhiana engineering, Kochi and Balasore seafood, and Moradabad brass. Export demand makes jobs in these clusters steadier than purely local markets.
6. **Women and first-generation founders.** The MoS for MSME told Parliament that more than 2.64 crore women-owned enterprises have registered on Udyam since 2020 (as reported; we haven't checked the reply itself). At IITF 2025, 67% of MSME stalls went to women entrepreneurs.

## Risks the app should be honest about

- **Closures:** 39,446 MSMEs deregistered in 2024-25, nearly double the year before. Maharashtra had the most (9,702), followed by Tamil Nadu and Gujarat.
- **Late payments:** MSME Samadhaan holds 2,56,892 cases worth Rs 55,244 crore (June 2026).
- **Credit gap:** estimates start at Rs 30 lakh crore of unmet demand.
- **Job quality is unknown:** Udyam job counts say nothing about wages, contracts or EPF. Hunar Setu's verified listings check EPF registration, and its offer checker runs on every live listing, because informal hiring is where fee-for-job and trafficking scams operate.

## How this is built into the app

| Insight | Feature |
|---|---|
| Clusters decide local demand | `msme.json`: 15 states, about 60 clusters, each mapped to Hunar Setu careers and job-board search terms |
| Students search in their own district | `POST /api/opportunities/regional`: live listings by district, widened to the state when the district has few |
| Informal hiring carries scam risk | Every live listing goes through `checkOffer`; risky ones are flagged and listed last |
| Self-employment is a real route | The MSME screen lists Udyam, PMEGP, PM Vishwakarma, MUDRA, CGTMSE, ASPIRE, Technology Centres and Stand-Up India, linked to the scheme rules already in the knowledge base |
| Data conflicts are common | Every figure has its source and date; disagreements are stated, not hidden |

## Next steps

- Load the official **state- and district-level Udyam table** (Lok Sabha unstarred question 1883, 11 Dec 2025) to rank clusters by registered units.
- Use the **data.gov.in Udyam API** (needs a free key) for district counts by NIC sector.
- Add **ODOP (One District One Product)** for every district, not just the clusters listed here.
- Let facilitators tag local MSMEs as **verified employers**, so their openings appear among the verified listings.

## Sources

- PIB, *From Enterprise to Empowerment: The MSME Story*, 26 June 2026. <https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jun/doc2026626903401.pdf>
- Lok Sabha written reply on Udyam-reported employment (MoS MSME), July 2026, as reported. <https://www.newkerala.com/news/a/government-says-msmes-now-report-over-crore-jobs-102.htm>
- Economic Survey 2025-26, as reported. <https://yourstory.com/smbstory/indian-msmes-employ-3282-crore-people-contribute-31-to-gdp-economic-survey-budget-2026>
- Ministry of MSME, Union Budget 2025-26 note (classification x2.5 / x2, credit guarantees). <https://pib.gov.in/PressReleasePage.aspx?PRID=2099687>
- Budget 2025-26 MSME measures (credit cards, guarantees). <https://www.downtoearth.org.in/economy/budget-2025-26-big-push-for-micro-small-and-medium-enterprises>
- MSME closures in 2024-25. <https://www.taxscan.in/top-stories/39446-msmes-shut-shop-in-fy-2024-25-mos-attributes-deregistration-to-multiple-business-factors-1439079>
- The Wire, MSME closures in 2024-25 nearly double the previous year. <https://m.thewire.in/article/economy/over-35000-msmes-closed-in-2024-25-nearly-double-of-last-year>
- UNIDO MSME cluster list (RBI annex). <https://website.rbi.org.in/documents/87730/39016390/56MD29072022_A1.pdf>
- NITI Aayog, *Enhancing Competitiveness of MSMEs in India* (2025). <https://www.niti.gov.in/sites/default/files/2025-05/Enhancing_Competitiveness_of_MSMEs_in_India.pdf>
