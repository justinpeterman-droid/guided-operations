"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { RetentionDeletionRequestSummary } from "@/server/retention/retention-deletion";

import { getRetentionDeletionApproval } from "./retention-deletion-request";

type State = "idle" | "reviewing" | "submitting" | "approved" | "failed";

/** Records backup evidence and approval only; it never performs deletion. */
export function ApproveRetentionDeletionForm({
  recordType,
  recordId,
}: Readonly<{
  recordType: RetentionDeletionRequestSummary["recordType"];
  recordId: string;
}>) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");

  async function approve(form: HTMLFormElement) {
    const values = new FormData(form);
    const authorityReference = values.get("authorityReference");
    const databaseBackupReference = values.get("databaseBackupReference");
    const storageBackupReference = values.get("storageBackupReference");
    const backupManifestSha256 = values.get("backupManifestSha256");
    const backupVerifiedAt = values.get("backupVerifiedAt");
    const backupExpiresAt = values.get("backupExpiresAt");
    const passcode = values.get("administratorPasscode");
    if (
      typeof authorityReference !== "string" ||
      typeof databaseBackupReference !== "string" ||
      typeof storageBackupReference !== "string" ||
      typeof backupManifestSha256 !== "string" ||
      typeof backupVerifiedAt !== "string" ||
      typeof backupExpiresAt !== "string" ||
      typeof passcode !== "string"
    )
      return setState("failed");

    setState("submitting");
    try {
      const proof = await getRetentionDeletionApproval("approve", passcode);
      const response = await fetch("/api/admin/retention-deletions", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": proof.csrfToken,
        },
        body: JSON.stringify({
          requestId: proof.requestId,
          token: proof.token,
          recordType,
          recordId,
          authorityReference,
          databaseBackupReference,
          storageBackupReference,
          backupManifestSha256,
          backupVerifiedAt: new Date(backupVerifiedAt).toISOString(),
          backupExpiresAt: new Date(backupExpiresAt).toISOString(),
        }),
      });
      if (!response.ok) throw new Error("approval_failed");
      setState("approved");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  if (state === "approved")
    return <span className="report-status">Deletion approved</span>;
  if (state !== "reviewing" && state !== "submitting")
    return (
      <div className="account-session-actions">
        <button onClick={() => setState("reviewing")} type="button">
          Prepare deletion approval
        </button>
        {state === "failed" ? (
          <p aria-live="polite" className="account-session-message">
            Deletion was not approved. No record or export was deleted.
          </p>
        ) : null}
      </div>
    );

  return (
    <form
      className="account-session-confirm"
      onSubmit={(event) => {
        event.preventDefault();
        void approve(event.currentTarget);
      }}
    >
      <p>
        This step records approval only. Database and private-Storage backups
        must already be verified and remain available beyond the approval
        window. Do not enter names, narratives, or record contents.
      </p>
      <label htmlFor={`delete-authority-${recordId}`}>
        Deletion authority reference
      </label>
      <input
        autoComplete="off"
        id={`delete-authority-${recordId}`}
        maxLength={160}
        minLength={3}
        name="authorityReference"
        pattern="[A-Za-z0-9][A-Za-z0-9 ._:/-]*"
        required
      />
      <label htmlFor={`database-backup-${recordId}`}>
        Database backup reference
      </label>
      <input
        autoComplete="off"
        id={`database-backup-${recordId}`}
        maxLength={160}
        minLength={3}
        name="databaseBackupReference"
        pattern="[A-Za-z0-9][A-Za-z0-9 ._:/-]*"
        required
      />
      <label htmlFor={`storage-backup-${recordId}`}>
        Private-Storage backup reference
      </label>
      <input
        autoComplete="off"
        id={`storage-backup-${recordId}`}
        maxLength={160}
        minLength={3}
        name="storageBackupReference"
        pattern="[A-Za-z0-9][A-Za-z0-9 ._:/-]*"
        required
      />
      <label htmlFor={`backup-manifest-${recordId}`}>
        Combined backup manifest SHA-256
      </label>
      <input
        autoComplete="off"
        id={`backup-manifest-${recordId}`}
        maxLength={64}
        minLength={64}
        name="backupManifestSha256"
        pattern="[a-f0-9]{64}"
        required
      />
      <label htmlFor={`backup-verified-${recordId}`}>
        Backup restore verified at
      </label>
      <input
        id={`backup-verified-${recordId}`}
        name="backupVerifiedAt"
        required
        type="datetime-local"
      />
      <label htmlFor={`backup-expires-${recordId}`}>Backup expires at</label>
      <input
        id={`backup-expires-${recordId}`}
        name="backupExpiresAt"
        required
        type="datetime-local"
      />
      <label htmlFor={`delete-approval-passcode-${recordId}`}>
        Your administrator passcode
      </label>
      <input
        autoComplete="current-password"
        id={`delete-approval-passcode-${recordId}`}
        minLength={8}
        name="administratorPasscode"
        required
        type="password"
      />
      <button disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Recording approval…" : "Approve only"}
      </button>
      <button
        disabled={state === "submitting"}
        onClick={() => setState("idle")}
        type="button"
      >
        Cancel
      </button>
    </form>
  );
}
