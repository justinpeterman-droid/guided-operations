import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyOpenAiDataControls } from "./verify-openai-data-controls.mjs";

const validEnvironment = {
  OPENAI_DATA_CONTROLS_CHECK_ENABLED: "true",
  OPENAI_ADMIN_KEY: "fictional-admin-key-value",
  OPENAI_PROJECT_ID: "proj_fictional",
  OPENAI_DATA_RETENTION_MODE: "zero_data_retention",
  OPENAI_API_DATA_SHARING_ENABLED: "false",
};

describe("OpenAI project data-control verifier", () => {
  it("returns only value-free evidence for the exact approved project mode", async () => {
    let observedUrl = "";
    let observedAuthorization = "";
    const result = await verifyOpenAiDataControls({
      environment: validEnvironment,
      fetchImplementation: async (url, options) => {
        observedUrl = url;
        observedAuthorization = options.headers.Authorization;
        return Response.json({
          object: "project.data_retention",
          type: "zero_data_retention",
        });
      },
    });

    assert.equal(
      observedUrl,
      "https://api.openai.com/v1/organization/projects/proj_fictional/data_retention",
    );
    assert.equal(observedAuthorization, "Bearer fictional-admin-key-value");
    assert.deepEqual(result, {
      status: "verified",
      retentionMode: "zero_data_retention",
      apiDataSharingEnabled: false,
    });
    assert.doesNotMatch(
      JSON.stringify(result),
      /fictional-admin|proj_fictional/,
    );
  });

  it("rejects disabled sharing attestations, unapproved modes, and mismatches", async () => {
    let calls = 0;
    const fetchImplementation = async () => {
      calls += 1;
      return Response.json({
        object: "project.data_retention",
        type: "modified_abuse_monitoring",
      });
    };

    await assert.rejects(
      verifyOpenAiDataControls({
        environment: {
          ...validEnvironment,
          OPENAI_API_DATA_SHARING_ENABLED: "true",
        },
        fetchImplementation,
      }),
      /data sharing must be recorded as disabled/,
    );
    await assert.rejects(
      verifyOpenAiDataControls({
        environment: {
          ...validEnvironment,
          OPENAI_DATA_RETENTION_MODE: "none",
        },
        fetchImplementation,
      }),
      /not an approved value/,
    );
    assert.equal(calls, 0);

    await assert.rejects(
      verifyOpenAiDataControls({
        environment: validEnvironment,
        fetchImplementation,
      }),
      /does not match/,
    );
  });

  it("does not expose provider response bodies in failures", async () => {
    await assert.rejects(
      verifyOpenAiDataControls({
        environment: validEnvironment,
        fetchImplementation: async () =>
          new Response("restricted provider detail", { status: 403 }),
      }),
      (error) => {
        assert.doesNotMatch(error.message, /restricted provider detail/);
        return true;
      },
    );

    await assert.rejects(
      verifyOpenAiDataControls({
        environment: validEnvironment,
        fetchImplementation: async () => {
          throw new Error(
            "private transport failure for proj_fictional with fictional-admin-key-value",
          );
        },
      }),
      (error) => {
        assert.equal(
          error.message,
          "OpenAI project data-control verification failed",
        );
        return true;
      },
    );
  });
});
