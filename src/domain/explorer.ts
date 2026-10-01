import type { FamilyGraph, Person, Relationship } from './model';

// Explicit display allowlist. No DOB, Member association, notes or source metadata.
export type ExplorerPerson = Readonly<Pick<Person, 'id' | 'displayName'>>;
export type ExplorerRelationship = Readonly<Pick<Relationship,
  'id' | 'fromPersonId' | 'toPersonId' | 'relationshipType' | 'status'>>;
export interface ExplorerGraph {
  readonly people: readonly ExplorerPerson[];
  readonly relationships: readonly ExplorerRelationship[];
}
export function toExplorerGraph(graph: ExplorerGraph | FamilyGraph): ExplorerGraph {
  return {
    people: graph.people.map(p => ({ id: p.id, displayName: p.displayName })),
    relationships: graph.relationships.map(r => ({ id: r.id, fromPersonId: r.fromPersonId,
      toPersonId: r.toPersonId, relationshipType: r.relationshipType, status: r.status })),
  };
}
export function immediateFamily(graph: ExplorerGraph, personId: string) {
  const byId = new Map(graph.people.map(p => [p.id, p]));
  return graph.relationships.flatMap(r => {
    const outgoing = r.fromPersonId === personId;
    if (!outgoing && r.toPersonId !== personId) return [];
    const person = byId.get(outgoing ? r.toPersonId : r.fromPersonId);
    if (!person) return [];
    const label = r.relationshipType === 'PARENT_OF' ? (outgoing ? 'Child' : 'Parent')
      : r.relationshipType === 'SPOUSE_OF' ? 'Spouse / Partner' : 'Sibling';
    return [{ person, label, relationshipId: r.id, status: r.status }];
  }).sort((a, b) => a.label.localeCompare(b.label) || a.person.displayName.localeCompare(b.person.displayName) || a.person.id.localeCompare(b.person.id));
}
export function searchPeople(graph: ExplorerGraph, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return graph.people.filter(p => p.displayName.toLocaleLowerCase().includes(normalized))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}
export function personContext(graph: ExplorerGraph, personId: string) {
  const relatives = immediateFamily(graph, personId);
  return relatives.length ? relatives.map(r => `${r.label}: ${r.person.displayName}`).join(' · ') : 'No relationships recorded';
}
