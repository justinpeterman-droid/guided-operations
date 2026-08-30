# 2026-08-30 Production release

First production release of the application itself. Earlier production
deployments served the documentation-only `main`; the application had never run
in production before this date.

## What shipped

`main` at the merge of pull request #1 (296 commits). Every prior commit lived
only on `codex/production-readiness`; nothing had ever been merged. The branch
was merged, and the two superseded draft pull requests (#3 planning documents,
#4 an earlier standalone authentication implementation) were closed and their
branches deleted. The repository now has one branch and no open pull requests.

## Verification

- Local, `NODE_ENV=test`: 700 Vitest tests pass, 1 skipped; lint, typecheck and
  Prettier clean.
- Local database: 628 pgTAP tests pass; `supabase db lint` clean; generated
  types match the migrated schema; the production data inventory verifies.
- CI on `main`: Web quality, Database quality, Recovery rehearsal and
  Authenticated browser quality all green.
- Live: `/api/health/live` returns `ok`, `/api/health/ready` returns `ready`,
  which confirms the production environment configuration validates.

## Database

Production Supabase was fourteen migrations behind `main` and would have failed
every policy request against the deployed code. A schema dump and a data dump
were taken first, outside the repository, then all fourteen were applied:

| Migration                           | Purpose                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `20260827130000` – `20260827133000` | daily paperwork template registry, backup-freeze coverage, session authority binding, workflow |
| `20260827134000` – `20260827135000` | report revision conflicts, DOCX export                                                         |
| `20260828143000` – `20260828150000` | personal session revocation and its hardening                                                  |
| `20260828151000`                    | daily paperwork template packages                                                              |
| `20260828173000`                    | local policy ingestion pipeline                                                                |
| `20260828200000` – `20260828210000` | collection-filtered and hybrid policy retrieval                                                |
| `20260828220000`                    | policy page-range approval enforcement                                                         |
| `20260830090000`                    | answer reports                                                                                 |

Local and remote migration histories now match exactly.

## Models

`OPENAI_POLICY_MODEL` and `OPENAI_REPORT_DRAFT_MODEL` moved from `gpt-4o-mini`
to `gpt-5.6-terra`, verified current against OpenAI's published model list on
this date. `OPENAI_EMBEDDING_MODEL` remains `text-embedding-3-small`, also still
current. See O-027.

## Known state at release

**The production corpus is empty.** Production holds the facility, the staff
roster, accounts and audit events, but no policy documents, pages, chunks or
embeddings. The policy expert will report that it has no sources rather than
answer, which is the designed refusal behaviour and not a fault. Ingesting the
236 real documents is the next step and requires `OPENAI_API_KEY` in the
ingestion machine's environment; the key currently exists only in Vercel.

No live provider request has been made against `gpt-5.6-terra` yet. The first
real policy question will be the first exercise of that pin and of the
reasoning-token budget added alongside it.
