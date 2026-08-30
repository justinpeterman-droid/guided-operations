import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SUPABASE_SESSION_STORAGE_KEY = "go-auth-session";

const COOKIE_CHUNK_SIZE = 2_800;
const MAX_COOKIE_CHUNKS = 8;
const MAX_PLAINTEXT_BYTES = 16_384;
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const ENVELOPE_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ASSOCIATED_DATA = Buffer.from(
  "guided-operations:supabase-session:v1",
  "utf8",
);

type CookieValue = Readonly<{ name: string; value: string }>;

export type SessionCookieChange = Readonly<{
  name: string;
  value: string;
  options: Readonly<{
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
    priority: "high";
  }>;
}>;

export type SessionCookieIo = Readonly<{
  readAll(): CookieValue[];
  writeAll(changes: SessionCookieChange[]): void | Promise<void>;
}>;

type SessionStorageOptions = Readonly<{
  encryptionKey: string;
  secure: boolean;
  cookies: SessionCookieIo;
}>;

export type EncryptedSupabaseSessionStorage = Readonly<{
  isServer: true;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}>;

function decodeEncryptionKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== encoded) {
    throw new Error("Invalid auth session encryption key.");
  }
  return key;
}

function encryptSession(value: string, key: Buffer): string {
  if (Buffer.byteLength(value, "utf8") > MAX_PLAINTEXT_BYTES) {
    throw new Error("Auth session exceeds the encrypted-cookie size limit.");
  }

  const nonce = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, nonce);
  cipher.setAAD(ASSOCIATED_DATA);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    nonce.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function decryptSession(envelope: string, key: Buffer): string | null {
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) return null;

  try {
    const nonce = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    if (
      nonce.length !== 12 ||
      tag.length !== 16 ||
      ciphertext.length > MAX_PLAINTEXT_BYTES
    ) {
      return null;
    }

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, nonce);
    decipher.setAAD(ASSOCIATED_DATA);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function isSessionCookie(name: string): boolean {
  return (
    name === SUPABASE_SESSION_STORAGE_KEY ||
    name.startsWith(`${SUPABASE_SESSION_STORAGE_KEY}.`)
  );
}

function readEncryptedEnvelope(cookies: CookieValue[]): string | null {
  const matching = cookies.filter(({ name }) => isSessionCookie(name));
  const unchunked = matching.filter(
    ({ name }) => name === SUPABASE_SESSION_STORAGE_KEY,
  );
  const chunked = matching.filter(
    ({ name }) => name !== SUPABASE_SESSION_STORAGE_KEY,
  );

  if (unchunked.length > 1 || (unchunked.length === 1 && chunked.length > 0)) {
    return null;
  }
  if (unchunked.length === 1) return unchunked[0].value;
  if (chunked.length === 0 || chunked.length > MAX_COOKIE_CHUNKS) return null;

  const ordered = chunked
    .map(({ name, value }) => {
      const suffix = name.slice(SUPABASE_SESSION_STORAGE_KEY.length + 1);
      return /^(0|[1-9][0-9]*)$/.test(suffix)
        ? { index: Number(suffix), value }
        : null;
    })
    .sort((left, right) => (left?.index ?? -1) - (right?.index ?? -1));

  if (
    ordered.some(
      (chunk, index) =>
        !chunk || chunk.index !== index || index >= MAX_COOKIE_CHUNKS,
    )
  ) {
    return null;
  }

  return ordered.map((chunk) => chunk?.value ?? "").join("");
}

function splitEncryptedEnvelope(envelope: string): CookieValue[] {
  if (envelope.length <= COOKIE_CHUNK_SIZE) {
    return [{ name: SUPABASE_SESSION_STORAGE_KEY, value: envelope }];
  }

  const chunks: CookieValue[] = [];
  for (let offset = 0; offset < envelope.length; offset += COOKIE_CHUNK_SIZE) {
    chunks.push({
      name: `${SUPABASE_SESSION_STORAGE_KEY}.${chunks.length}`,
      value: envelope.slice(offset, offset + COOKIE_CHUNK_SIZE),
    });
  }
  if (chunks.length > MAX_COOKIE_CHUNKS) {
    throw new Error("Encrypted auth session requires too many cookies.");
  }
  return chunks;
}

function cookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/" as const,
    maxAge,
    priority: "high" as const,
  };
}

function replacementChanges(
  currentCookies: CookieValue[],
  replacement: CookieValue[],
  secure: boolean,
): SessionCookieChange[] {
  const nextByName = new Map(
    replacement.map((cookie) => [cookie.name, cookie]),
  );
  const changes: SessionCookieChange[] = [];

  for (const current of currentCookies.filter(({ name }) =>
    isSessionCookie(name),
  )) {
    if (!nextByName.has(current.name)) {
      changes.push({
        name: current.name,
        value: "",
        options: cookieOptions(secure, 0),
      });
    }
  }
  for (const cookie of replacement) {
    changes.push({
      ...cookie,
      options: cookieOptions(secure, COOKIE_MAX_AGE_SECONDS),
    });
  }
  return changes;
}

/**
 * Stores only the Supabase access/refresh session as authenticated ciphertext.
 * The browser receives no token, provider alias, or user object it can decode.
 */
export function createEncryptedSupabaseSessionStorage({
  encryptionKey,
  secure,
  cookies,
}: SessionStorageOptions): EncryptedSupabaseSessionStorage {
  const key = decodeEncryptionKey(encryptionKey);

  async function clearSessionCookies() {
    const changes = replacementChanges(cookies.readAll(), [], secure);
    if (changes.length > 0) await cookies.writeAll(changes);
  }

  return {
    isServer: true,
    async getItem(storageKey) {
      if (storageKey !== SUPABASE_SESSION_STORAGE_KEY) return null;

      const envelope = readEncryptedEnvelope(cookies.readAll());
      if (!envelope) {
        await clearSessionCookies();
        return null;
      }

      const plaintext = decryptSession(envelope, key);
      if (plaintext === null) await clearSessionCookies();
      return plaintext;
    },
    async setItem(storageKey, value) {
      if (storageKey !== SUPABASE_SESSION_STORAGE_KEY) return;

      const replacement = splitEncryptedEnvelope(encryptSession(value, key));
      await cookies.writeAll(
        replacementChanges(cookies.readAll(), replacement, secure),
      );
    },
    async removeItem(storageKey) {
      if (storageKey === SUPABASE_SESSION_STORAGE_KEY) {
        await clearSessionCookies();
      }
    },
  };
}
