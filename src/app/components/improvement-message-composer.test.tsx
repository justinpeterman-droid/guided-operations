import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ImprovementMessageComposer } from "./improvement-message-composer";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it.each(["csrf", "reply"])(
  "preserves the reply and permits retry after session expiry at %s",
  async (expiredAt) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    if (expiredAt === "reply")
      fetch.mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-token" }),
      );
    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const user = userEvent.setup();
    render(<ImprovementMessageComposer requestId="fictional-request" />);
    await user.type(
      screen.getByLabelText("Your reply"),
      "Fictional retained reply.",
    );
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session ended",
    );
    expect(screen.getByLabelText("Your reply")).toHaveValue(
      "Fictional retained reply.",
    );
    expect(
      screen.getByRole("link", { name: "Sign in again (opens a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    fetch
      .mockResolvedValueOnce(
        Response.json({ csrfToken: "fictional-new-token" }),
      )
      .mockResolvedValueOnce(Response.json({ data: {} }, { status: 201 }));
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Your reply")).toHaveValue(""),
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/web/v1/improvement-requests/fictional-request/messages",
      expect.objectContaining({
        body: JSON.stringify({ body: "Fictional retained reply." }),
      }),
    );
  },
);
it("prevents typing over an in-flight reply and retains it on an uncertain result", async () => {
  let rejectRequest!: (error: Error) => void;
  const pending = new Promise<Response>((_, reject) => {
    rejectRequest = reject;
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json({ csrfToken: "fictional-token" }))
    .mockReturnValueOnce(pending);
  const user = userEvent.setup();
  render(<ImprovementMessageComposer requestId="fictional-request" />);
  await user.type(screen.getByLabelText("Your reply"), "Fictional reply.");
  await user.click(screen.getByRole("button", { name: "Send reply" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Your reply")).toBeDisabled();
  await act(async () => rejectRequest(new Error("fictional interruption")));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Sending could not be confirmed",
  );
  expect(screen.getByLabelText("Your reply")).toHaveValue("Fictional reply.");
  expect(screen.getByLabelText("Your reply")).toBeEnabled();
});
