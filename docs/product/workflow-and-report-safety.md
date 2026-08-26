# Workflow and Report Safety Invariants

These invariants define correctness. A feature that violates one is not
releasable even if its UI appears complete.

## Safe workflow sequence

```text
Officer relationships
  -> field notes saved as source words
  -> structured facts proposed
  -> employee reviews/corrects/marks unknown
  -> missing-information questions reviewed
  -> confirmed-fact revision created
  -> reports and packet drafted from that revision
  -> employee reviews and edits outputs
  -> deliberate print/download/copy/physical acknowledgment
  -> append-only history and redacted audit metadata
```

No implementation may skip directly from raw notes or model output to an
official output.

## A. Data authorization boundary

**SAFE-001 — Fictional operational data only.** Until a separate real-data
approval is recorded, source control, local/preview/production-like databases,
tests, screenshots, traces, support examples, logs, and demos use fictional
personnel and operational data. The only real content permitted is authorized
RAG source material.

**SAFE-002 — No production fallback fixtures.** Empty or failed authorized
queries render an honest empty/error state. They never render sample incidents,
staff, counts, service status, notifications, dates, quotes, or identities.

**SAFE-003 — Data minimization.** Collect and return only fields required for
the current workflow and role. List endpoints do not return narratives or fact
bodies when summaries suffice.

**SAFE-004 — Private artifacts.** Policy files, generated reports, and form
artifacts are private. Access requires a current authorization check and a
short-lived delivery mechanism; object keys and permanent public URLs are not
exposed.

## B. Facts and human confirmation

**SAFE-010 — Preserve source words.** Field notes are stored separately from
extracted facts and generated narratives. Normalization may not silently rewrite
the employee's source notes.

**SAFE-011 — Proposed is not confirmed.** Every extracted value begins as
proposed and carries provenance to the note span/model run where practical.
Proposed values cannot populate official output as confirmed facts.

**SAFE-012 — Explicit confirmation.** Confirmation records actor, timestamp,
base incident revision, confirmed values, explicit unknown/not-applicable
values, and extraction/rule version. A bulk “accept” action must still make the
reviewed scope clear.

**SAFE-012a — Revision-local provenance.** Each confirmed fact references one or
more field notes in the same immutable incident revision. A note from a
different revision cannot provide silent provenance.

**SAFE-013 — Unknown remains unknown.** Missing values remain blank or
explicitly Unknown/Not applicable according to the target form. The system
cannot infer a person, time, location, quantity, charge, injury, evidence
result, notification, or disposition simply because a template requires it.

**SAFE-014 — System metadata is labeled.** The server may assign technical IDs
and timestamps. It may not present a server timestamp as the event time or
another technical value as an operational fact.

**SAFE-015 — Categories and rule inputs are controlled.** Incident categories,
form-rule inputs, and official classifications use approved versioned values.
Free text may describe an event but must not bypass controlled classification or
charge decisions.

## C. Missing-information workflow

**SAFE-020 — Questions have a source.** A missing-information question comes
from an approved incident checklist, form definition, policy/rule version, or a
model suggestion clearly labeled for review. Persist the source/version of the
rule, not a claim that the model made it required.

**SAFE-021 — Questions are bounded and relevant.** Ask only information
necessary for an authorized workflow. Avoid soliciting medical, protected, or
identifying detail merely because a model predicts it might be useful.

**SAFE-022 — No coercive completeness.** Employees can record Unknown or Not
applicable when accurate. Progress and packet completeness expose the unresolved
state without forcing a fabricated answer.

**SAFE-023 — Reconfirmation after material change.** Changing notes, category,
involved people, or another rule-driving fact invalidates affected confirmation
and generated-output state. The UI identifies what needs review again.

## D. Reports and generated text

**SAFE-030 — Generation input is pinned.** Every generation request references
an immutable confirmed-fact revision, reporting officer relationship, report
type, prompt/template version, and idempotency key.

**SAFE-031 — Schema first.** Provider output is parsed into a strict domain
schema. Unexpected fields, missing provenance, invalid identifiers, or unbounded
content fail validation before persistence.

**SAFE-032 — Draft labeling.** Generated text is editable draft material until
the required employee review is recorded. Model confidence language cannot
replace that state.

**SAFE-033 — Attribution survives preparation.** A preparing officer or
administrator does not replace the reporting officer. Report history records
author/reporting officer, preparer, editor, and elevated administrator actions
distinctly.

**SAFE-034 — Regeneration does not erase edits.** Regeneration creates a new
candidate or revision with a visible comparison/recovery path. It does not
silently overwrite human edits.

**SAFE-035 — No autonomous filing.** A provider or background job cannot submit
to an external records system, print, download, email, close an incident, or
acknowledge physical completion.

**SAFE-036 — Copy-only means copy-only.** Supervisor Summary, Disciplinary
Supplement, and any other approved copy-to-records output expose deliberate
plain-text copy. They do not display Print or Download Word unless a later
approved contract explicitly changes the output type.

