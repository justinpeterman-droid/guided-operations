import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION,
  FICTIONAL_TEST_ROTATION_CONFIRMATION,
  GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF,
  GUIDED_OPERATIONS_LOCAL_ORIGIN,
  validateFictionalTestBootstrapRequest,
  validateFictionalTestRotationRequest,
} from "./fictional-test-administrator-bootstrap-guard.mjs";

const developmentEnvironment = {
  APP_ENV: "development",
  APP_ORIGIN: GUIDED_OPERATIONS_LOCAL_ORIGIN,
  AUTH_SESSION_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  EMPLOYEE_LOOKUP_PEPPER: "fictional-development-employee-pepper",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: `https://${GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF}.supabase.co`,
  SUPABASE_DB_URL: `postgresql://postgres.${GUIDED_OPERATIONS_DEVELOPMENT_PROJECT_REF}:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  SUPABASE_SECRET_KEY: "fictional-secret-key",
};

describe("fictional test administrator bootstrap guard", () => {
  it("accepts only an explicitly confirmed development request", () => {
    assert.doesNotThrow(() =>
      validateFictionalTestBootstrapRequest({
        argv: [FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION],
        environment: developmentEnvironment,
      }),
    );
  });

  it("accepts the separate explicit development-only rotation request", () => {
    assert.doesNotThrow(() =>
      validateFictionalTestRotationRequest({
        argv: [FICTIONAL_TEST_ROTATION_CONFIRMATION],
        environment: developmentEnvironment,
      }),
    );
  });

  it("rejects missing confirmation and non-development targets", () => {
    assert.throws(() =>
      validateFictionalTestBootstrapRequest({
        argv: [],
        environment: developmentEnvironment,
      }),
    );
    assert.throws(() =>
      validateFictionalTestBootstrapRequest({
        argv: [FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION],
        environment: { ...developmentEnvironment, APP_ENV: "production" },
      }),
    );
  });

  it("rejects the wrong hosted project and database", () => {
    assert.throws(() =>
      validateFictionalTestBootstrapRequest({
        argv: [FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION],
        environment: {
          ...developmentEnvironment,
          NEXT_PUBLIC_SUPABASE_URL: "https://wrong-project.supabase.co",
        },
      }),
    );
    assert.throws(() =>
      validateFictionalTestBootstrapRequest({
        argv: [FICTIONAL_TEST_BOOTSTRAP_CONFIRMATION],
        environment: {
          ...developmentEnvironment,
          SUPABASE_DB_URL:
            "postgresql://postgres.wrongproject:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
        },
      }),
    );
  });

  it("requires the guarded local session settings before rotation", () => {
    for (const environment of [
      { ...developmentEnvironment, APP_ORIGIN: "https://example.test" },
      {
        ...developmentEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
      { ...developmentEnvironment, EMPLOYEE_LOOKUP_PEPPER: "too-short" },
      { ...developmentEnvironment, AUTH_SESSION_ENCRYPTION_KEY: "" },
    ]) {
      assert.throws(() =>
        validateFictionalTestRotationRequest({
          argv: [FICTIONAL_TEST_ROTATION_CONFIRMATION],
          environment,
        }),
      );
    }
  });
});
