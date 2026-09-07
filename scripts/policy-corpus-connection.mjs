import { readFileSync } from "node:fs";

/** Require certificate verification; only read-only local inspection permits plaintext. */
export function corpusDatabaseTls(
  databaseUrl,
  {
    allowLoopback = false,
    certificate = process.env.SUPABASE_DB_CA,
    readCertificate = readFileSync,
  } = {},
) {
  const url = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Invalid database protocol");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (loopback && allowLoopback) return false;
  if (loopback)
    throw new Error("Embedding requires the approved remote database");
  const mode = url.searchParams.get("sslmode");
  if (mode && mode !== "verify-full")
    throw new Error("Database requires certificate verification");
  const path = url.searchParams.get("sslrootcert");
  const ca = certificate || (path ? readCertificate(path, "utf8") : "");
  if (typeof ca !== "string" || !ca.includes("-----BEGIN CERTIFICATE-----"))
    throw new Error("A trusted database CA is required");
  return { rejectUnauthorized: true, ca };
}
