import { describe, expect, it } from "vitest";

import { advanceRevision } from "./revision-control";

describe("advanceRevision", () => {
  it("advances exactly one revision when the client has the current head", () => {
    expect(
      advanceRevision({ revisionNumber: 4 }, 4, { title: "Updated" }),
    ).toEqual({
      status: "advanced",
      nextRevisionNumber: 5,
      payload: { title: "Updated" },
    });
  });

  it("rejects a stale edit without returning its unsaved payload", () => {
    expect(
      advanceRevision({ revisionNumber: 5 }, 4, { title: "Stale" }),
    ).toEqual({
      status: "conflict",
      currentRevisionNumber: 5,
    });
  });

  it("rejects invalid revision values", () => {
    expect(() => advanceRevision({ revisionNumber: -1 }, 0, {})).toThrow(
      "non-negative safe integers",
    );
    expect(() => advanceRevision({ revisionNumber: 1 }, 1.5, {})).toThrow(
      "non-negative safe integers",
    );
  });
});
