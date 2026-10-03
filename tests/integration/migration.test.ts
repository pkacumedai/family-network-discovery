import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { it, expect } from 'vitest';
it('migrates populated original Member/graph history without creating auth identities or claiming People', async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Disposable database required');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA migration_probe');
    await client.query('SET LOCAL search_path TO migration_probe');
    const apply = async (file: string) => {
      const text = (await readFile(file, 'utf8')).replaceAll('"public".', '"migration_probe".');
      for (const statement of text.split('--> statement-breakpoint')) if (statement.trim()) await client.query(statement);
    };
    await apply('drizzle/0000_petite_princess_powerful.sql');
    await apply('drizzle/0001_updated_at_triggers.sql');
    await client.query("INSERT INTO people (id,display_name,birth_date) VALUES ('P1','One','1978-02-14'),('P2','Two',NULL)");
    await client.query("INSERT INTO members (id,display_name,email,linked_person_id,onboarding_state,status,joined_at) VALUES ('M1','One','one@example.com','P1','COMPLETED','JOINED','2026-09-01')");
    await client.query("INSERT INTO relationships (id,from_person_id,to_person_id,relationship_type,created_by_member_id) VALUES ('R1','P1','P2','PARENT_OF','M1')");
    await client.query("INSERT INTO events (id,member_id,event_type,related_person_id) VALUES ('E1','M1','identity_claimed','P1')");
    await apply('drizzle/0002_yummy_sharon_carter.sql');
    expect((await client.query('SELECT id, family_id, birth_date::text FROM people ORDER BY id')).rows).toEqual([
      { id: 'P1', family_id: 'sample-family', birth_date: '1978-02-14' }, { id: 'P2', family_id: 'sample-family', birth_date: null },
    ]);
    expect((await client.query('SELECT id,linked_person_id,status,onboarding_state FROM legacy_member_records')).rows[0]).toEqual({ id: 'M1', linked_person_id: 'P1', status: 'JOINED', onboarding_state: 'COMPLETED' });
    expect((await client.query('SELECT created_by_member_id, family_id FROM relationships')).rows[0]).toEqual({ created_by_member_id: 'M1', family_id: 'sample-family' });
    expect((await client.query('SELECT member_id,family_id FROM events')).rows[0]).toEqual({ member_id: 'M1', family_id: 'sample-family' });
    expect((await client.query('SELECT id,legacy_member_id,status,bound_account_id FROM family_admissions')).rows[0]).toEqual({ id: 'M1', legacy_member_id: 'M1', status: 'ACTIVE', bound_account_id: null });
    for (const table of ['auth_user', 'app_accounts', 'memberships']) expect((await client.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(0);
    await client.query("INSERT INTO auth_user (id,name,email,email_verified) VALUES ('U1','One','one@example.com',true)");
    await client.query("INSERT INTO app_accounts (id,auth_user_id) VALUES ('A1','U1')");
    await client.query("UPDATE family_admissions SET bound_account_id='A1' WHERE id='M1'");
    await client.query("INSERT INTO memberships (id,account_id,family_id,admission_id,person_id,onboarding_completed_at) VALUES ('LIVE1','A1','sample-family','M1','P1',now())");
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ['people', 'relationships', 'legacy_member_records', 'memberships', 'app_accounts', 'auth_user', 'events']) {
        result[table] = (await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
      }
      return result;
    };
    const before = await snapshot();
    await apply('drizzle/0003_mixed_kinsey_walden.sql');
    expect(await snapshot()).toEqual(before);
    expect((await client.query('SELECT expected_person_id FROM family_admissions')).rows).toEqual([{ expected_person_id: null }]);
    expect((await client.query("SELECT indexdef FROM pg_indexes WHERE schemaname='migration_probe' AND indexname='membership_active_person_unique'")).rows[0].indexdef).toContain('UNIQUE INDEX');
  } finally { await client.query('ROLLBACK'); client.release(); await pool.end(); }
});
