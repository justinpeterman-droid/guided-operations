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
