# Quality handbook

Quality for Guided Operations means more than a successful build. The private
web application must preserve authorization, database integrity, approved-corpus
boundaries, grounded AI behavior, usable browser and print output,
accessibility, recoverability, and explicit owner control.

## Current status

Web, database, and fictional recovery CI now exist and repeatedly pass on the
production-readiness branch. Unit/component, pgTAP, secret/dependency, build,
private-Storage negative, runtime-readiness, and local recovery controls cover
important implementation slices. They do not prove a signed-in hosted browser
flow, full accessibility/print parity, approved-corpus quality, off-provider
hosted restore, monitoring/alerts, exact release qualification, or Production
approval. Inspect the exact commit and retained evidence before citing a gate as
passed.

## Documents

- [testing-strategy.md](testing-strategy.md) — test layers, contracts,
  PostgreSQL/RLS/Auth/Storage, concurrency, idempotency, AI evaluation, browser,
  print, and accessibility.
- [fictional-data-and-rag-content.md](fictional-data-and-rag-content.md) — data
  classification, non-production fictional-fixture rule, and corpus lifecycle.
- [definition-of-done.md](definition-of-done.md) — change, release, deployment,
  and operational-readiness gates.

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
