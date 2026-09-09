# Family Network Discovery App
## Milestone 1 — Architecture Specification

**Status:** Implementation architecture  
**Parent:** Discovery App PRD v0.1  
**Companion:** Milestone 1 Functional + UX Specification

## 1. Architecture Goal

Provide the smallest durable architecture capable of supporting:

- persistent family graph;
- graph visualization;
- multiple layout projections;
- identity onboarding;
- Person/Member separation;
- new-person creation;
- primitive relationship creation;
- privacy metadata;
- event instrumentation;
- later verification and collaboration features.

Avoid premature architecture for large-scale genealogy, AI agents, or enterprise-scale graph processing.

## 2. Recommended Application Stack

Use a mainstream TypeScript web stack.

Recommended baseline:

- Next.js / React
- TypeScript
- PostgreSQL
- Prisma or equivalent typed relational data-access layer
- Node.js runtime
- responsive browser UI

Graph rendering shall use a mature interactive graph library rather than implementing SVG graph behavior from scratch.

A library such as Cytoscape.js is suitable for the network-oriented graph interaction, provided the visualization layer is isolated behind application components so that layout libraries can be changed later.

A separate layout algorithm/library may be used where helpful for generational arrangement.

Specific package versions should use current stable releases at implementation time and be recorded in the repository lockfile.

## 3. Core Architectural Principle

The application has one canonical Family Relationship Graph.

It consists of:

**People + Relationships**

The visual graph is a projection of canonical data.

The visualization library is never the canonical data store.

Conceptually:

Family Domain Data  
↓  
Graph Service / Query Layer  
↓  
Layout Transformation  
↓  
Interactive Visualization

## 4. Person Entity

Minimum logical Person fields:

- id
- display_name
- birth_date
- is_living
- created_at
- created_by_member_id
- updated_at

Optional Milestone 1 fields may include:

- nickname
- alternate_name

A Person represents an individual in the family graph.

A Person does not imply that the individual has application access.

## 5. Member Entity

A Member represents application access and participation.

Minimum logical fields:

- id
- display_name
- email and/or other login identifier
- status
- linked_person_id
- joined_at
- created_at

Member and Person are distinct.

Before identity setup:

`linked_person_id = NULL`

After successful identity claim or creation:

`linked_person_id = Person.id`

One Person should normally be claimable by at most one Member.

## 6. Relationship Entity

Minimum logical fields:

- id
- from_person_id
- to_person_id
- relationship_type
- status
- created_by_member_id
- created_at
- updated_at

Milestone 1 relationship types:

- PARENT_OF
- SPOUSE_OF
- SIBLING_OF

PARENT_OF is directional.

SPOUSE_OF and SIBLING_OF are logically symmetric.

Do not persist inverse duplicates merely to simplify querying.

Example:

`A PARENT_OF B`

implies:

`B CHILD_OF A`

CHILD_OF is therefore derived rather than independently stored.

Similarly:

`A SIBLING_OF B`

implies:

`B SIBLING_OF A`

## 7. Relationship Status

Although verification is deferred, retain a status field so the schema does not need redesign immediately afterward.

Suggested Milestone 1 statuses:

- SEEDED
- UNVERIFIED
- VERIFIED

Relationships loaded from an administrator-approved initial family seed may use SEEDED or VERIFIED according to implementation convention.

Relationships added during Milestone 1 onboarding should use UNVERIFIED.

Later milestones can extend this to:

- PROPOSED
- DISPUTED
- ADMIN_RESOLVED

without redesigning the graph model.

## 8. Relationship Provenance

Every relationship must retain:

- creator/source;
- creation timestamp.

The seed importer should identify its source separately from a Member-created relationship.

Do not sacrifice provenance simply because verification is not implemented yet.

## 9. Privacy Model Foundation

Birth date storage and information visibility shall be separate concepts.

Minimum profile privacy fields:

- share_birth_month_day
- share_birth_year

Future architecture must be able to separate:

- storage permission;
- display permission;
- intelligent/AI usage permission.

Milestone 1 does not require a full permissions engine.

However, application code should not assume that because a field exists in the database it may be returned by all APIs or displayed to all Members.

## 10. Persistence

Use PostgreSQL as the canonical persistent store.

Primary Milestone 1 tables:

- people
- relationships
- members
- profile_privacy
- events

Optional implementation may combine profile privacy with Person or Member records initially if the separation remains clear.

Do not use CSV, JSON files, browser local storage, or graph-renderer state as the live system of record.

## 11. Database Integrity

Enforce where practical:

- unique Person IDs;
- unique Member IDs;
- valid relationship endpoints;
- no self-referential relationships;
- no duplicate canonical relationships;
- valid relationship types;
- at most one Member associated with a Person;
- foreign-key integrity.

For symmetric relationships, canonicalize endpoint ordering or otherwise ensure:

`A SIBLING_OF B`

cannot coexist as a duplicate of:

`B SIBLING_OF A`

The same applies to SPOUSE_OF.

## 12. Graph Query Layer

Application code should expose graph-oriented operations independent of SQL.

Examples:

