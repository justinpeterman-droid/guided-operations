# Production data inventory

The machine-readable inventory is
[`production-data-inventory.json`](production-data-inventory.json). It lists
every private application table and Storage bucket plus the external surfaces
where production data could be processed, logged, cached, copied, or backed up.

## What this proves

`npm run data:inventory:check` validates the document and compares it with a
loopback-only local Supabase database. The check fails when an `app_private`
table or Storage bucket is added, removed, or renamed without an inventory
decision. It never connects to a hosted database and never reads or prints
record bodies.

The repository inventory is complete for the current schema. That does not prove
that hosted provider retention, logging, AI data handling, backups, or deletion
jobs are configured. Entries with a pending `release_status` or
`deletion_status` remain production release gates.

## Retention interpretation

- Operational records, controlled exports, and their revision history are kept
  for 730 days from the final revision.
- Personnel/account lifecycle records and configuration are kept for 730 days
  after deactivation or supersession.
- Policy source material and derived retrieval data are kept for 730 days after
  source supersession.
- Allowlisted audit and ingestion events are kept for 730 days from the event.
- Short-lived keyed digests used only for rate limiting, idempotency, and
  administrator step-up are technical controls, not record bodies. They expire
  on their bounded expiry fields; the durable allowlisted audit event is the
  retained accountability record.
- A legal hold or incident preservation decision overrides normal deletion for
  every hold-eligible source and all copies containing it.
- Archived incident, report, and paperwork heads receive a database-derived
  deletion-review date 730 days after archival. Archival must occur at or after
  the final revision. The date only makes a record reviewable; it never grants
  deletion authority or deletes anything.
- Private legal-hold records validate their target and facility, are audited,
  and remain immutable after release. No Data API role can read or change them
  directly. Protected administrator routes use current-role, origin, CSRF, and
  purpose-bound step-up checks for placement and release.
- The protected administrator retention page shows a bounded same-facility
  review list only after the two-year date. Held records remain visible but
  blocked. Classification grants no deletion authority, and no deletion action
  or automatic cleanup path is exposed.
- Backups remain protected until every included source record is deletion
  eligible and any hold has cleared.

This describes the owner's operating decision and engineering controls; it is
not legal advice or a compliance certification.

## Change procedure

1. Add the migration or provider surface.
2. Update the JSON inventory in the same change.
3. State purpose, data classes, boundary, retention profile, deletion state, and
   provider verification state.
4. Run the inventory check after a clean local migration replay.
5. Do not mark a pending hosted or deletion control complete without dated,
   value-free evidence.

Do not put names, employee numbers, narratives, credentials, record bodies,
signed URLs, keys, or other real values in this inventory or its evidence.
