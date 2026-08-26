"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SignOutState = "idle" | "submitting" | "failed";

const FAILURE_MESSAGE = "We could not sign you out. Please try again.";

/** Small client boundary for the CSRF-protected, local browser sign-out flow. */
export function SignOutButton() {
  const router = useRouter();
  const [state, setState] = useState<SignOutState>("idle");
  const submitting = state === "submitting";

  async function signOut() {
    setState("submitting");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
      });
      const csrfBody: unknown = await csrfResponse.json();
      const csrfToken =
        typeof csrfBody === "object" &&
        csrfBody !== null &&
        "csrfToken" in csrfBody &&
        typeof csrfBody.csrfToken === "string"
          ? csrfBody.csrfToken
          : null;
      if (!csrfResponse.ok || !csrfToken) throw new Error("csrf_unavailable");

      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) throw new Error("sign_out_failed");

      router.replace("/login");
      router.refresh();
      return;
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="workspace-sign-out">
      <button disabled={submitting} onClick={signOut} type="button">
        {submitting ? "Signing out…" : "Sign out"}
      </button>
      <p aria-live="polite">{state === "failed" ? FAILURE_MESSAGE : null}</p>
    </div>
  );
}
