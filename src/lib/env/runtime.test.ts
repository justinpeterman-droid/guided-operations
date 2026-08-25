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
});
