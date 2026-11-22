// States and union territories with the short codes the knowledge base uses
// ("TN", "KA", ...). Names match what India Post and OpenStreetMap return, so a
// pincode or GPS lookup maps straight to a code; aliases cover older spellings.
export const STATES: { code: string; name: string; aliases?: string[] }[] = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CG", name: "Chhattisgarh", aliases: ["Chattisgarh"] },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", aliases: ["Dadra and Nagar Haveli", "Daman and Diu", "Dadra & Nagar Haveli and Daman & Diu"] },
  { code: "DL", name: "Delhi", aliases: ["National Capital Territory of Delhi", "NCT of Delhi"] },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir", aliases: ["Jammu & Kashmir"] },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha", aliases: ["Orissa"] },
  { code: "PY", name: "Puducherry", aliases: ["Pondicherry"] },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TS", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand", aliases: ["Uttaranchal"] },
  { code: "WB", name: "West Bengal" },
];

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

export function stateCode(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const n = norm(name);
  return STATES.find((s) => norm(s.code) === n || norm(s.name) === n || s.aliases?.some((a) => norm(a) === n))?.code;
}

export const stateName = (code: string | undefined) => STATES.find((s) => s.code === code)?.name;

export interface Place {
  state: string; // code
  stateName: string;
  district?: string;
  pincode?: string;
  locality?: string;
  lat?: number;
  lon?: number;
}

export const PINCODE = /^[1-9]\d{5}$/;
