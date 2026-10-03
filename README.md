# Family Network — authenticated Explorer and existing-Person claim

This Milestone 1 slice supports **email OTP → Family authorization → explicit existing-Person claim → read-only Explorer → logout**. Add Myself, graph editing, verification, invitations UI and cross-Family discovery remain deferred. The PRD and Milestone 1 specifications remain governing context; the implementation request supplies the Account/Family/Membership decisions. See [AUTH_IMPLEMENTATION_REPORT.md](./AUTH_IMPLEMENTATION_REPORT.md) for verification, deviations and deployment limitations. The [authentication evaluation](./docs/authentication-options-evaluation.md) remains the original research artifact.

## Local setup

Use Node 24 (`nvm use`), npm and Docker Compose. Dependencies are pinned.

```sh
npm ci
cp .env.example .env  # Only for a new checkout; preserve existing local settings.
openssl rand -base64 48
# Put that random value in BETTER_AUTH_SECRET in .env.
docker compose up -d db mailpit
npm run db:migrate
npm run seed:validate
npm run seed          # Fresh database only; do not overwrite an existing graph.
npm run dev
```

Open http://127.0.0.1:3000. Sign in with `alex@example.com`, `sam@example.com`, or `casey@example.com`. Open the local inbox at http://127.0.0.1:8025, copy the real six-digit code, and verify it. In Setup Mode, search/select an existing Person, review immediate-family context, then explicitly choose **This is me**. Reload returns to Explorer. Log out ends the session. The sample has six People, six Relationships and intentionally repeated names.

For an existing checkout, run the forward migration, add the new environment settings, and restart the dev server. Existing graph data is preserved; do not reseed. `ENABLE_LOCAL_EXPLORER` is obsolete and does not bypass authentication. A new local secret and Mailpit settings were added to this workspace's ignored `.env`; production credentials were not configured.

The local database is PostgreSQL 18.6 on loopback port 55432; Mailpit SMTP is 1025 and its inbox is 8025, also loopback-only. Docker volumes retain database data. Local mail is captured, never delivered to participants. The same OTP and session machinery runs locally and in production; there is no fixed-code or auth bypass.

The Person-claim follow-up migration and synthetic admission expectations have already been applied to this workspace. Keep the existing `.env` and secret; do not reseed. For daily use, run `docker compose up -d db mailpit` and `npm run dev`. For another existing database, apply `npm run db:migrate`, then import a reviewed admissions file with expected Person IDs and the existing intended roles/statuses. Do not blindly import sample roles over pilot settings. See [CLAIM_IMPLEMENTATION_REPORT.md](./CLAIM_IMPLEMENTATION_REPORT.md).

## Identity and data boundaries

- Better Auth **1.7.7** owns `auth_user`, `auth_session`, `auth_credential`, `auth_verification`, and `auth_rate_limit`. Its credential `account` model is mapped to `auth_credential` and is unrelated to our application Account.
- `app_accounts` maps one stable application ID uniquely to an immutable auth-user ID. Better Auth's verified email is authoritative; Account does not duplicate email.
- `families` owns the graph boundary. Every Person and Relationship belongs to exactly one Family. Composite foreign keys enforce same-Family endpoints.
- `family_admissions` contains administrator-provisioned email eligibility. It is distinct from authentication and a Person claim.
- `memberships` joins an Account and Family uniquely, with ACTIVE/REVOKED status, MEMBER/ADMIN role and nullable Person link. A partial unique index prevents two active Memberships from claiming one Person. Roles are stored; no administration UI is introduced.
- `legacy_member_records` preserves original Member IDs, email, links, lifecycle/onboarding timestamps and creator/event references as migration history. It is never consulted for authorization. Legacy PRELINKED associations do not automatically claim a Person in the new flow.

