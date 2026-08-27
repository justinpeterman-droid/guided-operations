import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyExpert } from "./policy-expert";

describe("PolicyExpert", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

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
});
