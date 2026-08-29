import { createHmac } from "node:crypto";

const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9-]{2,32}$/;

export function normalizeEmployeeNumber(value: string): string {
  const normalized = value.normalize("NFKC").trim().toUpperCase();

  if (!EMPLOYEE_NUMBER_PATTERN.test(normalized)) {
    throw new Error("Invalid employee number format");
  }

  return normalized;
}

export function employeeLookupDigest(
  employeeNumber: string,
  pepper: string,
): string {
  if (pepper.length < 8) {
    throw new Error("Employee lookup pepper is not configured");
  }

  return createHmac("sha256", pepper)
    .update(normalizeEmployeeNumber(employeeNumber), "utf8")
    .digest("hex");
}
