import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connectDatabase } from '../src/server/db/connection';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const { db, pool } = connectDatabase(url);
try { await migrate(db, { migrationsFolder: './drizzle' }); console.log('Migrations applied.'); }
catch { console.error('Migration failed. Check database connectivity and migration state.'); process.exitCode = 1; }
finally { await pool.end(); }
