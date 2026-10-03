# Authentication options evaluation

Decision proposal — 1 October 2026. Research only; no authentication implementation or dependency changes.

## 1. Requirements and constraints

Select passwordless email authentication for an invite-only hosted pilot, preferably a six-digit code. Require expiring, single-use codes, bounded guessing and sending, secure sessions, server verification, logout, and convenient local testing without real email delivery. Authentication proves mailbox control; it must never grant Family access by itself.

Repository baseline: Next.js **16.3.4** App Router, React **19.3.0**, TypeScript **6.0.3**, Node **24**, PostgreSQL **18.6**, Drizzle ORM **0.45.2**, Drizzle Kit **0.31.10**, and node-postgres **8.23.0**. `next.config.ts` only separates browser-test build output; it contains no authentication configuration. Server Components call a server-only graph service. Cytoscape remains presentation-only.

Reviewed the PRD, all three Milestone 1 specifications, README, setup/explorer/hydration reports, package/configuration files, domain/schema, and graph retrieval. The PRD is the parent specification; Milestone 1 documents govern implementation. The installed Next.js authentication guide also recommends an auth library and separates authentication, sessions, and authorization.

**Architecture gap:** the repository implements `members`, `people`, `relationships`, `profile_privacy`, and `events`. It does **not** yet implement Account, Family, or Membership. Those are the requested future direction, not an existing schema. Current retrieval selects every Person/Relationship, protected only by a development flag; production is closed. Authentication alone cannot make that query safe for multiple Families.

## 2. Options evaluated

