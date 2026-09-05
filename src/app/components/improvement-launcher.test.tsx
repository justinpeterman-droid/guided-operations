import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ImprovementLauncher } from "./improvement-launcher";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("retries the same suggestion with its original request body and nonce", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) => {
      if (url === "/api/auth/csrf")
        return Response.json({ csrfToken: "fictional-token" });
      throw new Error("fictional lost response");
    });
  const user = userEvent.setup();
  render(<ImprovementLauncher />);
  await user.click(screen.getByRole("button", { name: "Suggest a change" }));
  await user.click(
    screen.getByRole("button", { name: /Report something not working/ }),
  );
  await user.type(
    screen.getByLabelText("What should change?"),
    "Fictional suggestion.",
  );
  for (let i = 0; i < 2; i++) {
    await user.click(screen.getByRole("button", { name: "Send suggestion" }));
    await screen.findByRole("alert");
  }
  const calls = fetch.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(calls).toHaveLength(2);
  expect(calls[1][1]?.body).toEqual(calls[0][1]?.body);
});
it("keeps keyboard focus in the suggestion panel and confirms before discarding its text", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<ImprovementLauncher />);
  await user.click(screen.getByRole("button", { name: "Suggest a change" }));
  const dialog = screen.getByRole("dialog", { name: "Suggest a change" });
  await user.click(
    screen.getByRole("button", { name: /Report something not working/ }),
  );
  await user.type(
    screen.getByLabelText("What should change?"),
    "Fictional suggestion.",
  );
  for (let i = 0; i < 8; i++) await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard("{Escape}");
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("What should change?")).toHaveValue(
    "Fictional suggestion.",
  );
  confirm.mockReturnValue(true);
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "Suggest a change" }),
  ).toHaveFocus();
});
it("locks suggestion editing and closing while sending, then retains a failed attempt", async () => {
  let rejectRequest!: (error: Error) => void;
  const pending = new Promise<Response>((_, reject) => {
    rejectRequest = reject;
  });
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);
  const user = userEvent.setup();
  render(<ImprovementLauncher />);
  await user.click(screen.getByRole("button", { name: "Suggest a change" }));
  await user.click(
    screen.getByRole("button", { name: /Report something not working/ }),
  );
  await user.type(
    screen.getByLabelText("What should change?"),
    "Fictional suggestion.",
  );
  await user.click(screen.getByRole("button", { name: "Send suggestion" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("What should change?")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Close suggestion" }),
  ).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeVisible();
  await act(async () => rejectRequest(new Error("fictional failure")));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Sending could not be confirmed",
  );
  expect(screen.getByLabelText("What should change?")).toHaveValue(
    "Fictional suggestion.",
  );
});
