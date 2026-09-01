# Legacy Assistant Parity Contract

This contract records what the replacement must preserve from the old Report
Assistant and RAG Policy Assistant, what must be made safer, and what remains
unfinished. It prevents a visually similar page from being treated as feature
parity.

## Inspected legacy snapshot

- Repository: `justinpeterman-droid/prison-policy-ai`
- Ref: `origin/main`
- Commit: `ebe52c4b977ab742975974732beec42fff1bbce5`
- Inspected: 2026-08-27

The local legacy checkout was 56 commits behind and had unrelated uncommitted
work. This comparison therefore uses fetched `origin/main`, not the dirty local
checkout. Google/Flask implementation details, secrets, real personnel data,
source documents, generated output, and realistic gold reports are not copied.

## Report Assistant

### Legacy sources that define the behavior

| Source                                                          | What it proves                                                                                                    | Replacement decision                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `REPORT_ENGINE_SPEC.md`                                         | Notes -> classification -> extraction -> fixed gap questions -> officer confirmation -> narrative-only generation | Adapt the workflow; replace provider and persistence code                              |
| `templates/gold_reports/STYLE_RULINGS.md`                       | Final supervisor rulings and their precedence                                                                     | Treat as the legacy authority; convert reviewed rules into versioned code/tests        |
| `REPORT_WRITING_RULES.md` and `templates/report_style_guide.md` | Earlier rule descriptions and examples                                                                            | Reference only where they agree with the final rulings                                 |
| `templates/incident_checklist_v2.json`                          | Controlled categories, questions, answer types, required forms, and code-inserted content                         | Quarantine until source/current-version approval, then import as versioned data        |
| `backend/reports/prompts_v2.py`                                 | Model receives structured facts and writes narrative prose only                                                   | Preserve the boundary; do not copy Python/provider coupling                            |
| `backend/reports/validate.py` and `report_validator.py`         | Deterministic gaps, Unknown markers, auto-content, anti-fabrication, and style checks                             | Translate applicable blocking checks into target-native code                           |
| `backend/reports/generator.py` and `service.py`                 | Five report types, conditional investigation, reporter binding, validation/repair                                 | Rebuild behind the confirmed-fact and revision boundary                                |
| `backend/webapp/api_v1/reports.py`                              | Authorized list, content, append-only revisions, conflict handling, restore, and exact-revision DOCX export       | Preserve using Supabase authorization, RLS, immutable revisions, and private artifacts |

`STYLE_RULINGS.md` explicitly wins when the legacy files disagree. Important
final rulings are:

1. Narrative ADC numbers use `ADC# 123456`.
2. Rank abbreviations keep their period: `Sgt.`, `Cpl.`, `Lt.`, `Cpt.`
3. Narrative time uses `9:50 pm`; the 005 time field separately uses
   `APX. 9:50 PM`.
4. `inmate` is lowercase in the middle of a sentence.
5. The house style has no `End of report` statement closer.
6. Disciplinary output uses the `Due to the above stated facts` charging
   sentence and `pending DCR` when charges are confirmed.
7. Clinical injury/treatment prose is excluded from the narrative; the form uses
   the approved `MSF 205` reference.
8. `Same as above` is the approved 005 presence-field value.
9. Investigation is a fifth report type and appears only when confirmed
   investigation findings exist.
10. `use_of_force` and `medical_emergency` are controlled categories;
    use-of-force marks both the 005 and 409 designations.
11. A marked designation box uses `X`.
12. Every officer gets a separately attributed draft containing only that
    officer's actions or attributed secondhand information.

### Behavior the replacement must preserve

- Keep source notes separate and unchanged.
- Propose a controlled category, then require officer confirmation or override.
- Extract proposed facts into a schema; never turn extraction directly into an
  official report.
- Ask approved, prewritten missing-information questions with typed answers.
  `Unknown` remains available; `No` on a nonblocking checklist question does not
  block progress.
- Generate from one immutable confirmed-fact revision, never raw notes.
- Select required forms and insert required sentences with deterministic rules,
  not model judgment.
- Bind the reporting officer separately from the preparing officer and create
  per-officer drafts from only that officer's supported perspective.
- Run deterministic anti-fabrication and style checks after generation.
- Keep all generated material visibly review-only until an officer edits and
  attests to it.
- Save append-only history, detect concurrent edits, restore as a new revision,
  and export only an explicit reviewed revision.

### Current replacement status

Already present:

- immutable field notes, reviewed fact states, same-revision provenance, and
  confirmed-fact-only generation;
- strict provider output with paragraph-to-fact IDs;
- explicit officer review before finalization;
- authorized report list, history, restore, and print-request audit;
- the versioned `bmu-house-style-v2` generation profile;
- deterministic rejection of legacy blocking errors for ADC/rank/time format,
  invented numeric facts, placeholders, clinical wording, prohibited closers,
  missing first-person perspective, supervisor first-person wording, and missing
  disciplinary closing language;
- one controlled report package—first person, supervisor summary, cover letter,
  and disciplinary—enforced by the request, service, read, and database layers;
- immutable incident-revision relationships for reporting, preparing, involved,
  and witness staff, with the preparer fixed to the signed-in account;
- one selected reporting officer bound to each review-only candidate and final
  report, while reporting officer, preparer, and final editor attribution remain
  distinct and the reporter identity never enters AI-provider input;
- schema-versioned confirmed-fact scopes that bind each fact to applicable
  reporting officers, require deliberate assignment when multiple reporters are
  selected, and reject cross-officer facts before generation and database
  storage;
