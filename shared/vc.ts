// Talent Passport credentials: W3C Verifiable Credentials 2.0, secured as a compact
// JWS (EdDSA / Ed25519). The issuer is a did:key, so the public key travels inside
// the credential and a QR can be verified with no network. In production the hub
// anchors issuers in Sunbird RC and links holders to their APAAR ID.
// Pure WebCrypto: the same code verifies on the hub and in the phone's browser.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function unbase58(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("bad base58");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}

const ED25519_MULTICODEC = [0xed, 0x01];

export function didKeyFromPublic(raw: Uint8Array): string {
  return `did:key:z${base58(new Uint8Array([...ED25519_MULTICODEC, ...raw]))}`;
}

export function publicFromDidKey(did: string): Uint8Array {
  const m = /^did:key:z([1-9A-HJ-NP-Za-km-z]+)/.exec(did);
  if (!m) throw new Error("not a did:key");
  const bytes = unbase58(m[1]);
  if (bytes[0] !== 0xed || bytes[1] !== 0x01) throw new Error("not an Ed25519 did:key");
  return bytes.slice(2);
}

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const enc = new TextEncoder();

export interface TalentClaim {
  type: "SkillDemonstration" | "FacilitatorEndorsement" | "ModuleCompletion" | "VerifiedPlacement";
  name: string; // e.g. "Basic wiring task" or "Recommended for solar apprenticeship"
  occupation?: string; // NCO-2015 unit group or occupation id
  level?: string;
  evidence?: string; // never raw personal data; a short description or hash
}

export interface Credential {
  "@context": string[];
  type: string[];
  id: string;
  issuer: { id: string; name: string };
  validFrom: string;
  credentialSubject: { id: string; name: string; achievement: TalentClaim };
}

export function buildCredential(issuerDid: string, issuerName: string, holderId: string, holderName: string, claim: TalentClaim, now = new Date()): Credential {
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential", "HunarSetuTalentCredential"],
    id: `urn:uuid:${crypto.randomUUID()}`,
    issuer: { id: issuerDid, name: issuerName },
    validFrom: now.toISOString(),
    credentialSubject: { id: `urn:hunarsetu:student:${holderId}`, name: holderName, achievement: claim },
  };
}

export async function signCredential(vc: Credential, privateKey: CryptoKey): Promise<string> {
  const header = { alg: "EdDSA", typ: "vc+jwt", kid: `${vc.issuer.id}#${vc.issuer.id.slice(8)}` };
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(vc)))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, enc.encode(input)));
  return `${input}.${b64url(sig)}`;
}

export interface VerifyResult {
  valid: boolean;
  credential?: Credential;
  error?: string;
}

export async function verifyCredential(jws: string, trustedIssuers?: string[]): Promise<VerifyResult> {
  try {
    const [h, p, s] = jws.trim().split(".");
    if (!h || !p || !s) return { valid: false, error: "malformed" };
    const header = JSON.parse(new TextDecoder().decode(unb64url(h)));
    if (header.alg !== "EdDSA") return { valid: false, error: "unsupported alg" };
    const vc = JSON.parse(new TextDecoder().decode(unb64url(p))) as Credential;
    const raw = publicFromDidKey(vc.issuer.id);
    const key = await crypto.subtle.importKey("raw", raw as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("Ed25519", key, unb64url(s) as BufferSource, enc.encode(`${h}.${p}`));
    if (!ok) return { valid: false, credential: vc, error: "signature does not match" };
    if (trustedIssuers && !trustedIssuers.includes(vc.issuer.id)) return { valid: false, credential: vc, error: "issuer not on the trusted list" };
    return { valid: true, credential: vc };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}
