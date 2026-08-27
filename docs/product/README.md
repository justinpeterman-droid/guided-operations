# Product Documentation

This directory contains product contracts for the replacement. They describe
target behavior and acceptance; they do not claim that the behavior is already
implemented.

At the 2026-08-25 baseline, the repository has technical foundation slices but
no accepted complete migrated product route.

- [Product Principles](principles.md) — non-negotiable experience, trust,
  privacy, accessibility, and provider rules.
- [Experience Design Brief](experience-design-brief.md) — owner-approved visual
  direction, command-center hierarchy, responsive behavior, and design
  acceptance checklist.
- [Roles and Permissions](roles-and-permissions.md) — identity concepts,
  officer/admin matrix, RLS/server enforcement, and open decisions.
- [Feature Catalog and Parity](feature-catalog-and-parity.md) — old canonical
  behavior, target routes, known gaps, and cross-cutting acceptance gates.
- [Domain Glossary](domain-glossary.md) — canonical terms for UI, domain,
  schema, API, and tests.
- [Workflow and Report Safety](workflow-and-report-safety.md) — traceable
  `SAFE-*` invariants and required test pack.

The root [Product Contract](../../PRODUCT.md) is the entry point. Migration
provenance and execution live in
[Migration Documentation](../migration/README.md).

When implementation changes a product decision, update the relevant contract in
the same reviewed change. Do not change a status to migrated/live/deployed
without exact commit, environment, and acceptance evidence.
