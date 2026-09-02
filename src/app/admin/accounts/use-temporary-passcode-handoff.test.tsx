import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { useTemporaryPasscodeHandoff } from "./use-temporary-passcode-handoff";

function TestHandoff() {
  const handoff = useTemporaryPasscodeHandoff<{
    temporaryPasscode: string;
    temporaryPasscodeExpiresAt: string;
  }>();
  return (
    <>
      <button
        onClick={() =>
          handoff.show({
            temporaryPasscode: "FixturePasscode",
            temporaryPasscodeExpiresAt: new Date(
              Date.now() + 1_000,
            ).toISOString(),
          })
        }
        type="button"
      >
        Show passcode
      </button>
      {handoff.handoff ? <p>{handoff.handoff.temporaryPasscode}</p> : null}
      {handoff.expired ? <p>Expired</p> : null}
    </>
  );
}

describe("useTemporaryPasscodeHandoff", () => {
  it("clears a passcode as soon as its handoff deadline passes", async () => {
    vi.useFakeTimers();
    render(<TestHandoff />);

    await act(async () => {
      await screen.getByRole("button", { name: "Show passcode" }).click();
    });
    expect(screen.getByText("FixturePasscode")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByText("FixturePasscode")).not.toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
