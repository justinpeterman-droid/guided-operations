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
    for (const form of dailyPaperworkCatalog) {
      expect(
        screen.getByRole("heading", { name: form.title }),
      ).toBeInTheDocument();
    }
  });

  it("does not claim editing or printing is ready", () => {
    render(
      <DailyPaperworkCatalog
        forms={forms}
        shiftCode="A"
        workDate="2026-08-27"
      />,
    );

    expect(screen.getByText("Approved source loaded")).toBeInTheDocument();
    expect(
      screen.getByText("The editor and printing are still being tested."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /print/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /open/i })).toBeNull();
  });
});
