import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { connectDatabase } from '../../src/server/db/connection';
import { people, relationships, legacyMembers as members, profilePrivacy } from '../../src/server/db/schema';
import { importSeed } from '../../src/server/seed/import';
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Dedicated test database required');
  const { db, pool } = connectDatabase(url);
  const snapshot = async () => Promise.all([
    db.select().from(people).orderBy(people.id), db.select().from(relationships).orderBy(relationships.id),
    db.select().from(members).orderBy(members.id), db.select().from(profilePrivacy).orderBy(profilePrivacy.personId),
  ]);
  let before: Awaited<ReturnType<typeof snapshot>>;
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    await db.execute(sql`TRUNCATE events, profile_privacy, relationships, legacy_member_records, people, families, app_accounts, auth_user, auth_verification, auth_rate_limit CASCADE`);
    const read = (name: string) => readFile(`seed/fixtures/${name}.csv`, 'utf8');
    await importSeed(db, { people: await read('people'), relationships: await read('relationships'), members: await read('members'), families: await read('families'), admissions: await read('admissions') }, 'browser-synthetic-fixture');
    before = await snapshot();
  } catch (error) { await pool.end(); throw error; }
  return async () => {
    try { if (!isDeepStrictEqual(await snapshot(), before)) throw new Error('Browser interactions changed canonical database records'); }
    finally { await pool.end(); }
  };
}
