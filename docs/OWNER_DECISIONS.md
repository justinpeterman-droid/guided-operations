# Owner decisions and open questions

This is the short decision ledger for choices that affect multiple workstreams.
Detailed technical reasoning belongs in an ADR. An unchecked item is not
permission for an agent to guess, provision, deploy, migrate, or retire a
resource.

## Confirmed

| ID    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence date |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| O-001 | The replacement repository is named `guided-operations` and is private.                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-08-25    |
| O-002 | The replacement is a web app only; the Microsoft Access client is out of scope.                                                                                                                                                                                                                                                                                                                                                                                               | 2026-08-25    |
| O-003 | The initial deployment serves one facility.                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-08-25    |
| O-004 | The login experience should use employee number plus a personal PIN-like secret, or the safest practical equivalent. It must not use a shared facility code.                                                                                                                                                                                                                                                                                                                  | 2026-08-25    |
| O-005 | Vercel and Supabase are the target hosting/data platforms. Google hosting is excluded.                                                                                                                                                                                                                                                                                                                                                                                        | 2026-08-25    |
| O-006 | OpenAI is acceptable as the initial AI provider; interfaces must permit another provider.                                                                                                                                                                                                                                                                                                                                                                                     | 2026-08-25    |
| O-007 | Baseline assumption: there was no real operational data and the RAG policy/reference corpus was the only real source material. O-015 supersedes this for isolated Production only.                                                                                                                                                                                                                                                                                            | 2026-08-25    |
| O-008 | Prefer free plans where their terms and controls fit; do not weaken safety or readiness to remain free.                                                                                                                                                                                                                                                                                                                                                                       | 2026-08-25    |
| O-009 | Use a United States region; the exact paired regions are not yet approved.                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-08-25    |
| O-010 | The project began as a personal, non-commercial app for a small invited group and is not represented as an official agency/facility system. O-015 does not establish plan eligibility or official adoption.                                                                                                                                                                                                                                                                   | 2026-08-25    |
| O-011 | Create a separate Supabase project named `guided-operations` in `justinpeterman-droid's Org`, in `us-east-1`, leaving the inactive project untouched.                                                                                                                                                                                                                                                                                                                         | 2026-08-25    |
| O-012 | Officers and administrators use individual passcodes of at least eight characters. This is not a shared PIN or facility code.                                                                                                                                                                                                                                                                                                                                                 | 2026-08-25    |
| O-013 | Passcode-only administration was accepted only for the no-data foundation. That exception does not qualify the current real-data Production target; administrator assurance must be decided and tested before release.                                                                                                                                                                                                                                                        | 2026-08-25    |
| O-014 | The owner is the first/main administrator and is the only initial authority for additional-account creation, credential resets, unlocks, and temporary-secret delivery. Temporary passcodes are handed to the recipient in person.                                                                                                                                                                                                                                            | 2026-08-26    |
| O-015 | The owner authorizes production use of real operational and personal data and is accountable for product, security, records, privacy, retention, incident response, backup, billing, and production approval.                                                                                                                                                                                                                                                                 | 2026-08-26    |
| O-016 | Production records and controlled production copies are retained for two years from final revision, unless a legal hold, incident investigation, or later written records decision requires longer retention.                                                                                                                                                                                                                                                                 | 2026-08-26    |
| O-017 | The development and demonstration corpus is a generated fictional set of 22 documents (12 policies, 6 post orders, 4 directives) for an invented "Riverbend Training Unit". Every page is stamped as fictional test data. It remains the only corpus authorized for local development, CI, Preview, shared non-production, screenshots, and test fixtures. O-022 and O-028 separately authorize the real 236-document corpus for isolated Production processing.                         | 2026-08-29    |
| O-018 | The real policy corpus was identified and initially withheld from extraction, embedding, and AI transmission. O-021, O-022, and O-028 supersede that initial restriction for isolated Production only. The surviving environment boundary is unchanged: real documents never enter Git, local development, CI, Preview, shared non-production, screenshots, logs, support tools, or test fixtures.                                                                               | 2026-08-29    |
| O-019 | Application authentication alone is accepted as sufficient protection for the publicly reachable Production URL. This closes OQ-017.                                                                                                                                                                                                                                                                                                                                          | 2026-08-29    |
| O-020 | Administrator second-factor assurance is deferred for the fictional-data demonstration phase; password-only administration is accepted for that phase only. O-013 remains an open release gate and must be satisfied before any real data.                                                                                                                                                                                                                                    | 2026-08-29    |
| O-021 | The owner holds full authorization from the agency IT Director and owns the project completely. The project is not paid work and is not represented as an official agency system.                                                                                                                                                                                                                                                                                             | 2026-08-30    |
| O-022 | The real policy corpus is public record: all 236 documents are published on the agency public website. They may be extracted, embedded, and sent to the AI provider in the isolated Production workflow. This closes OQ-009 and supersedes the initial restriction in O-018. Corpus composition is settled: NCU and BMU are the same facility under its former and current names, with zero duplicate policy numbers or subjects, so NCU-numbered policies are never filtered out or treated as superseded. | 2026-08-30    |
| O-023 | Scope is deliberately small: a personal hobby tool for a few invited officers, not a department-wide system. Free provider tiers are an accepted decision rather than an oversight. This closes OQ-004.                                                                                                                                                                                                                                                                       | 2026-08-30    |
| O-024 | The application is advisory only and never sits in a time-critical path. If it is slow or unavailable, officers use their normal method.                                                                                                                                                                                                                                                                                                                                      | 2026-08-30    |
| O-025 | The application is not the system of record. Incident output is a draft writing aid; the official report is filed in the agency's own system.                                                                                                                                                                                                                                                                                                                                 | 2026-08-30    |
| O-026 | The corpus is replaced once a year, by the owner, by hand. There is no automated sync and no freshness checker, and none is wanted.                                                                                                                                                                                                                                                                                                                                           | 2026-08-30    |
| O-027 | Pinned models, verified current against OpenAI's published model list on 2026-08-30: `gpt-5.6-terra` for policy answers and report drafting, `text-embedding-3-small` for embeddings. `gpt-5.6-sol` and `gpt-5.6-luna` are the accuracy and cost dials. Because these models spend billed reasoning tokens out of `max_output_tokens`, every Responses call pins `reasoning.effort` and adds a reasoning allowance on top of its answer allowance.                            | 2026-08-30    |
| O-028 | The owner attests that all three collections — unit policies, post orders and secretarial directives — are published on the agency public website, and authorizes registering all 236 documents as `classification = public`, `rights_status = approved_full_reader`, `external_ai_allowed = true`, with the owner as rights reviewer and O-021/O-022 as the evidence reference. The review is recorded as current for one year, matching the annual manual refresh in O-026. | 2026-08-30    |
| O-029 | On the official 005/409 form, `UNIT/DIVISION` reading "Benny Magness Unit" is part of the form and is printed as a constant, not filled as a field. No domain value maps to it and no code path may substitute a different unit; using the tool at another facility would be a new form revision with a new source hash.                                                                                                                                                      | 2026-08-30    |

