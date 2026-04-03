/** RFC 6238 TOTP (SHA-1) for authenticator apps — server-side only. */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]!;
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31]!;
  }
  return output;
}

function base32ToBytes(s: string): Uint8Array {
  const cleaned = s.toUpperCase().replace(/=+$/, "");
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE32.length; i++) {
    lookup[BASE32[i]!] = i;
  }
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of cleaned) {
    const idx = lookup[c];
    if (idx === undefined) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function counterToBytes(counter: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return buf;
}

async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return new Uint8Array(sig);
}

export async function totpCodeAt(
  secretB32: string,
  stepSeconds: number,
  t0: number,
  digits: number,
  nowMs: number,
): Promise<string> {
  const counter = BigInt(Math.floor((nowMs / 1000 - t0) / stepSeconds));
  const key = base32ToBytes(secretB32);
  const msg = counterToBytes(counter);
  const h = await hmacSha1(key, msg);
  const offset = h[h.length - 1]! & 0x0f;
  const bin =
    ((h[offset]! & 0x7f) << 24) |
    ((h[offset + 1]! & 0xff) << 16) |
    ((h[offset + 2]! & 0xff) << 8) |
    (h[offset + 3]! & 0xff);
  const mod = 10 ** digits;
  const code = (bin % mod).toString().padStart(digits, "0");
  return code;
}

export async function verifyTotp(
  secretB32: string,
  code: string,
  window = 1,
  nowMs = Date.now(),
): Promise<boolean> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (let w = -window; w <= window; w++) {
    const c = await totpCodeAt(secretB32, 30, 0, 6, nowMs + w * 30_000);
    if (c === trimmed) return true;
  }
  return false;
}
