import { useEffect, useState } from "preact/hooks";
import { AccountPanel } from "./Account.tsx";
import QRCode from "qrcode";
import { t } from "../../../shared/i18n/strings.ts";
import { verifyCredential, type VerifyResult } from "../../../shared/vc.ts";
import { activeProfile, useStore, type HubCredential } from "../store.ts";
import { Speak } from "../ui.tsx";

const ICON: Record<string, string> = { SkillDemonstration: "🧩", FacilitatorEndorsement: "⭐", ModuleCompletion: "📘", VerifiedPlacement: "💼" };

function CredentialCard({ c }: { c: HubCredential }) {
  const lang = activeProfile()!.lang;
  const [v, setV] = useState<VerifyResult | null>(null);
  const [qr, setQr] = useState("");
  const [open, setOpen] = useState(false);

  // Verified on the phone itself with WebCrypto: no network needed.
  useEffect(() => { verifyCredential(c.jws).then(setV); }, [c.jws]);
  useEffect(() => { if (open && !qr) QRCode.toDataURL(c.jws, { errorCorrectionLevel: "L", margin: 1, scale: 4 }).then(setQr); }, [open]);

  const a = v?.credential?.credentialSubject.achievement;
  return (
    <div class="card">
      <div class="card-row">
        <span class="emoji">{a ? ICON[a.type] : "🎖️"}</span>
        <div class="grow">
          <h3>{a?.name ?? "…"}</h3>
          <div class="small muted">{a?.type.replace(/([A-Z])/g, " $1").trim()} · {v?.credential?.issuer.name}</div>
          {a?.evidence && <div class="small">{a.evidence}</div>}
          <div style="margin-top:6px">{v == null ? "…" : v.valid ? <span class="chip good">✓ signature valid</span> : <span class="chip bad">✗ {v.error}</span>}</div>
        </div>
        {a && <Speak text={a.name} lang={lang} />}
      </div>
      <button class="btn quiet" style="margin-top:8px" onClick={() => setOpen(!open)}>▦ QR</button>
      {open && qr && (
        <div style="text-align:center;margin-top:8px">
          <img class="qr" src={qr} alt="Credential QR code" />
          <p class="small muted">{t(lang, "passport.verify")}</p>
          <p class="source" style="word-break:break-all">{v?.credential?.issuer.id.slice(0, 40)}…</p>
        </div>
      )}
    </div>
  );
}

export function Passport() {
  const s = useStore();
  const p = activeProfile()!;
  const lang = p.lang;
  const mine = s.credentials.filter((c) => c.studentId === p.id);
  const pendingTasks = s.outbox.filter((o) => o.kind === "task_result" && o.payload.studentId === p.id && Number(o.payload.score) >= 0.7).length;

  return (
    <div>
      <div class="row"><h1 class="grow">🎖️ {t(lang, "passport.title")}</h1><Speak text={t(lang, "passport.title")} lang={lang} /></div>
      <p class="small muted">W3C Verifiable Credentials, signed by your hub. In production linked to your APAAR ID and Academic Bank of Credits.</p>
      {pendingTasks > 0 && <div class="card wait">⏳ {t(lang, "sync.pending", { n: pendingTasks })}</div>}
      {mine.length === 0 && !pendingTasks && <div class="card">{t(lang, "passport.empty")}</div>}
      {mine.map((c) => <CredentialCard key={c.id} c={c} />)}
      <AccountPanel />
    </div>
  );
}