**Better Auth with Email OTP and the Drizzle adapter.** An application-hosted library with native code authentication, database sessions, and direct PostgreSQL integration. Its current documentation identifies version 1.7.7. The upstream manifest includes Next 16, React 19, Drizzle 0.45.2, Drizzle Kit ≥0.31.4, and pg 8 peer ranges, covering the corresponding repository pins. Its App Router integration supports Route Handlers and server session reads. [Manifest](https://raw.githubusercontent.com/better-auth/better-auth/main/packages/better-auth/package.json), [Next.js integration](https://better-auth.com/docs/integrations/next), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle).

**Clerk.** Managed authentication with email-code UI and server SDK, reducing security-service operations. Its Next SDK manifest accepts this Next version and Node 24; its React peer catalog includes 19.3.0. The current integration explicitly covers Next 16's `proxy.ts` convention. [SDK manifest](https://raw.githubusercontent.com/clerk/javascript/main/packages/nextjs/package.json), [React peer catalog](https://raw.githubusercontent.com/clerk/javascript/main/pnpm-workspace.yaml), [App Router guide](https://clerk.com/docs/nextjs/getting-started/quickstart).

**Supabase Auth with `@supabase/ssr`.** Managed or self-hosted authentication with email OTP and a documented Next.js SSR integration. The SSR package is framework-independent, with a Supabase JS peer dependency rather than Next/React peers. It would coexist with the current Drizzle database, but does not act as an auth adapter for it. [SSR package](https://raw.githubusercontent.com/supabase/ssr/main/package.json), [Next.js SSR integration](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

These are compatibility assessments, **not verified installations**. Upstream main-branch manifests are supporting evidence, not frozen release manifests. Before implementation, inspect the selected published release and transitive peer ranges, pin it, and verify TypeScript 6, Node 24, and the complete production build. No candidate was installed or tested during this evaluation.

## 3. Comparison table

| Criterion | Better Auth | Clerk | Supabase Auth |
| --- | --- | --- | --- |
| Exact stack fit | Strongest direct fit; relevant peer ranges cover existing pins | Next 16/React 19 integration; SDK/provider setup required | Framework-neutral client plus Next SSR cookie integration; no ORM coupling |
| Email code | Native plugin; six digits, five-minute expiry and three attempts by default | Native email-code flow and prebuilt UI; documented ten-minute validity | Native six-digit OTP; change email template from link to token and configure expiry |
| Sessions/server boundary | Opaque cookie and database session; server `getSession`, then domain authorization | Short-lived signed session JWT; server SDK verifies, then domain authorization | Access JWT plus rotating refresh token; server `getClaims`/`getUser`, then domain authorization |
| Cookie tradeoff | Production HttpOnly/Secure cookies; straightforward same-origin design | HttpOnly frontend-API credential; application `__session` JWT is deliberately JavaScript-readable | Standard browser/SSR refresh flow needs JavaScript-readable cookies; a server-only alternative adds work |
| Logout/revocation | Library sign-out and session revocation; avoid cookie-cache delay | Managed session termination; locally verified JWT can remain valid until expiry | Sign-out revokes refresh access; issued access JWT survives until expiry |
| PostgreSQL/Drizzle | Auth tables in existing PostgreSQL; reviewed Drizzle migrations | Identity/session data hosted by Clerk; domain stays in Drizzle | Separate Auth service owns its PostgreSQL auth schema; existing domain DB can remain separate |
| Local development | Real OTP delivered to local mail catcher; no external auth service | Test emails/codes avoid delivery; hosted development instance still required | Local Docker/CLI stack includes Mailpit; more services than current Compose |
| Production email | We supply transactional email transport | Managed delivery with production domain/DNS setup | Custom SMTP needed for a real pilot |
| Security responsibility | Library code/session primitives; we configure durable limits, trusted proxy, delivery and patching | Managed endpoint limits and attack protections; configure admission/enumeration policy | Managed OTP/rate controls; configure quotas, SMTP, CAPTCHA if needed |
| Domain integration | Local stable identity mapping; separate auth tables from application Account | Map external user ID; reconcile provisioning/deletion; no Clerk Organizations as Family model | Map external user ID; no automatic domain authorization from JWT or Supabase roles |
| Main cost/risk | More operational responsibility and a small custom code-entry UI | Vendor availability, pricing, SDK and identity-service dependence | Separate service/database boundary; browser token handling and local-stack complexity |

Capability sources: [Better Auth OTP](https://better-auth.com/docs/plugins/email-otp), [sessions](https://better-auth.com/docs/concepts/session-management), [cookies](https://better-auth.com/docs/concepts/cookies); [Clerk sign-in options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [cookie tradeoff](https://clerk.com/docs/guides/secure/best-practices/xss-leak-protection), [session architecture](https://clerk.com/docs/guides/how-clerk-works/overview); [Supabase OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [sessions](https://supabase.com/docs/guides/auth/sessions), [SSR cookie considerations](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## 4. Recommended approach

**Use Better Auth, Email OTP, database-backed sessions, and the Drizzle PostgreSQL adapter.** It matches the code UX and existing persistence architecture, supports fully local authentication, and avoids moving identity into another hosted platform. Keep the integration small: email entry, code entry/resend, session verification, and sign-out. Let the library own code generation/verification and session mechanics.

This is not the lowest-operations choice: Clerk wins there. Choose Clerk instead if nobody can own dependency security updates, delivery monitoring, and rate-limit configuration. For this small prototype, Better Auth's direct database fit, local reproducibility, and first-party HttpOnly session design justify that responsibility. Supabase becomes more compelling if the broader application is moving to its platform; that move is unnecessary here.

## 5. Proposed integration with Account / Family / Membership

Proposed domain contract, subject to resolving the existing Member migration:

- **Auth identity:** library-owned user ID, verified email, sessions, and verification records. Better Auth's internal `account` table describes authentication-provider credentials; it is **not** our application Account. Use clearly separated table names/schema mappings. [Database model](https://better-auth.com/docs/concepts/database).
- **Account:** application-owned stable ID linked uniquely to the auth user ID. Use that ID after verification; do not identify an existing Account by mutable email on every request. Email changes must not silently merge Accounts or change Family access.
- **Family:** application-owned graph/access boundary.
- **Membership:** unique Account–Family participation record with explicit access status and, eventually, a nullable Person association. One Account can have multiple Memberships. Being authenticated need not mean onboarding is complete.
- **Person/Relationship:** canonical family data. Neither authentication nor session creation claims a Person, creates relationships, or changes visualization/layout state.

Request boundary: **verified session → mapped, enabled Account → authorized Membership for requested Family → family-scoped query → privacy-safe graph DTO**. Perform this in the server/domain service, not only in a page, client component, or Proxy. Treat the requested Family ID as untrusted. Missing mapping/membership fails closed. Avoid shared caching of private responses or authorization results.

For the initial pilot, prefer controlled administrator provisioning of invited identities with automatic signup disabled. Provisioning does not prove mailbox ownership or complete onboarding. Establish an idempotent Account mapping, then accept/activate only the intended Family admission after email verification. Recheck invitation eligibility at acceptance; an old invitation must not restore revoked access. Minimal admission plumbing is necessary; member-generated invitations and a full invitation-management UI remain deferred. [Signup behavior](https://better-auth.com/docs/plugins/email-otp).

## 6. Security and privacy considerations

Proposed configuration: six-digit codes, five-minute expiry, three attempts, hashed OTP storage, and default code rotation on resend. Do not write our own OTP generator or verifier. Verify consumed-code rejection, parallel verification, resend invalidation, and attempt exhaustion against the pinned library/adapter before release. Hashing does not make a six-digit secret resistant to offline enumeration if storage is compromised. [OTP settings](https://better-auth.com/docs/plugins/email-otp).

Use database-backed rate-limit storage and explicit send/verify limits; in-memory limits do not coordinate application instances. Better Auth's limiter is disabled in development by default and **direct `auth.api` calls bypass it**. Prefer the standard client-to-handler flow; any public wrapper must preserve equivalent protection. Trust only the deployment proxy's sanitized client-IP header. Add recipient cooldown/send budgets using a maintained limiter where library configuration is insufficient; a UI countdown is not a security control. [Rate limiting](https://better-auth.com/docs/concepts/rate-limit).

Clerk provides managed request/attempt limits and enumeration protections; its password account-lockout feature should not be mistaken for the OTP policy. Supabase provides endpoint quotas and verification throttling. All options still require application admission checks and abuse monitoring. [Clerk security](https://clerk.com/docs/guides/secure/overview), [Clerk limits](https://clerk.com/articles/clerk-security-how-we-protect-your-users), [Supabase limits](https://supabase.com/docs/guides/auth/rate-limits).

Keep auth same-origin, use HTTPS and HttpOnly/Secure cookies in production, retain CSRF/origin protections, and configure a strong server secret. Disable session cookie caching initially so database revocation is checked on protected retrieval; use library logout to terminate the session and clear cookies. Account disablement and Membership removal must take effect on subsequent authorized requests. [Cookie configuration](https://better-auth.com/docs/concepts/cookies), [session management](https://better-auth.com/docs/concepts/session-management), [security controls](https://better-auth.com/docs/reference/security).

Return generic send-code responses for unknown/uninvited emails. Do not log codes, tokens, full emails, graph contents, or DOB. Auth providers/email transports need no Person records, relationship data, or birth dates. Preserve the current explicit graph-field allowlist. Email OTP proves access to a mailbox, not kinship or legal identity; shared/compromised mailboxes remain a limitation.

## 7. Local-development approach

For Better Auth, propose a loopback-only Mailpit service and synthetic invited users in the disposable development database. The delivery callback sends actual randomly generated codes into the local inbox; developers copy them into the same UI used in production. Expiry, attempts, sessions, and logout remain real. Do not add a fixed code, public code-return endpoint, or authentication bypass. Tests can retrieve messages from the isolated test mail catcher. Production configuration must reject the local delivery mode. [Delivery callback](https://better-auth.com/docs/plugins/email-otp), [Mailpit](https://mailpit.axllent.org/).

Clerk offers reserved test addresses and `424242` without sending email, but still uses its service. Supabase's local CLI includes Mailpit and its own Docker stack. [Clerk testing](https://clerk.com/docs/guides/development/testing/test-emails-and-phones), [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started).

## 8. Production email-delivery implications

Better Auth requires a transactional-email provider through its delivery callback; it does not deliver mail itself. Select a provider with an authenticated sending domain, delivery/bounce visibility, sending limits, and suitable data handling. Configure SPF/DKIM/DMARC, server-only credentials, and a code-only template without family information. Ensure delivery completes reliably on the chosen host; do not launch an untracked promise that a serverless runtime can terminate. Test latency and spam-folder placement before inviting participants.

Clerk manages delivery after production domain/DNS setup. Supabase's default sender is restricted and unsuitable for pilot participants; configure custom SMTP. Neither managed option removes deliverability monitoring. [Clerk production](https://clerk.com/docs/guides/development/deployment/production), [Clerk delivery](https://clerk.com/docs/guides/development/troubleshooting/email-deliverability), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 9. Known risks or unresolved questions

1. **Member migration:** approve how existing Member IDs, email uniqueness, PRELINKED/onboarding state, provenance foreign keys, events, and seed contracts map into Account/Membership. Preserve history; do not silently reinterpret JOINED as both authorized and onboarded.
2. **Family ownership:** decide whether People belong to one Family or can be shared across Families, and how relationship endpoints and privacy are scoped. Recommend explicit isolated graphs initially, pending agreement. Current global Person-claim uniqueness needs review under this decision.
3. **Admission:** approve controlled preprovisioning versus invitation-gated first signup, who can provision, and when invited access becomes active. A Family invitation is distinct from an authentication code. Clerk's provider invite-only mode likewise would not grant domain Membership. [Clerk admission](https://clerk.com/docs/guides/secure/restricting-access).
4. **Operations:** choose host, origin/domain, email provider, session lifetime, current-device versus all-device logout expectations, and responsibility for security updates. Keep email change/recovery out of the initial UI until policy is defined.
5. **Compatibility/security gate:** published-version installation, TypeScript 6 checking, adapter concurrency behavior, distributed throttling, and physical iPhone Safari/Chrome sessions remain untested. No claim of production readiness follows from this research alone.

## 10. Implementation implications for the next slice

After approving the domain decisions, plan reviewed migrations for isolated auth tables and Account/Family/Membership; preserve the existing graph and seed history. Add a server-only auth module, Node-runtime auth Route Handler, narrow identity-to-Account adapter, delivery transport, code-entry/sign-out UI, and Membership-aware graph service/query. Server Components can read sessions; cookie issuance/renewal belongs in supported handlers/actions. [Next.js integration](https://better-auth.com/docs/integrations/next).

Protect the existing read-only Explorer before enabling hosted access. Do not introduce identity claiming, Add Myself, graph mutation, verification, social login, passwords, provider Organizations, or later-milestone invitation features in the authentication slice.

Required verification: allowed/uninvited email flows; invalid/expired/replayed/concurrently submitted OTPs; resend and rate limits across instances; forged/expired/revoked sessions; logout; missing/disabled Account; denied/revoked/cross-Family Membership; private HTML/RSC responses; safe cookie/cache behavior; and unchanged canonical graph/layout invariants. Run lint, typecheck, unit/database/browser tests, and production build then. This evaluation changed only this document and ran no implementation checks.
