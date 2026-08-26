# Local candidate evidence — 2026-08-26

## Candidate identity

- Branch: `codex/production-readiness`
- Candidate commit: `7d2055b0f4de892c29e17de1ff9a86d9e0079ea7`
- State: local-only; not pushed, reviewed remotely, or deployed
- Data boundary: fictional operational data only; no corpus bytes or real
  operational/personnel data were introduced

## Automated local evidence

The following checks were run against the current worktree before this record:

| Check                    | Result                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `npm run check`          | Passed: formatting, lint, TypeScript, 196 web tests, production build                        |
| `npm run db:reset`       | Passed: fresh replay through `20260826105451_add_count_sheet_save_rpc.sql`                   |
| `npm run db:lint`        | Passed: no schema warnings/errors                                                            |
| `npm run db:test`        | Passed: 141 pgTAP tests                                                                      |
| `npm run security:check` | Passed: no tracked secret patterns; zero high-severity production dependency vulnerabilities |

## Included local changes after the last Preview commit

The current Vercel Preview was verified as building `dd1bce3`. This candidate
also contains local-only protected report revision/history/restore/print work
and the fictional Count Sheet persistence/access/save/contract tests added after
that deployed commit. It is not a release candidate and must not be treated as
Preview evidence until the exact commit is pushed, CI passes, and Vercel creates
a protected Preview for it.

## Still required before qualification

- Explicit authorization to push the branch and a green GitHub/Vercel build for
  this exact commit.
- Protected Preview browser, keyboard, accessibility, visual, print, and
  degraded-service evidence.
- Hosted migration, Auth/RLS/Storage, fictional-account, and cross-user checks.
- Approved policy-corpus rights, source/version manifest, citation/refusal
  evaluation, and provider qualification.
- Backup/Storage restore rehearsal, monitoring/alert proof, reviewer evidence,
  and owner release authorization.

The full non-production and live promotion gates remain in
[release-gates.md](release-gates.md) and
[definition of done](../quality/definition-of-done.md).
