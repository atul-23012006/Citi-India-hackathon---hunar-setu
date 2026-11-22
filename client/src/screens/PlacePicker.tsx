import { useState } from "preact/hooks";
import type { Lang } from "../../../shared/types.ts";
import { t } from "../../../shared/i18n/strings.ts";
import { PINCODE, STATES, stateName, type Place } from "../../../shared/geo.ts";

// Three ways to say where you are, most automatic first: GPS, pincode, or
// picking the state by hand (which also works fully offline).

type Status = "" | "busy" | "loc.notfound" | "loc.failed" | "loc.denied";

async function resolve(body: { pincode: string } | { lat: number; lon: number }): Promise<Place | "loc.notfound" | "loc.failed"> {
  try {
    const res = await fetch("/api/location/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 404) return "loc.notfound";
    if (!res.ok) return "loc.failed";
    return (await res.json()) as Place;
  } catch {
    return "loc.failed";
  }
}

export function PlacePicker({ lang, initial, onPick, compact }: { lang: Lang; initial?: Partial<Place>; onPick: (p: Place) => void; compact?: boolean }) {
  const [pin, setPin] = useState(initial?.pincode ?? "");
  const [state, setStateCode] = useState(initial?.state ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [status, setStatus] = useState<Status>("");
  const [found, setFound] = useState<Place | null>(null);

  const got = (r: Place | "loc.notfound" | "loc.failed") => {
    if (typeof r === "string") return setStatus(r);
    setStatus("");
    setFound(r);
    setStateCode(r.state);
    setDistrict(r.district ?? "");
    if (r.pincode) setPin(r.pincode);
    if (compact) onPick(r); // inside a form: fill the fields straight away
  };

  const gps = () => {
    if (!navigator.geolocation) return setStatus("loc.denied");
    setStatus("busy");
    navigator.geolocation.getCurrentPosition(
      async (pos) => got(await resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })),
      () => setStatus("loc.denied"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const byPin = async () => {
    if (!PINCODE.test(pin)) return setStatus("loc.notfound");
    setStatus("busy");
    got(await resolve({ pincode: pin }));
  };

  const manual = () => {
    if (!state) return;
    onPick({ state, stateName: stateName(state)!, district: district.trim() || undefined, pincode: found?.state === state && PINCODE.test(pin) ? pin : undefined });
  };

  return (
    <div class="place-picker">
      {!compact && <p class="small muted">{t(lang, "loc.why")}</p>}
      <button type="button" class="btn ghost block" onClick={gps} disabled={status === "busy"}>📍 {t(lang, "loc.gps")}</button>

      <div class="or-line"><span>{t(lang, "loc.or")}</span></div>
      <label class="field">
        <span>{t(lang, "loc.pincode")}</span>
        <div class="row" style="flex-wrap:nowrap">
          <input type="text" inputMode="numeric" autocomplete="postal-code" maxLength={6} pattern="[0-9]{6}" value={pin} style="flex:1"
            onInput={(e) => setPin((e.target as HTMLInputElement).value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); byPin(); } }} />
          <button type="button" class="btn" onClick={byPin} disabled={pin.length !== 6 || status === "busy"}>{t(lang, "loc.find")}</button>
        </div>
      </label>

      {status === "busy" && <p class="small muted" role="status">…</p>}
      {status && status !== "busy" && <p class="small" role="alert" style="color:var(--no)">{t(lang, status)}</p>}
      {found && (
        <div class="card yes" role="status">📍 <strong>{found.district ? `${found.district}, ` : ""}{found.stateName}</strong>{found.locality ? <span class="small muted"> · {found.locality}</span> : null}</div>
      )}

      {!compact && <div class="or-line"><span>{t(lang, "loc.or")}</span></div>}
      <div class="two-col">
        <label class="field">
          <span>{t(lang, "loc.state")}</span>
          <select value={state} onChange={(e) => { setStateCode((e.target as HTMLSelectElement).value); setFound(null); }}
            onBlur={() => compact && state && onPick({ state, stateName: stateName(state)!, district: district.trim() || undefined, pincode: found ? pin : undefined })}>
            <option value="">{t(lang, "acc.choose")}</option>
            {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <label class="field">
          <span>{t(lang, "loc.district")}</span>
          <input type="text" autocomplete="address-level2" value={district} maxLength={60}
            onInput={(e) => setDistrict((e.target as HTMLInputElement).value)}
            onBlur={() => compact && state && onPick({ state, stateName: stateName(state)!, district: district.trim() || undefined, pincode: found ? pin : undefined })} />
        </label>
      </div>
      {!compact && <button type="button" class="btn block" disabled={!state} onClick={manual}>{t(lang, "loc.save")}</button>}
    </div>
  );
}
