# Authenticated participant slice — implementation report

Verified 2 October 2026. Implemented **Authenticate → Authorize Family → Claim existing Person → Explore**, with logout and returning-participant behavior. No commit, push, merge, or deployment.

Follow-up: [Person-claim investigation and implementation report](./CLAIM_IMPLEMENTATION_REPORT.md) records the reproduced UI-only duplicate-claim appearance, optional Family-local admission expectations, Setup Mode claimability, migration/local data preservation, and the subsequent verification results. The original implementation results below are retained as history.

## Implementation and compatibility

Better Auth **1.7.7** was selected from the published npm release, installed and pinned. Published peers cover Next.js 16.3.4, React 19.3.0, Drizzle ORM 0.45.2, Drizzle Kit 0.31.10 and pg 8.23.0. Installation, initial factory type checking and production build passed before substantial application/schema work. Final execution exercised Node 24.16.0, TypeScript 6.0.3 and PostgreSQL 18.6. No framework-version changes were needed. SMTP uses pinned Nodemailer 10.0.13; local Mailpit is 1.29.2.

Configuration: native six-digit Email OTP, 300-second expiry, three guesses, hashed storage, resend rotation, database sessions with seven-day lifetime, cookie cache disabled, production Secure/HttpOnly cookies, and supported same-origin Better Auth handlers. Password authentication is disabled; the exposed route surface includes only sending/verifying sign-in codes, reading a session, and logout. Auth and SMTP logging are disabled. Unknown addresses receive a generic send response without delivery. Codes/tokens are never generated or verified by application code.

## Domain and migration

Migration `0002_yummy_sharon_carter.sql`, its Drizzle snapshot, and journal add:

- Better Auth-owned `auth_user`, `auth_session`, `auth_credential`, `auth_verification`, `auth_rate_limit`.
- Application-owned `app_accounts`, `families`, `family_admissions`, `memberships`.
- Explicit required Family ownership on People and Relationships; composite endpoint/claim foreign keys; Account+Family uniqueness; active Person-claim uniqueness; additional event context/types.

The old `members` table is renamed to **`legacy_member_records`**, retaining IDs, original associations, status, onboarding timestamps and creator/event foreign keys. It is historical data, never the authorization model. Existing rows generate unbound admission eligibility in `sample-family`. No Better Auth users or application Accounts are fabricated during migration. No Person is automatically claimed. Even historical PRELINKED/COMPLETED records require the new explicit participant claim; the original association/history remains preserved for review.

The populated-schema migration test proves preservation of Person IDs/DOB, Relationship endpoints/provenance, Member association/lifecycle history and events. The existing development database was forward-migrated, not reset or re-imported. Family scoping may advance existing `updated_at` triggers; topology and profile values are preserved.

## Admission, authorization and claiming

`admissions.csv` defines stable admission ID, normalized email, Family ID, MEMBER/ADMIN role and ACTIVE/REVOKED status. Private files stay under ignored `seed/private`. `npm run admissions:import` applies a transactional admission-only import to an existing graph. It rejects unknown Families, changed admission identities and reactivation of revoked admissions. Revocation also revokes associated Memberships. Initial graph import still refuses populated domain data.

After server-side session verification, an eligible requested-Family admission is bound to an application Account uniquely mapped to the auth user ID. Transactional bootstrap is serialized per auth subject and idempotent across concurrent retries. Existing bound identities use stable IDs rather than treating mutable email as Account identity. A bound email admission cannot be appropriated by another auth user. No valid requested-Family admission means no Membership or graph access. Login never restores revoked access.

`getExplorerGraph(familyId)` verifies the Better Auth session and enabled Account/active Membership/active bound admission. The internal query explicitly filters both People and Relationships by Family. Search and context operate only over this authorized DTO. Manipulated Family IDs fail closed. There is no global current-Family service assumption, membership listing, or multi-Family switcher.

Setup Mode reuses Family Explorer. The selected-person context offers **This is me**, retaining search, layouts, pan/zoom, reset, fit, selection and relationship context. The claim POST checks same-origin, verified session and domain authorization. Its transaction locks authorization rows, rechecks access, locks the selected Family-local Person, rejects existing/double claims, and links Membership with an onboarding timestamp. An identical retry succeeds; reassignment fails. Database uniqueness protects competing claims. Only Membership and events change; Person/Relationship records remain unchanged. Reload with a linked Membership bypasses setup; logout invalidates the session.