On a server-verified session, page entry binds an eligible Family admission to the application Account and creates that Family's Membership idempotently. No fake auth users are seeded. A bound admission cannot be taken over by another auth identity reusing the email. Later identity lookup uses auth user ID; email is used only to bind an unbound admission. Existing revoked Memberships/admissions are never reactivated by login. Account disablement also denies access.

Every graph service call verifies the session and independently authorizes the requested Family. The internal Drizzle query requires an explicit Family ID. Search and immediate context run only over that authorized, filtered DTO. The browser receives Person ID/name and Relationship ID/endpoints/type/status, plus its own Person link. The shell separately receives only the current verified session’s email for the “Signed in as” indicator beside logout, in both Setup and Explorer modes. During Setup Mode only, each Person also has a claimability label; no Account, Membership, admission or auth records are sent. It receives no full DOB, notes or other participants’ emails. No provider organization/team represents a Family.

Claims recheck authorization under row locks, validate Family-local Person ownership and uniqueness, and update only Membership onboarding state plus events. Concurrent claims are protected by locks and a database unique index. An identical retry succeeds; changing an established claim fails. Accounts and Person records are never merged. Person creation and Account Global Profile remain deferred.

## Seeds and pilot admissions

`seed/fixtures/families.csv` explicitly declares `sample-family,Sample Family`. People/Relationships include `family_id`; original synthetic Person/Relationship IDs remain stable. A minimal second Family is created by integration-test setup only, not exposed as a product feature.

For a new private graph, copy `seed/templates` under Git-ignored `seed/private`, supply `families.csv`, `people.csv`, `relationships.csv`, and `admissions.csv`, then validate/import using `SEED_DIR=seed/private`. The legacy `members.csv` format is accepted for historical seed compatibility; it imports archival records and admission eligibility, not authenticated Accounts or completed claims. New pilot participants should use admissions only.

Admission format:

```csv
admission_id,family_id,email,role,status,expected_person_id
pilot-001,sample-family,participant@example.com,MEMBER,ACTIVE,P001
```

Emails normalize to lowercase/trimmed form. Admission ID and Family+email must be unique. Roles are MEMBER/ADMIN and status is ACTIVE/REVOKED. Family must already exist when applying admissions independently. Do not supply auth user IDs, Account IDs, OTPs or passwords. Person links are established only by the authenticated claim action. Validation rejects unknown Family/Person references, duplicate admissions, invalid legacy claim hints, and cross-Family relationships; PostgreSQL enforces Membership/Person Family consistency and claim uniqueness.

`expected_person_id` is optional: use an explicit existing Person ID in the same Family, or leave it blank for unconstrained self-identification. No name/email matching is performed. It neither reserves nor claims a Person and creates no Account or onboarding confirmation. The participant must still choose **This is me**. A non-null expectation permits only that Person; any active live claim makes the Person unavailable. Other People remain visible and searchable. Synthetic expectations are M001 → P001 and M002 → P003 (the explicitly chosen Sam); M003 remains blank because Casey is not represented in the fixture. Legacy Member links are never live claims or implicit admission expectations.

To **add participants to an existing graph**, add rows to the private `admissions.csv`, then:

```sh
SEED_DIR=seed/private npm run admissions:import
```

This is a transactional upsert of admissions only, not graph import. It refuses to change an existing admission's email/Family or reactivate a revoked admission. It updates roles without restoring access. Omitted rows are unchanged. To **revoke access**, set the row to REVOKED and rerun the command; it revokes associated Memberships too. Subsequent server requests fail even if the auth session remains valid. Reinstatement/identity correction requires a separately reviewed administrative operation and is not supplied by this slice.

Unknown/cross-Family expected IDs fail validation and a composite database foreign key. An older CSV without the optional column preserves existing expectations; an explicitly blank cell clears the expectation, so review blanks carefully. Import rejects a non-null expectation conflicting with an existing Membership claim and never changes the claim. Unchanged roles no longer rewrite Membership timestamps.

