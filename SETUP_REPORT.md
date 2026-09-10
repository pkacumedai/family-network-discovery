# Milestone 1 setup report

Verified September 9, 2026. The four Markdown specifications in `docs` were read before any edits and remain unchanged. This is the requested repository foundation, not completion of the Milestone 1 product.

## Delivered

- Next.js App Router placeholder, strict TypeScript, pinned npm dependencies and lockfile.
- PostgreSQL Compose service and typed Drizzle data-access infrastructure.
- Five specified tables, versioned initial migration and update-timestamp triggers.
- Domain records separate from Member access, visualization state and layout state.
- CSV templates plus synthetic fixtures; calendar/graph/member validation, nonblocking warnings, transaction-based import, safe development reset gate and private-data ignores.
- Unit and real PostgreSQL integration test projects, CI, environment template and developer README.

## Verification results

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript `tsc --noEmit` | Passed |
| Vitest unit suite | 36 passed |
| PostgreSQL integration suite | 7 passed |
| Next.js production build | Passed; only placeholder and framework not-found routes |
| Initial migrations against PostgreSQL 18.6 | Passed |
| Repeated migration execution | Passed in integration test |
| Synthetic CSV validation | 0 errors; 4 intentional warnings |
| Synthetic import | 6 People, 6 Relationships, 3 Members; 2 graph components |
| Import atomicity and nonempty-database refusal | Passed in integration tests |
| Production dependency audit | 0 published vulnerabilities reported |
| Full dependency audit | 4 moderate development-only findings in Drizzle Kit's legacy esbuild chain |

The fixture warnings are two missing birth dates, one isolated Person and disconnected graph components. They do not prevent import.

The integration suite covers actual PostgreSQL migrations, timestamps, provenance, privacy defaults, unique Person claims, case-insensitive login uniqueness, symmetric duplicates, self-links, foreign keys, invalid seed rejection, mid-transaction failure rollback and refusal to overwrite populated data. It does not substitute for future product workflow tests.

## Implementation choices and deviations

- Drizzle is the architecture specification's permitted typed relational equivalent to Prisma.
- Next.js 16.3.4 and React 19.3.0 are pinned from npm stable releases. TypeScript 6.0.3 is used because the current Next.js ESLint parser rejects TypeScript 7. ESLint 9.39.5 is used because the bundled React/import/accessibility plugins do not declare ESLint 10 support. ESLint 9 is marked deprecated by npm; these compatibility pins should be revisited when Next.js's tooling supports newer majors.
- PostgreSQL uses local port 55432 because port 5432 was occupied. Existing services were left running. CI uses its own port 5432.
- Email is the selected initial Member login identifier; authentication remains unimplemented. Prelinked seed Members retain INVITED status until an actual join occurs.
- Unknown living state is null; both birth-date sharing flags default false. Seed Relationships use SEEDED and a distinct source label.
- Product functionality and its acceptance tests are deliberately deferred per the setup-only request: authenticated access, privacy-filtered graph queries, search, rendering, generational/network layout algorithms, identity claim, create-self, anchor relationships, onboarding and event emission. No later-milestone features are implemented.
- The stable Drizzle Kit development dependency advisory remains recorded rather than applying npm's suggested breaking downgrade. The affected tool is used for migration generation, not a served esbuild endpoint.

## Local state

Docker Desktop was started. The repository's PostgreSQL container is running on localhost:55432. `family_network_dev` contains only the supplied synthetic fixture. A separate `family_network_test` database was created for disposable tests. No private seed data was read or imported. No application server is left running, and no deployment or Git commit was made.

See [README.md](./README.md) for setup, migration, seed and test commands.
