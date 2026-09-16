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

## 2026-09-15 security patch qualification

This separate dependency change addresses the npm audit gate blocking corpus PR
#63. It is a Tier 1 framework/security patch, not corpus approval or a
production release.

| Package                        | Previous | Candidate | Reason                                                     |
| ------------------------------ | -------- | --------- | ---------------------------------------------------------- |
| Next.js and eslint-config-next | 16.3.2   | 16.3.5    | Patched framework release with matching lint configuration |
| js-yaml (transitive)           | 4.3.1    | 4.3.2     | Bound CPU use for empty YAML merge sources                 |
| sharp (transitive)             | 0.35.3   | 0.35.4    | Patched prebuilt image libraries, including libheif        |

The Next.js SWC/env/plugin packages and sharp platform/libvips packages move
with their parent releases. Other package versions and unrelated platform
metadata remain unchanged. No new install script is introduced by the changed
lockfile entries. The sources and integrity hashes remain npm registry
artifacts.

Reviewed upstream evidence:

- [Next.js Windows filesystem advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36)
  and
  [AVIF image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
- [Next.js 16.3.5 release notes](https://github.com/vercel/next.js/releases/tag/v16.3.5).
- [js-yaml advisory](https://github.com/advisories/GHSA-2883-xcg3-v3hh) and
  [4.3.2 release](https://github.com/nodeca/js-yaml/releases/tag/4.3.2).
- [sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) and
  [0.35.4 release](https://github.com/lovell/sharp/releases/tag/v0.35.4).
- Installed version-matched Next.js guide:
  `node_modules/next/dist/docs/01-app/01-getting-started/18-upgrading.md`.

This stays within the existing Next.js 16.3 line and preserves the React pins.
No framework source migration or codemod is needed for the dependency edits. The
initial audit reproduced three affected packages (two high, one critical). Exact
candidate checks and their limitations are recorded in the dependency PR. Hosted
preview, authenticated browser qualification, independent security review, and
owner promotion remain separate gates; a clean npm audit does not prove the
production deployment has been patched.

Rollback retains the previous manifest and lockfile in Git, but reverting them
reintroduces the known audit failures. Prefer a corrected patch and withhold
production promotion if qualification fails. There is no database or source-data
migration to reverse, and no corpus approval state is changed by this update.
