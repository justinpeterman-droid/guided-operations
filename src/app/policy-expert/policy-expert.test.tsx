import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyExpert } from "./policy-expert";

describe("PolicyExpert", () => {
  beforeEach(() => vi.restoreAllMocks());

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
      }),
    });
    expect(
      await screen.findByText("Evidence is not sufficient"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No fictional evidence is available."),
    ).toBeInTheDocument();
  });
});
