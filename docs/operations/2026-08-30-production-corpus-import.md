# 2026-08-30 Production corpus registration and import

The real corpus reached the production database on this date. Extraction had
finished earlier; registration and import are separate owner-driven steps and
both ran today.

## Authoritative registration/import result

| Collection      | Registered | Imported | Pages     | Chunks    |
| --------------- | ---------- | -------- | --------- | --------- |
| BMU policies    | 160        | 160      | 796       | 735       |
| BMU Post Orders | 42         | 42       | 249       | 234       |
| SD              | 34         | 33       | 265       | 255       |
| **Total**       | **236**    | **235**  | **1,310** | **1,224** |

All 236 are registered as `classification = public`,
`rights_status = approved_full_reader`, `external_ai_allowed = true`, reviewed
by the owner against O-021/O-022/O-028, review current for one year. The 236
source PDFs are in the `policy-sources` Storage bucket under content-addressed
keys, `<collection-slug>/<source-sha256>.pdf`.

Everything imported as `awaiting_review`. Chunks remain `pending` and
`qa_approved = false`. Nothing is searchable and nothing can be embedded until
the owner approves it.

## The one document that did not import

`SD 2022-01 Revised COVID Visitation Directive.pdf`, page 5 of 5.

```
Supabase import failed: DataError; PostgreSQL text fields cannot contain NUL (0x00) bytes
```

Page 5 is a symptom screening checklist. The PDF draws its checkboxes with a
symbol font whose empty-checkbox glyph is character `0x00`, so the extracted
text reads:

```
...the following symptoms in the past 72 hours?
[NUL] Fever (>=100.4 F) [NUL] Nausea or Diarrhea [NUL] Chills...
```

Eleven NUL bytes on that page, carried into one chunk. They are present in
MinerU's raw output as well, so this is faithful extraction of an awkward source
rather than a pipeline defect. PostgreSQL rejects NUL in `text` columns, and the
import failed at the last document.

**The correct fix is in normalization.** A normalizer declaring
`unicode-nfkc-lines-v1` should strip C0 control characters and raise a warning
code on the page, so a reviewer knows characters were removed rather than
silently losing the checkboxes. It is not fixed at the import boundary, because
each chunk records a `content_sha256` over its own text; sanitising during
import would store text that no longer matches its recorded hash, which is
exactly the provenance guarantee a citation tool cannot give up.

**Deferred by owner decision on 2026-08-30.** `normalization_version` is part of
the configuration hash identifying every bundle on disk, so changing it re-keys
all 236 and implies a full re-extraction. Rather than spend that to recover one
document, the failure is recorded here and the directive is simply not
searchable. The annual corpus refresh (O-026) re-extracts everything anyway,
which is the natural moment to bump the version at no extra cost.

Until then: **the COVID visitation directive is absent from the corpus.** A
question it would answer will get an honest "no sources" rather than a wrong
answer, which is the designed behaviour, but the gap is real and deliberate.

## Method notes for the next run

- Registration and import both need `SUPABASE_DB_URL` in the operator's own
  PowerShell window. Vercel stores that variable as sensitive, which is
  write-only, so it cannot be pulled back from there.
- The account role enum is `('officer', 'administrator')`. A lookup querying for
  `admin` errors, and its output is easily mistaken for a result.
- `--import-only` imports bundles that were extracted in an earlier session
  without re-running the extractor. It did not exist before today; `--force` was
  the only alternative and re-runs MinerU over everything.
- `--mineru-backend pipeline` is required on the import command. The backend is
  part of the configuration hash, and the corpus was extracted with `pipeline`;
  the default `auto` computes a different hash and finds no bundles.
