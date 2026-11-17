import { randomUUID } from "node:crypto";
import type { Opportunity } from "../shared/types.ts";
import { kb } from "../shared/kb/index.ts";

// A Beckn-style discovery endpoint in the shape of the ONEST / DSEP work-opportunity
// and training specs: any network participant (BAP) can search this hub (BPP) for
// apprenticeships, jobs, training and mentors without a custom integration.
// Simplified: replies synchronously with on_search instead of a gateway callback.

interface SearchRequest {
  context?: { domain?: string; transaction_id?: string; message_id?: string; bap_id?: string; location?: { city?: { name?: string } } };
  message?: { intent?: { item?: { descriptor?: { name?: string } }; tags?: { code?: string; value?: string }[] } };
}

export function becknSearch(req: SearchRequest, opportunities: Opportunity[]) {
  const q = req.message?.intent?.item?.descriptor?.name?.toLowerCase() ?? "";
  const city = req.context?.location?.city?.name?.toLowerCase();
  const kind = req.message?.intent?.tags?.find((t) => t.code === "kind")?.value;

  const items = opportunities.filter((o) => {
    if (kind && o.kind !== kind) return false;
    if (city && o.district.toLowerCase() !== city) return false;
    if (!q) return true;
    const occNames = o.occupationIds.flatMap((id) => Object.values(kb.occupations.find((x) => x.id === id)?.name ?? {}));
    return [o.title, o.employer, ...o.occupationIds, ...occNames].join(" ").toLowerCase().includes(q);
  });

  const byProvider = new Map<string, Opportunity[]>();
  for (const o of items) byProvider.set(o.employer, [...(byProvider.get(o.employer) ?? []), o]);

  return {
    context: {
      domain: req.context?.domain ?? "onest:work-opportunities",
      action: "on_search",
      version: "1.1.0",
      bpp_id: "hunarsetu.hub",
      transaction_id: req.context?.transaction_id ?? randomUUID(),
      message_id: req.context?.message_id ?? randomUUID(),
      timestamp: new Date().toISOString(),
    },
    message: {
      catalog: {
        descriptor: { name: "Hunar Setu hub catalogue" },
        providers: [...byProvider.entries()].map(([employer, list]) => ({
          id: employer.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          descriptor: { name: employer },
          locations: [{ city: { name: list[0].district }, state: { code: list[0].state } }],
          items: list.map((o) => ({
            id: o.id,
            descriptor: { name: o.title },
            category_ids: [o.kind],
            tags: [
              { code: "stipend_monthly_inr", value: String(o.stipendMonthly ?? 0) },
              { code: "min_education", value: o.minEducation },
              { code: "hostel", value: String(o.hostel) },
              { code: "women_staffed", value: String(o.womenStaffed) },
              { code: "epf_registered", value: String(o.epfRegistered) },
              { code: "employer_verified", value: String(o.employerVerified) },
              { code: "nco_2015", value: o.occupationIds.map((id) => kb.occupations.find((x) => x.id === id)?.nco).filter(Boolean).join(",") },
              { code: "co_funded_by", value: o.schemeIds.join(",") },
              { code: "demo_listing", value: String(o.demo) },
            ],
            quantity: { available: { count: o.seats } },
          })),
        })),
      },
    },
  };
}
