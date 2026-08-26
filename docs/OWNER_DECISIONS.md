# Owner decisions and open questions

This is the short decision ledger for choices that affect multiple workstreams.
Detailed technical reasoning belongs in an ADR. An unchecked item is not
permission for an agent to guess, provision, deploy, migrate, or retire a
resource.

## Confirmed

| ID    | Decision                                                                                                                                                                                                                           | Evidence date |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| O-001 | The replacement repository is named `guided-operations` and is private.                                                                                                                                                            | 2026-08-25    |
| O-002 | The replacement is a web app only; the Microsoft Access client is out of scope.                                                                                                                                                    | 2026-08-25    |
| O-003 | The initial deployment serves one facility.                                                                                                                                                                                        | 2026-08-25    |
| O-004 | The login experience should use employee number plus a personal PIN-like secret, or the safest practical equivalent. It must not use a shared facility code.                                                                       | 2026-08-25    |
| O-005 | Vercel and Supabase are the target hosting/data platforms. Google hosting is excluded.                                                                                                                                             | 2026-08-25    |
| O-006 | OpenAI is acceptable as the initial AI provider; interfaces must permit another provider.                                                                                                                                          | 2026-08-25    |
| O-007 | There is no real operational data. The existing RAG policy/reference content is the only real source material.                                                                                                                     | 2026-08-25    |
| O-008 | Prefer free plans where their terms and controls fit; do not weaken safety or readiness to remain free.                                                                                                                            | 2026-08-25    |
| O-009 | Use a United States region; the exact paired regions are not yet approved.                                                                                                                                                         | 2026-08-25    |
| O-010 | This is a personal, non-commercial hobby app for a small invited group of officers, not an official organization/facility system.                                                                                                  | 2026-08-25    |
| O-011 | Create a separate Supabase project named `guided-operations` in `justinpeterman-droid's Org`, in `us-east-1`, leaving the inactive project untouched.                                                                              | 2026-08-25    |
| O-012 | Officers and administrators use individual passcodes of at least eight characters. This is not a shared PIN or facility code.                                                                                                      | 2026-08-25    |
| O-013 | Administrators use passcode-only access for the hobby foundation. MFA is deferred and must be reconsidered before any official or real-data use.                                                                                   | 2026-08-25    |
| O-014 | The owner is the first/main administrator and is the only initial authority for additional-account creation, credential resets, unlocks, and temporary-secret delivery. Temporary passcodes are handed to the recipient in person. | 2026-08-26    |
| O-015 | The owner authorizes production use of real operational and personal data and is accountable for product, security, records, privacy, retention, incident response, backup, billing, and production approval.                      | 2026-08-26    |
| O-016 | Production records and controlled production copies are retained for two years from final revision, unless a legal hold, incident investigation, or later written records decision requires longer retention.                      | 2026-08-26    |

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

## Authentication implementation constraints

- **O-012 passcode policy:** at least eight characters for individual officer
  and administrator passcodes. The implementation still rejects common patterns
  and employee-number equality.
- **O-013 admin assurance:** passcode-only access is approved only for the
  no-data hobby foundation. Administrator MFA is mandatory for reconsideration
  before official or real-data use.
- **O-014 recovery/bootstrap owner:** the owner is the first/main administrator
  and sole initial authority for account lifecycle actions. The app must never
  print, log, or retain a temporary passcode after its protected delivery. The
  owner gives each temporary passcode to its recipient in person.
- **O-015/O-016 real-data boundary:** real operational and personal data may
  enter only the isolated Production environment after all release gates pass.
  It remains prohibited in Git, local development, CI, Preview, shared
  non-production, screenshots, logs, support tools, and test fixtures. The
  production retention target is two years, subject to legal hold and verified
  deletion across database, Storage, exports, and backups.

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

- [x] **OQ-011 — Operational data authorization:** the owner authorized real
      operational and personal data in production on 2026-08-26. This does not
      authorize real data in Git, local, CI, Preview, or staging environments.
- [x] **OQ-012 — Retention:** the owner set a two-year production-record
      retention period on 2026-08-26. Recovery objectives, legal-hold handling,
      deletion verification, and provider controls remain release gates.
- [ ] **OQ-013 — AI budget and quality:** approve model/evaluation thresholds,
      monthly budget, request caps, and circuit-breaker behavior.
- [ ] **OQ-014 — Document worker:** decide whether a non-Google durable worker
      is allowed if measured DOCX/PDF/OCR work cannot be safely split into
      Vercel-sized jobs.
- [x] **OQ-015 — Accountable owner:** the owner holds security, records/policy,
      facility pilot, production approval, incident-response, and billing
      decisions for the initial release (2026-08-26).

## Change rule

When the owner answers an item, update its row or checkbox and the affected ADR,
architecture, security, migration, operations, and test contracts in the same
change. Record the decision date and avoid copying credentials or restricted
content into this ledger.