- a protected incident-to-draft workspace that shows only the selected reporting
  officer's confirmed facts, submits opaque fact IDs through the existing
  generation boundary, and routes the result into the existing officer review
  and finalization screen;
- fictional local browser qualification for officer review/edit/finalization,
  correction, stale-revision conflict recovery that preserves unsaved text,
  append-only history/restore, audited print, and same-facility administrator
  access to an officer's restored report revision;
- a nine-category, source-commit-bound pilot checklist with typed answer
  controls, explicit Unknown/Not applicable states, deterministic dependent
  questions, required-answer validation, note-backed confirmed facts, and
  owner-approved Production pilot use under O-030;
- explicit officer confirmation of the selected category plus conservative
  one-note-line/one-proposal fact review with exact visible source text,
  confirm/exclude decisions, edit re-confirmation, and separate provenance for
  an officer-edited confirmed fact.
- a protected provider-neutral suggestion route that uses a bounded AI budget,
  strict non-stored/tool-free output, allowlisted categories, and
  server-restored source-line provenance. Invalid or unavailable AI cannot block
  the manual review path or confirm any value.

Still required for parity:

- qualify the provider-neutral structured extraction boundary against the pinned
  model and approved fictional evaluation set, then approve provider data
  controls before any operational note is sent;
- operationally review every recovered question, option, dependency, required
  slot, report type, and paperwork mapping against the current source forms;
- implement required auto-content and the approved 005/409 output mapping;
- approve the source DOCX/form revisions and qualify print/export fidelity;
- add exact opening, first-reference, quote, attribution, and combined-action
  validation where the confirmed schema provides enough data;
- complete real-browser acceptance for incident creation, extraction review,
  category confirmation, fixed gap questions, draft generation, comparison, and
  explicit-revision export. The replacement now has a deterministic generic
  reviewed-report DOCX for an explicitly selected immutable revision, with an
  authorization recheck and redacted integrity audit; it is not the approved
  005/409 form. The later review/correction/conflict/history/restore/print,
  generic Word download, and administrator-visibility path is locally covered
  with fictional tests but still needs full browser, hosted, and owner
  acceptance.

## RAG Policy Assistant

### Legacy sources that define the behavior

| Source                                                               | What it proves                                                                                                 | Replacement decision                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `backend/pipeline/query.py`                                          | Work-topic gate, bounded retrieval, passage selection, history-as-context, cited answer, and fallback behavior | Preserve useful behavior but replace Google and weak citation paths |
| `backend/pipeline/citations.py`                                      | Inline marker parsing and lexical citation inference                                                           | Reference tests only; lexical inference is not authoritative        |
| `backend/webapp/api_v1/policy.py`                                    | Bounded history, deadline, idempotency, transient content, and value-free audit                                | Preserve the security and cost-control contract                     |
| `frontend/web/src/features/policy/PolicyExpertPage.tsx` and `api.ts` | Question, answer, refusal/error, and source-panel user experience                                              | Adapt to the Next.js route and stricter response schema             |
| Full-policy-reader branch                                            | Open cited source with an opaque authorized ID                                                                 | Rebuild against private Supabase Storage                            |

The old path retrieved broadly, selected at most 12 bounded passages, treated up
to six prior question/answer turns as context rather than evidence, and showed
source passages. It also had important weaknesses that must not be copied:

- it could display an uncited model answer with a warning;
- it could infer citations from wording overlap;
- it contained hard-coded PREA/domain claims outside the approved corpus;
- it depended on Google Discovery Engine/Vertex and legacy route contracts.

### Behavior the replacement must preserve

- Ask focused correctional-policy questions and give an honest off-topic or
  unsupported response.
- Retrieve only active, authorized document versions for the user's facility.
- Bound query, passage, answer, timeout, retry, cost, and history size.
- Treat source passages and prior chat turns as untrusted context, never
  instructions or independent policy authority.
- Put citations beside the answer and let the officer review the exact source,
  version, page/section, and excerpt.
- Keep question, answer, history, and passage text out of ordinary logs and
  audit records; retain only allowlisted operational measurements.
- Refuse when evidence is missing, conflicting, inaccessible, invalid, or the
  provider is unavailable.

### Current replacement status

Already present:

- authenticated, same-origin, CSRF-protected policy requests;
- active-version/facility-aware Supabase retrieval;
- tool-free, non-stored OpenAI generation with budgets and timeouts;
- strict structured answer/refusal/conflict outcomes;
- exact immutable citation-object validation with no model-created source,
  version, page, hash, excerpt, or chunk identity;
- at most six transient prior user questions for follow-up interpretation; prior
  answers are never accepted from the browser, and prior questions are context
  only rather than evidence;
- accessible citation display and private source-reader authorization;
- deterministic fictional evaluation for retrieval, citations, conflicts,
  refusal, prompt injection, access boundaries, provider outage, and value-free
  scorecards.

Still required for parity and release:

- recover, approve, hash, version, page-map, and privately ingest the real
  policy corpus;
- add reviewed slang/query expansion only where it improves retrieval without
  changing the officer's question;
- complete the authorized full-policy reader with source highlighting and focus
  restoration;
- run the custodian-approved real-corpus golden set and human review;
- prove private Storage backup/restore, index rebuild, and repeatable
  evaluation.

## Release rule

Neither assistant has parity merely because its page renders. Report Assistant
parity requires the controlled rule/checklist workflow and reviewed outputs.
Policy Assistant parity requires the approved corpus, strict cited answers, safe
follow-up context, and authorized source reading. Every remaining item is a
release gate until evidence proves it against the exact candidate.
