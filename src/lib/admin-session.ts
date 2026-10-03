// Signed, expiring admin session tokens. Dependency-free (Web Crypto only, no
// next/headers) so both the proxy and server routes can verify them.
//
// A token is `<expiry ms>.<HMAC-SHA256 of the expiry>`. Without the secret it
// can't be forged, and it stops working on its own at the expiry — unlike the
// old fixed cookie value, which anyone could set by hand.
//
// The key is ADMIN_SESSION_SECRET, falling back to ADMIN_PASSWORD so the site
// keeps working before the new variable is set. Either way, changing it logs
// every admin out.

export const ADMIN_COOKIE = "aa_admin";

/** How long a login lasts. */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

const encoder = new TextEncoder();

function sessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`aa-admin-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** A fresh session token, or null when no secret is configured. */
export async function createAdminSession(now: number = Date.now()): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = String(now + ADMIN_SESSION_SECONDS * 1000);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(exp));
  return `${exp}.${toBase64Url(sig)}`;
}

/** True for an unexpired token signed with the current secret. */
export async function verifyAdminSession(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  if (!/^\d{1,16}$/.test(exp) || Number(exp) <= now) return false;
  const sig = fromBase64Url(token.slice(dot + 1));
  if (!sig) return false;
  // subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", await hmacKey(secret), sig, encoder.encode(exp));
}
