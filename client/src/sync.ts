import { kb } from "../../shared/kb/index.ts";
import { getState, setState } from "./store.ts";

// Opportunities posted by partners reach the phone through sync and join the
// bundled ones, so matching keeps working offline with the latest listings.
const bundled = kb.opportunities;
export function mergePartnerOpportunities() {
  const partner = getState().partnerOpportunities.filter((o) => !bundled.some((b) => b.id === o.id));
  kb.opportunities = [...bundled, ...partner];
}

// Outbox sync. Ops carry unique ids, so a dropped connection mid-sync is safe to
// retry: the hub skips ops it has already applied. Runs on reconnect, on a timer,
// and after every local change once the network is back.

let inFlight = false;

export async function syncNow(): Promise<boolean> {
  const s = getState();
  if (inFlight || !navigator.onLine) return false;
  inFlight = true;
  setState({ syncing: true });
  const ops = s.outbox.slice(0, 200);
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: s.deviceId, studentIds: s.profiles.map((p) => p.id), ops }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const applied = new Set<string>(data.applied);
    setState({
      outbox: getState().outbox.filter((o) => !applied.has(o.opId)),
      scamReports: data.scamReports,
      partnerOpportunities: data.partnerOpportunities,
      credentials: data.credentials,
      requests: data.requests,
      requestCounts: data.requestCounts ?? {},
      modules: data.modules ?? [],
      lastSync: new Date().toISOString(),
      online: true,
    });
    mergePartnerOpportunities();
    return true;
  } catch {
    setState({ online: navigator.onLine });
    return false;
  } finally {
    inFlight = false;
    setState({ syncing: false });
  }
}

export async function refreshStatus() {
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    const data = await res.json();
    setState({ aiAvailable: !!data.ai, online: true });
  } catch {
    setState({ aiAvailable: false, online: navigator.onLine });
  }
}

export function startSync() {
  const kick = () => {
    setState({ online: navigator.onLine });
    if (navigator.onLine) {
      refreshStatus();
      syncNow();
    }
  };
  window.addEventListener("online", kick);
  window.addEventListener("offline", () => setState({ online: false, aiAvailable: false }));
  setInterval(() => {
    if (getState().outbox.length || Date.now() - Date.parse(getState().lastSync ?? "0") > 60_000) syncNow();
  }, 15_000);
  kick();
}
