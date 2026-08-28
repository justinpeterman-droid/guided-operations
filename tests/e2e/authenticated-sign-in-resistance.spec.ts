import { expect, test, type APIRequestContext } from "@playwright/test";

import { createLocalQualificationAccounts } from "./support/local-qualification-account";

test.describe.configure({ mode: "serial" });

const genericFailure = {
  message: "Unable to sign in with those credentials.",
};

type FailedAttempt = Readonly<{
  elapsedMs: number;
  status: number;
  body: unknown;
  cacheControl: string | undefined;
}>;

async function failedSignIn(
  request: APIRequestContext,
  employeeNumber: string,
  passcode: string,
): Promise<FailedAttempt> {
  const startedAt = performance.now();
  const response = await request.post("/api/auth/sign-in", {
    data: { employeeNumber, passcode },
    headers: {
      Origin: "http://127.0.0.1:3109",
      "x-vercel-forwarded-for": "192.0.2.44",
    },
  });
  const elapsedMs = performance.now() - startedAt;

  return {
    elapsedMs,
    status: response.status(),
    body: await response.json(),
    cacheControl: response.headers()["cache-control"],
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

test("known-wrong and unknown employees receive the same bounded response", async ({
  request,
}) => {
  const accounts = await createLocalQualificationAccounts();
  const knownWrongPasscode = `${accounts.officer.passcode}-wrong`;
  const unknownEmployeeNumber = "FICTIONAL-E2E-DOES-NOT-EXIST";
  const unknownPasscode = "FictionalUnknownPasscode9!";
  const knownAttempts: FailedAttempt[] = [];
  const unknownAttempts: FailedAttempt[] = [];

  // Alternate the order so a warming server cannot consistently favor one
  // path. Four attempts per account stay below the five-attempt account limit.
  for (let index = 0; index < 4; index += 1) {
    if (index % 2 === 0) {
      knownAttempts.push(
        await failedSignIn(
          request,
          accounts.officer.employeeNumber,
          knownWrongPasscode,
        ),
      );
      unknownAttempts.push(
        await failedSignIn(request, unknownEmployeeNumber, unknownPasscode),
      );
    } else {
      unknownAttempts.push(
        await failedSignIn(request, unknownEmployeeNumber, unknownPasscode),
      );
      knownAttempts.push(
        await failedSignIn(
          request,
          accounts.officer.employeeNumber,
          knownWrongPasscode,
        ),
      );
    }
  }

  for (const attempt of [...knownAttempts, ...unknownAttempts]) {
    expect(attempt.status).toBe(401);
    expect(attempt.body).toEqual(genericFailure);
    expect(attempt.cacheControl).toBe("no-store");
    expect(attempt.elapsedMs).toBeLessThan(3_000);
  }

  const knownMedian = median(knownAttempts.map(({ elapsedMs }) => elapsedMs));
  const unknownMedian = median(
    unknownAttempts.map(({ elapsedMs }) => elapsedMs),
  );

  // The local provider and database share one machine, so a 300 ms median
  // difference is a conservative CI-safe bound while still catching a missing
  // password-authentication call on either path.
  expect(Math.abs(knownMedian - unknownMedian)).toBeLessThanOrEqual(300);
});
