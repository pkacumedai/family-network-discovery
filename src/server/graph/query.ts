import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { people, relationships, memberships } from '../db/schema';
import { toExplorerGraph, type ExplorerGraph } from '../../domain/explorer';

// Internal query entry point for the service and database tests; never a browser API.
export async function retrieveExplorerGraph(db: Database, familyId: string, setup?: { expectedPersonId: string | null }): Promise<ExplorerGraph> {
  return db.transaction(async tx => {
    const personRows = await tx.select({ id: people.id, displayName: people.displayName })
      .from(people).where(eq(people.familyId, familyId)).orderBy(people.id);
    const relationshipRows = await tx.select({ id: relationships.id,
      fromPersonId: relationships.fromPersonId, toPersonId: relationships.toPersonId,
      relationshipType: relationships.relationshipType, status: relationships.status,
    }).from(relationships).where(eq(relationships.familyId, familyId)).orderBy(relationships.id);
    const graph = toExplorerGraph({ people: personRows, relationships: relationshipRows });
    if (!setup) return graph;
    const claims = await tx.select({ personId: memberships.personId }).from(memberships)
      .where(and(eq(memberships.familyId, familyId), eq(memberships.status, 'ACTIVE')));
    const claimed = new Set(claims.map(m => m.personId));
    // Presentation-only authorization hint. Claim POST rechecks current database state.
    return { ...graph, people: graph.people.map(person => ({ ...person,
      claimability: claimed.has(person.id) ? 'ALREADY_CLAIMED' as const
        : setup.expectedPersonId === person.id ? 'EXPECTED' as const
        : setup.expectedPersonId ? 'NOT_ELIGIBLE' as const : 'AVAILABLE' as const,
    })) };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
