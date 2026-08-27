import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createEncryptedSupabaseSessionStorage,
  SUPABASE_SESSION_STORAGE_KEY,
  type SessionCookieChange,
} from "./encrypted-supabase-session-storage";

const encryptionKey = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function harness(initialCookies: Array<{ name: string; value: string }> = []) {
  let currentCookies = [...initialCookies];
  const changes: SessionCookieChange[][] = [];
  const storage = createEncryptedSupabaseSessionStorage({
    encryptionKey,
    secure: true,
    cookies: {
      readAll: () => currentCookies,
      writeAll: (nextChanges) => {
        changes.push(nextChanges);
        for (const change of nextChanges) {
          currentCookies = currentCookies.filter(
            ({ name }) => name !== change.name,
          );
          if (change.options.maxAge !== 0) {
            currentCookies.push({ name: change.name, value: change.value });
          }
        }
      },
    },
  });
  return { storage, changes, cookies: () => currentCookies };
}

describe("encrypted Supabase session storage", () => {
  it("round-trips a session without exposing its alias or tokens in cookies", async () => {
    const alias = "fictional-hidden-alias@auth.invalid";
    const accessToken = "fictional-access-token";
    const refreshToken = "fictional-refresh-token";
    const session = JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { email: alias },
    });
    const target = harness();

    await target.storage.setItem(SUPABASE_SESSION_STORAGE_KEY, session);

    const browserCookieText = target
      .cookies()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    expect(browserCookieText).not.toContain(alias);
    expect(browserCookieText).not.toContain(accessToken);
    expect(browserCookieText).not.toContain(refreshToken);
    expect(
      Buffer.from(browserCookieText, "base64url").toString("utf8"),
    ).not.toContain(alias);
    expect(await target.storage.getItem(SUPABASE_SESSION_STORAGE_KEY)).toBe(
      session,
    );

    const written = target.changes.flat();
    expect(written).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          options: expect.objectContaining({
            httpOnly: true,
            sameSite: "lax",
            secure: true,
            path: "/",
            priority: "high",
          }),
        }),
      ]),
    );
  });

  it("chunks a large session and requires a complete ordered set", async () => {
    const target = harness();
    const session = JSON.stringify({ padding: "x".repeat(7_000) });

    await target.storage.setItem(SUPABASE_SESSION_STORAGE_KEY, session);

    expect(target.cookies().length).toBeGreaterThan(1);
    expect(target.cookies()[0].name).toBe(`${SUPABASE_SESSION_STORAGE_KEY}.0`);
    expect(await target.storage.getItem(SUPABASE_SESSION_STORAGE_KEY)).toBe(
      session,
    );

    const incomplete = harness(target.cookies().slice(1));
    await expect(
      incomplete.storage.getItem(SUPABASE_SESSION_STORAGE_KEY),
    ).resolves.toBeNull();
    expect(incomplete.cookies()).toEqual([]);
  });

  it("fails closed and expires every session cookie after tampering", async () => {
    const target = harness();
    await target.storage.setItem(
      SUPABASE_SESSION_STORAGE_KEY,
      JSON.stringify({ access_token: "fictional-token" }),
    );
    const original = target.cookies()[0];
    const envelopeParts = original.value.split(".");
    envelopeParts[2] = `${envelopeParts[2][0] === "A" ? "B" : "A"}${envelopeParts[2].slice(1)}`;
    const tampered = harness([{ ...original, value: envelopeParts.join(".") }]);

    await expect(
      tampered.storage.getItem(SUPABASE_SESSION_STORAGE_KEY),
    ).resolves.toBeNull();
    expect(tampered.cookies()).toEqual([]);
    expect(tampered.changes.flat()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: original.name,
          value: "",
          options: expect.objectContaining({ maxAge: 0, httpOnly: true }),
        }),
      ]),
    );
  });

  it("ignores unrelated Auth storage slots and cookies", async () => {
    const target = harness([{ name: "unrelated", value: "keep" }]);

    await target.storage.setItem(
      `${SUPABASE_SESSION_STORAGE_KEY}-code-verifier`,
      "never-persisted",
    );
    await target.storage.removeItem(
      `${SUPABASE_SESSION_STORAGE_KEY}-code-verifier`,
    );

    expect(target.cookies()).toEqual([{ name: "unrelated", value: "keep" }]);
    await expect(
      target.storage.getItem(`${SUPABASE_SESSION_STORAGE_KEY}-user`),
    ).resolves.toBeNull();
  });
});
