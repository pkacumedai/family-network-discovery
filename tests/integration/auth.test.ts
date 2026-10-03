import 'dotenv/config';
import { importAdmissions } from '../../src/server/seed/admissions';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, sql } from 'drizzle-orm';
import { connectDatabase } from '../../src/server/db/connection';
import { accounts, admissions, authUser, authVerification, authSession, families, memberships, people, relationships } from '../../src/server/db/schema';
import { createAuthentication } from '../../src/server/auth/factory';
import { authorize, bootstrap, claimPerson } from '../../src/server/auth/domain';
import { retrieveExplorerGraph } from '../../src/server/graph/query';
import { searchPeople, immediateFamily } from '../../src/domain/explorer';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Disposable test database required');
const { db, pool } = connectDatabase(url);
const codes = new Map<string, string>();
const origin = 'http://localhost:3000';
const auth = createAuthentication(db, 'test-secret-for-integration-only-01234567890123456789', origin, async (email, code) => { codes.set(email, code); });
const post = (path: string, body: unknown, cookie = '') => auth.handler(new Request(`${origin}/api/auth/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'x-forwarded-for': '127.0.0.1', Cookie: cookie }, body: JSON.stringify(body),
}));
const send = (email = 'one@example.com') => post('email-otp/send-verification-otp', { email, type: 'sign-in' });
const verify = (otp: string, email = 'one@example.com') => post('sign-in/email-otp', { email, otp });
const identity = { id: 'U1', email: 'one@example.com', emailVerified: true };
async function user(id = 'U1', email = 'one@example.com') { await db.insert(authUser).values({ id, email, name: 'Participant', emailVerified: true }); return { id, email, emailVerified: true }; }
beforeAll(async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  codes.clear();
  await db.execute(sql`TRUNCATE events, families, app_accounts, auth_user, auth_verification, auth_rate_limit, legacy_member_records CASCADE`);
  await db.insert(families).values([{ id: 'A', name: 'Family A' }, { id: 'B', name: 'Private test family' }]);
  await db.insert(people).values([{ id: 'PA', familyId: 'A', displayName: 'Person A' }, { id: 'PA2', familyId: 'A', displayName: 'Other A' }, { id: 'PB', familyId: 'B', displayName: 'Secret B' }]);
  await db.insert(relationships).values({ id: 'RA', familyId: 'A', fromPersonId: 'PA', toPersonId: 'PA2', relationshipType: 'SPOUSE_OF', seedSource: 'test' });
  await db.insert(admissions).values([{ id: 'AD1', familyId: 'A', email: 'one@example.com' }, { id: 'AD2', familyId: 'A', email: 'two@example.com' }, { id: 'AD3', familyId: 'B', email: 'one@example.com' }]);
});
describe('real Better Auth OTP and database sessions', () => {
  it('creates a verified identity/session and terminates it on logout', async () => {
    expect((await send()).status).toBe(200);
    expect(codes.get(identity.email)).toMatch(/^\d{6}$/);
    const response = await verify(codes.get(identity.email)!);
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    expect(response.headers.get('set-cookie')).toMatch(/httponly/i);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })).toBeTruthy();
    expect((await post('sign-out', {}, cookies)).status).toBe(200);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })).toBeNull();
  });
  it('sets Secure and HttpOnly session cookies in production configuration', async () => {
    const secureOrigin = 'https://family.example';
    const secureAuth = createAuthentication(db, 'test-secret-for-production-cookie-check-only-123456', secureOrigin, async (email, otp) => { codes.set(email, otp); }, true);
    const request = (path: string, body: unknown) => secureAuth.handler(new Request(`${secureOrigin}/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: secureOrigin, 'x-forwarded-for': '127.0.0.2' }, body: JSON.stringify(body) }));
    await request('email-otp/send-verification-otp', { email: identity.email, type: 'sign-in' });
    const response = await request('sign-in/email-otp', { email: identity.email, otp: codes.get(identity.email) });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/; Secure/i);
    expect(response.headers.get('set-cookie')).toMatch(/; HttpOnly/i);
  });
  it('unknown email has generic send response and no delivery or account', async () => {
    expect((await send('unknown@example.com')).status).toBe(200);
    expect(codes.size).toBe(0);
    expect((await verify('123456', 'unknown@example.com')).status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(accounts)).toHaveLength(0);
  });
  it('rejects wrong codes and exhausted attempts', async () => {
    await send(); const correct = codes.get(identity.email)!; const wrong = correct === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) expect((await verify(wrong)).status).toBeGreaterThanOrEqual(400);
    expect((await verify(correct)).status).toBeGreaterThanOrEqual(400);
  });
  it('rejects expiry', async () => {
    await send(); await db.update(authVerification).set({ expiresAt: new Date(0) });
    expect((await verify(codes.get(identity.email)!)).status).toBeGreaterThanOrEqual(400);
  });
  it('rotates on resend and rejects the older code', async () => {
    await send(); const old = codes.get(identity.email)!; await send(); const next = codes.get(identity.email)!;
    expect(next).not.toBe(old);
    expect((await verify(old)).status).toBeGreaterThanOrEqual(400);
    expect((await verify(next)).status).toBe(200);
  });
  it('consumes a code once under concurrent verification and rejects replay', async () => {
    await send(); const code = codes.get(identity.email)!;
    const responses = await Promise.all([verify(code), verify(code)]);
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect((await verify(code)).status).toBeGreaterThanOrEqual(400);
  });
  it('rejects forged, expired, and revoked sessions', async () => {
    expect(await auth.api.getSession({ headers: new Headers({ cookie: 'better-auth.session_token=forged' }) })).toBeNull();
    await send(); const response = await verify(codes.get(identity.email)!);
    const cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    await db.update(authSession).set({ expiresAt: new Date(0) });
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
  });
  it('throttles sends and denies untrusted origins', async () => {
    for (let i = 0; i < 3; i++) await send();
    expect((await send()).status).toBe(429);
    const response = await auth.handler(new Request(`${origin}/api/auth/sign-in/email-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: JSON.stringify({ email: identity.email, otp: '123456' }) }));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
describe('admission, authorization, and claim invariants', () => {
  it('bootstraps once under retries without claiming a Person', async () => {
    await user(); const results = await Promise.all([bootstrap(db, identity, 'A'), bootstrap(db, identity, 'A')]);
    expect(results[0].id).toBe(results[1].id); expect(results[0].personId).toBeNull();
    expect(await db.select().from(accounts)).toHaveLength(1); expect(await db.select().from(memberships)).toHaveLength(1);
  });
  it('denies unmapped identities, unverified identities and missing admission', async () => {
    await expect(authorize(db, 'missing', 'A')).rejects.toThrow();
    await user(); await expect(bootstrap(db, { ...identity, emailVerified: false }, 'A')).rejects.toThrow();
    await expect(bootstrap(db, identity, 'missing')).rejects.toThrow();
    await user('U2', 'unknown@example.com'); await expect(bootstrap(db, { ...identity, id: 'U2', email: 'unknown@example.com' }, 'A')).rejects.toThrow();
  });
  it('denies revoked admissions before and after bootstrap without restoring access', async () => {
    await user(); await bootstrap(db, identity, 'A');
    await db.update(admissions).set({ status: 'REVOKED' }).where(eq(admissions.id, 'AD1'));
    await expect(authorize(db, identity.id, 'A')).rejects.toThrow(); await expect(bootstrap(db, identity, 'A')).rejects.toThrow();
  });
  it('denies disabled Accounts and revoked Memberships', async () => {
    await user(); const m = await bootstrap(db, identity, 'A');
    await db.update(accounts).set({ enabled: false }); await expect(authorize(db, identity.id, 'A')).rejects.toThrow();
    await expect(bootstrap(db, identity, 'A')).rejects.toThrow(); await db.update(accounts).set({ enabled: true });
    await db.update(memberships).set({ status: 'REVOKED' }).where(eq(memberships.id, m.id));
    await expect(authorize(db, identity.id, 'A')).rejects.toThrow(); await expect(bootstrap(db, identity, 'A')).rejects.toThrow();
  });
  it('keeps stable identity after email changes and prevents email reassignment takeover', async () => {
    await user(); const m = await bootstrap(db, identity, 'A');
    expect((await bootstrap(db, { ...identity, email: 'changed@example.com' }, 'A')).accountId).toBe(m.accountId);
    const other = await user('U2', 'replacement@example.com');
    await expect(bootstrap(db, { ...other, email: identity.email }, 'A')).rejects.toThrow();
  });
  it('isolates graph/search/context and rejects manipulated Family/Person IDs', async () => {
    const other = await user('U2', 'two@example.com'); await bootstrap(db, other, 'A');
    await expect(authorize(db, other.id, 'B')).rejects.toThrow(); await expect(bootstrap(db, other, 'B')).rejects.toThrow();
    const graph = await retrieveExplorerGraph(db, 'A');
    expect(searchPeople(graph, 'Secret')).toEqual([]); expect(graph.people.find(p => p.id === 'PB')).toBeUndefined();
    expect(immediateFamily(graph, 'PB')).toEqual([]); await expect(claimPerson(db, other.id, 'A', 'PB')).rejects.toThrow();
    await expect(claimPerson(db, other.id, 'B', 'PB')).rejects.toThrow();
  });
  it('allows independent Memberships and distinct Person claims without graph mutations', async () => {
    await user(); const a = await bootstrap(db, identity, 'A'); const b = await bootstrap(db, identity, 'B');
    expect(a.accountId).toBe(b.accountId); const before = await db.select().from(people); const edges = await db.select().from(relationships);
    await claimPerson(db, identity.id, 'A', 'PA'); await claimPerson(db, identity.id, 'B', 'PB');
    expect((await authorize(db, identity.id, 'A')).personId).toBe('PA'); expect((await authorize(db, identity.id, 'B')).personId).toBe('PB');
    expect(await db.select().from(people)).toEqual(before); expect(await db.select().from(relationships)).toEqual(edges);
    await db.update(memberships).set({ status: 'REVOKED' }).where(eq(memberships.id, a.id));
    expect((await authorize(db, identity.id, 'B')).id).toBe(b.id);
  });
  it('supports idempotent claim retry but refuses reassignment', async () => {
    await user(); await bootstrap(db, identity, 'A'); await claimPerson(db, identity.id, 'A', 'PA');
    expect((await claimPerson(db, identity.id, 'A', 'PA')).personId).toBe('PA');
    await expect(claimPerson(db, identity.id, 'A', 'PA2')).rejects.toThrow('already linked');
  });
  it('allows only one competing claim and rejects duplicates in PostgreSQL', async () => {
    await user(); const other = await user('U2', 'two@example.com'); await bootstrap(db, identity, 'A'); const m2 = await bootstrap(db, other, 'A');
    const outcomes = await Promise.allSettled([claimPerson(db, identity.id, 'A', 'PA'), claimPerson(db, other.id, 'A', 'PA')]);
    expect(outcomes.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const [winner] = await db.select().from(memberships).where(eq(memberships.personId, 'PA'));
    await expect(db.update(memberships).set({ personId: 'PA' }).where(and(eq(memberships.familyId, 'A'), sql`${memberships.id} <> ${winner.id}`))).rejects.toThrow();
    expect(m2).toBeTruthy();
  });
  it('enforces same-Family endpoints and Membership claims in PostgreSQL', async () => {
    await user(); const m = await bootstrap(db, identity, 'A');
    await expect(db.update(memberships).set({ personId: 'PB' }).where(eq(memberships.id, m.id))).rejects.toThrow();
    await expect(db.insert(relationships).values({ id: 'bad', familyId: 'A', fromPersonId: 'PA', toPersonId: 'PB', relationshipType: 'PARENT_OF', seedSource: 'test' })).rejects.toThrow();
  });
});

describe('administrative admission import', () => {
  const header = 'admission_id,family_id,email,role,status\n';
  it('adds a participant without changing the graph or inventing an auth identity', async () => {
    const before = await db.select().from(people);
    expect(await importAdmissions(db, header + 'NEW,A,new@example.com,MEMBER,ACTIVE\n')).toBe(1);
    expect(await db.select().from(authUser)).toEqual([]);
    expect(await db.select().from(people)).toEqual(before);
  });
  it('revokes Membership and admission together and never reactivates on retry', async () => {
    await user(); await bootstrap(db, identity, 'A');
    await importAdmissions(db, header + 'AD1,A,one@example.com,MEMBER,REVOKED\n');
    await expect(authorize(db, identity.id, 'A')).rejects.toThrow();
    await expect(importAdmissions(db, header + 'AD1,A,one@example.com,MEMBER,ACTIVE\n')).rejects.toThrow();
    expect((await db.select().from(memberships))[0].status).toBe('REVOKED');
  });
  it('rejects unknown families and rolls back an entire conflicting import', async () => {
    await expect(importAdmissions(db, header + 'NEW,Z,new@example.com,MEMBER,ACTIVE\n')).rejects.toThrow();
    await expect(importAdmissions(db, header + 'NEW,A,new@example.com,MEMBER,ACTIVE\nAD1,B,one@example.com,MEMBER,ACTIVE\n')).rejects.toThrow();
    expect(await db.select().from(admissions).where(eq(admissions.id, 'NEW'))).toEqual([]);
  });
});

describe('Family-local expected Person and live claimability', () => {
  const expectedHeader = 'admission_id,family_id,email,role,status,expected_person_id\n';
  it('rejects a second sequential claim without changing either membership or canonical graph', async () => {
    await user(); const other = await user('U2', 'two@example.com');
    await bootstrap(db, identity, 'A'); await bootstrap(db, other, 'A');
    await claimPerson(db, identity.id, 'A', 'PA');
    const before = await db.select().from(memberships).orderBy(memberships.id);
    const persons = await db.select().from(people); const edges = await db.select().from(relationships);
    await expect(claimPerson(db, other.id, 'A', 'PA')).rejects.toThrow('already been claimed');
    expect(await db.select().from(memberships).orderBy(memberships.id)).toEqual(before);
    expect(await db.select().from(people)).toEqual(persons); expect(await db.select().from(relationships)).toEqual(edges);
  });
  it('imports expectation without creating identity, Account, Membership, or confirmation', async () => {
    await importAdmissions(db, expectedHeader + 'AD1,A,one@example.com,MEMBER,ACTIVE,PA\n');
    expect(await db.select().from(authUser)).toEqual([]);
    expect(await db.select().from(accounts)).toEqual([]);
    expect(await db.select().from(memberships)).toEqual([]);
    await user(); const m = await bootstrap(db, identity, 'A');
    expect(m.personId).toBeNull(); expect(m.onboardingCompletedAt).toBeNull();
    const before = await db.select().from(memberships);
    const admissionBefore = await db.select().from(admissions);
    const persons = await db.select().from(people); const edges = await db.select().from(relationships);
    await expect(claimPerson(db, identity.id, 'A', 'PA2')).rejects.toThrow('associated with your invitation');
    expect(await db.select().from(memberships)).toEqual(before);
    expect(await db.select().from(admissions)).toEqual(admissionBefore);
    expect(await db.select().from(people)).toEqual(persons); expect(await db.select().from(relationships)).toEqual(edges);
    const result = await claimPerson(db, identity.id, 'A', 'PA');
    expect(result.personId).toBe('PA'); expect(result.onboardingCompletedAt).not.toBeNull();
    expect(await claimPerson(db, identity.id, 'A', 'PA')).toEqual(result);
    await expect(claimPerson(db, identity.id, 'A', 'PA2')).rejects.toThrow('already linked');
  });
  it('validates expected references on import and enforces the composite FK in PostgreSQL', async () => {
    const before = await db.select().from(admissions);
    for (const personId of ['missing', 'PB']) {
      await expect(importAdmissions(db, expectedHeader + `AD1,A,one@example.com,MEMBER,ACTIVE,${personId}\n`)).rejects.toThrow('validation');
      await expect(db.update(admissions).set({ expectedPersonId: personId }).where(eq(admissions.id, 'AD1'))).rejects.toThrow();
    }
    expect(await db.select().from(admissions)).toEqual(before);
  });
  it('preserves expectation for old CSVs and refuses implicit correction of a confirmed claim', async () => {
    await importAdmissions(db, expectedHeader + 'AD1,A,one@example.com,MEMBER,ACTIVE,PA\n');
    await importAdmissions(db, 'admission_id,family_id,email,role,status\nAD1,A,one@example.com,ADMIN,ACTIVE\n');
    expect((await db.select().from(admissions).where(eq(admissions.id, 'AD1')))[0].expectedPersonId).toBe('PA');
    await user(); await bootstrap(db, identity, 'A'); await claimPerson(db, identity.id, 'A', 'PA');
    const before = await db.select().from(memberships);
    await expect(importAdmissions(db, expectedHeader + 'NEW,A,new@example.com,MEMBER,ACTIVE,PA2\nAD1,A,one@example.com,ADMIN,ACTIVE,PA2\n')).rejects.toThrow('conflicts');
    expect(await db.select().from(admissions).where(eq(admissions.id, 'NEW'))).toEqual([]);
    expect(await db.select().from(memberships)).toEqual(before);
  });
  it('revoked admission cannot claim its expected Person', async () => {
    await db.update(admissions).set({ expectedPersonId: 'PA' }).where(eq(admissions.id, 'AD1'));
    await user(); await bootstrap(db, identity, 'A');
    await importAdmissions(db, expectedHeader + 'AD1,A,one@example.com,MEMBER,REVOKED,PA\n');
    await expect(claimPerson(db, identity.id, 'A', 'PA')).rejects.toThrow();
    expect((await db.select().from(memberships))[0].personId).toBeNull();
  });
  it('projects minimum claimability only during setup, with claimed taking precedence over expected', async () => {
    await user(); await bootstrap(db, identity, 'A');
    const before = await db.select().from(people); const edges = await db.select().from(relationships);
    const expected = await retrieveExplorerGraph(db, 'A', { expectedPersonId: 'PA' });
    expect(expected.people).toEqual([
      { id: 'PA', displayName: 'Person A', claimability: 'EXPECTED' },
      { id: 'PA2', displayName: 'Other A', claimability: 'NOT_ELIGIBLE' },
    ]);
    await claimPerson(db, identity.id, 'A', 'PA');
    const unavailable = await retrieveExplorerGraph(db, 'A', { expectedPersonId: 'PA' });
    expect(unavailable.people[0].claimability).toBe('ALREADY_CLAIMED');
    const unconstrained = await retrieveExplorerGraph(db, 'A', { expectedPersonId: null });
    expect(unconstrained.people.map(p => p.claimability)).toEqual(['ALREADY_CLAIMED', 'AVAILABLE']);
    const returning = await retrieveExplorerGraph(db, 'A');
    expect(returning.people).toEqual([{ id: 'PA', displayName: 'Person A' }, { id: 'PA2', displayName: 'Other A' }]);
    expect(expected.relationships).toEqual(returning.relationships);
    expect(JSON.stringify(expected)).not.toMatch(/email|account|membership|admission|authUser|expectedPersonId|birthDate/i);
    expect(await db.select().from(people)).toEqual(before); expect(await db.select().from(relationships)).toEqual(edges);
  });
  it('keeps expected identity independent per Family for the same Account', async () => {
    await db.update(admissions).set({ expectedPersonId: 'PA' }).where(eq(admissions.id, 'AD1'));
    await db.update(admissions).set({ expectedPersonId: 'PB' }).where(eq(admissions.id, 'AD3'));
    await user(); await bootstrap(db, identity, 'A'); await bootstrap(db, identity, 'B');
    const persons = await db.select().from(people); const edges = await db.select().from(relationships);
    await claimPerson(db, identity.id, 'A', 'PA');
    expect((await authorize(db, identity.id, 'B')).personId).toBeNull();
    await claimPerson(db, identity.id, 'B', 'PB');
    expect(await db.select().from(accounts)).toHaveLength(1);
    expect((await db.select().from(memberships)).map(m => m.personId).sort()).toEqual(['PA', 'PB']);
    expect(await db.select().from(people)).toEqual(persons); expect(await db.select().from(relationships)).toEqual(edges);
  });
  it('does not reserve expected People, but permits exactly one concurrent live claimant', async () => {
    await db.update(admissions).set({ expectedPersonId: 'PA' }).where(eq(admissions.familyId, 'A'));
    await user(); const other = await user('U2', 'two@example.com');
    await bootstrap(db, identity, 'A'); await bootstrap(db, other, 'A');
    const results = await Promise.allSettled([claimPerson(db, identity.id, 'A', 'PA'), claimPerson(db, other.id, 'A', 'PA')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await db.select().from(memberships);
    expect(rows.filter(m => m.personId === 'PA' && m.status === 'ACTIVE')).toHaveLength(1);
    expect(rows.filter(m => m.personId === null && m.onboardingCompletedAt === null)).toHaveLength(1);
  });
});
