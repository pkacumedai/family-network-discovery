import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectDatabase } from '../src/server/db/connection';
import { importAdmissions } from '../src/server/seed/admissions';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error();
  const { db, pool } = connectDatabase(process.env.DATABASE_URL);
  try {
    const count = await importAdmissions(db, await readFile(resolve(process.env.SEED_DIR ?? 'seed/fixtures', 'admissions.csv'), 'utf8'));
    console.log(`Admissions processed: ${count}`);
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Admission import failed; no changes committed. Check file validation, stable IDs, family references and revocation rules.'); process.exitCode = 1; });
