import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getRuntimeEnvironment } from "./runtime";

describe("runtime environment", () => {
  it("accepts an exact HTTPS origin and supported environment", () => {
    expect(
      getRuntimeEnvironment({
        APP_ENV: "preview",
        APP_ORIGIN: "https://preview.example.test",
      }),
    ).toEqual({
      APP_ENV: "preview",
      APP_ORIGIN: "https://preview.example.test",
    });
  });

  it("rejects an origin with a path", () => {
    expect(() =>
      getRuntimeEnvironment({
        APP_ENV: "production",
        APP_ORIGIN: "https://guided-operations.example.test/workspace",
      }),
    ).toThrow(/APP_ORIGIN must be an origin/i);
  });

  it("derives an exact origin from the Vercel Preview hostname only in Preview", () => {
    expect(
      getRuntimeEnvironment({
        APP_ENV: "preview",
        VERCEL_URL: "guided-operations-pr-1.vercel.app",
      }),
    ).toEqual({
      APP_ENV: "preview",
      APP_ORIGIN: "https://guided-operations-pr-1.vercel.app",
    });
    expect(() =>
      getRuntimeEnvironment({
        APP_ENV: "production",
        VERCEL_URL: "guided-operations.vercel.app",
      }),
    ).toThrow(/APP_ORIGIN is required/i);
  });

  it("requires HTTPS for the production origin", () => {
    expect(() =>
      getRuntimeEnvironment({
        APP_ENV: "production",
        APP_ORIGIN: "http://guided-operations.example.test",
      }),
    ).toThrow(/must use HTTPS/i);
  });
});
