import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOpenAiDataControlsEnvironment } from "./openai-data-controls";

const validEnvironment = {
  OPENAI_DATA_CONTROLS_APPROVAL_REF: "owner-approval-2026-08-28",
  OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
  OPENAI_API_DATA_SHARING_ENABLED: "false",
};

describe("OpenAI data controls environment", () => {
  it("accepts a documented approved retention mode with data sharing disabled", () => {
    expect(getOpenAiDataControlsEnvironment(validEnvironment)).toEqual({
      ...validEnvironment,
      OPENAI_API_DATA_SHARING_ENABLED: false,
    });
  });

  it.each([
    "zero_data_retention",
    "modified_abuse_monitoring",
    "enhanced_zero_data_retention",
    "enhanced_modified_abuse_monitoring",
  ])("accepts the approved provider mode %s", (mode) => {
    expect(() =>
      getOpenAiDataControlsEnvironment({
        ...validEnvironment,
        OPENAI_DATA_RETENTION_MODE: mode,
      }),
    ).not.toThrow();
  });

  it.each(["organization_default", "none", "default", undefined])(
    "rejects an unverified retention mode %s",
    (mode) => {
      expect(() =>
        getOpenAiDataControlsEnvironment({
          ...validEnvironment,
          OPENAI_DATA_RETENTION_MODE: mode,
        }),
      ).toThrow();
    },
  );

  it("rejects missing approval evidence or enabled API data sharing", () => {
    expect(() =>
      getOpenAiDataControlsEnvironment({
        ...validEnvironment,
        OPENAI_DATA_CONTROLS_APPROVAL_REF: undefined,
      }),
    ).toThrow();
    expect(() =>
      getOpenAiDataControlsEnvironment({
        ...validEnvironment,
        OPENAI_API_DATA_SHARING_ENABLED: "true",
      }),
    ).toThrow();
  });
});

describe("fictional corpus exemption", () => {
  it("waives the retention attestation for an explicitly fictional corpus", () => {
    expect(
      getOpenAiDataControlsEnvironment({
        POLICY_CORPUS_CLASSIFICATION: "fictional",
        OPENAI_API_DATA_SHARING_ENABLED: "false",
      }),
    ).toEqual({
      POLICY_CORPUS_CLASSIFICATION: "fictional",
      OPENAI_API_DATA_SHARING_ENABLED: false,
    });
  });

  it("still forbids API data sharing for a fictional corpus", () => {
    expect(() =>
      getOpenAiDataControlsEnvironment({
        POLICY_CORPUS_CLASSIFICATION: "fictional",
        OPENAI_API_DATA_SHARING_ENABLED: "true",
      }),
    ).toThrow();
  });

  it.each(["restricted", "Fictional", "fictional ", "", "real"])(
    "requires the full attestation when the classification is %o",
    (classification) => {
      expect(() =>
        getOpenAiDataControlsEnvironment({
          POLICY_CORPUS_CLASSIFICATION: classification,
          OPENAI_API_DATA_SHARING_ENABLED: "false",
        }),
      ).toThrow();
    },
  );

  it("requires the full attestation when no classification is set", () => {
    expect(() =>
      getOpenAiDataControlsEnvironment({
        OPENAI_API_DATA_SHARING_ENABLED: "false",
      }),
    ).toThrow();
  });

  it("accepts a complete attestation for a restricted corpus", () => {
    expect(
      getOpenAiDataControlsEnvironment({
        POLICY_CORPUS_CLASSIFICATION: "restricted",
        OPENAI_DATA_CONTROLS_APPROVAL_REF: "owner-approval-2026-08-28",
        OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
        OPENAI_API_DATA_SHARING_ENABLED: "false",
      }),
    ).toEqual({
      OPENAI_DATA_CONTROLS_APPROVAL_REF: "owner-approval-2026-08-28",
      OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
      OPENAI_API_DATA_SHARING_ENABLED: false,
    });
  });
});
