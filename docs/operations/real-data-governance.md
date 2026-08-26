# Real-data governance

## Current decision

On 2026-08-26, the owner authorized real operational and personal data for the
isolated Production environment. The owner is accountable for product, security,
records, privacy, retention, incident response, backup, billing, and production
approval.

This is a product authorization, not a claim of legal, regulatory, vendor, or
agency compliance. Production use stays blocked until the release gates in
[production-execution-checklist.md](production-execution-checklist.md) and
[release-gates.md](release-gates.md) have evidence.

## Where data may exist

| Environment                                                                                             | Real operational or personal data                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git, issues, chat, local development, CI, tests, screenshots, demos, Preview, and shared non-production | Prohibited                                                                                                                                                                     |
| Isolated staging/release qualification                                                                  | Prohibited unless the owner records a time-bounded, minimum-necessary exception and the same production protections are verified                                               |
| Production                                                                                              | Allowed only after production promotion approval, with authenticated least-privilege access, private Storage, audit redaction, tested backup/restore, monitoring, and rollback |

Never copy a production database, Storage bucket, export, or browser capture to
a non-production environment.

## Retention and deletion

- Retain a production record and its controlled production copies for two years
  from its final revision.
- A legal hold, incident investigation, or later written records decision
  suspends deletion for the affected scope.
- Before deletion, record the scope, authority, hold check, deletion job,
  completion evidence, and backup-expiry date without retaining record bodies.
- The two-year period applies to database rows, private Storage artifacts,
  exports, indexes, caches, and backups. Backups may expire naturally only after
  their included data is eligible for deletion and no hold applies.

## Required controls before real-data entry

1. Production is isolated from Preview, CI, local, and staging credentials and
   data stores.
2. Auth, RLS, Storage, current-account, cross-user, disabled-account, step-up,
   audit-redaction, and secret-scanning negative tests pass on the exact release
   candidate.
3. Production database and Storage backup/restore is rehearsed, including
   retention/deletion and legal-hold procedure evidence.
4. Logs, analytics, errors, support artifacts, and AI requests are allowlisted,
   redacted, access-controlled, and configured to the approved provider
   retention posture.
5. The owner accepts the exact commit, deployment, migrations, data inventory,
   provider configuration, known limits, rollback procedure, and release window.

If any condition fails, stop real-data entry, restrict access, preserve minimal
incident evidence, and follow [incident-response.md](incident-response.md).
