import 'server-only';
import { connectDatabase } from './connection';
let connection: ReturnType<typeof connectDatabase> | undefined;
export function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  connection ??= connectDatabase(url);
  return connection.db;
}
