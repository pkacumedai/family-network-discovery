// CLI/test entry point. Application code must import ./index (server-only).
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export function connectDatabase(url: string) {
  const pool = new Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
export type Database = ReturnType<typeof connectDatabase>['db'];
