# Hosted readiness refresh — 2026-08-28

## Scope

This is a read-only provider-state refresh for the `codex/production-readiness`
candidate. It did not deploy, change traffic, modify environment variables,
apply migrations, create accounts, import policy content, or write operational
data.

## Vercel evidence

- The repository-local Vercel link names the `guided-operations` project in the
  previously recorded owner team.
- The currently connected Vercel provider session can see the owner Hobby team,
  but lists no projects in that team.
- A direct read of the linked project returns `404 Not Found`.

This is a current access/evidence failure, not proof that the historical project
or deployment was deleted. Protected Preview and Production qualification must
remain open until the provider connection can read the authoritative project,
its environment-variable names and scopes, its deployments, and its protection
settings without exposing secret values.

## Supabase evidence

- The connected Supabase provider session can read the linked
  `guided-operations` Development project.
- The project is `ACTIVE_HEALTHY`, uses PostgreSQL 17, and is in `us-east-1`.
- Hosted migration history contains 62 ordered migrations through
  `20260827120000_enforce_report_finalization_authority`.
- The repository contains 70 migrations through
  `20260828150000_harden_personal_passcode_revocation`; eight additive
  migrations remain unapplied to Development.
- No separately named or isolated Guided Operations Production project exists in
  the connected organization.

The pending Development migrations were not applied. They require the recorded
non-production approval path and a fresh local/CI replay first. Development is
fictional-only and is not an acceptable real-data target.

## Provider security-advisor review

The Development project currently reports:

- 31 informational `rls_enabled_no_policy` notices for forced-RLS tables in the
  non-exposed, no-direct-grant `app_private` schema;
- 28 warnings for authenticated `SECURITY DEFINER` routines in the reviewed
  `api` schema; and
- one warning that leaked-password protection is disabled.

A read-only catalog query checked all 28 reviewed API routines. Every routine
has an empty search path, anonymous callers cannot execute it, the elevated Data
API role cannot execute it, no private helper is directly executable by an
authenticated caller, and every routine contains a reviewed session-
authorization anchor. These provider warnings describe the intentional narrow
RPC boundary; they do not replace the function-level positive and negative pgTAP
tests.

The leaked-password-protection warning is an unresolved hosted authentication
setting. It must be enabled and rechecked in isolated Production before real
accounts or data are allowed.

`supabase/tests/provider_security_advisor.test.sql` now makes the generic RPC
privilege, search-path, private-helper, and authorization-anchor checks part of
database qualification so a newly exposed routine cannot silently widen this
boundary.

## Release effect

The code candidate remains qualified only by local/CI fictional-data evidence.
The following gates remain open:

1. restore read access to the authoritative Vercel project;
2. replay and qualify the eight pending migrations before any approved
   Development apply;
3. create and configure a separate isolated Production Supabase project under
   exact owner authorization;
4. enable and verify Production authentication hardening, backup/restore,
   monitoring, policy-corpus, smoke, rollback, and observation gates; and
5. record owner approval for the exact release commit and deployment.
