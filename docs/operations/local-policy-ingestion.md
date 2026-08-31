# Local Policy Ingestion Runbook

**Purpose:** Extract and prepare the approved local policy corpus with MinerU on
the authorized Windows workstation, then optionally import reviewed provenance
into the private Supabase RAG tables and, after separate approval, resume
profile-bound embeddings for reviewed chunks.

**Current state:** The tool and schema are implemented. Running the extraction
command does not activate policy chat. Production import additionally requires
the reviewed database migration, registered document versions, private database
credentials, and the explicit import command below. The embedding foundation is
implemented but must not process real policy text until corpus rights and the
OpenAI project data-control/retention gates are approved.

## Safety boundary

- Run this only on the authorized workstation and authorized policy folders.
- Never copy source files, extracted text, `pages.json`, `chunks.json`, or
  MinerU output into Git, tickets, CI artifacts, or chat.
- The normal path uses local MinerU models and has no per-page OCR API charge.
- Browser code never receives a database password or Supabase service-role key.
- A successful document is `awaiting_review`, not active or searchable.
- Embedding sends approved chunk text to the configured OpenAI project. It is a
  separate controlled Production action, not part of normal MinerU extraction.
- The tool logs collection, hashes, counts, safe error codes, and timing. It
  does not log policy text or absolute source paths.

## Prerequisites

- Windows 10/11, at least 16 GB RAM (32 GB recommended), and sufficient SSD
  space for MinerU models plus private working output.
- NVIDIA RTX 4070 with a current NVIDIA driver.
- Python 3.12. Do not use Python 3.13 on Windows for this workflow because a
  MinerU dependency does not support that combination reliably.
- Git and `uv`.
- WSL and Docker are not required for the primary path.

Verify the GPU and install `uv` in PowerShell:

```powershell
nvidia-smi
winget install --id astral-sh.uv -e
```

## Installed MinerU extras

The `mineru` extra requests `mineru[pipeline,vlm]`, not `mineru[all]`. Both
extraction backends this tool uses stay available: `pipeline` and the
transformers VLM path. What `all` added was the vLLM and LMDeploy serving
engines and the Gradio web interface, none of which this tool ever invokes — it
shells out to the `mineru` command line. Dropping them takes the locked
environment from 237 packages to 110 and removes every vLLM, LMDeploy, Gradio,
and xgrammar advisory.

Extraction output is unchanged. `ExtractionConfig` in
`guided_policy_ingestion/config.py` pins `provider_version` to `3.4.5`, and that
version is part of the configuration hash that names every bundle on disk. This
change does not touch it, so bundles already extracted stay valid and resumable.
Upgrading MinerU itself would change that hash and require re-extracting the
whole corpus.

## One-time installation

Open PowerShell in the repository and run:

```powershell
cd "C:\Users\justi\OneDrive\Documents\New project\guided-operations\tools\policy-ingestion"
uv python install 3.12
uv venv --python 3.12
uv pip install --python .\.venv\Scripts\python.exe torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu126
uv pip install --python .\.venv\Scripts\python.exe -e ".[mineru,import]"
.\.venv\Scripts\mineru-models-download.exe --source huggingface --model_type all
[Environment]::SetEnvironmentVariable("MINERU_MODEL_SOURCE", "local", "User")
```

The downloader writes the local pipeline and VLM model paths to the user's
MinerU configuration. The user-level environment setting makes later PowerShell
windows use those downloaded models instead of cloud OCR. Open a new PowerShell
window, activate the isolated environment, and verify CUDA:

```powershell
cd "C:\Users\justi\OneDrive\Documents\New project\guided-operations\tools\policy-ingestion"
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
$env:MINERU_MODEL_SOURCE = "local"
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
mineru --version
```

Expected CUDA result: `True`, followed by the RTX 4070 name. If it is `False`,
stop before the full batch and reinstall the CUDA-enabled PyTorch wheel that
matches the installed NVIDIA driver. CPU fallback is available with
`--mineru-backend pipeline`, but it will be substantially slower.

## First safe check

This discovers supported files, verifies the three collection folders, and
computes source hashes without extraction:

```powershell
python ingest.py ingest "D:\Policy\ADC Policies" --dry-run
```

The required folder names are exact:

- `BMU policies`
- `BMU Post Orders`
- `SD`

## Exact local ingestion command

```powershell
$env:MINERU_MODEL_SOURCE = "local"
python ingest.py ingest "D:\Policy\ADC Policies" --resume
```

MinerU is allowed to select the local GPU backend. The tool processes PDF, DOCX,
BMP, JPEG, PNG, TIFF, and WebP files recursively. It does not upload them.

Useful bounded runs:

