import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyExpert } from "./policy-expert";

describe("PolicyExpert", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());
  it("keeps a question and offers separate-tab sign-in after session expiration", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ csrfToken: "csrf-token" }))
      .mockResolvedValueOnce(Response.json({}, { status: 401 }));
    const user = userEvent.setup();
    render(<PolicyExpert />);
    await user.type(
      screen.getByLabelText("Policy question"),
      "Fictional policy question?",
    );
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );
    expect(await screen.findByText(/Your session ended/)).toBeVisible();
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/web/v1/policy-answer",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByLabelText("Policy question")).toHaveValue(
      "Fictional policy question?",
    );
    expect(
      screen.getByRole("link", { name: "Sign in again (opens a new tab)" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("keeps native question validation and allows vertical expansion", () => {
    render(<PolicyExpert />);

    const question = screen.getByLabelText("Policy question");
    expect(question).toBeRequired();
    expect(question).toHaveAttribute("minlength", "3");
    expect(question).toHaveClass("resize-vertical");
    expect(question.closest("form")).not.toHaveAttribute("novalidate");
  });

  it("gets a session CSRF token before submitting a same-origin policy question", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              outcome: {
                kind: "insufficient_evidence",
                answer: {
                  status: "insufficient_evidence",
                  answer: "No fictional evidence is available.",
                  citations: [],
                  limitations: ["Check the fictional source."],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const user = userEvent.setup();
    render(<PolicyExpert />);

    await user.type(
      screen.getByLabelText("Policy question"),
      "What does the fictional policy require?",
    );
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", {
      cache: "no-store",
      credentials: "same-origin",
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/web/v1/policy-answer", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "csrf-token",
      },
      body: JSON.stringify({
        question: "What does the fictional policy require?",
        history: [],
      }),
    });
    expect(
      await screen.findByText("Evidence is not sufficient"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No fictional evidence is available."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This is not policy guidance\. Open the approved source document or ask a supervisor/,
      ),
    ).toBeInTheDocument();
  });

  it("sends only bounded prior user questions with a follow-up", async () => {
    const outcome = {
      data: {
        outcome: {
          kind: "insufficient_evidence",
          answer: {
            status: "insufficient_evidence",
            answer: "No fictional evidence is available.",
            citations: [],
            limitations: [],
          },
        },
      },
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-one" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(outcome), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-two" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(outcome), { status: 200 }),
      );
    const user = userEvent.setup();
    render(<PolicyExpert />);

    const question = screen.getByLabelText("Policy question");
    await user.type(question, "What is the fictional visiting schedule?");
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );
    await screen.findByText("No fictional evidence is available.");

    await user.type(question, "What about weekends?");
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(4, "/api/web/v1/policy-answer", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "csrf-two",
      },
      body: JSON.stringify({
        question: "What about weekends?",
        history: [{ question: "What is the fictional visiting schedule?" }],
      }),
    });
  });

  it("can limit a question to one policy collection", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              outcome: {
                kind: "insufficient_evidence",
                answer: {
                  status: "insufficient_evidence",
                  answer: "No fictional evidence is available.",
                  citations: [],
                  limitations: ["Check the fictional source."],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const user = userEvent.setup();
    render(<PolicyExpert />);

    await user.selectOptions(
      screen.getByLabelText("Search collection"),
      "BMU Post Orders",
    );
    await user.type(
      screen.getByLabelText("Policy question"),
      "What does the fictional post order require?",
    );
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );

    expect(fetch).toHaveBeenNthCalledWith(2, "/api/web/v1/policy-answer", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "csrf-token",
      },
      body: JSON.stringify({
        question: "What does the fictional post order require?",
        history: [],
        collections: ["BMU Post Orders"],
      }),
    });
  });

  it("links every cited answer to its authorized immutable source PDF", async () => {
    const documentVersionId = "22222222-2222-4222-8222-222222222222";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              outcome: {
                kind: "answer",
                answer: {
                  status: "answered",
                  answer: "The fictional policy requires documented review.",
                  limitations: [],
                  citations: [
                    {
                      documentId: "11111111-1111-4111-8111-111111111111",
                      documentVersionId,
                      chunkId: "33333333-3333-4333-8333-333333333333",
                      stableKey: "fictional-policy",
                      title: "Fictional Review Policy",
                      versionLabel: "Version 1",
                      sourceSha256: "a".repeat(64),
                      collection: "BMU policies",
                      pageStart: 4,
                      pageEnd: 4,
                      sectionPath: "Review",
                      excerpt: "Fictional source excerpt.",
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );
    const user = userEvent.setup();
    render(<PolicyExpert />);

    await user.type(
      screen.getByLabelText("Policy question"),
      "What does the fictional review policy require?",
    );
    await user.click(
      screen.getByRole("button", { name: "Find cited guidance" }),
    );

    const sourceLink = await screen.findByRole("link", {
      name: "Open Fictional Review Policy source PDF in a new tab",
    });
    expect(sourceLink).toHaveAttribute(
      "href",
      `/api/web/v1/policy-sources/${documentVersionId}`,
    );
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Page 4")).toBeInTheDocument();
    expect(screen.getAllByText("BMU policies")).toHaveLength(2);
  });
});
