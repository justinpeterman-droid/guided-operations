import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { dailyPaperworkCatalog } from "./catalog";
import { DailyPaperworkCatalog } from "./daily-paperwork-catalog";

const forms = dailyPaperworkCatalog.map((item, index) => ({
  kind: item.kind,
  title: item.title,
  configured: index === 0,
  templateId: index === 0 ? "33333333-3333-4333-8333-333333333333" : null,
  templateVersion: index === 0 ? 1 : null,
  recordId: null,
  currentRevisionNumber: null,
  updatedAt: null,
}));

afterEach(cleanup);

describe("DailyPaperworkCatalog", () => {
  it("shows all six administrator forms and the selected shift meaning", () => {
    render(
      <DailyPaperworkCatalog
        forms={forms}
        shiftCode="F"
        workDate="2026-08-27"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Daily Paperwork", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /F · Five-day week field/ }),
    ).toBeInTheDocument();
    const workDate = screen.getByLabelText("Work date");
    expect(workDate).toBeRequired();
    expect(workDate.closest("form")).not.toHaveAttribute("novalidate");
    for (const form of dailyPaperworkCatalog) {
      expect(
        screen.getByRole("heading", { name: form.title }),
      ).toBeInTheDocument();
    }
  });

  it("links only configured forms to the protected editor", () => {
    render(
      <DailyPaperworkCatalog
        forms={forms}
        shiftCode="A"
        workDate="2026-08-27"
      />,
    );

    expect(screen.getByText("Approved source loaded")).toBeInTheDocument();
    expect(
      screen.getByText("The protected editor is ready for this form."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /print/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open blank form" }),
    ).toHaveAttribute(
      "href",
      "/admin/paperwork/daily/assignment_roster?workDate=2026-08-27&shiftCode=A",
    );
    expect(screen.getAllByRole("link", { name: /open/i })).toHaveLength(1);
  });
});
