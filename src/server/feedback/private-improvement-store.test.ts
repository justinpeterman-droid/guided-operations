import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const sql = vi.hoisted(() => vi.fn());
vi.mock("postgres", () => ({ default: () => sql }));
vi.mock("@/lib/env/auth-server", () => ({
  getAuthServerEnvironment: () => ({
    SUPABASE_DB_URL: "fictional-mocked-database",
  }),
}));
import { createPrivateImprovementStore } from "./private-improvement-store";
beforeEach(() => {
  sql.mockReset();
  sql.mockResolvedValue([]);
});
it("constrains upload recovery to the owner, facility, unexpired file, and verified matching metadata", async () => {
  const result =
    await createPrivateImprovementStore().getFormCandidateForUpload(
      "request-id",
      "owner-id",
      "facility-id",
    );
  expect(result).toBeNull();
  const [parts, ...values] = sql.mock.calls[0];
  const query = parts.join("?");
  expect(values).toEqual(["request-id", "owner-id", "owner-id", "facility-id"]);
  for (const clause of [
    "file.uploaded_by_account_id =",
    "request.submitted_by_account_id =",
    "request.facility_id =",
    "file.facility_id = request.facility_id",
    "file.expires_at > statement_timestamp()",
    "file.upload_state = 'uploading'",
    "file.upload_state = 'uploaded'",
    "file.actual_sha256 = file.declared_sha256",
    "file.actual_byte_size = file.declared_byte_size",
    "file.actual_media_type = file.declared_media_type",
  ])
    expect(query).toContain(clause);
});
