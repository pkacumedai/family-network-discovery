# Read-only Family Explorer implementation report

Verified September 11, 2026. The PRD, three Milestone 1 specifications, README and SETUP_REPORT were read before implementation. The original specifications, schema, migrations and synthetic fixtures are unchanged.

## Delivered

- Server-only graph service over the existing PostgreSQL/Drizzle model, using a read-only, repeatable-read transaction.
- Explicit display DTO with Person ID/name and Relationship ID/endpoints/type/status. No DOB, notes, nickname, living state, Member data or source metadata reaches the client.
- Cytoscape.js 3.34.3 renderer with typed, labeled edges: solid directional Parent → Child, dashed Spouse / Partner, dotted Sibling.
- Partial-name search with immediate relationship context to distinguish identical names; result selection centers and highlights the node. Canvas selection updates the same selected-person panel.
- Immediate Parent, Child, Spouse/Partner and Sibling context with linked relatives; isolated-person and no-search-results states.
- Pan, zoom, Fit all, keyboard viewport controls, touch selection and node dragging.
- Generational and Network layouts, preserving selection and canonical data. Dragged positions are kept separately for each layout in memory and reset on page reload.
- Responsive desktop, tablet and mobile arrangement, text/keyboard alternatives to canvas selection, loading/empty/database-error states.
- Unit, PostgreSQL and Playwright tests; CI configuration and README updates.

## Boundaries and choices

The root Server Component calls a server-only service; no REST graph endpoint, Server Action or write operation was added. SQL explicitly selects safe fields and the domain projection applies the same allowlist again. Search and immediate-family queries operate on this small display graph in the browser. PostgreSQL remains the canonical source; the renderer is never read back as family data.

Generational layout groups explicit symmetric peers, condenses parent cycles and ranks the resulting DAG by parent depth. These groups/ranks exist only in presentation calculations. Cycles and cross-generation peer links can share ranks; the result is deliberately best effort rather than a genealogical tree. Network layout uses Cytoscape's built-in CoSE force algorithm on disposable copied elements. Person and Relationship renderer IDs have separate namespaces.

Authentication was explicitly excluded, so the explorer requires `NODE_ENV=development` and `ENABLE_LOCAL_EXPLORER=true`. Development/start scripts bind to 127.0.0.1. Production is always disabled, even when the flag is true. This is a local synthetic preview and must not be exposed as a hosted/private-family pilot. This development gate is not an authentication implementation.

This slice omits all birthday information even if sharing is enabled; permission-aware birthday display is deferred. It performs no event writes. Identity claiming, Add Myself, relationship creation, verification, invitations and later milestone features remain unimplemented.

## Verification

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Unit suite | 43 passed |
| Real PostgreSQL integration suite | 9 passed |
| Chromium browser suite | 4 passed: desktop and mobile; none skipped |
| Production build | Passed |
| Production gate smoke test | Passed with local flag enabled and no database credentials |
| Diff whitespace check | Passed |
| Specification/schema/fixture diff | Unchanged |

Unit tests freeze full canonical records (including private fields and provenance), run both layouts, mutate renderer positions/data, and verify the canonical records and display DTO remain unchanged. They also cover cycles, disconnected nodes, multiple parents, duplicate names, inverse/symmetric semantics, empty graphs, style distinctions and ID namespace collisions.

Database tests verify the DTO allowlist with real DOB/notes stored, with privacy enabled and with privacy rows missing. All outputs omit restricted fields. Queries preserve canonical rows.

Browser tests use the existing six-Person/six-Relationship/three-Member fixture in the disposable `_test` database. They cover search/context synchronization, canvas selection, centering, layout switching, zoom, desktop node dragging and keyboard panning, actual mobile touch selection, and horizontal overflow. Page HTML/RSC is checked for private fixture fields. Teardown compares all five database tables with their pre-interaction snapshots; no data changes occurred.

Desktop and mobile screenshots were inspected. Browser artifacts are local, ignored files under `test-results/`. Browser coverage uses Chromium mobile emulation; physical-device pinch gestures and Safari/Firefox are not separately verified.

## Deviations and local state

- No schema or canonical-model deviations. Hosted authentication and event instrumentation remain deferred as requested.
- Generational grouping is best effort; the app does not infer or persist new relationships.
- The existing synthetic fixture contains no sibling edge. Dedicated unit tests verify sibling context and actual Cytoscape dotted/no-arrow styling without changing the fixture.
- Existing TypeScript/ESLint compatibility pins remain. No dependency upgrades were made beyond the visualization/browser-test additions. The previously reported Drizzle Kit development advisories were not addressed in this slice.
- Next.js generated AGENTS.md and CLAUDE.md during `next dev`; its local server/client-boundary and lazy-loading guides were read. These generated instruction files are left uncommitted with the implementation.
- The existing development database was not reseeded or changed. Automated tests reset only the explicitly configured disposable test database. Browser and production preview servers were stopped after verification; the preexisting PostgreSQL container remains running.
- No commit, push, merge or deployment was performed.

Start locally using the README instructions with `ENABLE_LOCAL_EXPLORER=true`, the existing synthetic development database and `npm run dev`.