## Sample data and isolation

The existing six-Person/six-Relationship fixture retains its stable IDs and now explicitly belongs to **Sample Family** (`sample-family`). Synthetic admission addresses are `alex@example.com`, `sam@example.com`, and `casey@example.com`. Accounts are created only after real OTP verification. Original `members.csv` remains a backward-compatible historical seed input; new participants use admissions.

A minimal second Family is generated in integration tests. Tests prove graph/search/context isolation, wrong-Family claim denial, database rejection of cross-Family endpoints, independent authorization, and one Account with two distinct Family-local Person associations. No global Person merge or cross-Family topology is implemented.

## Security, privacy and instrumentation

- Durable PostgreSQL auth rate limits: send 3/minute/IP, verify 10/minute/IP, plugin/global limits, and bounded code guesses. No public wrapper calls direct OTP server APIs to bypass the handler limiter.
- Production requires HTTPS, a non-placeholder secret, SMTP credentials/sender and an explicitly configured proxy client-IP header. The host must sanitize that header. Mailpit mode is rejected in production.
- No session cookie cache; disabled Accounts, revoked Memberships/admissions and terminated sessions deny subsequent protected requests.
- Existing graph DTO allowlist is preserved: no DOB, notes, private email, auth tokens or other Family memberships. Auth/email providers receive no graph/profile data.
- Auth outcome, Family access, setup/explorer view, search/selection, claim outcome, onboarding and logout events are supported. Search text and auth secrets are not recorded. Browser tests verify journey events and absence of sensitive fixture values in them. Anonymous auth events have no invented Account identity.

## Verification results

| Check | Result |
| --- | --- |
| Published-package compatibility gate | Passed installation, typecheck and early production build |
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit tests | **54 passed** |
| PostgreSQL integration tests | **32 passed** |
| Browser/E2E | **6 passed** — desktop and mobile Chromium |
| Forward migration on existing local development data | Passed; no reset/reseed |
| Populated original-schema migration test | Passed in rolled-back isolated test schema |
| Repeated migration execution | Passed |
| Seed validation | Passed; 0 errors, 4 existing fixture warnings |
| Fresh CLI migration/seed/admission import | Passed in `family_network_seed_test` |
| Production build | Passed |
| Private-file ignore checks | `.env` and `seed/private` remain ignored |

Auth tests cover real library-generated codes, wrong/expired/exhausted/replayed codes, concurrent verification, resend rotation, Secure/HttpOnly cookies, forged/expired sessions, logout, throttling and origin rejection. Domain tests cover unmapped/unverified identities, disabled Accounts, missing/wrong/revoked admissions/Memberships, retries, stable identity binding, concurrent claims and canonical invariance. Original unit/Explorer tests remain; database tests were adapted to archived table names and explicit Family IDs. Browser invariance continues to cover People, Relationships, privacy and legacy records; new Accounts/Memberships/events necessarily change.

The complete OTP→claim→return→logout journey uses actual Mailpit SMTP messages, not fixed codes or bypasses. CI now provisions Mailpit. Browser coverage uses mobile Chromium emulation; it does not establish physical-iPhone/Safari authentication behavior. Mobile Explorer screenshots were inspected; new auth/claim controls have touch-sized buttons.

## Files and documentation

Changes are grouped in `src/server/auth`, `src/server/db`, `src/server/graph`, `src/server/seed`, new auth/claim/events Route Handlers, the root page, sign-in controls and small Explorer setup/claim additions. Also updated: domain types, migration/snapshot/journal, seed fixtures/templates, admission CLI, package/lockfile, Compose, environment template, CI, Playwright setup and unit/integration/browser tests.

[README.md](./README.md) documents the exact local workflow, admission format/add/revoke commands, binding rules, migration semantics and production requirements. This report records results/deviations. Original specifications and `docs/authentication-options-evaluation.md` were not edited. The named Account/Family/Membership specification was absent; the user explicitly approved the attached implementation request as its replacement.

## Deviations and remaining limitations

