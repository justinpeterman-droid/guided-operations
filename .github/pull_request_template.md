## Outcome

<!-- What user-visible or operational outcome does this change produce? -->

## Scope and source

- [ ] The change is within the requested scope.
- [ ] Migrated predecessor behavior names its canonical source in the migration
      manifest or PR description.
- [ ] Planned work is not described as implemented or deployed.

## Safety

- [ ] No secrets, credentials, real operational records, personnel data, RAG
      source text, prompts, model responses, or generated exports are committed.
- [ ] Authorization is enforced server-side; exposed database access has
      explicit grants, RLS, and negative tests.
- [ ] AI behavior preserves sources, abstention, missing information, and human
      review.
- [ ] Logging and audit metadata follow the allowlist in `SECURITY.md`.

## Evidence

- [ ] Formatting, lint, types, tests, and production build pass.
- [ ] Database reset/lint/pgTAP pass when schema changed.
- [ ] Real-browser desktop/mobile/keyboard checks are attached when UI changed.
- [ ] Print comparison is attached when print output changed.
- [ ] Documentation and ADRs were updated when behavior or architecture changed.

## External gates

<!-- List deployment, migration, data, security, records, pilot, or owner gates
that remain. A green PR does not close them automatically. -->
