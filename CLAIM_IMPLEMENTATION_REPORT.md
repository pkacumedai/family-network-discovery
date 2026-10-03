# Person-claim investigation and correction

2 October 2026. Narrow follow-up to the authenticated participant slice. Account → Membership → Family/Person remains unchanged. No package changes, commit, push, merge, deployment, new Person creation, claim transfer, or global identity model.

## 1. Root cause and pre-change reproduction

The apparent duplicate claim was **UI-only in the reproduced scenario**. Setup Mode offered “This is me” for every selected Person because the graph DTO contained no claimability state. The existing claim transaction and PostgreSQL unique index rejected the duplicate. No persisted duplicate was reproduced or found in the local development database.

Before application changes, a real OTP/browser reproduction ran against the disposable test database using the unchanged claim endpoint:

| Step | Result | Persisted Membership state |
| --- | --- | --- |
| Alex authenticates | Setup Mode | M001 ACTIVE, Person null |
| Alex claims P001 | HTTP 200 | M001 ACTIVE → P001 |
| Alex attempts P002 | HTTP 409 | M001 remains P001 |
| Logout; Casey authenticates/selects P001 | “This is me” incorrectly visible | M003 ACTIVE, Person null |
| Casey submits P001 | HTTP 409 | M001 unchanged; M003 remains null |
| Logout; Sam authenticates | Setup Mode | M002 ACTIVE, Person null |
| Sam submits unrelated unclaimed P002 (Robin) | **HTTP 200** | M002 ACTIVE → P002 |

All rows belonged to `sample-family`. Reload after a successful claim bypassed Setup Mode. The temporary reproduction test passed before being replaced by permanent regression coverage. It wrote only disposable test data, not the manual-test development database.

The wrong-identity behavior was a real authorization gap for the controlled pilot: admission established eligibility, but contained no expected Person constraint. It was consistent with the old unconstrained self-attestation model.

## 2. Exact local development state before changes

| Membership ID | Admission | Family | Status | Person | Onboarding completed (UTC) |
| --- | --- | --- | --- | --- | --- |
| 3d60317e-a8b3-4068-8eb9-7e7c1f51dbab | M001 | sample-family | ACTIVE | P001 | 2026-10-02 20:11:22.565 |
| c0204051-627f-4bd2-b479-80c00118a144 | M003 | sample-family | ACTIVE | null | null |

There was no M002 Membership. All three admissions were ACTIVE. The duplicate-group query returned **zero rows**. Historical `legacy_member_records` contained M001 → P001/PRELINKED and unclaimed M002/M003. Those historical rows were not used by claim authorization.

The installed database index was:

```sql
CREATE UNIQUE INDEX membership_active_person_unique
ON public.memberships (family_id, person_id)
WHERE status = 'ACTIVE' AND person_id IS NOT NULL;
```

The existing transaction locks authorization rows, rechecks access, locks the Family-local Person, checks for an active claim, then updates only the claimant Membership and success events. Person locking serializes competing claims; the partial unique index also rejects duplicate direct database writes. It never overwrites or revokes the other claimant. Same-Membership/same-Person retries remain idempotent; changing an established claim remains forbidden. These protections were retained, not replaced.

## 3. Admission and authorization changes

Added nullable `family_admissions.expected_person_id`, a composite foreign key `(family_id, expected_person_id) → people(family_id, id)`, and optional CSV column `expected_person_id`. Migration `0003_mixed_kinsey_walden.sql` is additive and leaves existing expectations null; it performs no identity inference or claim backfill.

Synthetic admissions explicitly configure M001 → P001 and M002 → P003. P003 is the chosen synthetic Sam; no matching algorithm chooses between the two Sam records. M003 remains null because Casey has no Person record in the fixture.

An expectation is **neither a reservation nor a claim**. It creates no auth identity, Account, Membership, or onboarding completion. When an unclaimed Membership has a non-null expectation, the transaction checks the selected ID against the locked, reauthorized active admission before claiming. Mismatches fail without changing the admission, Membership, Person or Relationships; the endpoint records the existing non-sensitive `identity_claim_failed` event without emails, expected IDs, or submitted request metadata. Existing origin/session/access/revocation and concurrency protections remain.

Seed and admission import reject unknown or cross-Family expected IDs. Admission imports lock the admission before examining existing claims, reject conflicting non-null expectations, and cannot correct or transfer a live claim. Missing optional columns preserve existing expectations; explicitly blank cells clear them. Unchanged roles avoid unnecessary Membership timestamp updates. Existing role/revocation import behavior is retained.

