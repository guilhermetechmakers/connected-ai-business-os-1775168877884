/**
 * AES-GCM encrypt/decrypt for connector credential blobs.
 * Set CREDENTIALS_MASTER_KEY to base64-encoded 32-byte key (openssl rand -base64 32).
 */
const ALGO = "AES-GCM";

async function decodeKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(masterKeyB64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("CREDENTIALS_MASTER_KEY must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"]);
}

export async function encryptCredentialsJson(
  plainObject: Record<string, unknown>,
  masterKeyB64: string,
): Promise<string> {
  const key = await decodeKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(plainObject));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGO, iv }, key, plain),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptCredentialsJson(
  packedB64: string,
  masterKeyB64: string,
): Promise<Record<string, unknown>> {
  const key = await decodeKey(masterKeyB64);
  const packed = Uint8Array.from(atob(packedB64), (c) => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const cipher = packed.slice(12);
  const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, cipher);
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text) as Record<string, unknown>;
}

export function maskSecret(value: string, visible = 4): string {
  if (!value || value.length <= visible * 2) return "••••••••";
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}
