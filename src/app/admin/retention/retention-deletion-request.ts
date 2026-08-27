import { csrfFrom, proofFrom } from "./legal-hold-request";

export async function getRetentionDeletionApproval(
  action: "approve" | "execute",
  passcode: string,
): Promise<Readonly<{ csrfToken: string; requestId: string; token: string }>> {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
  });
  const csrfToken = csrfFrom(await csrfResponse.json());
  if (!csrfResponse.ok || !csrfToken) throw new Error("csrf_unavailable");

  const proofResponse = await fetch("/api/admin/retention-deletion-step-up", {
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
