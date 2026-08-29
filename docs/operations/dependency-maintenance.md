# Dependency maintenance

Dependency updates are controlled product changes. A passing package install is
not enough to qualify authentication, RLS, document handling, AI behavior,
printing, or deployment.

## Inventory and ownership

Track at minimum:

- Node.js and package-manager versions;
- Next.js, React, TypeScript, linting, test, browser, accessibility, PDF/print,
  and UI packages;
- Supabase CLI and client libraries;
- Vercel CLI/actions and GitHub Actions;
- AI provider SDKs, model aliases, tokenizers, and evaluation tooling;
- database extensions and migration tooling;
- base images or operating-system packages used in CI.

Pin the Node.js major/minor and package-manager version in repository
configuration. Commit the lockfile. Pin GitHub Actions to immutable commit SHAs
and record the upstream release.

## Update cadence

| Cadence    | Work                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Continuous | Secret scanning and supported dependency vulnerability alerts                                                           |
| Weekly     | Review automated dependency PRs, provider deprecations, and lockfile drift                                              |
| Monthly    | Apply qualified minor/patch batches; review licenses, runtime status, Supabase/Vercel limits, and AI model availability |
| Quarterly  | Review major upgrades, unused dependencies, browser support, RLS/database advisors, and end-of-life dates               |
| Emergency  | Triage actively exploited or high-impact issues immediately                                                             |

Automated tools may open narrowly scoped PRs. They must not merge or deploy
dependency updates automatically.

The current repeatable integrity gate is:

```powershell
npm run dependency:integrity:check
```

It rejects high-severity vulnerabilities in the complete locked Node.js
dependency graph and verifies npm registry signatures and attestations. Run it
through `npm run security:check` with the tracked-secret and runtime-logging
checks before qualification. A provider-side scanner or alert remains a separate
control and must not be inferred from this local result.

## Risk tiers

- **Tier 1:** Next.js/React runtime, Supabase/Auth/Storage, database driver, AI
  adapter/model behavior, PDF/print, cryptography, CI/deployment, or a major
  version. Require the full applicable test/evaluation suite, preview evidence,
  security review, and owner release authorization.
- **Tier 2:** build, test, lint, UI, or observability packages with runtime or
  output impact. Require build/lint/tests and targeted browser/visual checks.
- **Tier 3:** development-only patch with no generated-output change. Require
  install, lint, build, unit tests, and lockfile review.

Do not mix unrelated Tier 1 upgrades in one PR. Do not auto-merge a change
because a dependency bot labels it compatible.

## Qualification procedure

1. Read the upstream changelog, migration guide, security advisory, and
   supported-runtime matrix.
2. Record the reason, old/new versions, risk tier, deprecations, rollback plan,
   and expected generated changes.
3. Review install scripts and lockfile source/integrity changes.
4. Run repository lint, build, types, tests, dependency audit, secret scan, and
   software-composition/license checks when configured.
5. Run applicable PostgreSQL/RLS/Auth/Storage, concurrency/idempotency, browser,
   visual, print, accessibility, and AI evaluations.
6. Inspect the Vercel preview and non-production Supabase behavior using
   fictional fixtures.
7. Recheck bundle size, cold start, database connections, log volume, and AI
   cost for material runtime updates.
8. Require owner authorization before production promotion.

The current repository may not yet contain every named command. Missing
automation is an open implementation item, not permission to mark the check
passed. Follow the testing targets in
[../quality/testing-strategy.md](../quality/testing-strategy.md).

## Next.js documentation

The repository AGENTS.md requires consulting the version-matched Next.js
documentation installed with the project before changing framework code.
Dependency PRs must preserve that rule and link the consulted documentation or
migration guide in their evidence.

## Emergency updates

For an actively exploited issue:

1. assess whether the vulnerable path is reachable;
2. contain or disable the path if a qualified upgrade cannot be completed
   promptly;
3. patch on a narrow branch;
4. run the highest-value security, auth/RLS, build, and browser checks;
5. obtain owner emergency-release authorization;
6. complete deferred noncritical tests immediately after stabilization;
7. document the exception and corrective actions.

Emergency does not authorize disabling authentication/RLS, exposing secrets,
skipping database backup, or copying real operational data.

## Rollback and removal

- Keep the prior lockfile and deployment address available through Git history.
- Confirm schema and generated-data compatibility before rolling back a runtime.
- Remove unused packages and credentials after verifying there are no runtime,
  build, migration, or recovery consumers.
- Revoke provider keys introduced solely for an abandoned dependency.
- Record dependency removal and the evidence that its transitive risk and
  license obligations are gone.
