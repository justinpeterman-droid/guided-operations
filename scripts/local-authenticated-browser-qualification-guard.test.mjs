import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LOCAL_BROWSER_QUALIFICATION_CONFIRMATION,
  validateLocalBrowserQualificationRequest,
} from "./local-authenticated-browser-qualification-guard.mjs";

const localStatus = {
  API_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  PUBLISHABLE_KEY: "fictional-local-publishable-key",
  SECRET_KEY: "fictional-local-secret-key",
};

describe("local authenticated browser qualification guard", () => {
  it("accepts only the exact confirmed local Supabase target", () => {
    assert.deepEqual(
      validateLocalBrowserQualificationRequest({
        argv: [LOCAL_BROWSER_QUALIFICATION_CONFIRMATION],
        status: localStatus,
      }),
      {
        apiUrl: localStatus.API_URL,
        databaseUrl: localStatus.DB_URL,
        publishableKey: localStatus.PUBLISHABLE_KEY,
        secretKey: localStatus.SECRET_KEY,
      },
    );
  });

  it("rejects a missing confirmation before returning local credentials", () => {
    assert.throws(
      () =>
        validateLocalBrowserQualificationRequest({
          argv: [],
          status: localStatus,
        }),
      /requires --confirm-local-guided-operations/,
    );
  });

  it("rejects hosted, wrong-port, and incomplete targets", () => {
    for (const status of [
      { ...localStatus, API_URL: "https://example.supabase.co" },
      {
        ...localStatus,
        DB_URL: "postgresql://postgres:postgres@127.0.0.1:54323/postgres",
      },
      { ...localStatus, SECRET_KEY: "", SERVICE_ROLE_KEY: "" },
    ]) {
      assert.throws(() =>
        validateLocalBrowserQualificationRequest({
          argv: [LOCAL_BROWSER_QUALIFICATION_CONFIRMATION],
          status,
        }),
      );
    }
  });
});