- getFullGraph()
- getPerson(id)
- searchPeople(query)
- getNeighbors(personId)
- getImmediateFamily(personId)
- createPerson(...)
- createRelationship(...)
- claimIdentity(...)
- getRelationshipPath(...)

Milestone 1 does not require sophisticated path querying, but the architecture should not prevent it.

Graph traversal may initially occur in application memory because pilot family graphs are small.

A graph database is explicitly not required.

## 13. API / Server Boundary

The browser shall not directly manipulate database tables.

Logical server operations should include equivalents of:

- retrieve graph;
- search People;
- retrieve Person neighborhood;
- claim identity;
- create Person;
- create Relationship;
- update privacy preferences;
- record interaction event.

The exact implementation may use API routes, server actions, or another framework-native server mechanism.

Domain behavior must remain separated enough from UI components to be testable.

## 14. Visualization Boundary

Canonical domain data should be converted into a visualization-specific representation.

Example transformation:

Canonical:

Person P001  
Person P002  
Relationship P001 PARENT_OF P002

Visualization:

Node P001  
Node P002  
Edge R001

Coordinates, force-layout parameters, zoom level, selected-node state, or screen geometry are not canonical family data.

## 15. Layout Strategy

Milestone 1 requires two interchangeable layout strategies.

### Generational

Use parent-child relationships to calculate a best-effort hierarchy.

The algorithm may assign visual ranks or layers.

Those ranks are presentation calculations and shall not become permanent Person attributes.

### Network

Use connectivity-oriented layout suitable for arbitrary node-edge relationships.

Switching layout must preserve all graph semantics.

## 16. Manual Node Movement

Users may reposition nodes to improve readability.

Dragging a node modifies presentation state only.

Manual movement shall never create, delete, or modify a family relationship.

Persistent personal layout preferences are not required in Milestone 1.

## 17. Seed Import Boundary

Initial family data shall be supplied through source-controlled or locally maintained seed files.

The import process shall:

1. read seed files;
2. validate them;
3. reject invalid references;
4. populate PostgreSQL;
5. produce a clear import report.

Seed files are inputs, not the production database.

The importer shall be repeatable in a development environment.

## 18. Events

Minimum Event structure:

- id
- timestamp
- member_id nullable
- event_type
- related_person_id nullable
- related_relationship_id nullable
- metadata JSON nullable

High-frequency visualization events should be throttled or aggregated.

No analytics dashboard is required.

## 19. Authentication

Milestone 1 should use the simplest reasonable authenticated-member mechanism suitable for a private hosted pilot.

Authentication implementation shall remain replaceable.

Do not build an elaborate enterprise identity system.

The system must nevertheless distinguish one Member from another and prevent unauthenticated access to private family data in hosted testing.

## 20. Security Minimum

- No public graph endpoints.
- No DOB exposure through unrestricted API responses.
- Secrets stored in environment configuration and excluded from Git.
- Server-side validation for graph mutations.
- Database credentials never sent to browser.
- Seed files containing real private family data should not be committed to a public repository.
- Production/pilot logs should avoid unnecessary personal information.

## 21. Repository Boundaries

Suggested structure:

`/src` — application code

`/src/domain` — Person/Relationship/graph semantics

`/src/server` — persistence and server operations

`/src/components/graph` — graph rendering and layout adapters

`/src/components/onboarding` — onboarding UI

`/src/lib` — shared utilities

`/prisma` or equivalent — database schema/migrations

`/seed` — seed templates and development fixtures

`/scripts` — seed validation/import

`/docs` — PRD and specifications

`/tests` — automated tests

Exact framework-generated directories may vary.

## 22. Testing Minimum

Automated tests should cover at least:

- seed validation;
- inverse relationship semantics;
- symmetric relationship canonicalization;
- self-relationship rejection;
- duplicate relationship rejection;
- Person/Member identity claim;
- prevention of duplicate claims;
- birth-year privacy response behavior;
- creation of missing Person;
- creation of onboarding anchor relationship.

Graph rendering should additionally receive lightweight component/integration testing.

## 23. Architectural Non-Goals

Milestone 1 does not require:

- Neo4j or another graph database;
- microservices;
- event streaming infrastructure;
- real-time collaboration;
- distributed caching;
- Kubernetes;
- GraphQL;
- AI infrastructure;
- vector databases;
- generalized rules engines;
- complex role-based authorization.

## 24. Forward Compatibility

The architecture should make it straightforward to add:

- relationship verification;
- invitations;
- activity feeds;
- additional privacy settings;
- stories/photos;
- derived kinship paths;
- natural-language graph queries;
- AI assistants operating only on permitted data.

Forward compatibility does not justify implementing these features in Milestone 1.

## 25. Architecture Definition of Done

Architecture is correctly implemented when:

- PostgreSQL is the system of record;
- People and Relationships form the canonical graph;
- Members remain distinct from People;
- seed data can be reproducibly imported;
- both graph layouts operate from identical graph data;
- presentation geometry is isolated from family semantics;
- onboarding writes persist;
- privacy preferences affect returned/displayed data;
- events persist;
- automated tests protect core graph invariants.