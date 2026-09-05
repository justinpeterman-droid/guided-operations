import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ReportsList } from "./reports-list";

afterEach(cleanup);

describe("ReportsList", () => {
  it("displays and searches the category label without exposing its internal code", async () => {
    const user = userEvent.setup();
    render(
      <ReportsList
        reports={[]}
        incidents={[
          {
            incidentId: "fictional",
            incidentNumber: "F-003",
            displayName: "Fictional category review",
            status: "draft",
            occurredAt: "2026-09-05T12:00:00Z",
            category: "incident_no_disciplinary",
            currentRevisionNumber: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("Incident (No Disciplinary)")).toBeVisible();
    expect(
      screen.queryByText("incident_no_disciplinary"),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Search your authorized reports"),
      "No Disciplinary",
    );
    expect(screen.getByRole("link", { name: "F-003" })).toBeVisible();
  });
  it("filters only the authorized summaries it was given", async () => {
    const user = userEvent.setup();
    const view = render(
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

    expect(view.container.querySelectorAll('[data-slot="badge"]')).toHaveLength(
      2,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing 1 of 2 incidents and 1 of 1 reports",
    );
    await user.clear(screen.getByLabelText("Search your authorized reports"));
    await user.type(
      screen.getByLabelText("Search your authorized reports"),
      "Cover letter",
    );
    expect(screen.getByRole("link", { name: "Cover letter" })).toBeVisible();
    await user.clear(screen.getByLabelText("Search your authorized reports"));
    await user.type(
      screen.getByLabelText("Search your authorized reports"),
      "no matching fictional record",
    );
    expect(
      screen.getByText("No authorized reports match this search."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(
      screen.getByLabelText("Search your authorized reports"),
    ).toHaveFocus();
    expect(screen.getByRole("link", { name: "F-001" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Cover letter" })).toBeVisible();
  });
});
