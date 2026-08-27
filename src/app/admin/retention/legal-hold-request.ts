export function csrfFrom(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "csrfToken" in body &&
    typeof body.csrfToken === "string"
    ? body.csrfToken
    : null;
}

export function proofFrom(
  body: unknown,
): Readonly<{ requestId: string; token: string }> | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    typeof body.data !== "object" ||
    body.data === null
  )
    return null;
  const data = body.data;
  return "requestId" in data &&
    "token" in data &&
    typeof data.requestId === "string" &&
    typeof data.token === "string"
    ? { requestId: data.requestId, token: data.token }
    : null;
}

export async function getLegalHoldApproval(
  action: "place" | "release",
  passcode: string,
): Promise<Readonly<{ csrfToken: string; requestId: string; token: string }>> {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  const csrfToken = csrfFrom(await csrfResponse.json());
  if (!csrfResponse.ok || !csrfToken) throw new Error("csrf_unavailable");

  const proofResponse = await fetch("/api/admin/legal-hold-step-up", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ action, passcode }),
  });
  const proof = proofFrom(await proofResponse.json());
  if (!proofResponse.ok || !proof) throw new Error("step_up_denied");

  return { csrfToken, ...proof };
}
