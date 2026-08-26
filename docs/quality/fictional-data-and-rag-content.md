# Data classification, real-data boundary, and approved RAG content

## Non-negotiable boundary

Guided Operations permits real operational and personal data only in its
isolated Production environment after the owner accepts every release gate. The
owner authorized that boundary and a two-year retention period on 2026-08-26.
This is not permission to place real records in Git, local work, CI, Preview,
shared non-production, screenshots, logs, analytics, support tools, test
fixtures, or unapproved AI requests.

Production handling is governed by
[../operations/real-data-governance.md](../operations/real-data-governance.md).

## Classification

| Class                                | Examples                                                                                                                                                                                      | Rule                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Restricted operational/personal data | real names, employee/resident numbers, passcodes, schedules, rosters, housing/incident/case details, counts, narratives, photos, signatures, medical/legal/disciplinary content, live exports | Production only after release approval; never Git, non-production, logs, screenshots, test fixtures, or unapproved provider requests |
| Approved real corpus                 | signed-off policies, procedures, manuals, statutes/regulations, approved reference material, provenance/effective-date/rights metadata                                                        | Private, versioned, least privilege, approved ingestion only                                                                         |
| Fictional application data           | clearly invented users, events, workflows, counts, identifiers, facilities, dates, narratives                                                                                                 | Allowed when unmistakably fictional and non-derivable from real people/events                                                        |
| Synthetic policy data                | invented policy text used for deterministic tests                                                                                                                                             | Allowed in Git/CI when labeled synthetic                                                                                             |
| Secrets/security data                | tokens, cookies, keys, connection strings, hashes, signed URLs, internal prompts                                                                                                              | Never commit or expose; store only in approved secret systems                                                                        |
| Derived corpus data                  | chunks, OCR, embeddings, indexes, summaries, evaluation traces                                                                                                                                | Treat at least as sensitively as the source corpus                                                                                   |

“Anonymized” operational data remains restricted: removing a name alone does not
make an incident or personnel record safe for a lower environment.

## Fictional fixture rules

- Use obviously fictional names such as “Jordan Example” and reserved example
  domains.
- Prefix identifiers with terms such as FIC, DEMO, or TEST and generate them
  independently of real numbering schemes.
- State “Fictional demonstration data” in seeded UI and captured screenshots.
- Avoid plausible copies of real incidents, rosters, shift patterns, population
  counts, policies, or facility layouts.
- Use stable seeded randomness so failures reproduce.
- Include edge cases without borrowing from real records: long names, Unicode,
  DST boundaries, empty lists, large safe counts, permission conflicts, and
  concurrent edits.
- Add an automated scanner for prohibited patterns and high-risk field names in
  fixtures, logs, and artifacts. A scanner supplements human review; it does not
  certify that content is safe.

If real data is discovered outside Production or outside its authorized scope,
stop processing, restrict access, preserve only minimal evidence, notify the
owner, and follow
[../operations/incident-response.md](../operations/incident-response.md).

## Corpus admission

Every real source requires an owner-approved manifest entry before ingestion:

- stable source ID and title;
- issuing authority and authoritative source location;
- document version, effective/review/expiration dates, and superseded version
  relationship;
- facility/applicability scope and jurisdiction;
- rights/license or owner authorization;
- source-file checksum, media type, page count/size, and acquisition time;
- classification, access roles, retention/deletion rule, and approver;
- ingestion/parser/OCR version, chunking/index settings, and resulting corpus
  version.

The repository should normally contain schemas, fixture corpus, and a
content-free manifest template—not the real source documents. Store approved
source objects and derived artifacts in private Supabase Storage. Committing a
real source document requires a separate owner/rights/security decision even in
a private repository.

## Ingestion pipeline

1. Upload to a quarantine prefix in a private bucket.
2. Validate size, media type, file signature, encryption/password state, and
   malware scanning result.
3. Match the file checksum to an approved manifest entry and reject unapproved
   duplicates or substitutions.
4. Extract text in an isolated, bounded process; record parser/OCR version and
   failures.
5. Detect hidden text, unexpected attachments/scripts, prompt-like instructions,
   and content outside the approved class.
6. Have a reviewer compare sampled extraction to the authoritative source,
   including tables, headers, footnotes, page/section identifiers, and
   redactions.
7. Chunk without losing source ID, page/section, effective date, access scope,
   and corpus version.
8. Build derived indexes/embeddings under the same access controls as the
   source.
9. Run retrieval, citation, refusal, injection, and stale/conflict evaluations.
10. Promote the immutable corpus version only after recorded owner approval.

Source text is untrusted input. Instructions inside documents cannot override
system policy, reveal hidden prompts, call tools, widen access, or suppress
citations.

## Retrieval and answer rules

- Filter retrieval by active corpus version, facility/applicability, effective
  date, and actor authorization before ranking.
- Present source title, stable identifier, page/section, and effective/version
  information with the answer.
- Keep generated interpretation distinct from quoted/source material.
- Refuse or escalate when evidence is absent, conflicting, stale, inaccessible,
  or outside scope.
- Do not provide autonomous operational decisions or claim legal/compliance
  authority.
- Do not send more source text to an AI provider than the approved task
  requires.
- The AI adapter must be provider-neutral; changing providers/models triggers
  contract and evaluation qualification.
- Do not store prompts/responses by default. If future controlled retention is
  proposed, it requires a new data classification, retention policy, access
  review, and owner authorization.

## Versioning, correction, and deletion

- Corpus versions are immutable manifests. A correction creates a new version.
- Superseded documents remain inaccessible to normal retrieval but retain the
  approved audit/retention status.
- An emergency withdrawal immediately disables retrieval of the affected
  source/version and triggers an integrity/evaluation review.
- Deletion covers source objects, extracted text, chunks, embeddings/indexes,
  caches, evaluation copies, and backups according to the approved retention
  rule.
- Record tombstones and checksums without retaining prohibited content.
- Rebuild derived indexes after policy, parser, chunking, embedding,
  authorization, or deletion changes.

## Environment use

- **Local:** synthetic corpus by default. Access to the approved real corpus is
  exceptional, private, time-bounded, and owner-approved.
- **Preview/shared non-production:** fictional application data; only a
  controlled approved-corpus copy when the release test requires it.
- **Staging-equivalent release candidate:** pinned private preview plus
  controlled non-production corpus qualification.
- **Production:** approved corpus and real operational application data are
  permitted only after the owner accepts the exact release candidate and all
  real-data controls are verified.

Never copy a production database or Storage bucket into development. Backups and
restore drills follow
[../operations/backup-and-restore.md](../operations/backup-and-restore.md) and
must preserve the same classification.

## Production real-data gate

Before any real-data entry, require the data inventory/purpose, role model,
audit requirements, threat model, provider controls, backup/restore evidence,
retention/deletion procedure, incident response, release tests, and explicit
owner acceptance described in
[../operations/real-data-governance.md](../operations/real-data-governance.md).
