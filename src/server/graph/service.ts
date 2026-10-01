import 'server-only';
import { getDatabase } from '../db';
import { localExplorerEnabled } from './access';
import { retrieveExplorerGraph } from './query';
export async function getExplorerGraph() {
  if (!localExplorerEnabled(process.env)) throw new Error('Local explorer is disabled');
  return retrieveExplorerGraph(getDatabase());
}
