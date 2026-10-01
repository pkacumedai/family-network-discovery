import type { ExplorerGraph } from '../../domain/explorer';
import type { LayoutState } from './types';

/** Best-effort ranks only: group symmetric peers, condense parent cycles, rank the DAG.
 * All maps are local presentation calculations. No generated family edges or domain writes.
 */
export function generationalPositions(graph: ExplorerGraph): LayoutState['positions'] {
  const ids = graph.people.map(p => p.id).toSorted();
  const groups = new Map(ids.map(id => [id, id]));
  const root = (id: string): string => {
    let current = id;
    while (groups.get(current) !== current) current = groups.get(current)!;
    return current;
  };
  for (const r of graph.relationships) {
    if (r.relationshipType === 'PARENT_OF' || !groups.has(r.fromPersonId) || !groups.has(r.toPersonId)) continue;
    const a = root(r.fromPersonId), b = root(r.toPersonId);
    groups.set(a < b ? b : a, a < b ? a : b);
  }
  const vertices = [...new Set(ids.map(root))].sort();
  const children = new Map(vertices.map(id => [id, new Set<string>()]));
  for (const r of graph.relationships) {
    if (r.relationshipType === 'PARENT_OF' && groups.has(r.fromPersonId) && groups.has(r.toPersonId)) {
      const a = root(r.fromPersonId), b = root(r.toPersonId);
      if (a !== b) children.get(a)!.add(b);
    }
  }
  // Reachability gives strongly connected components for these small pilot graphs.
  const reachable = new Map(vertices.map(id => {
    const seen = new Set<string>(), pending = [id];
    while (pending.length) {
      const next = pending.pop()!;
      if (seen.has(next)) continue;
      seen.add(next); pending.push(...children.get(next)!);
    }
    return [id, seen] as const;
  }));
  const component = new Map(vertices.map(id => [id, vertices.find(v => reachable.get(id)!.has(v) && reachable.get(v)!.has(id))!]));
  const parents = new Map([...new Set(component.values())].map(id => [id, new Set<string>()]));
  for (const [a, targets] of children) for (const b of targets) {
    if (component.get(a) !== component.get(b)) parents.get(component.get(b)!)!.add(component.get(a)!);
  }
  const ranks = new Map<string, number>();
  const rank = (id: string): number => {
    if (!ranks.has(id)) ranks.set(id, Math.max(0, ...[...parents.get(id)!].map(p => rank(p) + 1)));
    return ranks.get(id)!;
  };
  const rows = new Map<number, string[]>();
  for (const id of ids) {
    const level = rank(component.get(root(id))!);
    rows.set(level, [...(rows.get(level) ?? []), id]);
  }
  return Object.fromEntries([...rows].flatMap(([level, row]) => row.map((id, index) =>
    [id, { x: (index - (row.length - 1) / 2) * 270, y: level * 185 }])));
}
