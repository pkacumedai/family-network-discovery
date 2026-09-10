# Family Network — Milestone 1 foundation

Repository scaffolding only. The PRD is the parent specification; the three Milestone 1 documents in [docs](./docs) govern implementation. All four were read before setup. The specifications are unchanged.

## Requirements and quick start

Use Node.js 24 LTS (`nvm use`), npm, and Docker Compose. Versions are pinned in `package.json` and `package-lock.json`; use `npm ci` for reproducible installation.

```sh
npm ci
cp .env.example .env
# Start Docker Desktop first.
docker compose up -d db
npm run db:migrate
npm run seed:validate
npm run seed
npm run dev
```

Open http://localhost:3000 for the placeholder page. It exposes no family data. This is not yet a usable family pilot.

PostgreSQL 18.6 stores all canonical data. The container binds only to loopback and keeps data in the `family_pg` volume. `docker compose stop` preserves it. The example credentials are for local development only.

## Technical choices and boundaries

Next.js 16.3.4 App Router, React 19.3.0, strict TypeScript, Drizzle ORM 0.45.2, and `pg` provide the application and typed relational layer. SQL migrations preserve database-enforced invariants. Vitest separates unit tests from real PostgreSQL integration tests. Plain CSS is sufficient for the placeholder.

TypeScript is pinned to stable 6.0.3 because the ESLint parser bundled with the current Next.js configuration requires TypeScript below 6.1; npm's TypeScript 7 release is not supported by that parser. ESLint is pinned to 9.39.5 because Next.js’s React/import/accessibility plugins do not yet declare support for ESLint 10. No prerelease dependencies are selected.

| Location | Responsibility |
| --- | --- |
| `src/app` | Framework shell; no graph endpoints or product UI |
| `src/domain` | Person, Member, Relationship, canonical graph and primitive semantics |
| `src/server/db` | Drizzle schema and database connections |
| `src/server/seed` | CSV validation and transactional import |
| `src/components/graph` | Separate visualization and layout contracts |
| `src/components/onboarding` | Reserved for future onboarding UI |
| `src/lib` | Reserved for shared utilities |
| `drizzle` | Committed SQL migrations, snapshots and journal |
| `seed/templates` | Empty human-authoring CSV templates |
| `seed/fixtures` | Synthetic examples, including same names and unclaimed Members |
| `seed/private` | Git-ignored private inputs |
| `scripts` | Migration and seed command entry points |
| `tests` | Unit and PostgreSQL integration suites |

People and Relationships alone form the canonical graph. A Member represents access and may have no Person link. `VisualizationState` holds selection/pan/zoom; `LayoutState` holds coordinates and a generational/network strategy. Neither is persisted as family data. A future mature renderer such as Cytoscape will sit behind this boundary; it is intentionally not installed or implemented yet.

App persistence uses the `server-only` entry point in `src/server/db/index.ts`. The separate connection factory supports CLI and tests. ESLint prevents domain/components from importing persistence. Future server operations must authenticate the Member, validate mutations, and explicitly project permitted profile fields. Raw Person/database records include DOB and are not API response types. No authentication bypass or public graph API is provided.

## Schema conventions

The five specified tables are `people`, `members`, `relationships`, `profile_privacy`, and `events`.

- Stable text IDs accommodate human-assigned seed keys and future generated IDs. Names, DOB and email are not Person keys.
- Unknown DOB and living state are nullable; an unknown date is never fabricated.
- A unique nullable Member-to-Person foreign key prevents double claims. Email uniqueness is case-insensitive. PRELINKED describes an initial association, not proof that a Member has signed in: seeded Members remain INVITED with no joined timestamp.
- Only PARENT_OF, SPOUSE_OF and SIBLING_OF persist. CHILD_OF is derived. An expression-based unique index rejects reversed symmetric duplicates even if a caller does not canonicalize ordering. Self-links, invalid endpoints and missing provenance are rejected by PostgreSQL.
- Member-created relationships default to UNVERIFIED. Seeds use SEEDED with an explicit `seed_source` and no invented Member creator. Each relationship has exactly one provenance source.
- Privacy is a separate row, both DOB sharing flags default false. Missing privacy rows must also be treated as private by future query code. Stored values do not imply display or AI-use consent.
- Events include all 14 Milestone 1 event types and nullable contextual foreign keys. Instrumentation and metadata filtering/throttling are future product work.
- Foreign-key deletion defaults preserve referential integrity; deleting a Person cascades only its privacy row. There is no general deletion workflow.

