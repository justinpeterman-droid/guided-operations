import { createHmac, randomBytes, randomUUID } from "node:crypto";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface IssuedOpaqueToken {
  id: string;
  secret: string;
  serialized: string;
}

export function issueOpaqueToken(): IssuedOpaqueToken {
  const id = randomUUID();
  const secret = randomBytes(32).toString("base64url");

  return {
    id,
    secret,
    serialized: `${id}.${secret}`,
  };
}

export function parseOpaqueToken(
  serialized: string,
): { id: string; secret: string } | null {
  const separator = serialized.indexOf(".");
  if (separator <= 0 || separator !== serialized.lastIndexOf(".")) {
    return null;
  }

  const id = serialized.slice(0, separator);
  const secret = serialized.slice(separator + 1);

  if (!UUID_V4_PATTERN.test(id) || !OPAQUE_SECRET_PATTERN.test(secret)) {
    return null;
  }

  return { id: id.toLowerCase(), secret };
}

export function hashOpaqueSecret(secret: string, key: string): string {
  if (key.length < 8) {
    throw new Error("Opaque token HMAC key is not configured");
  }

  return createHmac("sha256", key).update(secret, "utf8").digest("hex");
}
