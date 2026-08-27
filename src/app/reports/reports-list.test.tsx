import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ReportsList } from "./reports-list";

afterEach(cleanup);

describe("ReportsList", () => {
  it("filters only the authorized summaries it was given", async () => {
    const user = userEvent.setup();
    render(
      <ReportsList
        incidents={[
          {
            incidentId: "one",
            incidentNumber: "F-001",
            displayName: "Fictional training one",
            status: "draft",
            occurredAt: "2026-08-26T12:00:00Z",
            category: "training",
            currentRevisionNumber: 1,
          },
          {
            incidentId: "two",
            incidentNumber: "F-002",
            displayName: "Fictional training two",
            status: "complete",
            occurredAt: "2026-08-26T12:00:00Z",
            category: "exercise",
            currentRevisionNumber: 2,
          },
        ]}
        reports={[
          {
            reportId: "report-one",
            incidentNumber: "F-002",
            incidentName: "Fictional training two",
            reportType: "cover_letter",
            status: "draft",
            currentRevisionNumber: 1,
            updatedAt: "2026-08-26T12:00:00Z",
          },
        ]}
      />,
    );
    await user.type(
      screen.getByLabelText("Search your authorized reports"),
      "F-002",
    );
    expect(screen.getAllByText("Fictional training two")).toHaveLength(2);
    expect(
      screen.queryByText("Fictional training one"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cover letter" })).toHaveAttribute(
      "href",
      "/reports/report-one",
    );
    expect(screen.getByRole("link", { name: "F-002" })).toHaveAttribute(
      "href",
      "/incidents/two",
    );
  });
});
