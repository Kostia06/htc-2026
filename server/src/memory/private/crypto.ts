export type Sealed = { ciphertext: string; iv: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// fixed salt is fine here: the secret is already high-entropy, and the user id as HKDF info is what separates the keys
const SALT = encoder.encode("htc-mentor/private-memory/v1");

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function keyFor(secret: string, userId: string) {
  const master = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: SALT, info: encoder.encode(userId) },
    master,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptFor(secret: string, userId: string, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(secret, userId);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

// throws when the key is wrong: AES-GCM authenticates, so another user's key fails instead of returning garbage
export async function decryptFor(secret: string, userId: string, sealed: Sealed): Promise<string> {
  const key = await keyFor(secret, userId);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.ciphertext));
  return decoder.decode(plain);
}
