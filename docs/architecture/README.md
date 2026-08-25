# Architecture Documentation

These documents describe the target system. The repository currently has an
unlinked local foundation: a static preview, health route, Supabase client
factories, initial locked migration/tests, Count Sheet domain tests, and a
grounded-policy schema. Nothing is hosted or deployed unless a document records
specific verification evidence.

1. [System context](system-context.md)
2. [Containers and trust boundaries](containers.md)
3. [Data flows](data-flows.md)
4. [Environments and delivery](environments.md)
5. [Data model](data-model.md)
6. [API contracts](api-contracts.md)
7. [Authentication, RBAC, and RLS](auth-rbac-rls.md)
8. [AI and RAG](ai-rag.md)
9. [Storage and jobs](storage-jobs.md)
10. [Legacy migration](legacy-migration.md)

Repository-wide decisions are summarized in
[ARCHITECTURE.md](../../ARCHITECTURE.md). Durable technology choices live in
[the ADR index](../adr/README.md). Security invariants live in
[SECURITY.md](../../SECURITY.md).
