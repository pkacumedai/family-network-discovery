import type { Database } from '../db/connection';
import { people, relationships } from '../db/schema';
import { toExplorerGraph, type ExplorerGraph } from '../../domain/explorer';

// Internal query entry point for the service and database tests; never a browser API.
export async function retrieveExplorerGraph(db: Database): Promise<ExplorerGraph> {
  return db.transaction(async tx => {
    const personRows = await tx.select({ id: people.id, displayName: people.displayName })
      .from(people).orderBy(people.id);
    const relationshipRows = await tx.select({ id: relationships.id,
      fromPersonId: relationships.fromPersonId, toPersonId: relationships.toPersonId,
      relationshipType: relationships.relationshipType, status: relationships.status,
    }).from(relationships).orderBy(relationships.id);
    return toExplorerGraph({ people: personRows, relationships: relationshipRows });
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