## Migrations

```sh
# After editing src/server/db/schema.ts:
npm run db:generate
# Review the generated SQL and commit SQL plus drizzle/meta files.
npm run db:migrate
```

The migrator records applied migrations in PostgreSQL and can run repeatedly. Use forward migrations; never edit an already deployed migration or run schema push against the pilot. Custom SQL triggers maintain `updated_at` for People and Relationships independently of the data-access caller. Run migrations once per deployment before starting application instances. A migration connection should have DDL privileges; future hosted application credentials should not.

## Authoring and importing seed data

Copy the template headers into `seed/private`. Keep private names, dates, email addresses and notes out of tracked files. `.env*` is ignored except `.env.example`. Synthetic fixtures use example.com addresses.

`people.csv` and `relationships.csv` are required, even if only headers; `members.csv` is optional. People require `person_id,display_name`. Relationships require `from_person_id,to_person_id,relationship_type`. If supplying Members, this email-login scaffold requires `member_key,display_name,email`; Person association and onboarding state are optional. Blank onboarding state is derived as PRELINKED for a linked Person and UNCLAIMED otherwise. All accepted columns are shown in the templates. Unknown columns are rejected on data rows. Notes are retained internally and must not be returned indiscriminately.

CSV parsing handles quoted fields, newlines, commas and BOM. Validation checks calendar dates, living values, IDs, endpoints, self-links, supported types, canonical duplicates, duplicate logins and claims, and onboarding/link consistency. It emits nonblocking warnings for missing DOB, isolated People, more than two parents, redundant explicit siblings and disconnected components. Valid loops, multiple spouses and cross-branch paths are allowed; no relationships are inferred.

```sh
SEED_DIR=seed/private npm run seed:validate
SEED_DIR=seed/private SEED_SOURCE=pilot-initial-v1 npm run seed
```

Reports contain counts and issue codes, not private record values. Row numbers are logical CSV record numbers (a quoted multiline record counts once). Missing relationship IDs are generated deterministically from canonical endpoints and type. Changing CSV order will not change them.

Import revalidates, locks the tables, checks that the database is empty, and inserts People/privacy, Relationships and Members in one transaction. Any failure rolls back the entire import. Running it again against populated data deliberately fails instead of silently replacing participant contributions. Seed CSVs stop being the system of record after import.

For an intentional development reset only:

```sh
NODE_ENV=development npm run seed -- --reset-development
```

This deletes all five tables' data within the import transaction. It is accepted only for loopback database hosts with a name ending in `_dev` and `NODE_ENV=development`. Never label a pilot database `_dev` or use this command through a tunnel to pilot data. There is no automatic reset. For pilot operations, use a backup and a separately reviewed migration.

## Validation and tests

```sh
npm run check              # ESLint, strict typecheck, unit tests
npm run seed:validate
# Create a dedicated disposable test database once:
docker compose exec db createdb -U family family_network_test
npm run test:integration
npm run build
```

Integration tests require `TEST_DATABASE_URL` ending in `_test`; they fail clearly if it is missing and truncate the five application tables before each test. Do not point them at valuable data. They apply real migrations and cover provenance, privacy defaults, identity uniqueness, relationship constraints, import rollback and refusal to overwrite data. Unit tests cover parsing, validation, warnings, canonicalization/inverse semantics and development reset guards. CI provisions PostgreSQL and runs the same checks and a production build.

## Scope and remaining Milestone 1 work

This setup does not complete Milestone 1's product acceptance scenarios. Authentication, graph queries/privacy-safe responses, search, renderer and both layout algorithms, identity claim/create-self/anchor workflows, onboarding UI and event recording remain unimplemented at the user's request. Corresponding product behavior and graph component tests must be added with those features. Privacy-default tests do not claim to test a privacy API; database identity constraints do not claim to test an onboarding workflow.

The optional email login convention, nullable unknown living state, SEEDED status, and separate PRELINKED/onboarding status are implementation choices within the specifications. Drizzle is the permitted equivalent to Prisma. No invitations workflow, verification, admin dashboard, kinship paths, AI or other later-milestone features have been added.

The current stable Drizzle Kit dependency chain reports four moderate development-only audit findings through legacy esbuild. It is used for migration generation, not as a served development endpoint. Runtime dependency audit results and verification outcomes are recorded in the setup report; recheck `npm audit` as dependencies evolve.