## Required before hosted development linkage

- [x] **OQ-001 — Provider login:** the Vercel CLI and Supabase provider session
      were independently authenticated to the expected owner accounts on
      2026-08-28. Tokens remain in provider credential stores, not Git.
- [x] **OQ-002 — Vercel region:** Supabase Development is provisioned in
      `us-east-1`, and the authoritative Vercel project reports the aligned
      `iad1` function region. Isolated Production must preserve this approved
      regional pairing unless the owner records a replacement decision.
- [x] **OQ-003 — Facility label:** answered 2026-08-29. The application is
      displayed as "Guided Operations" and uses `guided-operations` in host and
      project naming. No real facility name appears in the display name, the
      URL, or any public metadata. No real roster is added.
- [x] **OQ-004 — Plan eligibility (closed 2026-08-30 by O-023):** the owner
      accepts the small personal, non-commercial scope for a few invited
      officers and the current Vercel Hobby/Supabase Free plan choice. This does
      not waive real-data availability, backup, support, security, or provider
      limit gates, and the decision must be revisited if scope or terms change.

## Authentication implementation constraints

- **O-012 passcode policy:** at least eight characters for individual officer
  and administrator passcodes. The implementation contract now bounds personal
  passcodes to 8–64 printable non-space ASCII characters and still rejects
  common patterns and employee-number equality. Employee numbers use bounded
  NFKC/trim/uppercase normalization while preserving leading zeroes and approved
  separators. The owner must accept the final wording/usability before the first
  real account is created.