```powershell
python ingest.py ingest "D:\Policy\ADC Policies" --collection "BMU policies" --resume
python ingest.py ingest "D:\Policy\ADC Policies" --collection "BMU Post Orders" --limit 5 --resume
python ingest.py ingest "D:\Policy\ADC Policies" --collection "SD" --limit 5 --resume
```

## Resume, stop, validate, and retry

- Stop safely with `Ctrl+C`. Completed files remain checkpointed.
- Restart with the same `--resume` command. A successfully validated source with
  the same source and configuration hashes is skipped.
- If source bytes or extraction/chunking configuration changes, a different
  content-addressed identity is used automatically.
- Revalidate one existing bundle without rerunning MinerU:

```powershell
python ingest.py ingest "D:\Policy\ADC Policies" --source-sha <64-character-sha256> --validate-only
```

- Force a new attempt for one failed policy:

```powershell
python ingest.py ingest "D:\Policy\ADC Policies" --source-sha <64-character-sha256> --force
```

The SHA is available in the private attempt `manifest.json` or `state.json`.

## Private output layout

The default working directory is:

```text
%LOCALAPPDATA%\GuidedOperations\policy-ingestion\
  batch-report.json
  bmu-policies\
    <source-sha256>\
      <configuration-sha256>\
        attempt-0001\
          state.json
          manifest.json
          pages.json
          chunks.json
          validation.json
          extraction\
            ... MinerU Markdown, JSON, layout, and page artifacts ...
  bmu-post-orders\
    <source-sha256>\<configuration-sha256>\attempt-0001\...
  sd\
    <source-sha256>\<configuration-sha256>\attempt-0001\...
```

The path depends on collection, source SHA-256, full processing configuration,
and attempt number—not the original filename alone. Use `--work-dir` to select a
different private local drive. The report contains only counts broken down by
collection.

## Registration: creating the identities the import requires

The import refuses any source that is not already exactly one
`policy_document_version`. Extraction does not create those rows, so
registration is a separate step and must run first. It reads only the extraction
manifests - hashes, counts, filenames and collections - and never opens policy
text.

Registration is also where the rights attestation is recorded. The database
enforces it rather than trusting it: `external_ai_allowed` is rejected unless
`rights_status` is approved, with a named reviewer, a review timestamp and a
non-empty evidence reference. Nothing can be embedded without that record.

Source files belong in Storage under content-addressed keys, so a filename never
becomes a URL:

```text
policy-sources/<collection-slug>/<source-sha256>.pdf
```

Upload them with the linked CLI. Windows drive letters break the CLI's URL
parsing, so copy from inside the staging folder using relative paths, and never
copy recursively into a prefix that already holds an object - the CLI then
treats the destination as a directory and nests a second copy one level deeper:

```powershell
cd <staging folder>
npx supabase storage cp -r ./bmu-policies ss:///policy-sources/bmu-policies/ --linked --experimental
```

Then register. A dry run needs no credentials and reports what would be created:

```powershell
python ingest.py register --work-dir <work dir> --version-label "2026-05-28" --rights-evidence-ref "<safe reference>" --dry-run
```

The controlled Production registration needs the same private values as the
import, plus the reviewer, set only in the current private PowerShell window:

```powershell
$env:SUPABASE_DB_URL = "<private direct Supabase PostgreSQL connection string>"
$env:GUIDED_OPERATIONS_FACILITY_ID = "<facility uuid>"
$env:SUPABASE_PROJECT_REF = "<approved Production Supabase project reference>"
$env:GUIDED_OPERATIONS_RIGHTS_REVIEWER_ID = "<reviewing staff member uuid>"

python ingest.py register --work-dir <work dir> --version-label "2026-05-28" --rights-evidence-ref "<safe reference>" --target-environment production --source-data controlled-policy --confirm-controlled-production-registration
```

Each source registers in its own transaction and the command is idempotent on
(facility, source hash), so a partial run leaves a consistent database and can
simply be re-run. Use `--rights-status pending` to record a collection without
approving it for search or any AI provider; it can be approved later.

## Supabase import requirements

Do not put these values in `.env` files committed to Git. For a controlled
Production import, the operator needs:

- the new migration reviewed and applied to the intended Production project;
- a direct, server-side Supabase PostgreSQL connection string with permission to
  write `app_private` ingestion tables;
- `GUIDED_OPERATIONS_FACILITY_ID` for the intended facility;
- `SUPABASE_PROJECT_REF` set to the exact approved Production Supabase project
  reference; the tool verifies it against direct and pooler connection URLs;
- every source already registered as exactly one `policy_document_version` with
  matching source SHA-256 and canonical collection;
- owner authorization for the import and the controlled Production data gate.

Set the values only in the current private PowerShell window:

