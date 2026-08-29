# Dependency and repository security review — 2026-08-28

## Scope and boundary

This is read-only evidence for the uncommitted `codex/production-readiness`
candidate based on repository HEAD `f18cc00482c4c8890797823089812efe56377929`.
It did not update packages, push code, change repository settings, deploy,
migrate a hosted database, or access real operational or policy data.

## Results

| Check                           | Result                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high`  | Passed: zero vulnerabilities across 461 locked packages                                   |
| `npm audit signatures`          | Passed: 461 packages had verified registry signatures; 132 also had verified attestations |
| GitHub Dependabot alerts API    | Accessible: zero open alerts                                                              |
| GitHub Dependabot pull requests | Zero open pull requests                                                                   |
| GitHub code scanning API        | Unavailable for this repository                                                           |
| GitHub secret scanning API      | Unavailable for this repository                                                           |

The repository Actions permission is enabled for all actions and the workflow
default token is read-only. There are no self-hosted runners, which is expected
because the workflows request GitHub's `ubuntu-latest` hosted runner. A fresh
Web-quality retry after GitHub reported Actions operational still failed before
runner assignment (`runner_id: 0`) with no executed steps. The current API
credential cannot read account billing/Actions usage, so this evidence cannot
determine whether the remaining cause is account allocation, billing, or a
provider-side repository condition.

The local tracked-file secret scanner and runtime logging control remain part of
`npm run security:check`. They are useful controls, but they are not evidence
that GitHub's provider-side code or secret scanning is enabled.

## Available updates and disposition

The read-only version inventory found patch/minor updates for Next.js,
`eslint-config-next`, Testing Library React, Supabase CLI, and Zod, plus major
updates for Node.js types, ESLint, and TypeScript. None was applied. An
available version is not automatically a security fix or a qualified product
change. Runtime, database tooling, framework, and major updates must be
isolated, reviewed against upstream release notes, tested at the applicable risk
tier, and promoted separately.

## Repeatable gate

The repository now defines:

```powershell
npm run dependency:integrity:check
npm run security:check
```

The first command audits the complete dependency graph for high-severity issues
and verifies package signatures. The second also checks tracked files for secret
patterns and enforces the safe runtime logging boundary. CI runs the combined
command.

## Remaining release gate

Before Production, enable GitHub code scanning and secret scanning if supported
by the selected repository plan, establish equivalent supported controls, or
record an explicit owner risk decision. Re-run this evidence against the exact
release commit because package and provider state can change.
