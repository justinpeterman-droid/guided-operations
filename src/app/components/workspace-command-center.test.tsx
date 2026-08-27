import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OfficerCommandCenter,
  WorkspaceCommandCenter,
} from "./workspace-command-center";

describe("WorkspaceCommandCenter", () => {
  it("keeps the preview action-oriented and visibly fictional", () => {
    render(<WorkspaceCommandCenter />);

    expect(
      screen.getByRole("heading", {
        name: "You did the work. Keep the paperwork clear.",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Training example")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Start a report/ }),
    ).toHaveAttribute("href", "/preview/report-assistant");
    expect(
      screen.getByRole("link", { name: /Ask Policy Expert/ }),
    ).toHaveAttribute("href", "/preview/policy-expert");
    expect(
      screen.getByRole("link", { name: /Daily paperwork/ }),
    ).toHaveAttribute("href", "/preview/forms-library");
    expect(
      screen.queryByText(/live|all clear|last synced/i),
    ).not.toBeInTheDocument();
  });
});

describe("OfficerCommandCenter", () => {
  it("uses real destinations and never substitutes training work", () => {
    const { container } = render(
      <OfficerCommandCenter
        reports={[
          {
            reportId: "11111111-1111-4111-8111-111111111111",
            incidentNumber: "INC-100",
            incidentName: "Fictional test incident",
            reportType: "first_person",
            status: "in_review",
            currentRevisionNumber: 2,
            updatedAt: "2026-08-26T12:00:00+00:00",
          },
        ]}
      />,
    );
    const commandCenter = within(container);

    expect(
      commandCenter
        .getAllByRole("link", { name: /Start a report/ })
        .some((link) => link.getAttribute("href") === "/incidents/new"),
    ).toBe(true);
    expect(
      commandCenter.getByRole("link", { name: /Ask Policy Expert/ }),
    ).toHaveAttribute("href", "/policy-expert");
    expect(commandCenter.getByText("INC-100")).toBeVisible();
    expect(
      commandCenter.queryByText("Training example"),
    ).not.toBeInTheDocument();
  });

  it("shows an honest empty state when no authorized reports are present", () => {
    render(<OfficerCommandCenter reports={[]} />);

    expect(
      screen.getByText("No reports are available for your account yet."),
    ).toBeVisible();
  });
});
