# Migration Documentation

This directory defines how to replace the old application without copying stale,
sensitive, provider-coupled, or unverified material. All work is planned unless
a later evidence record explicitly says otherwise.

- [Source Manifest](source-manifest.md) — canonical legacy SHA, branch
  reconciliation, source paths, hashes, and unverified evidence.
- [Reuse, Rewrite, and Omit](reuse-rewrite-omit.md) — file-level migration
  decisions and per-file import checklist.
- [RAG Corpus Migration](rag-corpus-migration.md) — source acquisition, rights,
  SHA-256, private storage, page mapping, chunks, retrieval, citations, full
  reader, and corpus gates.
- [Replacement Migration Plan](migration-plan.md) — phased workstreams,
  environment model, acceptance gates, ordering, and risk register.
- [Cutover, Google Cloud Retirement, and Rollback](cutover-retirement-rollback.md)
  — traffic switch, triggers, recovery methods, dependency inventory, and
  destructive retirement order.

## Current truth

- Canonical old source: `justinpeterman-droid/prison-policy-ai` `origin/main` at
  `ebe52c4b977ab742975974732beec42fff1bbce5`.
- Branch-only Full Policy Reader source:
  `c5e49c809674750e6be36ae1b042222a6d2ce3cd`.
- New repository: technical foundation only; no complete migrated user-facing
  feature.
- RAG: the old Git manifest names 292 unique PDFs, but the audit did not prove
  that 292 authoritative source byte streams are recoverable, current, or
  rights-approved.
- Deployment: no Vercel production deployment or linked hosted Supabase
  production project is evidenced at this baseline.
- Google Cloud: no resource is authorized for deletion merely because these
  plans exist.

## Non-negotiable migration rules

1. Read legacy files from the pinned Git commit, not the dirty local working
   tree.
2. Use fictional operational/personnel data everywhere. Only rights-approved
   policy/RAG sources may be real.
3. Keep source PDFs, extracted corpus, embeddings, dumps, provider exports, and
   rights evidence out of Git by default.
4. Rebuild Flask, `/workspace`, Access handoff, and Google provider boundaries
   for Next.js/Vercel/Supabase.
5. Preserve the anti-fabrication, revision, idempotency, citation,
   physical-form, and explicit-action invariants.
6. Keep code/CI, deployment, migration, pilot, cutover, and retirement evidence
   separate.
7. Recover, hash, authorize, import, restore-test, and reconcile required
   corpus/database evidence before deleting a Google resource.
