import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewIncidentWorkspace } from "./new-incident-workspace";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NewIncidentWorkspace", () => {
  it("keeps AI category and fact suggestions pending for officer review", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              staff: [
                {
                  staffMemberId: "11111111-1111-4111-8111-111111111111",
                  displayName: "Fictional Officer",
                  employeeNumberHint: "11",
                  shiftCode: "A",
                  isCurrentAccount: true,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              categoryKey: "incident_no_disciplinary",
              proposals: [
                {
                  key: "field-note-line-1-fact-1",
                  sourceText: "Fictional raw training note.",
                  value: "Fictional structured training fact.",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    const user = userEvent.setup();
    render(<NewIncidentWorkspace />);

    await user.click(
      await screen.findByRole("button", {
        name: "Confirm officer relationships",
      }),
    );
    await user.type(screen.getByLabelText("Incident number"), "FICTIONAL-102");
    await user.type(screen.getByLabelText("Incident name"), "AI training");
    fireEvent.change(screen.getByLabelText("Date and time occurred"), {
      target: { value: "2026-08-27T13:00" },
    });
    await user.type(screen.getByLabelText("Location"), "Training room");
    await user.type(
      screen.getByLabelText("Your field notes"),
      "Fictional raw training note.",
    );
    await user.click(
      screen.getByRole("button", { name: "Suggest category and facts" }),
    );

    expect(await screen.findByText(/AI suggestions are ready/)).toBeVisible();
    expect(screen.getByLabelText("Incident category")).toHaveValue(
      "incident_no_disciplinary",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Confirm category and review facts",
      }),
    );
    expect(
      screen.getByDisplayValue("Fictional structured training fact."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Confirm fact" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/web/v1/incident-fact-proposals",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("keeps missing information explicit through review before a protected save", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              staff: [
                {
                  staffMemberId: "11111111-1111-4111-8111-111111111111",
                  displayName: "Fictional Officer",
                  employeeNumberHint: "11",
                  shiftCode: "A",
                  isCurrentAccount: true,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 201 }),
      );
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("a".repeat(32));
    const user = userEvent.setup();
    render(<NewIncidentWorkspace />);

    await user.click(
      await screen.findByRole("button", {
        name: "Confirm officer relationships",
      }),
    );
    await user.type(screen.getByLabelText("Incident number"), "FICTIONAL-101");
    await user.type(
      screen.getByLabelText("Incident name"),
      "Training scenario",
    );
    fireEvent.change(screen.getByLabelText("Date and time occurred"), {
      target: { value: "2026-08-27T12:00" },
    });
    await user.type(screen.getByLabelText("Location"), "Training room");
    await user.selectOptions(
      screen.getByLabelText("Incident category"),
      "incident_no_disciplinary",
    );
    await user.type(
      screen.getByLabelText("Your field notes"),
      "Fictional observed note.",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Confirm category and review facts",
      }),
    );
    expect(screen.getByText("Source note")).toBeVisible();
    expect(screen.getByDisplayValue("Fictional observed note.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm fact" }));
    await user.type(
      screen.getByLabelText("Information not yet known"),
      "Fictional missing detail.",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Continue to missing information",
      }),
    );

    await user.selectOptions(
      screen.getByLabelText(
        "What was the medical disposition for the inmate or inmates? answer",
      ),
      "N/A - no injuries reported",
    );
    const investigationQuestion = screen
      .getByText(/Did an investigation occur\?/)
      .closest("fieldset");
    expect(investigationQuestion).not.toBeNull();
    await user.click(
      within(investigationQuestion as HTMLFieldSetElement).getByRole("button", {
        name: "No",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Review report types" }),
    );

    expect(screen.getByText("Fictional missing detail.")).toBeVisible();
    expect(screen.getByText("first person")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Continue to Forms & Export" }),
    );
    expect(screen.getByText("005 409")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save incident" }));

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/web/v1/staff?limit=100", {
      credentials: "same-origin",
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/auth/csrf", {
      credentials: "same-origin",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/web/v1/incidents",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    const [, request] = fetch.mock.calls[2] as [string, RequestInit];
    const savedBody = JSON.parse(request.body as string) as {
      staffRelationships: Array<{
        staffMemberId: string;
        relationship: string;
      }>;
      revision: {
        schemaVersion: number;
        category: string;
        fieldNotes: Array<{ text: string }>;
        reviewedFacts: Array<{
          field: string;
          state: string;
          reportingStaffMemberIds?: string[];
        }>;
      };
    };
    expect(savedBody.staffRelationships).toEqual([
      {
        staffMemberId: "11111111-1111-4111-8111-111111111111",
        relationship: "preparer",
      },
      {
        staffMemberId: "11111111-1111-4111-8111-111111111111",
        relationship: "reporting_officer",
      },
    ]);
    expect(savedBody.revision.schemaVersion).toBe(2);
    expect(savedBody.revision.category).toBe("incident_no_disciplinary");
    expect(savedBody.revision.fieldNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining("Training room"),
        }),
      ]),
    );
    expect(savedBody.revision.reviewedFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "Officer-confirmed fact 1",
          state: "confirmed",
          value: "Fictional observed note.",
        }),
        expect.objectContaining({
          field: expect.stringContaining(
            "[report-checklist:bmu-legacy-candidate@1:medical_disposition]",
          ),
        }),
      ]),
    );
    expect(
      savedBody.revision.reviewedFacts
        .filter(({ state }) => state === "confirmed")
        .every(({ reportingStaffMemberIds }) =>
          reportingStaffMemberIds?.includes(
            "11111111-1111-4111-8111-111111111111",
          ),
        ),
    ).toBe(true);
    expect(await screen.findByText(/Incident saved/)).toBeVisible();
  });
});
