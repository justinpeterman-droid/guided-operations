import { createHmac } from "node:crypto";

export type AuthSubjectKind = "account" | "device" | "network" | "global";

export function hashAuthSubject(
  kind: AuthSubjectKind,
  value: string,
  key: string,
): string {
  if (key.length < 8) {
    throw new Error("Authentication subject HMAC key is not configured");
  }

  return createHmac("sha256", key)
    .update(kind, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("hex");
}
