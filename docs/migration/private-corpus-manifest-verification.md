# Private policy corpus manifest verification

This procedure verifies the approved source-byte inventory without placing a
policy PDF, source filename, title, approval record, extracted text, question,
answer, citation, or provider location in Git, CI, Preview, screenshots, or
ordinary logs. It implements a local fail-closed gate; it does not approve a
corpus, upload a source, run extraction, or authorize Production promotion.

The custodian keeps both the manifest and source directory in an approved
restricted location outside—and not containing—the repository. The verifier
reads them on a controlled operator computer and emits only value-free aggregate
evidence.

## Command

```powershell
npm run corpus:verify -- `
  --manifest 'D:\Restricted\Guided Operations\corpus-manifest.json' `
  --source-root 'D:\Restricted\Guided Operations\approved-sources' `
  --output 'D:\Restricted\Guided Operations\corpus-verification-evidence.json'
```

The output path must not already exist. Omit `--output` only for an interactive
operator check; stdout then contains the same value-free evidence. Do not send
private paths, manifest content, source names, or verifier error output to CI or
support tools.

## Manifest contract

The JSON root contains exactly:

| Field                        | Requirement                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `manifest_version`           | Integer `1`                                                   |
| `corpus_version`             | Bounded opaque identifier                                     |
| `storage_bucket_alias`       | Bounded private-bucket alias                                  |
| `custodian_approval_ref`     | Controlled external approval-record reference                 |
| `rights_review_approval_ref` | Controlled external rights-review reference                   |
| `generated_at_utc`           | Real canonical UTC time, after every included review and scan |
| `entries`                    | One to 5,000 strict entry objects                             |

Each entry contains exactly:

| Group                     | Fields                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry identity         | `document_id`, `document_version_id`, `stable_key`, `title`, `version_label`, nullable `effective_on`                                                                        |
| Private source identity   | `source_file`, `source_sha256`, `byte_size`, `mime_type`, `page_count`                                                                                                       |
| Rights and classification | `classification`, `rights_status`, `rights_evidence_ref`, `rights_reviewed_at_utc`, nullable `rights_review_due_at_utc`, `allowed_processing_regions`, `external_ai_allowed` |
| Version state             | `lifecycle_status`, `is_current`, nullable `supersedes_document_version_id`                                                                                                  |
| Duplicate review          | Nullable `duplicate_bytes_approval_ref`                                                                                                                                      |
| Technical checks          | `malware_scan`, `file_validation`                                                                                                                                            |
| Intended private object   | `storage_bucket_alias`, `storage_object_key`                                                                                                                                 |

The entry names and descriptive metadata remain only in the restricted manifest.
They are never copied into verification evidence.

This fictional shape shows every required field. It is not valid approval or a
usable source record; the custodian workflow supplies the actual private values
and computed byte metadata outside Git.

```json
{
  "manifest_version": 1,
  "corpus_version": "opaque-corpus-version-001",
  "storage_bucket_alias": "policy-sources",
  "custodian_approval_ref": "FICTIONAL-CUSTODIAN-APPROVAL-001",
  "rights_review_approval_ref": "FICTIONAL-RIGHTS-APPROVAL-001",
  "generated_at_utc": "2026-08-27T11:00:00Z",
  "entries": [
    {
      "document_id": "11111111-1111-4111-8111-111111111111",
      "document_version_id": "22222222-2222-4222-8222-222222222222",
      "stable_key": "fictional_policy",
      "title": "Fictional Qualification Policy",
      "version_label": "fictional-revision-1",
      "effective_on": "2026-01-01",
      "source_file": "fictional-policy.pdf",
      "source_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "byte_size": 12345,
      "mime_type": "application/pdf",
      "page_count": 12,
      "classification": "restricted",
      "rights_status": "approved_full_reader",
      "rights_evidence_ref": "FICTIONAL-RIGHTS-EVIDENCE-001",
      "rights_reviewed_at_utc": "2026-08-27T09:00:00Z",
      "rights_review_due_at_utc": "2027-08-27T09:00:00Z",
      "allowed_processing_regions": ["us-east-1"],
      "external_ai_allowed": true,
      "lifecycle_status": "active",
      "is_current": true,
      "supersedes_document_version_id": null,
      "duplicate_bytes_approval_ref": null,
      "malware_scan": {
        "status": "passed",
        "tool_alias": "fictional-scanner",
        "tool_version": "1.0.0",
        "completed_at_utc": "2026-08-27T10:00:00Z",
        "source_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "byte_size": 12345
      },
      "file_validation": {
        "status": "passed",
        "tool_alias": "fictional-pdf-validator",
        "tool_version": "1.0.0",
        "completed_at_utc": "2026-08-27T10:15:00Z",
        "source_sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "byte_size": 12345,
        "detected_mime_type": "application/pdf",
        "page_count": 12
      },
      "storage_bucket_alias": "policy-sources",
      "storage_object_key": "11111111-1111-4111-8111-111111111111/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf"
    }
  ]
}
```

### Source and object binding

- `source_file` is a safe relative PDF path under the disjoint private source
  root. Direct symbolic files and paths that resolve outside the source root or
  into the repository are rejected.
- The verifier reads the source as a regular file, checks the declared bounded
  byte size, checks `%PDF-`, streams SHA-256, and rejects a file that changes
  during verification.
- `storage_object_key` is exactly `<document_id>/<source_sha256>.pdf`; the
  bucket alias must equal the root manifest alias.
- An individual PDF is limited to 2 GiB, the manifest to 5 MiB, the corpus to 2
  TiB, and a reviewed PDF page count to 100,000. Lower provider-plan limits must
  still be measured and enforced before upload.

### Scan binding

Both scan records have `status: "passed"`, a bounded tool alias/version, a
canonical UTC completion time, the exact source SHA-256, and the exact byte
size. `file_validation` additionally records `detected_mime_type` and
`page_count`, which must match the entry. Scan/review times cannot follow
manifest generation, and no rights-review due date may already be expired.

This proves that the inventory references review records for the bytes being
verified. It does not independently prove the scanner's quality or replace the
custodian's retained scan report.

### Version and duplicate rules

- A document ID may have multiple immutable version IDs.
- Its stable key, reviewed title, and classification stay consistent.
- Exactly one version is current and active; every other included version is
  superseded and belongs to one linear chain ending at the current version.
- A later version cannot supersede a version with a later effective date.
- A stable key cannot identify two document IDs.
- Identical source bytes are accepted only when every matching entry carries the
  same controlled duplicate-bytes approval reference. Unique bytes cannot carry
  that approval field.

## Value-free evidence

Successful evidence contains only:

- evidence and opaque corpus version;
- SHA-256 of the exact private manifest bytes;
- entry, active, current, external-AI-allowed, and approved-duplicate counts;
- total source bytes; and
- verification time.

It contains no source paths, filenames, titles, policy text, approval values,
document IDs, Storage keys, or scan details. This evidence may be referenced by
the private release record after custodian review, but it is not corpus
acceptance by itself.

## Required follow-on gates

After this verifier passes, the following remain mandatory:

1. The named custodian and rights reviewer approve the exact manifest hash.
2. Private Supabase Storage upload and post-download byte/hash reconciliation
   pass with unauthenticated and wrong-role reads denied.
3. Extraction/page mapping, chunking, embeddings, citations, reader access, and
   current/superseded behavior pass their separate gates.
4. The pinned approved-corpus retrieval, citation, refusal, injection, access,
   latency, and cost evaluation passes before promotion.
5. An isolated database-and-Storage restore reconciles the same objects and
   reruns the accepted evaluation.

Never treat a successful local verification as permission to ingest real
operational or personal records into a non-Production environment.
