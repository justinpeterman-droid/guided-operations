# Development fictional-data boundary — 2026-08-28

- **Target:** exact hard-bound Guided Operations Development project
- **Operation:** read-only aggregate database and Storage verification
- **Hosted changes:** none
- **Values retained:** counts and pass/fail state only
- **Personal/operational fields printed:** none

## Command

```powershell
npm run development:data-boundary:check
```

The command requires a separate explicit read-only confirmation, validates the
Development API and database hosts against the hard-bound project reference, and
uses the ignored Development employee-lookup pepper to verify the exact
repository-defined fictional fixture without returning its identifying fields.

## Verified result

```json
{
  "status": "verified",
  "applicationTableCount": 31,
  "fictionalFixtureAccounts": 1,
  "operationalRows": 0,
  "metadataRows": 101,
  "privateStorageBuckets": 2,
  "storageObjects": 0
}
```

The one Auth user, account, staff row, and facility row match the exact
fictional test-administrator fixture. The only other rows are 101 bounded audit
and authentication-attempt metadata records created by fictional qualification.
Every incident, report, paperwork, policy, embedding, legal-hold, deletion,
artifact, idempotency, and AI-budget table is empty. Both expected Storage
buckets are private and contain no objects.

This corrects the current-state shorthand that called all application tables
empty. The project is fictional-only but not literally empty. The verifier fails
closed if another identity, any operational row, an unexpected/non-private
bucket, or any Storage object appears. It emits a fixed generic error and never
prints a name, employee number, alias, row body, object path, project reference,
or credential.

Run this check again immediately before any Development migration apply and
after fictional qualification cleanup.
