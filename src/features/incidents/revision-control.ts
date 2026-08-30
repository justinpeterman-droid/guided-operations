export type RevisionHead = {
  revisionNumber: number;
};

export type RevisionAdvance<T> =
  | {
      status: "advanced";
      nextRevisionNumber: number;
      payload: T;
    }
  | {
      status: "conflict";
      currentRevisionNumber: number;
    };

/**
 * Pure optimistic-concurrency decision used by the later transaction layer.
 * The database must still enforce the same expected-head predicate atomically.
 */
export function advanceRevision<T>(
  current: RevisionHead,
  expectedRevisionNumber: number,
  payload: T,
): RevisionAdvance<T> {
  if (
    !Number.isSafeInteger(current.revisionNumber) ||
    current.revisionNumber < 0 ||
    !Number.isSafeInteger(expectedRevisionNumber) ||
    expectedRevisionNumber < 0
  ) {
    throw new Error("Revision numbers must be non-negative safe integers.");
  }

  if (current.revisionNumber !== expectedRevisionNumber) {
    return {
      status: "conflict",
      currentRevisionNumber: current.revisionNumber,
    };
  }

  return {
    status: "advanced",
    nextRevisionNumber: current.revisionNumber + 1,
    payload,
  };
}