## 4. Setup Mode and privacy

Setup responses add only a Person-level label: `EXPECTED`, `AVAILABLE`, `NOT_ELIGIBLE`, or `ALREADY_CLAIMED`. An active claim takes precedence over expectation. Returning Explorer responses omit this extra state.

All People remain visible, searchable and selectable, with the existing graph controls and privacy-safe context. Only EXPECTED/AVAILABLE selections offer “This is me.” Other selections display either “This is not the person associated with your invitation” or “Already associated with a family member account.” No Account/Membership/admission records, emails, auth IDs, or dates of birth are sent. Canonical graph transforms and storage remain separate from this presentation hint.

Server authorization remains authoritative when a browser snapshot becomes stale. Null expectations retain self-identification subject to live-claim uniqueness. One Account can independently confirm distinct expected People in separate Families, without merging People or changing topology.

## 5. Migration and local data outcome

Applied the forward migration and populated the local synthetic admission expectations. No graph reseed or claim repair was performed. The fixture admission import initially synchronized M001's role from MEMBER to ADMIN; that incidental change was explicitly reported and reversed with a checksum-guarded restoration. The local admission role was also restored to MEMBER. Future imports should use reviewed roles/statuses, not blindly copy sample roles onto existing data.

Final complete-row checksums match the pre-update values:

| Records | Before and after checksum |
| --- | --- |
| Memberships | a7d3a20b58424fdb64997785e59f4a68 |
| People | ed6b19b66477b8cfbba72be9188fda01 |
| Relationships | 4c1c5a97055104c397b69aa55cdc771f |
| Legacy Member records | 4837b54d4b8e6cc972181193fbecb9ec |

The final local database still has only M001 → P001 and unclaimed M003, with **zero duplicate active claims**. No invalid claim data requires repair. Existing admissions now have the intended P001/P003/null expectations. No existing claim, confirmation timestamp, graph record or legacy record was rewritten in the final state.

This workspace is ready for the usual local startup: ensure Docker database/Mailpit are running, then restart `npm run dev`. Keep `.env` and the existing secret; do not reseed. Other installations need the additive migration and a reviewed admission import.

## 6. Regression coverage and exact verification results

Added four seed-validation cases, eight PostgreSQL cases, and one browser scenario exercised on both desktop and mobile. Extended the existing migration-preservation test. Existing tests were not weakened.

Coverage includes sequential/concurrent duplicate rejection, original claimant preservation, direct database uniqueness, idempotence, reassignment rejection, expected/wrong Person authorization, no implicit claims or auth identities, unknown/cross-Family imports and foreign keys, revoked admissions, transactional import rollback, legacy CSV preservation, expected/unavailable/claimed DTO labels, safe browser responses, null expectations, stale browser submissions, returning login, independent multi-Family claims, and canonical graph invariance.

| Verification | Final result |
| --- | --- |
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit tests | **58 passed**, 3 files |
| PostgreSQL integration tests | **40 passed**, 3 files, including migration tests |
| Browser/E2E | **8 passed**, desktop/mobile Chromium; final run 49.6 seconds |
| Populated-history and live-claim migration preservation | Passed |
| Repeated migration application | Passed in integration suite |
| Seed/admission fixture validation | **0 errors**, 4 existing warnings |
| Local forward migration | Passed |
| Local admission import | 3 admissions processed; incidental role sync restored as documented |
| Production build | Passed on Next.js **16.3.8** |

Initial sandbox attempts could not access local sockets; approved runs passed. The first full browser run had 7 passes and one logout/navigation race in the new test. Waiting for the sign-in screen after logout fixed test synchronization; the complete rerun passed. Existing fixture warnings remain two missing DOBs, an isolated Person and disconnected components.

## 7. Remaining limits

No material architectural deviation was required. Browser claimability is a snapshot, not a live subscription; stale requests are still rejected. Expected Person does not reserve a record: an unconstrained admission can claim any otherwise available Person, including another admission's expected Person, as specified. Administrative identity correction remains outside this slice. Physical-device authentication was not retested; mobile coverage uses Chromium emulation. No historical unseen duplicate is ruled out solely by the current-state inspection, but the reported duplicate persistence could not be reproduced and no current invalid duplicates exist.

The previously accepted moderate Drizzle/esbuild dependency advisory remains deferred; this task did not change dependencies.
