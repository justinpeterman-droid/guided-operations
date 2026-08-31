# Hosted security qualification — 2026-08-30

- **Environment:** fictional-data Development Supabase project `guided-operations`
- **Project ref:** `mfkunfqhosmrjbreythc`
- **Exact repository snapshot tested:** `05349fa410705100a5958206e174a3016f24bc14`
- **Relationship to later review:** the tested snapshot is an ancestor of the frozen CodeRabbit audit head `32f6b35a6c537ef83c5cf6da4fc02fff63d9f47e`; this record does not claim that later head received the same hosted dynamic checks
- **Purpose:** continue Phase 1 authentication/database qualification without changing Production or using real operational data

## Migration state

The hosted Development database is current through:

`20260830090000_add_answer_reports`

No repository migration was pending on the hosted Development project at the time of this qualification.

## Hosted fictional-workflow readiness

Read-only aggregate inspection found:

- one Auth user;
- one active application staff/account record;
- that account is an active administrator still requiring temporary-passcode change;
- no qualified officer account is present;
- no hosted incidents, reports, or paperwork records are present yet.

The full fictional administrator-to-officer workflow therefore cannot be marked qualified yet. Creating or altering hosted identities is intentionally deferred to the controlled account ceremony rather than being done through ad-hoc SQL.

## Direct database privilege matrix

Read-only hosted catalog inspection confirmed:

- every `app_private` table has RLS enabled;
- `anon` has no direct SELECT, INSERT, UPDATE, or DELETE privilege on `app_private` tables;
- `authenticated` has no direct SELECT, INSERT, UPDATE, or DELETE privilege on `app_private` tables;
- `anon` cannot execute exposed application SECURITY DEFINER functions;
- `authenticated` cannot execute `app_private` SECURITY DEFINER functions directly;
- the elevated Data API `service_role` cannot execute application SECURITY DEFINER functions in `api` or `app_private`;
- authenticated execution is limited to the intended `api` RPC surface;
- inspected application SECURITY DEFINER functions pin an empty `search_path`.

PR #12 adds permanent pgTAP regression coverage for these boundaries.

## SECURITY DEFINER advisor warnings

Supabase Security Advisor reports that signed-in users can execute multiple `api` SECURITY DEFINER functions. This is expected for the application RPC architecture and is not, by itself, a vulnerability.

Representative definitions were inspected. The exposed functions delegate to or directly use current-session authorization helpers such as:

- `app_private.create_incident_scoped_core()`;
- `app_private.can_access_incident()`;
- `app_private.current_daily_paperwork_admin_facility_id()`;
- `app_private.current_policy_facility_id()`.

Those helpers bind access to `auth.uid()`, authoritative active account/staff state, facility scope, role where required, forced-passcode-change state, and current `auth_version` where applicable.

The advisor warnings remain useful regression signals: a newly exposed SECURITY DEFINER function must not be accepted merely because it lives in `api`; it must have an explicit authorization boundary and negative tests.

## RLS-with-no-policy advisor notices

Supabase reports INFO notices for private tables that have RLS enabled without row policies. In this architecture those tables are intentionally inaccessible to browser/Data API roles; application access is through narrowly granted RPC/server boundaries. Hosted privilege inspection confirmed that `anon` and `authenticated` have no direct CRUD privileges on these tables.

These INFO notices are therefore recorded as intentional defense-in-depth configuration, not evidence that direct table access is available.

## Open hosted configuration finding

Supabase Security Advisor reports **Leaked Password Protection Disabled**.

This remains an open hosted configuration gate. It should be enabled before security acceptance if the active Supabase plan/configuration supports it, then the advisor should be rerun and the result captured.

## Dynamic qualification still required

The following cannot be closed by catalog/static evidence alone:

1. known-account wrong-passcode vs unknown-account vs malformed-identifier timing distributions;
2. distributed/global/device/network sign-in abuse behavior;
3. real-browser refresh, logout-all, passcode-replacement, role-change, disable and stale-session behavior;
4. administrator step-up replay, wrong-purpose and expiry behavior in the hosted web application;
5. complete protected page/API/Server Action route inventory against the authoritative account gate;
6. production forwarding-header monitoring and fail-safe behavior.

The currently available Vercel connector does not enumerate this private project, and the remote-browser/desktop path is unavailable in this session. Authenticated browser qualification is therefore still open rather than inferred from deployment status.

A synthetic SQL-session JWT injection attempt through the database management connector was denied for both valid-looking and stale claims. Because that connector session does not reproduce the Supabase/PostgREST authentication context faithfully, that result is classified as a **test-harness limitation**, not a product failure.

## Current disposition

No direct database privilege bypass was found in this hosted pass. The Development database was migration-current at the tested snapshot. The remaining security work is primarily the controlled fictional account ceremony, authenticated browser/abuse qualification, and the leaked-password-protection configuration gate.

This document does not authorize Production or real-data use.