## E. Forms, packets, and physical processes

**SAFE-040 — Approved source and version required.** Each form definition
identifies source authority, revision/effective date when available, rights
status, template/render version, capabilities, and required/review/optional
fields.

**SAFE-041 — Deterministic requirement rules.** Required packet items are
selected by versioned deterministic rules over confirmed facts. AI may explain
or suggest, but it cannot silently set required status.

**SAFE-042 — Completeness is honest.** Completeness lists
missing/review-required fields. Rendering must not convert a missing value to
zero, false, a current date, or plausible prose unless the approved source
explicitly defines that default.

**SAFE-043 — Physical forms remain physical.** Chain of Custody and other
physical-only official forms receive a visible warning, obtain-from guidance,
and confirmed handwriting guidance. The app does not generate a replacement and
does not imply that acknowledgment is filing.

**SAFE-044 — Output capability is real.** Preview, print, PDF, and Word
capabilities are advertised only after that exact format is implemented,
authorized, and tested. A browser preview or planning flag is not a completed
download.

**SAFE-045 — Artifact provenance.** A generated artifact records incident/report
revision, form definition/version, renderer version, content hash, generator
time, actor/request, and expiration/retention class. Regeneration produces a new
immutable artifact identity.

**SAFE-046 — Packet order is stable.** Required, suggested, additional, and
physical-only items have deterministic order and capability labels. Print
packets explicitly exclude physical-only items and explain the exclusion.

## F. NCU Days Count and routine paperwork

**SAFE-050 — Counts are never corrected by the system.** Inputs, subtotals,
expected totals, and differences remain visible. The product may calculate and
highlight; only an authorized employee changes an entered value.

**SAFE-051 — Blank and zero differ.** Blank cells remain blank in storage/print
unless the approved source requires zero. Validation and calculations preserve
the distinction.

**SAFE-052 — Source order and print contract.** Count rows, daily logs, monthly
forms, labels, and print order follow the approved source definition. Schema
iteration order or UI sorting cannot silently change official output.

**SAFE-053 — Routine records are revision-safe.** Daily and monthly records use
base revision plus idempotency. Autosave never claims success before server
confirmation and never overwrites a newer record.

**SAFE-054 — No invented weekly product.** The canonical old weekly catalog is
empty. Weekly forms remain not configured until approved source material and an
owner decision exist.

## G. Policy retrieval and citations

**SAFE-060 — Authorized corpus only.** Retrieval is limited to registered source
versions whose rights and active/current state allow use. Unreviewed,
superseded, quarantined, or failed-ingestion sources are excluded by default.

**SAFE-061 — Evidence-bounded answer.** Generation receives only the selected
authorized passages and a rule to say it cannot answer when evidence is
insufficient. General model knowledge cannot be presented as facility policy.

**SAFE-062 — Verifiable citation.** Each citation references an opaque policy
ID, immutable source hash/version, chunk ID, start/end page, exact supporting
excerpt or excerpt hash, and the answer claim/span it supports. The server
verifies that the excerpt occurs in the registered chunk/page text.

**SAFE-063 — No fabricated page mapping.** Page numbers come from deterministic
extraction metadata and are checked against rendered source pages. A model may
not invent or infer a page number.

**SAFE-064 — Fail closed on unsupported answer.** If no passage supports the
answer, citation validation fails, retrieval is unavailable, or the employee
lacks source access, return a clear no-answer/error state. Do not show a
polished uncited answer.

**SAFE-065 — Policy questions are transient by default.** Do not persist
question text, answer text, or source excerpts in ordinary user history,
analytics, or audit. Persist only bounded operational metadata required for
safety/abuse/idempotency unless a separately approved retention policy says
otherwise.

**SAFE-066 — Reader is authorized.** Full-source text/PDF endpoints use opaque
IDs, check current session and source authorization on every request, prevent
object-key/path traversal, and return no public bucket URL.

**SAFE-067 — Guidance is not authority.** UI copy states that cited guidance
must be checked against current official policy and that operational/legal
decisions remain with authorized personnel.

## H. Revisions, concurrency, and idempotency

**SAFE-070 — Append-only history.** Incident facts, reports, routine paperwork,
form definitions, and corpus sources retain immutable historical revisions or
immutable source versions. Normal edits create successors; they do not rewrite
audit-relevant history.

**SAFE-071 — Compare base revision.** Every mutable domain write includes the
base revision read by the client. A mismatch returns a typed conflict with the
current revision; it never uses last-write-wins for protected content.

**SAFE-072 — Preserve local work on conflict.** The UI keeps the user's visible
content, blocks stale resubmission, explains that server save was not confirmed,
and provides a copy/compare/reopen recovery path.

**SAFE-073 — Idempotent retries.** Create, confirm, generate, output,
acknowledge, reset, and state-transition mutations accept scoped idempotency
keys. Replaying the same request returns the same logical result; reusing a key
with different content is rejected.

