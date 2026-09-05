import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportRevisionForm } from "../reports/[reportId]/report-revision-form";
import { ReportFinalizationForm } from "../reports/drafts/[candidateId]/report-finalization-form";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const id = "11111111-1111-4111-8111-111111111111";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe.each(["correction", "finalization"] as const)(
  "%s save recovery",
  (kind) => {
    const label =
      kind === "correction" ? "Corrected narrative" : "Final narrative";
    const action =
      kind === "correction"
        ? "Create corrected revision"
        : "Create final report";
    function showForm() {
      return render(
        kind === "correction" ? (
          <ReportRevisionForm
            reportId={id}
            revisionNumber={1}
            initialNarrative="Fictional original."
          />
        ) : (
          <ReportFinalizationForm
            candidateId={id}
            initialNarrative="Fictional original."
          />
        ),
      );
    }
    async function enterReview(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(label), " Fictional correction.");
      if (kind === "correction")
        await user.type(
          screen.getByLabelText("Correction reason"),
          "Fictional typo correction.",
        );
      else await user.click(screen.getByRole("checkbox"));
    }
    it("locks submitted text, retains a lost-response attempt, and retries the same request before clearing the leave guard", async () => {
      let rejectFirst!: (error: Error) => void;
      const first = new Promise<Response>((_, reject) => {
        rejectFirst = reject;
      });
      let attempts = 0;
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (_, init) => {
          if (!init?.method)
            return Response.json({ csrfToken: "fictional-token" });
          if (++attempts === 1) return first;
          return Response.json(
            {
              data:
                kind === "correction"
                  ? { revisionNumber: 2 }
                  : { reportId: id },
            },
            { status: 201 },
          );
        });
      const user = userEvent.setup();
      showForm();
      await enterReview(user);
      const leave = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(leave);
      expect(leave.defaultPrevented).toBe(true);
      await user.click(screen.getByRole("button", { name: action }));
      await waitFor(() => expect(attempts).toBe(1));
      expect(screen.getByLabelText(label)).toBeDisabled();
      await user.type(screen.getByLabelText(label), " Must not be lost.");
      expect(screen.getByLabelText(label)).toHaveValue(
        "Fictional original. Fictional correction.",
      );
      await act(async () => rejectFirst(new Error("fictional lost response")));
      expect(
        await screen.findByText(/Save could not be confirmed/),
      ).toBeVisible();
      expect(screen.getByLabelText(label)).toBeEnabled();
      await user.click(screen.getByRole("button", { name: action }));
      await waitFor(() => expect(attempts).toBe(2));
      const requests = fetch.mock.calls.filter(
        ([, init]) => init?.method === "POST",
      );
      expect(requests[1][1]?.body).toEqual(requests[0][1]?.body);
      expect(requests[1][1]?.headers).toEqual(requests[0][1]?.headers);
      await waitFor(() => expect(screen.getByLabelText(label)).toBeDisabled());
      const savedLeave = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(savedLeave);
      expect(savedLeave.defaultPrevented).toBe(false);
    });
    it("retains edits after session expiration and offers sign-in in a separate tab", async () => {
      const fetch = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json({ csrfToken: "fictional-token" }))
        .mockResolvedValueOnce(Response.json({}, { status: 401 }));
      const user = userEvent.setup();
      showForm();
      await enterReview(user);
      await user.click(screen.getByRole("button", { name: action }));
      expect(await screen.findByText(/Your session ended/)).toBeVisible();
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ method: "POST" }),
      );
      expect(screen.getByLabelText(label)).toHaveValue(
        "Fictional original. Fictional correction.",
      );
      expect(
        screen.getByRole("link", { name: "Sign in again (opens a new tab)" }),
      ).toHaveAttribute("target", "_blank");
    });
  },
);

it("requires review again after the final narrative changes", async () => {
  const user = userEvent.setup();
  render(
    <ReportFinalizationForm
      candidateId={id}
      initialNarrative="Fictional original."
    />,
  );
  await user.click(screen.getByRole("checkbox"));
  await user.type(screen.getByLabelText("Final narrative"), " Corrected.");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Create final report" }),
  ).toBeDisabled();
});
