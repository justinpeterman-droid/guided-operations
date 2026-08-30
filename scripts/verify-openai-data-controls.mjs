import { pathToFileURL } from "node:url";

const APPROVED_RETENTION_MODES = new Set([
  "zero_data_retention",
  "modified_abuse_monitoring",
  "enhanced_zero_data_retention",
  "enhanced_modified_abuse_monitoring",
]);

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required operator variable: ${name}`);
  return value;
}

/**
 * Verifies value-free OpenAI project data-control evidence. The Admin key and
 * project identifier are used only for the request and are never returned.
 */
export async function verifyOpenAiDataControls({
  environment = process.env,
  fetchImplementation = fetch,
} = {}) {
  if (environment.OPENAI_DATA_CONTROLS_CHECK_ENABLED !== "true") {
    throw new Error("OpenAI data-controls operator check is not enabled");
  }
  if (environment.OPENAI_API_DATA_SHARING_ENABLED !== "false") {
    throw new Error("OpenAI API data sharing must be recorded as disabled");
  }

  const adminKey = required(environment, "OPENAI_ADMIN_KEY");
  const projectId = required(environment, "OPENAI_PROJECT_ID");
  if (!/^[A-Za-z0-9_-]{2,160}$/.test(projectId)) {
    throw new Error("OpenAI project identifier is invalid");
  }
  const expectedMode = required(environment, "OPENAI_DATA_RETENTION_MODE");
  if (!APPROVED_RETENTION_MODES.has(expectedMode)) {
    throw new Error("OpenAI retention mode is not an approved value");
  }

  let response;
  try {
    response = await fetchImplementation(
      `https://api.openai.com/v1/organization/projects/${encodeURIComponent(projectId)}/data_retention`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new Error("OpenAI project data-control verification failed");
  }
  if (!response.ok) {
    throw new Error("OpenAI project data-control verification failed");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("OpenAI project data-control verification failed");
  }
  if (
    payload?.object !== "project.data_retention" ||
    payload.type !== expectedMode ||
    !APPROVED_RETENTION_MODES.has(payload.type)
  ) {
    throw new Error(
      "OpenAI project retention does not match the approved mode",
    );
  }

  return Object.freeze({
    status: "verified",
    retentionMode: payload.type,
    apiDataSharingEnabled: false,
  });
}

async function main() {
  try {
    const evidence = await verifyOpenAiDataControls();
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
