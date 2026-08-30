# Local candidate evidence — 2026-08-28

This record binds the current fictional-data qualification evidence to one exact
commit. It is not a deployment record, Production approval, corpus approval, or
authorization to apply hosted migrations.

## Candidate identity

- Branch: `codex/production-readiness`
- Pull request: `#1`
- Exact commit: `9a01c927f1088332fb8c8e13202d6c6d9327e43b`
- Qualification date: 2026-08-28
- Data class used by automated qualification: fictional local/CI data only

## Exact-commit automated evidence

All four required GitHub lanes completed successfully for the exact commit:

- Web quality: run `33189510880`
- Database quality: run `33189510822`
- Recovery rehearsal: run `33189510855`
- Authenticated browser quality: run `33189510850`

The browser lane built the Next.js application first, served that built output
with the Production-style server, and exercised the guarded fictional officer
and administrator workflows against an isolated local Supabase stack. The lane
included automated accessibility, responsive/reduced-motion, report and
revision, Word export, incident creation, Count Sheet, account lifecycle,
revoked-session, sign-in resistance, and administrator workflow checks. The
database lane included the direct negative proof that the elevated Data API role
cannot read private account or audit tables or invoke user/admin RPCs.

## What remains open

This evidence does not prove any protected hosted environment or live release.
The following gates remain open and must be tied to the later frozen release
candidate:

- owner acceptance of the exact release candidate;
- isolated Production Vercel and Supabase configuration;
- hosted migration, Auth, RLS, and Storage qualification;
- approved private policy corpus import and citation/refusal evaluation;
- manual screen-reader, zoom/reflow, visual, and print acceptance;
- Production database and Storage backup plus isolated restore;
- monitoring, alert, budget, rollback, smoke-test, and 15-minute health proof;
- controlled promotion and browser verification of the exact deployed artifact.

Real operational or personal data remains prohibited in Git, local development,
CI, Preview, staging, screenshots, logs, fixtures, and support tools. No hosted
mutation, merge, deployment, account creation, corpus import, Production
promotion, or legacy-system retirement is authorized by this record.
