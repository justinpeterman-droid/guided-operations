# Quality handbook

Quality for Guided Operations means more than a successful build. The private
web application must preserve authorization, database integrity, approved-corpus
boundaries, grounded AI behavior, usable browser and print output,
accessibility, recoverability, and explicit owner control.

## Current status

Updated 2026-08-31. Unit/component, pgTAP, operations-guard, secret and
dependency, build, private-Storage negative, runtime-readiness, local recovery,
and guarded fictional browser controls all run locally and pass. The application
was released to production on 2026-08-30.

Two limits apply to any claim made from this evidence. First, **GitHub Actions
could not run from 2026-08-28 to 2026-08-31** because the private repository's
included minutes were exhausted; the allowance reset on 2026-09-01 and workflows
run normally again, but no commit on `main` from that window has a passing CI
run, so evidence for those commits is local only and must name the exact commit
it was run against. Second, existing evidence does not prove native
screen-reader and print behavior, approved-corpus answer quality, off-provider
hosted restore, or monitoring and alerting. Inspect the exact commit and
retained evidence before citing a gate as passed.

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
