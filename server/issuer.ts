import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { dataDir } from "./store.ts";
import { didKeyFromPublic, buildCredential, signCredential, type TalentClaim } from "../shared/vc.ts";

// One Ed25519 issuer key per hub, created on first run and kept in data/.
const KEY_FILE = join(dataDir, "issuer-key.json");
const SECRET_FILE = join(dataDir, "secret");

let issuer: { did: string; name: string; privateKey: CryptoKey } | undefined;

export async function getIssuer() {
  if (issuer) return issuer;
  mkdirSync(dataDir, { recursive: true });
  let jwk: JsonWebKey;
  if (existsSync(KEY_FILE)) {
    jwk = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    writeFileSync(KEY_FILE, JSON.stringify(jwk), { mode: 0o600 });
  }
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
  const pub = Uint8Array.from(Buffer.from(jwk.x!, "base64url"));
  issuer = { did: didKeyFromPublic(pub), name: process.env.HUB_NAME ?? "Hunar Setu Hub (demo)", privateKey };
  return issuer;
}

export async function issue(holderId: string, holderName: string, claim: TalentClaim): Promise<string> {
  const i = await getIssuer();
  return signCredential(buildCredential(i.did, i.name, holderId, holderName, claim), i.privateKey);
}

// ---- facilitator auth: scrypt PINs, HMAC session tokens ----

const secret = (() => {
  mkdirSync(dataDir, { recursive: true });
  if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(SECRET_FILE, "utf8");
})();

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function checkPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const got = scryptSync(pin, salt, 32);
  return timingSafeEqual(got, Buffer.from(hash, "hex"));
}

export function tokenFor(facilitatorId: string): string {
  return `${facilitatorId}.${createHmac("sha256", secret).update(facilitatorId).digest("base64url")}`;
}

export function facilitatorFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, mac] = token.replace(/^Bearer\s+/i, "").split(".");
  if (!id || !mac) return null;
  const want = createHmac("sha256", secret).update(id).digest("base64url");
  return want.length === mac.length && timingSafeEqual(Buffer.from(want), Buffer.from(mac)) ? id : null;
}
