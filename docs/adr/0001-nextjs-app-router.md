# ADR-0001: Use Next.js App Router for the Web Application

- **Status:** Accepted
- **Date:** 2026-08-25
- **Deciders:** Product owner and technical lead

## Context

The old product separated a Vite React SPA from Flask/Python APIs and Google
hosting. The replacement is private, web-only, deployed to Vercel, and needs a
strong server boundary for employee authentication, authorization, private data,
AI credentials, Storage, queues, and exports.

React is the UI library; it does not provide routing, server rendering, secure
server data access, API endpoints, or deployment conventions by itself. The
decision is therefore between React application architectures, not “React
instead of Next.js.”

## Decision

Use Next.js 16 App Router with React 19 and TypeScript on Vercel.

- Server Components are the default for authenticated reads and page shells.
- Client Components are narrow interactive leaves for forms/editors.
- Route Handlers implement /api/web/v1.
- A server-only DAL owns data access and authorization.
- Node.js is the default runtime for authenticated routes.
- Static export is not used because Auth, server authorization, database access,
  AI calls, and private downloads require a server.

## Options considered

### Option A: Next.js App Router backend-for-frontend

| Dimension              | Assessment                                       |
| ---------------------- | ------------------------------------------------ |
| Security boundary      | Strong when DAL/server-only modules are enforced |
| Vercel fit             | Native                                           |
| Migration effort       | Medium                                           |
| Client bundle          | Lower when Server Components are used well       |
| Operational complexity | One web deployable                               |

Pros:

- Same-origin UI and API simplify secure cookies and CSRF.
- Server-side secrets and data filtering are first-class.
- Vercel supports the framework directly.
- Can reuse React 19 components and feature logic.

Cons:

- App Router/server-client boundaries require discipline.
- Existing Vite routing/data assumptions need refactoring.
- Caching and Route Handler semantics must be explicitly tested.

### Option B: Vite React SPA plus a separate API

| Dimension              | Assessment                                        |
| ---------------------- | ------------------------------------------------- |
| Security boundary      | Good if the separate API is designed correctly    |
| Vercel fit             | Static UI is easy; API remains another deployable |
| Migration effort       | Lower for UI, higher for platform                 |
| Client bundle          | SPA-sized                                         |
| Operational complexity | At least two deployables                          |

Pros:

- Closest to existing React workspace.
- Clear UI/API process separation.

Cons:

- Requires selecting and operating a separate API host immediately.
- Cross-origin cookie/CORS/CSRF and release coordination are harder.
- Does not use the desired Vercel/Next platform as one coherent boundary.

### Option C: Vite/React browser directly to Supabase

| Dimension               | Assessment                                        |
| ----------------------- | ------------------------------------------------- |
| Security boundary       | Depends almost entirely on browser tokens and RLS |
| Vercel fit              | Easy static deployment                            |
| Migration effort        | Superficially low                                 |
| Sensitive orchestration | Poor fit                                          |
| Operational complexity  | Low initially, high security coupling             |

Pros:

- Minimal server code.
- Supabase SDK offers quick CRUD.

Cons:

- Conflicts with the required server-side DAL.
- Broadens exposed schemas/RLS surface.
- Makes provider secrets, admin operations, exports, and durable workflows more
  difficult to isolate.
- A single RLS/grant mistake becomes an internet-facing data path.

## Trade-off analysis

Next.js adds framework-specific server/client complexity, but this product needs
a backend-for-frontend regardless. Keeping it with the React application on
Vercel reduces deployment and same-origin security complexity. The DAL and
domain modules remain framework-light so they can move if hosting changes.

## Consequences

- Existing React UI is ported feature by feature rather than copied as one SPA.
- Client-only libraries are wrapped at narrow boundaries.
- Server modules use the server-only marker and never enter client bundles.
- API/OpenAPI and domain tests remain independent of page rendering.
- Authenticated caching defaults to no-store.
- Vercel limits must be measured; long jobs are not forced into Route Handlers.

## Action items

1. [ ] Define the target src/app, src/server, src/features, and src/components
       boundaries.
2. [ ] Add server-only DAL lint/build tests.
3. [ ] Establish Route Handler error, CSRF, idempotency, and request-ID
       primitives.
4. [ ] Port one vertical slice and validate real-browser session behavior.
5. [ ] Document and test every route-specific caching/runtime choice.
