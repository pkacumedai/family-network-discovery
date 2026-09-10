import 'dotenv/config';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { connectDatabase } from '../../src/server/db/connection';
import { people, members, relationships, profilePrivacy } from '../../src/server/db/schema';
import { importSeed } from '../../src/server/seed/import';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a dedicated database ending in _test');
const { db, pool } = connectDatabase(url);
const files = {
  people: 'person_id,display_name\nP1,One\nP2,Two\n',
  relationships: 'from_person_id,to_person_id,relationship_type\nP1,P2,SPOUSE_OF\n',
  members: 'member_key,display_name,email,person_id,onboarding_state\nM1,One,a@example.com,P1,PRELINKED\n',
};
beforeAll(async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await db.execute(sql`TRUNCATE events, profile_privacy, relationships, members, people CASCADE`); });
describe('PostgreSQL foundation', () => {
  it('applies migrations repeatedly', async () => { await migrate(db, { migrationsFolder: './drizzle' }); });
  it('imports explicit records, seed provenance and private defaults', async () => {
    expect(await importSeed(db, files, 'test-fixture')).toMatchObject({ people: 2, relationships: 1, members: 1 });
    expect((await db.select().from(relationships))[0]).toMatchObject({ seedSource: 'test-fixture', status: 'SEEDED', createdByMemberId: null });
    expect(await db.select().from(profilePrivacy)).toEqual(expect.arrayContaining([
      { personId: 'P1', shareBirthMonthDay: false, shareBirthYear: false },
    ]));
    expect((await db.select().from(members))[0]).toMatchObject({ linkedPersonId: 'P1', status: 'INVITED', joinedAt: null });
    await expect(importSeed(db, files, 'again')).rejects.toThrow('not empty');
    expect(await db.select().from(people)).toHaveLength(2);
  });
  it('rejects invalid seeds before any writes', async () => {
    await expect(importSeed(db, { ...files, relationships: files.relationships + 'P1,P1,PARENT_OF\n' }, 'test')).rejects.toThrow();
    expect(await db.select().from(people)).toHaveLength(0);
  });
  it('rolls back all writes if a database failure occurs after people are inserted', async () => {
    // A temporary constraint produces a real mid-import SQL error.
    await db.execute(sql`ALTER TABLE members ADD CONSTRAINT test_reject_members CHECK (false)`);
    try { await expect(importSeed(db, files, 'test')).rejects.toThrow(); }
    finally { await db.execute(sql`ALTER TABLE members DROP CONSTRAINT test_reject_members`); }
    expect(await db.select().from(people)).toHaveLength(0);
    expect(await db.select().from(relationships)).toHaveLength(0);
  });
  it('maintains update timestamps for direct SQL writes', async () => {
    await importSeed(db, files, 'test');
    await db.execute(sql`UPDATE people SET updated_at = '2000-01-01' WHERE id = 'P1'`);
    expect((await db.select().from(people)).find(p => p.id === 'P1')!.updatedAt.getUTCFullYear()).toBeGreaterThan(2000);
  });
  it('enforces unique identity links and case-insensitive logins', async () => {
    await importSeed(db, files, 'test');
    await expect(db.insert(members).values({ id: 'M2', displayName: 'Two', email: 'b@example.com', linkedPersonId: 'P1', onboardingState: 'PRELINKED' })).rejects.toThrow();
    await expect(db.insert(members).values({ id: 'M3', displayName: 'Three', email: 'A@example.com' })).rejects.toThrow();
    await db.insert(members).values({ id: 'M4', displayName: 'Four', email: 'd@example.com' });
  });
  it('enforces relationship self, symmetric duplicate, endpoint and provenance constraints', async () => {
    await importSeed(db, files, 'test');
    const edge = { id: 'R2', fromPersonId: 'P2', toPersonId: 'P1', relationshipType: 'SPOUSE_OF' as const, seedSource: 'test' };
    await expect(db.insert(relationships).values(edge)).rejects.toThrow();
    await expect(db.insert(relationships).values({ ...edge, toPersonId: 'P2' })).rejects.toThrow();
    await expect(db.insert(relationships).values({ ...edge, toPersonId: 'missing' })).rejects.toThrow();
    await expect(db.insert(relationships).values({ ...edge, relationshipType: 'PARENT_OF', seedSource: null })).rejects.toThrow();
    await db.insert(relationships).values({ ...edge, relationshipType: 'PARENT_OF', seedSource: null, createdByMemberId: 'M1' });
    expect((await db.select().from(relationships)).find(r => r.id === 'R2')?.status).toBe('UNVERIFIED');
  });
});
