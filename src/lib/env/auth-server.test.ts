import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuthServerEnvironment } from "./auth-server";

describe("auth server environment", () => {
  it("fails closed when required server-only credentials are absent", () => {
    const environment = process.env;
    vi.stubGlobal("process", { ...process, env: {} });

    expect(() => getAuthServerEnvironment()).toThrow();

    vi.stubGlobal("process", { ...process, env: environment });
  });
});
