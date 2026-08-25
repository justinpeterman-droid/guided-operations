# Owner decisions and open questions

This is the short decision ledger for choices that affect multiple workstreams.
Detailed technical reasoning belongs in an ADR. An unchecked item is not
permission for an agent to guess, provision, deploy, migrate, or retire a
resource.

## Confirmed

| ID    | Decision                                                                                                                                                     | Evidence date |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| O-001 | The replacement repository is named `guided-operations` and is private.                                                                                      | 2026-08-25    |
| O-002 | The replacement is a web app only; the Microsoft Access client is out of scope.                                                                              | 2026-08-25    |
| O-003 | The initial deployment serves one facility.                                                                                                                  | 2026-08-25    |
| O-004 | The login experience should use employee number plus a personal PIN-like secret, or the safest practical equivalent. It must not use a shared facility code. | 2026-08-25    |
| O-005 | Vercel and Supabase are the target hosting/data platforms. Google hosting is excluded.                                                                       | 2026-08-25    |
| O-006 | OpenAI is acceptable as the initial AI provider; interfaces must permit another provider.                                                                    | 2026-08-25    |
| O-007 | There is no real operational data. The existing RAG policy/reference content is the only real source material.                                               | 2026-08-25    |
| O-008 | Prefer free plans where their terms and controls fit; do not weaken safety or readiness to remain free.                                                      | 2026-08-25    |
| O-009 | Use a United States region; the exact paired regions are not yet approved.                                                                                   | 2026-08-25    |
| O-010 | This is a personal, non-commercial hobby app for a small invited group of officers, not an official organization/facility system.                            | 2026-08-25    |
| O-011 | Create a separate Supabase project named `guided-operations` in `justinpeterman-droid's Org`, in `us-east-1`, leaving the inactive project untouched.        | 2026-08-25    |

## Required before hosted development linkage

- [ ] **OQ-001 — Provider login:** owner authenticates the Vercel and Supabase
      CLIs/accounts. Tokens must stay in provider credential stores, not Git.
- [ ] **OQ-002 — Vercel region:** Supabase `us-east-1` is approved and
      provisioned. Confirm the aligned Vercel function region; the provisional
      technical candidate remains `iad1`.
- [ ] **OQ-003 — Facility label:** supply the non-sensitive facility display
      name and URL/domain naming preference. Do not add a real roster.
- [ ] **OQ-004 — Plan eligibility:** confirm the intended invited-officer use
      continues to fit Vercel Hobby's personal/non-commercial terms and Supabase
      Free limits; otherwise approve the needed plan before deployment.

## Required before authentication implementation

- [ ] **OQ-005 — Passcode policy:** approve the final secret format after the
      Supabase alias-bridge spike. The current proposal is at least eight
      alphanumeric characters with common-pattern and employee-number rejection.
- [ ] **OQ-006 — Admin assurance:** decide whether administrators need TOTP,
      passkey, or another second factor before any real operational use.
- [ ] **OQ-007 — Recovery/bootstrap owners:** name who may create the first
      admin, reset credentials, unlock accounts, and receive temporary
      credentials.

## Required before RAG migration

- [ ] **OQ-008 — Corpus location:** identify the authoritative current source
      objects and legacy index/export location; the Git filename manifest is not
      the corpus.
- [ ] **OQ-009 — Corpus custodian:** name who can approve source rights, current
      versus superseded status, retention, full-document display, and external
      AI processing.
- [ ] **OQ-010 — Google boundary:** confirm whether Google AI APIs are also
      prohibited. The current target uses no Google hosting or Google-specific
      AI runtime either way.

## Required before private hobby production

- [ ] **OQ-016 — Repository enforcement:** choose a GitHub plan that supports
      branch protection/rulesets for the private repository, or explicitly
      accept documented manual pull-request, independent-review, green-check,
      no-force-push, and release-record controls that GitHub cannot enforce.
- [ ] **OQ-017 — Production URL protection:** decide whether application
      authentication is sufficient on the publicly reachable Vercel Hobby
      Production domain, or approve a plan/add-on that provides the required
      provider-level Production protection.

## Required before any future official adoption or real-data use

- [ ] **OQ-011 — Operational data authorization:** complete a separate written
      security, privacy, records, retention, incident-response, backup, and
      vendor review before permitting any real staff/incident/resident data.
- [ ] **OQ-012 — Recovery objectives:** approve RPO, RTO, retention/legal-hold,
      database backup, Storage backup, and restore-drill requirements.
- [ ] **OQ-013 — AI budget and quality:** approve model/evaluation thresholds,
      monthly budget, request caps, and circuit-breaker behavior.
- [ ] **OQ-014 — Document worker:** decide whether a non-Google durable worker
      is allowed if measured DOCX/PDF/OCR work cannot be safely split into
      Vercel-sized jobs.
- [ ] **OQ-015 — External owners:** name security, records/policy, facility
      pilot, production approval, incident-response, and billing owners.

## Change rule

When the owner answers an item, update its row or checkbox and the affected ADR,
architecture, security, migration, operations, and test contracts in the same
change. Record the decision date and avoid copying credentials or restricted
content into this ledger.