- The research proposed pre-created auth identities with automatic signup disabled. The governing implementation request instead requires email admissions without fake auth users. Accordingly, only eligible emails can complete native OTP first-user creation; Family authorization remains a separate domain transaction.
- Legacy Member history is preserved as an archive rather than forcing unauthenticated historical rows into Accounts/Memberships. It is not a parallel live access model. A migration of historical claims into automatic new claims was deliberately avoided.
- Original Milestone 1 name/DOB entry and Add Myself are not implemented in this slice, as instructed. No topology editing, invitations UI, Family creation/switcher, global profiles or cross-Family discovery was added.
- Production SMTP is implemented but unconfigured/untested. Delivery is awaited; generic send responses do not guarantee timing indistinguishability. No separate durable email queue was introduced.
- Limits are durable across application instances, but distributed-source email abuse still needs provider spend/send caps and hosting-edge protections. Shared household IP limits may need pilot tuning. No blanket multi-instance deployment readiness is claimed without testing the chosen host/proxy.
- Email changes, recovery, reinstatement and mistaken-claim correction have no participant/admin UI. Direct edits to auth emails require a reviewed operational procedure; no automatic Account merging occurs.
- Session termination applies to the current session; no all-devices management UI. Already displayed graph data cannot be withdrawn from a browser after revocation; subsequent protected requests are denied.
- Instrumentation provides proportional outcome/count data; anonymous auth outcomes are not correlated to a fabricated Account. No analytics UI or generalized telemetry pipeline.

### Dependency advisories and hosted-pilot decisions

Post-implementation dependency follow-up: `next` and `eslint-config-next` are now pinned to **16.3.8**. The user reports that the critical audit finding is resolved. The verification results above describe the original implementation run; checks were not rerun for this documentation-only update.

The moderate [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99) remains through Drizzle Kit → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → esbuild. The four moderate findings represent this dependency chain. **The user explicitly chose to leave it unchanged for now.** The affected functionality is esbuild's development server, which the application's migration workflow does not use. This is a deferred dependency issue, not a claim that the installed package is patched. Do not apply the audit-suggested forced downgrade to Drizzle Kit 0.18.1. Revisit when a compatible upstream fix is available or before introducing tooling that uses esbuild's server; any override requires migration/schema-generation compatibility testing. Better Auth's optional Drizzle Kit peer causes that tooling chain to appear in the runtime audit view as well; production packaging should exclude unused tooling where practical.

Before a hosted pilot: select/test hosting and database/backups, patch/reverify dependencies, configure HTTPS and sanitized client-IP headers, choose the email provider/domain and delivery limits, confirm seven-day session policy, define operational recovery/revocation ownership, and test authentication on physical iPhone Safari/Chrome. No production secrets or deployment were created.

Local PostgreSQL and Mailpit remain available for development. Temporary test servers stopped. The extra seed-test database contains only synthetic data. The ignored local `.env` received a random auth secret and local-mail settings without exposing the secret in outputs.

## Authenticated identity UX follow-up — 3 October 2026

Added a compact “Signed in as” email indicator beside the unchanged logout control in both Setup and Explorer modes. Mobile places the account controls on a separate wrapping header row. The server page extracts only `session.user.email` from the existing verified session and passes that scalar as `authenticatedEmail`; no session object or auth/domain identifiers cross the boundary. Graph DTOs, claim rules, authentication and database schema are unchanged. Existing expected/different/already-claimed Person messaging and action availability were retained and explicitly verified.

Expanded browser assertions cover email visibility before/after onboarding and returning login, independence from Person selection, logout removal, enabled expected-Person actions, absent actions for ineligible/claimed People, and exclusion of other participant emails and actual Membership/Account/admission IDs. Privacy tests now intentionally permit only the current user's email. The tests follow the configured expected Person instead of assuming the first same-name search result; the user's fixture change assigning Sam to P004 was preserved.

Final results: lint passed; strict TypeScript passed; **58 unit tests passed**; **8 desktop/mobile browser tests passed (54.2 seconds)**; production build passed on Next.js 16.3.8. Desktop/mobile screenshots were inspected. PostgreSQL integration tests were not rerun because persistence and authorization code were unaffected; browser tests used the disposable PostgreSQL database and retained canonical-data checks.

Initial verification exposed outdated no-email assertions and the hard-coded P003 fixture assumption. An overlapping production build also removed the browser server's nested output directory. Corrected the test expectations without relaxing other-user privacy or claim checks and reran the full browser suite separately; all passed. No application architecture change, dependency change, migration, local-development data reset, commit or push was performed for this UX task.
