import { stateCode, stateName, type Place } from "../shared/geo.ts";

// Turns "where are you?" into a state code and district. Pincode answers come
// from India Post's public directory; GPS goes through OpenStreetMap Nominatim
// to a postcode, then India Post again so district names match official ones.
// Only the resolved district is kept; coordinates are never stored.

const UA = "HunarSetu/0.1 (+https://github.com/atul-23012006/Citi-India-hackathon---hunar-setu)";
const TIMEOUT_MS = 6000;
const cache = new Map<string, Place | null>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`lookup failed: HTTP ${res.status}`);
  return res.json();
}

interface PostOffice { Name: string; District: string; State: string; Block?: string }

export async function fromPincode(pincode: string): Promise<Place | null> {
  if (cache.has(pincode)) return cache.get(pincode)!;
  const data = (await getJson(`https://api.postalpincode.in/pincode/${pincode}`)) as { Status: string; PostOffice: PostOffice[] | null }[];
  const po = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : undefined;
  const code = stateCode(po?.State);
  const place = po && code ? { state: code, stateName: stateName(code)!, district: po.District, pincode, locality: po.Name } : null;
  cache.set(pincode, place);
  return place;
}

interface NominatimAddress { state?: string; state_district?: string; county?: string; city?: string; town?: string; village?: string; postcode?: string }

export async function fromCoords(lat: number, lon: number): Promise<Place | null> {
  // ~1 km grid: enough for a district, and keeps us inside Nominatim's 1 request/second policy.
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const { address: a } = (await getJson(url)) as { address?: NominatimAddress };
  let place: Place | null = null;
  const pin = a?.postcode?.replace(/\s/g, "");
  if (pin && /^[1-9]\d{5}$/.test(pin)) place = await fromPincode(pin).catch(() => null);
  if (!place) {
    const code = stateCode(a?.state);
    const district = (a?.state_district ?? a?.county ?? a?.city)?.replace(/\s+district$/i, "");
    place = code ? { state: code, stateName: stateName(code)!, district, locality: a?.town ?? a?.village ?? a?.city } : null;
  }
  cache.set(key, place);
  return place;
}
