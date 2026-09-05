import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ImprovementMessageComposer } from "./improvement-message-composer";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
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
