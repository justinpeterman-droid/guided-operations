import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyPaperworkDocument } from "@/server/paperwork/get-daily-paperwork";

import { DailyPaperworkWorkspace } from "./daily-paperwork-workspace";

const paperwork: DailyPaperworkDocument = {
  kind: "assignment_roster",
  title: "Fictional Training Assignment Roster",
  workDate: "2026-08-27",
  shiftCode: "A",
  templateId: "33333333-3333-4333-8333-333333333333",
  controllingTemplateId: "33333333-3333-4333-8333-333333333333",
  templateVersion: 1,
  sourceRevision: "FICTIONAL-V1",
  sourceSha256: "a".repeat(64),
  printOrientation: "landscape",
  capabilities: ["screen", "print"],
  structure: { schema_version: 1 },
  fieldSchema: {
    schema_version: 1,
    fields: [
      {
        key: "supervisor",
        label: "Fictional supervisor",
        type: "text",
        required: true,
        max_length: 100,
      },
    ],
    tables: [
      {
        key: "entries",
        label: "Fictional entries",
        min_rows: 0,
        max_rows: 2,
        columns: [
          {
            key: "ready",
            label: "Ready",
            type: "boolean",
            required: false,
          },
        ],
      },
    ],
  },
  editable: true,
  recordId: null,
  currentRevisionNumber: 0,
  payload: {
    schema_version: 1,
    fields: { supervisor: null },
    tables: { entries: [] },
  },
  validation: null,
  reason: null,
  savedAt: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DailyPaperworkWorkspace", () => {
  it("renders the private schema, adds a row, and saves only entered values", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              recordId: "44444444-4444-4444-8444-444444444444",
              revisionNumber: 1,
            },
          }),
          { status: 201 },
        ),
      );
    render(<DailyPaperworkWorkspace initialPaperwork={paperwork} />);

    await user.type(
      screen.getByLabelText("Fictional supervisor"),
      "Fictional Supervisor",
    );
    await user.click(screen.getByRole("button", { name: "Add row" }));
    await user.selectOptions(screen.getByLabelText("Ready"), "true");
    await user.click(screen.getByRole("button", { name: "Save new revision" }));

    await waitFor(() =>
      expect(screen.getByText(/Saved as revision 1/)).toBeInTheDocument(),
    );
    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall?.[0]).toBe("/api/web/v1/daily-paperwork");
    const request = saveCall?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      kind: "assignment_roster",
      workDate: "2026-08-27",
      shiftCode: "A",
      baseRevisionNumber: 0,
      payload: {
        schema_version: 1,
        fields: { supervisor: "Fictional Supervisor" },
        tables: { entries: [{ ready: true }] },
      },
      reason: "Initial Daily Paperwork save.",
    });
  });

  it("keeps a retired historical form read-only", () => {
    render(
      <DailyPaperworkWorkspace
        initialPaperwork={{ ...paperwork, editable: false }}
      />,
    );
    expect(screen.getByLabelText("Fictional supervisor")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save new revision" }),
    ).toBeDisabled();
    expect(screen.getByText(/historical source version/i)).toBeInTheDocument();
  });
});
