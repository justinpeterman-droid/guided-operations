import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FormCandidateRequestForm } from "./form-candidate-request-form";
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  replace.mockClear();
});

it.each(["put", "finalize"])(
  "recovers a lost %s response without replacing the quarantined file",
  async (stage) => {
    const id = "22222222-2222-4222-8222-222222222222";
    let finalizations = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      subtle: { digest: async () => new Uint8Array(32).buffer },
    });
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        if (url === "/api/auth/csrf")
          return Response.json({ csrfToken: "fictional-token" });
        if (url === "/api/web/v1/improvement-requests")
          return Response.json(
            {
              data: {
                requestId: id,
                signedUploadUrl: "https://uploads.example.test/fictional",
              },
            },
            { status: 201 },
          );
        if (init?.method === "PUT") {
          if (stage === "put")
            throw new Error("fictional lost upload response");
          return new Response(null, { status: 200 });
        }
        if (String(url).endsWith("/finalize")) {
          finalizations++;
          if (stage === "finalize" && finalizations === 1)
            throw new Error("fictional lost verification response");
          return Response.json({ data: { finalized: true } });
        }
        throw new Error("Unexpected mocked request");
      });
    const user = userEvent.setup();
    render(<FormCandidateRequestForm />);
    await user.type(screen.getByLabelText("Form name"), "Fictional blank form");
    await user.type(
      screen.getByLabelText("What should this form help staff do?"),
      "Fictional upload recovery.",
    );
    const file = new File(["%PDF-fictional"], "fictional.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("%PDF-fictional").buffer,
    });
    await user.upload(
      screen.getByLabelText(/Attach a blank form candidate/),
      file,
    );
    await user.click(
      screen.getByRole("button", { name: "Submit and upload for review" }),
    );
    if (stage === "finalize") {
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Completion could not be confirmed",
      );
      expect(
        screen.getByRole("link", {
          name: "Check this request (opens a new tab)",
        }),
      ).toHaveAttribute("href", `/improvements/${id}`);
      await user.click(
        screen.getByRole("button", { name: "Submit and upload for review" }),
      );
    }
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/improvements/${id}?submitted=1`),
    );
    expect(
      fetch.mock.calls.filter(
        ([url]) => url === "/api/web/v1/improvement-requests",
      ),
    ).toHaveLength(1);
    const uploads = fetch.mock.calls.filter(
      ([, init]) => init?.method === "PUT",
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0][1]?.headers).toMatchObject({ "x-upsert": "false" });
  },
);

it("reuses an unchanged create nonce and gives edited content a new request identity", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) => {
      if (url === "/api/auth/csrf")
        return Response.json({ csrfToken: "fictional-token" });
      throw new Error("fictional lost create response");
    });
  const user = userEvent.setup();
  render(<FormCandidateRequestForm />);
  await user.type(screen.getByLabelText("Form name"), "Fictional request");
  await user.type(
    screen.getByLabelText("What should this form help staff do?"),
    "Fictional purpose.",
  );
  for (let i = 0; i < 2; i++) {
    await user.click(screen.getByRole("button", { name: "Send form request" }));
    await screen.findByRole("alert");
  }
  await user.type(screen.getByLabelText("Form name"), " edited");
  await user.click(screen.getByRole("button", { name: "Send form request" }));
  await screen.findByRole("alert");
  const bodies = fetch.mock.calls
    .filter(([url]) => url === "/api/web/v1/improvement-requests")
    .map(([, init]) => JSON.parse(String(init?.body)));
  expect(bodies).toHaveLength(3);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[2].requestNonce).not.toBe(bodies[0].requestNonce);
});
it("locks request fields while submitting and recovers entered text after session expiration", async () => {
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const fetch = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);
  const user = userEvent.setup();
  render(<FormCandidateRequestForm />);
  await user.type(screen.getByLabelText("Form name"), "Fictional form request");
  await user.type(
    screen.getByLabelText("What should this form help staff do?"),
    "Fictional explanation.",
  );
  const leave = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  await user.click(screen.getByRole("button", { name: "Send form request" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("Form name")).toBeDisabled();
  expect(screen.getByLabelText("What kind of request is this?")).toBeDisabled();
  await act(async () => complete(Response.json({}, { status: 401 })));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your session ended",
  );
  expect(screen.getByLabelText("Form name")).toHaveValue(
    "Fictional form request",
  );
  expect(screen.getByLabelText("Form name")).toBeEnabled();
  expect(
    screen.getByRole("link", { name: "Sign in again (opens a new tab)" }),
  ).toHaveAttribute("target", "_blank");
  expect(fetch).toHaveBeenCalledOnce();
});
