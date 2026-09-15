import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { policyReviewTls } from "./private-policy-review-store";
describe("policy review transport trust", () => {
  const ca =
    "-----BEGIN CERTIFICATE-----\nfictional\n-----END CERTIFICATE-----";
  it("requires verification and explicit CA trust", () => {
    expect(
      policyReviewTls(
        "postgresql://db.example.test/postgres?sslmode=verify-full",
        ca,
      ),
    ).toEqual({ rejectUnauthorized: true, ca });
    expect(() =>
      policyReviewTls("postgresql://db.example.test/postgres", undefined),
    ).toThrow();
    for (const mode of ["disable", "require", "prefer"])
      expect(() =>
        policyReviewTls(
          `postgresql://db.example.test/postgres?sslmode=${mode}`,
          ca,
        ),
      ).toThrow();
    expect(() =>
      policyReviewTls("postgresql://127.0.0.1/postgres", ca),
    ).toThrow();
  });
});