- **O-013 admin assurance:** the earlier passcode-only exception does not cover
  the real-data Production target. Administrator MFA or an explicitly approved,
  tested equivalent is an open release gate.
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

- [x] **OQ-008 — Corpus location:** answered 2026-08-29. The authoritative
      source set is 236 PDFs assembled 2026-05-28: BMU Policies (160), BMU Post
      Orders (42), and SD (34); BMU Forms (55) are deliberately excluded. The
      owner considers the set current as of May 2026. O-022 and O-028 provide
      the later rights and AI-processing authorization. The sources remain
      outside Git, local development, CI, Preview, shared non-production,
      screenshots, logs, support tools, and test fixtures.
- [x] **OQ-009 — Corpus custodian and processing rights (closed 2026-08-30 by
      O-021, O-022, and O-028):** the owner records agency authorization, public
      source status, collection scope, full-reader rights, external-AI approval,
      and the annual review period. All three approved collections, including
      post orders, may be processed only through the authorized isolated
      Production workflow; the surviving environment exclusions still apply.
- [ ] **OQ-010 — Google boundary:** confirm whether Google AI APIs are also
      prohibited. The current target uses no Google hosting or Google-specific
      AI runtime either way.

## Required before Production

- [ ] **OQ-016 — Repository enforcement:** choose a GitHub plan that supports
      branch protection/rulesets for the private repository, or explicitly
      accept documented manual pull-request, independent-review, green-check,
      no-force-push, and release-record controls that GitHub cannot enforce.
- [x] **OQ-017 — Production URL protection:** answered 2026-08-29. Application
      authentication alone is accepted; no provider-level URL protection will be
      purchased. See O-019. Revisit if real data is ever authorized.

## Known operational issues

- **One policy is missing from the corpus (2026-08-30):**
  `SD 2022-01 Revised COVID Visitation Directive.pdf` failed its production
  import. Its page 5 screening checklist draws checkboxes with a symbol font
  whose glyph is character `0x00`, and PostgreSQL rejects NUL in text columns.
  The fix belongs in normalization, but `normalization_version` is part of the
  configuration hash for every bundle, so changing it re-keys all 236 and
  implies a full re-extraction. The owner deferred that on 2026-08-30; the
  annual refresh in O-026 is the natural moment to bump it. Until then the
  directive is not searchable and a question about it returns no sources.
  Recorded in `docs/operations/2026-08-30-production-corpus-import.md`.

- **GitHub Actions exhausted (2026-08-29):** every workflow run on this private
  repository has failed in 3-5 seconds since 2026-08-28 16:34 UTC. Failed jobs
  are assigned no runner and execute zero steps. Actions is enabled and the
  workflow definitions are valid; a run on the owner's _public_ repository
  succeeded during the same window. The cause is the monthly included-minutes
  allowance for private repositories, consumed at roughly 22 minutes per push
  across four workflows. Local verification is unaffected: lint, typecheck, 681
  Vitest tests and 66 operations tests all pass.
- **NODE_ENV leak:** a shell environment with `NODE_ENV=production` causes React
  to load its production build, and 121 test files fail with
  `TypeError: React.act is not a function`. These are phantom failures. Run the
  suite with `NODE_ENV=test`.
- **MinerU backend:** the default VLM backend aborts with
  `Can not find $env:CUDA_PATH` because the CUDA Toolkit path is not exported to
  the shell. Use `--mineru-backend pipeline`, or set `CUDA_PATH`, until that is
  resolved.

## Required before real-data Production or any official adoption

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