```powershell
$env:SUPABASE_DB_URL = "<private direct Supabase PostgreSQL connection string>"
$env:GUIDED_OPERATIONS_FACILITY_ID = "<facility uuid>"
$env:SUPABASE_PROJECT_REF = "<approved Production Supabase project reference>"
```

The exact controlled Production import command is:

```powershell
python ingest.py ingest "D:\Policy\ADC Policies" --resume --import-supabase --target-environment production --source-data controlled-policy --confirm-controlled-production-import
```

The import refuses controlled policy data for a local/Development target. It
also verifies that the direct or pooler database URL contains the exact approved
Production project reference, forces encrypted database transport, and refuses a
source that is not uniquely pre-registered or whose registered collection
differs. Each document imports in a short transaction as `awaiting_review`;
chunks remain `pending` and `qa_approved = false`.

## Resumable embeddings after QA

Do not run this section merely because extraction succeeded. Before any real
policy embedding, all of the following must already be true:

- the exact document version and rights evidence are approved;
- `external_ai_allowed` is approved and its rights-review date is current;
- the ingestion run, pages, and chunks passed human QA and are active;
- the OpenAI project data-use, retention, region, API-data-sharing, budget, and
  credential controls are reviewed and recorded;
- an `embedding_profiles` row exactly matches the pinned provider, model, and
  dimensions; activation remains a separate evaluation decision;
- the Production connection guard and owner-controlled command are used.

Set the pinned non-secret configuration and the server-only API key only in the
private operator PowerShell window:

```powershell
$env:OPENAI_API_KEY = "<server-only project API key>"
$env:OPENAI_DATA_CONTROLS_APPROVAL_REF = "<safe approval record id; no secret>"
$env:OPENAI_DATA_RETENTION_MODE = "<zero_data_retention or modified_abuse_monitoring>"
$env:OPENAI_API_DATA_SHARING_ENABLED = "false"
$env:OPENAI_EMBEDDING_MODEL = "<approved exact model id>"
$env:OPENAI_EMBEDDING_DIMENSIONS = "<approved dimension>"
$env:POLICY_EMBEDDING_PROFILE_KEY = "<registered immutable profile key>"
```

The command refuses to create any provider request when these data-control
values are missing, the retention mode is `none`/unverified, or API data sharing
is not exactly `false`. These values are an operator attestation; verify the
exact OpenAI project in its Data Controls settings before recording them.

First perform a metadata-only dry run for one approved version:

```powershell
python ingest.py embed <document-version-uuid> --dry-run --target-environment production --source-data controlled-policy --confirm-controlled-production-embedding
```

Then resume only missing chunks in bounded batches:

```powershell
python ingest.py embed <document-version-uuid> --batch-size 16 --target-environment production --source-data controlled-policy --confirm-controlled-production-embedding
```

Use `--limit 10` for the first controlled pilot. The command never overwrites an
existing `(chunk, profile)` embedding. Stop with `Ctrl+C`; rerunning the same
command selects only missing chunks. A model or dimension change requires a new
immutable profile key. The safe summary reports only the opaque document-version
ID, profile key, eligible/existing/embedded/remaining counts, and no policy
text.

Before a chunk can cross the embedding-provider boundary, every physical page
from `page_start` through `page_end` must exist exactly once and be approved.
The command holds database share locks through the provider call so a rights,
version, ingestion, page, or chunk change cannot race that authorization check.
Changing page or chunk evidence clears stale page/chunk/run QA, and the run must
pass fresh complete-range review before it can become `ready` again.

## Review the result

Open the safe batch report:

```powershell
notepad "$env:LOCALAPPDATA\GuidedOperations\policy-ingestion\batch-report.json"
```

It reports discovered, processed, skipped unchanged, awaiting review, failed,
page, and chunk counts overall and for each canonical collection. Inspect a
failed attempt's private `state.json` for its safe failure code and inspect its
MinerU artifacts locally. Never paste extracted text into an issue or chat.

## Known limitations

- MinerU output formats can change; version `3.4.5` is the qualified adapter
  target and a new version changes the extraction configuration identity.
- PDF native-versus-OCR mode is conservatively recorded as `mixed` unless MinerU
  exposes reliable page-level mode evidence; a warning is retained for review.
- Printed page labels are captured when MinerU emits a page-number block.
  Missing labels remain null and source page indexes still provide exact
  physical-page provenance.
- Tables are retained in normalized page/chunk text and MinerU layout artifacts,
  but complex table fidelity requires human QA.
- The current tool prepares lexical chunks and has a resumable provider-style
  embedding command. The application and reviewed v4 database RPC implement
  deterministic lexical/semantic rank fusion for an exact enabled profile and
  preserve canonical collection citations. Real embedding generation, vector
  index selection, measured hybrid qualification, QA acceptance, and atomic
  activation remain separate release gates.