**SAFE-074 — Short transactions.** Authorize, validate the expected revision,
write the new state/history/outbox record, and commit in one bounded
transaction. Slow AI generation, object rendering, and network calls occur
outside row-locking transactions.

**SAFE-075 — Jobs are claim-safe.** Workers claim each queued job once, use
bounded retries, record terminal failure, and cannot apply a result to a
different or superseded input revision.

## I. Persistence and recovery language

**SAFE-080 — Truthful save states.** Use a shared vocabulary: Unsaved, Saving,
Saved to server, Reconnecting, Conflict, and Save failed. “Saved” appears only
after the authoritative server commit succeeds.

**SAFE-081 — Visible input survives dependency failure.** Network, validation,
provider, or server failures do not clear field notes, edits, gap answers, or
routine paperwork currently visible to the user.

**SAFE-082 — Retry is bounded.** Automatic retries apply only to safe/idempotent
operations with backoff. Terminal validation, authorization, and conflict errors
require user action and are not retried blindly.

**SAFE-083 — Partial success is explicit.** If a report saved but artifact
rendering failed, show those as separate states. Do not roll a successful
canonical save back merely to make the UI look atomic unless the product
contract requires one transaction.

## J. Authorization and session safety

**SAFE-090 — Server and database enforce access.** Client route guards and
hidden buttons are presentation only. Server authorization plus least-privilege
Postgres grants/RLS protect every read and mutation.

**SAFE-091 — Actor comes from the session.** The client cannot choose audit
actor, account identity, administrator identity, or preparing officer without
server validation of the relationship.

**SAFE-092 — Elevated actions expire.** Administrator step-up is action-scoped
or time-bounded, checked on the server, and invalidated by sign-out, role
change, credential reset, or policy expiry.

**SAFE-093 — Direct-access tests required.** Test direct route-handler, Supabase
REST, object-storage, and guessed-ID access—not only the intended UI path.

## K. Audit and observability

**SAFE-100 — Bounded audit metadata.** Audit records include event ID,
actor/account, role/elevation context, action, resource type/opaque ID,
prior/new revision or bounded state, timestamp, request correlation, result, and
reason code where required.

**SAFE-101 — Never audit protected bodies or secrets.** Ordinary audit/logging
excludes field notes, narratives, full proposed/confirmed fact values, gap
answers, policy questions/answers/excerpts, PINs, temporary credentials, tokens,
cookies, provider prompts, signed URLs, and raw source files.

**SAFE-102 — Redaction is tested.** Structured logging uses allowlists and tests
that intentionally submit secret-like and narrative-like input. Error reporting
receives safe codes and correlation IDs, not request bodies by default.

**SAFE-103 — Health is honest.** Health UI distinguishes Operational, Degraded,
Unavailable, and Unknown, names last checked time from a trusted clock, and does
not reveal internal endpoints, credentials, object keys, or sensitive payloads.

## Required safety test pack

Every feature pull request adds the applicable tests below. Release acceptance
runs them against the exact deployed candidate.

1. **Fabrication tests:** missing values stay missing through extraction,
   confirmation, generation, preview, print, and download.
2. **Provenance tests:** every output resolves to the confirmed-fact/form/source
   versions recorded at creation.
3. **Authorization tests:** unauthenticated, wrong officer, inactive account,
   downgraded role, expired step-up, guessed ID, direct API, and storage
   enumeration are denied.
4. **Revision tests:** two clients edit the same record; the stale write
   conflicts and both users' visible work remains recoverable.
5. **Idempotency tests:** retry each consequential mutation before/after a
   simulated timeout and prove one logical side effect.
6. **Persistence-language tests:** offline, server error, validation error,
   conflict, retry, and success never show a false Saved state.
7. **Audit-redaction tests:** prohibited bodies and secrets do not enter logs,
   audit rows, traces, analytics, or error reports.
8. **Citation tests:** every answer claim resolves to exact stored text and page
   mapping; injected/fabricated source IDs, excerpts, or page numbers fail.
9. **Physical-form tests:** no print/download/generated substitute action exists
   for physical-only items.
10. **Output tests:** every advertised format is actually generated, opens
    successfully, preserves source order/blank rules, and is access-controlled.
11. **Fictional-data scan:** repository, seed, snapshots, screenshots, traces,
    artifacts, and preview environment contain only approved fictional
    operational data.
12. **Accessibility recovery tests:** error/conflict/confirmation/status
    messages are keyboard-reachable, announced appropriately, and retain
    focus/input.

## Change control

Changing or waiving a `SAFE-*` invariant requires:

- a written product and threat/risk rationale;
- affected data and user roles;
- alternative control;
- test changes;
- named product, security, and operational owners; and
- an explicit repository decision record.

Silence, an implementation shortcut, provider limitation, or inherited legacy
behavior is not a waiver.
