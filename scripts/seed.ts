import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSeed } from '../src/server/seed/validate';
import { assertDevelopmentReset, importSeed } from '../src/server/seed/import';
import { connectDatabase } from '../src/server/db/connection';

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  if (!['validate', 'import'].includes(command) || flags.some(f => f !== '--reset-development') || (command === 'validate' && flags.length)) {
    throw new Error('Use seed:validate or seed [-- --reset-development]');
  }
  const directory = resolve(process.env.SEED_DIR ?? 'seed/fixtures');
  const files = {
    people: await readFile(resolve(directory, 'people.csv'), 'utf8'),
    relationships: await readFile(resolve(directory, 'relationships.csv'), 'utf8'),
    members: await readFile(resolve(directory, 'members.csv'), 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return undefined; throw e; }),
  };
  const report = validateSeed(files);
  console.log(JSON.stringify({ people: report.data.people.length, relationships: report.data.relationships.length,
    members: report.data.members.length, components: report.components, errors: report.errors, warnings: report.warnings }, null, 2));
  if (report.errors.length) { process.exitCode = 1; return; }
  if (command === 'validate') return;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const reset = flags.includes('--reset-development');
  if (reset) assertDevelopmentReset(url, process.env.NODE_ENV);
  const { db, pool } = connectDatabase(url);
  try { console.log(JSON.stringify(await importSeed(db, files, process.env.SEED_SOURCE ?? (directory === resolve('seed/fixtures') ? 'synthetic-development-v1' : ''), reset))); }
  finally { await pool.end(); }
}
main().catch(() => {
  // PostgreSQL/CSV errors can include private row values and connection details.
  console.error('Seed operation failed. Check validation, file access, DATABASE_URL, reset eligibility, and database emptiness. No import committed.');
  process.exitCode = 1;
});
