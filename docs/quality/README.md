# Quality handbook

Quality for Guided Operations means more than a successful build. The private
web application must preserve authorization, database integrity, approved-corpus
boundaries, grounded AI behavior, usable browser and print output,
accessibility, recoverability, and explicit owner control.

## Current status

Updated 2026-09-01. Web quality, Authenticated browser quality, and Recovery
rehearsal passed on exact `main` commit `49812ec4`. Database quality rebuilt and
linted the database, then exposed a test-role defect in one pgTAP assertion. A
test-only follow-up correction restores the owner role before querying a private
table; it still needs a green branch run and exact-merge rerun. The application
was released to production on 2026-08-30.

Two limits apply to any claim made from this evidence. First, the exact-main
database gate is not green yet; passing migration rebuild and lint do not
replace the incomplete pgTAP run. Second, existing evidence does not prove
native screen-reader and print behavior, approved-corpus answer quality,
off-provider hosted restore, or monitoring and alerting. Inspect the exact
commit and retained evidence before citing a gate as passed.

## Documents

- [testing-strategy.md](testing-strategy.md) — test layers, contracts,
  PostgreSQL/RLS/Auth/Storage, concurrency, idempotency, AI evaluation, browser,
  print, and accessibility.
- [fictional-data-and-rag-content.md](fictional-data-and-rag-content.md) — data
  classification, non-production fictional-fixture rule, and corpus lifecycle.
- [definition-of-done.md](definition-of-done.md) — change, release, deployment,
  and operational-readiness gates.
- [hands-on-accessibility-print-validation.md](hands-on-accessibility-print-validation.md)
  — repeatable human validation for native screen-reader announcements and the
  operating-system print dialog; uses fictional records only.
- [2026-09-01-post-merge-qualification.md](2026-09-01-post-merge-qualification.md)
  — exact-commit workflow evidence, the database-test correction, and a
  human-readable summary of the six-alert Dependabot triage.
- [2026-09-01-dependabot-triage.json](2026-09-01-dependabot-triage.json) — the
  complete machine-readable `triage-finding/v0` result for all six alerts.

## Evidence labels

- **AUTOMATED:** configured CI or a system check produced evidence for the exact
  commit.
- **MANUAL:** a named reviewer performed and recorded a check.
- **OWNER:** the product owner made a decision that automation cannot make.
- **EXTERNAL:** a provider, facility authority, security/privacy reviewer,
  rights holder, or other third party supplied evidence or approval.

No label substitutes for another. In particular, green automation does not
authorize a production release, deployment, facility pilot, or Production
real-data entry.
