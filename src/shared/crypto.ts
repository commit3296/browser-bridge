import { BridgePayloadV2, EncryptedArchiveV2 } from "./types";
import { BridgePayloadV2Schema, EncryptedArchiveV2Schema } from "./schemas";

const ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export async function encryptPayload(
  payload: BridgePayloadV2,
  password: string,
): Promise<EncryptedArchiveV2> {
  const normalized = BridgePayloadV2Schema.parse(payload);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, toArrayBuffer(salt), ITERATIONS);
  const encoded = new TextEncoder().encode(JSON.stringify(normalized));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    app: "browser-bridge",
    schemaVersion: 2,
    createdAt: normalized.createdAt,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: ITERATIONS,
    },
    cipher: {
      name: "AES-GCM",
    },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptArchive(
  archive: EncryptedArchiveV2,
  password: string,
): Promise<BridgePayloadV2> {
  const normalized = EncryptedArchiveV2Schema.parse(archive);
  const salt = base64ToBytes(normalized.salt);
  const iv = base64ToBytes(normalized.iv);
  const key = await deriveKey(password, toArrayBuffer(salt), normalized.kdf.iterations);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(normalized.ciphertext),
    );
    const parsed = JSON.parse(new TextDecoder().decode(decrypted));
    return BridgePayloadV2Schema.parse(parsed);
  } catch (error) {
    throw new Error("Cannot decrypt archive. Check the password and file integrity.", {
      cause: error,
    });
  }
}

async function deriveKey(password: string, salt: ArrayBuffer, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array) {
  if (typeof btoa === "function") {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(base64: string) {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