On first verified entry into that Family, admission binding and Membership creation occur in one transaction with a per-auth-subject lock. A retry cannot duplicate Account/Membership. No admission for the requested Family means no access, even if the email belongs to another admitted Family. Additional authorized Families may be reached through a supplied `/?family=FAMILY_ID` URL; no switcher or listing of other memberships is provided.

The initial graph importer still refuses nonempty domain databases. Intentional development reset remains restricted to `NODE_ENV=development`, a loopback database ending `_dev`, and explicit `--reset-development`. Never use it against pilot data. Keep all private seed files and `.env` outside Git. Records become PostgreSQL-owned after import.

## Environment and deployment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server PostgreSQL connection |
| `TEST_DATABASE_URL` | Disposable database ending `_test` only |
| `BETTER_AUTH_SECRET` | Random secret, at least 32 characters; never client-visible |
| `BETTER_AUTH_URL` | Exact origin, no trailing slash; HTTPS in production |
| `MAIL_TRANSPORT` | `mailpit` locally; `smtp` in production |
| `SMTP_HOST`, `SMTP_PORT` | Loopback:1025 locally; production TLS SMTP, normally port 465 |
| `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Production mail credentials/authenticated sender |
| `AUTH_IP_HEADER` | Required in production: client-IP header overwritten by the trusted hosting proxy |
| `SEED_DIR`, `SEED_SOURCE` | Seed input directory and provenance label |

Production refuses Mailpit, HTTP origin, missing credentials, placeholder secrets and an unspecified proxy IP header. Configure the host to **strip/overwrite** the selected header; never trust arbitrary client-supplied forwarding headers. Auth rate limits persist in PostgreSQL across instances: send 3/minute/IP, verify 10/minute/IP, plus plugin rules and three guesses/code. They are enabled in development too. Shared-IP households can hit these limits; tune with measured pilot traffic. A distributed attacker using many IPs can still cause email abuse; enforce provider send budgets/edge abuse controls before public deployment.

Codes are hashed in storage, expire after five minutes, rotate on resend, and are consumed atomically by Better Auth. Seven-day database sessions use production Secure/HttpOnly cookies and no cookie session cache. Supported Better Auth handlers retain CSRF/origin protections. Claim/events endpoints require same-origin POST and server authorization. No raw email/code/token/DOB is written to application logs or telemetry; auth library/SMTP logging is disabled. Anonymous auth telemetry records only outcome types; search events omit query text.

Choose a production host, database backups/pooling, HTTPS origin, trusted proxy header, mail service and authenticated sender domain (SPF/DKIM/DMARC). SMTP delivery is awaited for reliability; this can expose delivery timing differences despite generic responses. Monitor delivery and limits without logging secrets. No production email delivery or hosting was configured/tested. Resolve the recorded Next.js security advisory before hosting.

## Migrations and verification

Use reviewed forward migrations: `npm run db:generate`, inspect SQL/snapshots, then `npm run db:migrate`. Migration 0002 archives Members, scopes existing graph/history to Sample Family, provisions eligible admissions, and adds isolated auth/domain tables and constraints. It preserves graph IDs/provenance; it does not invent auth identities or silently claim People.

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run seed:validate
npm run test:browser
npm run build
```

Create `family_network_test` once with `docker compose exec db createdb -U family family_network_test`. Integration/browser suites reset only the explicit `_test` database and must run sequentially. Browser tests require Mailpit and clear its **local test inbox**; do not use that inbox for valuable messages. They exercise genuine OTP delivery, claim/return/logout, desktop/mobile Explorer regression, and canonical graph/archival record/privacy invariance. Events, Accounts and Memberships intentionally change in this slice. CI provisions PostgreSQL and Mailpit.

Cytoscape and both layout algorithms remain presentation-only. Pan/zoom/search/selection, independent manual positions, Reset layout, Fit all, and Center remain supported. Setup Mode adds identity controls without graph mutation. Physical-device authentication and production SMTP still need pilot checks. Earlier setup/explorer reports are historical; this README and the current report describe the new boundary.
