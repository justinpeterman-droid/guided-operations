# Quality handbook

Quality for Guided Operations means more than a successful build. The private
web application must preserve authorization, database integrity, approved-corpus
boundaries, grounded AI behavior, usable browser and print output,
accessibility, recoverability, and explicit owner control.

## Current status

These documents define required controls and target automation. They do not
claim that the tests, CI jobs, provider projects, environments, backups,
monitoring, or production deployment already exist. The current package scripts
must be inspected before citing a command as available.

## Documents

- [testing-strategy.md](testing-strategy.md) — test layers, contracts,
  PostgreSQL/RLS/Auth/Storage, concurrency, idempotency, AI evaluation, browser,
  print, and accessibility.
- [fictional-data-and-rag-content.md](fictional-data-and-rag-content.md) — the
  strict data boundary and controlled corpus lifecycle.
- [definition-of-done.md](definition-of-done.md) — change, release, deployment,
  and operational-readiness gates.
- [2026-08-30-authentication-adversarial-security-review.md](2026-08-30-authentication-adversarial-security-review.md)
  — open adversarial findings for Milestone 1 opaque authentication (PR #4).

## Evidence labels

- **AUTOMATED:** configured CI or a system check produced evidence for the exact
  commit.
- **MANUAL:** a named reviewer performed and recorded a check.
- **OWNER:** the product owner made a decision that automation cannot make.
- **EXTERNAL:** a provider, facility authority, security/privacy reviewer,
  rights holder, or other third party supplied evidence or approval.

No label substitutes for another. In particular, green automation does not
authorize a production release, deployment, facility pilot, or the use of real
operational data.
