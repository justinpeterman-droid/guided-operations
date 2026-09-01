# 2026-09-01 post-merge qualification

This is retained evidence for the released `main` revision after pull request
#23. It is not a production-readiness declaration and does not replace the open
gates in [`ROADMAP.md`](../../ROADMAP.md).

## Exact revision

- Branch: `main`
- Commit: `49812ec4c9bc93fad4a71323f50bb7d434c174e3`
- Qualification date: 2026-09-01 UTC
- Hosted production, production data, traffic, secrets, and hosted migrations:
  unchanged

## Workflow result

| Workflow                      | Run                                                                                               | Result | What it proves                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web quality                   | [33473905461](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33473905461) | Passed | The full web gate, policy-ingestion unit tests, package signatures, and build completed on the exact commit.                                                  |
| Authenticated browser quality | [33473905429](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33473905429) | Passed | The fictional authenticated browser qualification completed against an isolated local Supabase stack on the exact commit.                                     |
| Recovery rehearsal            | [33474588278](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33474588278) | Passed | The fictional local PostgreSQL archive and private Storage copy/checksum rehearsal completed on the exact commit. It does not prove hosted backup or restore. |
| Database quality              | [33474587779](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33474587779) | Failed | Migration rebuild and database lint passed. pgTAP exposed a test-role error in `answer_report_limits.test.sql`; later steps were skipped.                     |

The database failure was in the assertion, not in the database grants or row
security. The test deliberately became `authenticated`, successfully exercised
`api.report_policy_answer`, and then tried to query the private
`app_private.answer_reports` table before restoring the test-owner role.

Commit `3de268fed94c2e5d0bc730da5921cfd1be6fbbd0` moves `reset role` immediately
before that private-table assertion. It changes no migration, grant, RLS policy,
application behavior, or hosted state.

The first pull-request rerun,
[33475451312](https://github.com/justinpeterman-droid/guided-operations/actions/runs/33475451312),
then passed local PostgreSQL startup, migration and fictional-seed replay,
database lint, all pgTAP tests, and the fictional policy-bundle import. It found
a second pre-existing repository drift at generated-type verification:
`get_incident_summary` and `list_incident_reports` exist in migration
`20260831111000`, but were represented only by a temporary manual type
augmentation rather than `database.generated.ts`.

The follow-up regenerates `database.generated.ts` from an unlinked local stack
whose complete migration history exactly matched the checkout, then reduces the
temporary wrapper to a direct generated-type export as its own comment required.
Database quality must pass on the complete pull-request commit before merge and
then be rerun on the resulting exact `main` commit before the database gate is
recorded as green.

## Dependabot static triage

GitHub REST returned six open alerts in `tools/policy-ingestion/uv.lock`:
Transformers 4.57.6 and PyTorch 2.8.0, both included only through the optional
`mineru[pipeline,vlm]` environment. The web application does not ship these
packages. The repository runs MinerU as a local operator-controlled subprocess.

This was static triage only. No advisory was dismissed, no dependency or model
was changed, and no exploit or production action was run. The complete
`triage-finding/v0` evidence is in
[`2026-09-01-dependabot-triage.json`](2026-09-01-dependabot-triage.json).

|                                                                                   Alert | Advisory                            | Severity | Verdict                  | Reason and next action                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------: | ----------------------------------- | -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#34](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/34) | CVE-2026-4372 / GHSA-29pf-2h5f-8g72 | High     | **Needs review**, rank 1 | The pinned MinerU wheel contains Transformers model-loading paths and the runbook downloads model artifacts from HuggingFace, but the exact vulnerable dynamic-kernel branch and the downloaded model revisions/digests are not recorded. Pin and verify those artifacts, then qualify a compatible MinerU/Transformers upgrade. |
| [#36](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/36) | CVE-2026-5241 / GHSA-fgcw-684q-jj6r | High     | **Not actionable**       | The exploit requires an attacker-controlled LightGlue model. Neither this repository nor the exact locked MinerU 3.4.5 wheel contains a LightGlue path or caller-selected model-repository surface. Re-triage if that changes.                                                                                                   |
| [#15](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/15) | CVE-2026-1839 / GHSA-69w3-r845-3855 | Moderate | **Not actionable**       | The exploit requires Transformers `Trainer` to resume an attacker-controlled checkpoint. The product is inference-only; repository and MinerU source contain no Trainer path.                                                                                                                                                    |
| [#42](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/42) | CVE-2025-3000 / GHSA-rrmf-rvhw-rf47 | Low      | **Not actionable**       | No `torch.jit.script` call exists in repository or exact MinerU source. The nearby `torch.jit.is_tracing` occurrence is a different API.                                                                                                                                                                                         |
| [#24](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/24) | CVE-2025-3001 / GHSA-qfhq-4f3w-5fph | Low      | **Not actionable**       | No `torch.lstm_cell` call exists in repository or exact MinerU source.                                                                                                                                                                                                                                                           |
| [#23](https://github.com/justinpeterman-droid/guided-operations/security/dependabot/23) | CVE-2025-2999 / GHSA-vgrw-7cvw-pwgx | Moderate | **Not actionable**       | No `torch.nn.utils.rnn.unpack_sequence` call exists in repository or exact MinerU source.                                                                                                                                                                                                                                        |

The exact MinerU wheel was downloaded from the URL already recorded in
`uv.lock`, not installed or executed, and matched the recorded SHA-256
`4a73b865920bb9109c1b8b1bc46567e296bf0133a67106a04effd219536ae72d` before source
inspection. The separately downloaded model artifacts were not available in the
repository; that is the material proof gap for alert #34.

## Remaining release evidence

- Get Database quality green on the correction commit and then on the exact
  merge commit.
- Keep hosted backup/restore, monitoring, retention/deletion, administrator
  assurance, corpus activation/evaluation, and Production environment scoping
  open. Local workflow success does not close them.
- Decide whether to dismiss the five not-actionable alerts only after reviewing
  their individual recorded rationale. Do not bulk-dismiss or bulk-upgrade.
