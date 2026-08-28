# Local Policy Ingestion Runbook

**Purpose:** Extract and prepare the approved local policy corpus with MinerU on
the authorized Windows workstation, then optionally import reviewed provenance
into the private Supabase RAG tables.

**Current state:** The tool and schema are implemented. Running the extraction
command does not activate policy chat. Production import additionally requires
the reviewed database migration, registered document versions, private database
credentials, and the explicit import command below.

## Safety boundary

- Run this only on the authorized workstation and authorized policy folders.
- Never copy source files, extracted text, `pages.json`, `chunks.json`, or
  MinerU output into Git, tickets, CI artifacts, or chat.
- The normal path uses local MinerU models and has no per-page OCR API charge.
- Browser code never receives a database password or Supabase service-role key.
- A successful document is `awaiting_review`, not active or searchable.
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
- The current tool prepares lexical chunks only. The application and reviewed
  database RPC can search every canonical collection or filter to one exact
  collection, and each returned citation includes that collection. Embedding
  generation, measured hybrid rank fusion, QA approval, and atomic activation
  are separate release gates.
