# Incident draft recovery and containment

Draft recovery uses migrations 20260905220000, 20260907140000
and 20260907160000. Apply through the existing controlled production migration
process. The full versioned payload is validated at the exposed database
boundary; API validation alone is insufficient for authenticated RPC callers.

Resume preserves working text and still-current officer selections, but resets
each fact decision to pending and requires new officer/category/report
confirmation. A stale save, discard or promotion must be reopened from Home.
Nothing creates an incident until the deliberate final save.

If this feature must be rolled back, first execute
`supabase/operations/disable_incident_drafts.sql` with psql
`--single-transaction` using the established controlled database credential and
release procedure. This revokes every draft read, save, discard and promotion
RPC grant, including direct authenticated access. Deploy the preceding
application release to remove Save draft and Home resume entry points. During
that interval current application requests fail closed. Verify that
authenticated execution is denied and that draft row counts and retained
payloads are unchanged. The pgTAP recovery test exercises the actual containment
SQL in a rolled-back fictional transaction.

Do not drop the draft table, reverse migrations, or erase retained data.
Discarded and unfinished drafts remain retained; promoted drafts follow
controlled incident retention. To restore service, use a reviewed forward
migration to restore only the current RPC grants after validating payload
compatibility, current-session authorization and the browser recovery flow.
Never regrant the obsolete separate promotion endpoint.
