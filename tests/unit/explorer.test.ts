import { describe, expect, it, vi } from 'vitest';
import cytoscape from 'cytoscape';
import { toExplorerGraph, immediateFamily, searchPeople, personContext, type ExplorerGraph } from '../../src/domain/explorer';
import type { FamilyGraph } from '../../src/domain/model';
import { generationalPositions } from '../../src/components/graph/layouts';
import { toElements, applyPositions, applySelection, layoutPositions, nodeId, edgeAppearance, graphStyles, resetLayout } from '../../src/components/graph/adapter';
import { localExplorerEnabled } from '../../src/server/graph/access';
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const graph: ExplorerGraph = {
  people: [{ id: 'A', displayName: 'Sam Example' }, { id: 'B', displayName: 'Robin Example' },
    { id: 'C', displayName: 'Sam Example' }, { id: 'D', displayName: 'Isolated' }],
  relationships: [
    { id: 'A', fromPersonId: 'A', toPersonId: 'B', relationshipType: 'PARENT_OF', status: 'SEEDED' },
    { id: 'S', fromPersonId: 'B', toPersonId: 'C', relationshipType: 'SPOUSE_OF', status: 'SEEDED' },
  ],
};
describe('explorer domain', () => {
  it('whitelists fields even when a full canonical graph is supplied', () => {
    const canonical = {
      people: graph.people.map(p => ({ ...p, familyId: 'sample-family', birthDate: '1978-02-14', notes: 'private', nickname: 'secret', isLiving: true,
        createdAt: new Date(), updatedAt: new Date(), createdByMemberId: 'M1' })),
      relationships: graph.relationships.map(r => ({ ...r, familyId: 'sample-family', seedSource: 'private-source', createdAt: new Date(), updatedAt: new Date(), createdByMemberId: null })),
    } satisfies FamilyGraph;
    const before = structuredClone(canonical); freeze(canonical);
    const dto = toExplorerGraph(canonical);
    expect(dto).toEqual(graph);
    for (const strategy of ['generational', 'network'] as const) {
      const positions = layoutPositions(dto, strategy);
      const cy = cytoscape({ headless: true, elements: toElements(dto) });
      applyPositions(cy, positions); applySelection(cy, 'A');
      cy.getElementById(nodeId('A')).position({ x: 999, y: 333 });
      cy.getElementById(nodeId('A')).data('label', 'Renderer-only edit');
      cy.destroy();
    }
    expect(canonical).toEqual(before);
    expect(dto).toEqual(graph);
  });
  it('searches partially without merging duplicate names', () => {
    expect(searchPeople(graph, ' sAM ')).toHaveLength(2);
    expect(personContext(graph, 'A')).toBe('Child: Robin Example');
    expect(personContext(graph, 'C')).toBe('Spouse / Partner: Robin Example');
    expect(searchPeople(graph, 'missing')).toEqual([]);
    expect(searchPeople(graph, '')).toHaveLength(4);
  });
  it('uses correct parent/child direction and symmetric spouse/sibling context', () => {
    const sibling: ExplorerGraph = { ...graph, relationships: [...graph.relationships,
      { id: 'sibling', fromPersonId: 'A', toPersonId: 'C', relationshipType: 'SIBLING_OF', status: 'UNVERIFIED' }] };
    expect(immediateFamily(sibling, 'B').map(r => r.label)).toEqual(['Parent', 'Spouse / Partner']);
    expect(immediateFamily(sibling, 'C').map(r => r.label)).toContain('Sibling');
    expect(immediateFamily(sibling, 'A').map(r => r.label)).toContain('Sibling');
    expect(immediateFamily(sibling, 'D')).toEqual([]);
  });
});
describe('presentation projections', () => {
  it('places parents above children and peers together without mutating inputs', () => {
    const copy = freeze(structuredClone(graph));
    const positions = generationalPositions(copy);
    expect(positions.A.y).toBeLessThan(positions.B.y);
    expect(positions.B.y).toBe(positions.C.y);
    expect(new Set(Object.values(positions).map(p => JSON.stringify(p))).size).toBe(4);
    expect(copy).toEqual(graph);
    expect(generationalPositions({ ...copy, people: [...copy.people].reverse() })).toEqual(positions);
  });
  it('handles cycles, disconnected nodes, multiple parents, and empty graphs', () => {
    const cyclic = { ...graph, relationships: [...graph.relationships,
      { id: 'cycle', fromPersonId: 'B', toPersonId: 'A', relationshipType: 'PARENT_OF' as const, status: 'SEEDED' as const },
      { id: 'other', fromPersonId: 'D', toPersonId: 'C', relationshipType: 'PARENT_OF' as const, status: 'SEEDED' as const }] };
    for (const strategy of ['generational', 'network'] as const) {
      const positions = layoutPositions(freeze(cyclic), strategy);
      expect(Object.keys(positions)).toHaveLength(4);
      expect(Object.values(positions).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      expect(layoutPositions({ people: [], relationships: [] }, strategy)).toEqual({});
    }
  });
  it('keeps Person/Relationship IDs distinct and styles types with more than color', () => {
    const cy = cytoscape({ headless: true, styleEnabled: true, style: graphStyles, elements: toElements(graph) });
    expect(cy.nodes()).toHaveLength(4); expect(cy.edges()).toHaveLength(2);
    expect(cy.getElementById('relationship:A').style('target-arrow-shape')).toBe('triangle');
    expect(cy.getElementById('relationship:S').style('line-style')).toBe('dashed');
    expect(edgeAppearance.SIBLING_OF.line).toBe('dotted');
    cy.add({ data: { id: 'sibling-test', source: nodeId('A'), target: nodeId('C'), type: 'SIBLING_OF', label: 'Sibling' } });
    expect(cy.getElementById('sibling-test').style('line-style')).toBe('dotted');
    expect(cy.getElementById('sibling-test').style('target-arrow-shape')).toBe('none');
    expect(new Set(Object.values(edgeAppearance).map(s => s.label)).size).toBe(3);
    applySelection(cy, 'A');
    expect(cy.$('node:selected').data('personId')).toBe('A');
    expect(cy.getElementById(nodeId('B')).hasClass('neighbor')).toBe(true);
    expect(cy.getElementById(nodeId('D')).hasClass('muted')).toBe(true);
    applySelection(cy, null);
    expect(cy.$('.muted')).toHaveLength(0); expect(cy.$(':selected')).toHaveLength(0);
    cy.destroy();
  });
});
it('fails closed outside explicitly enabled development', () => {
  expect(localExplorerEnabled({ NODE_ENV: 'development', ENABLE_LOCAL_EXPLORER: 'true' })).toBe(true);
  for (const NODE_ENV of ['production', 'test', undefined]) expect(localExplorerEnabled({ NODE_ENV, ENABLE_LOCAL_EXPLORER: 'true' })).toBe(false);
  expect(localExplorerEnabled({ NODE_ENV: 'development' })).toBe(false);
});

describe('reset layout', () => {
  it.each(['generational', 'network'] as const)('restores %s only, fits, and preserves selection and canonical records', strategy => {
    const canonical = freeze({
      people: graph.people.map(p => ({ ...p, familyId: 'sample-family', birthDate: '1978-02-14', nickname: null, isLiving: true,
        createdAt: new Date(), updatedAt: new Date(), createdByMemberId: 'M1' })),
      relationships: graph.relationships.map(r => ({ ...r, familyId: 'sample-family', seedSource: 'original-source',
        createdAt: new Date(), updatedAt: new Date(), createdByMemberId: null })),
    } satisfies FamilyGraph);
    const before = structuredClone(canonical);
    const manual = (offset: number) => Object.fromEntries(graph.people.map((p, i) => [p.id, { x: offset + i * 300, y: 9999 }]));
    const cached = freeze({ generational: manual(1000), network: manual(2000) });
    const other = strategy === 'generational' ? 'network' : 'generational';
    // CoSE can use random tie-breaking even with randomize:false. Control it only in this test.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    const expected = layoutPositions(canonical, strategy);
    const cy = cytoscape({ headless: true, elements: toElements(canonical) });
    try {
      applyPositions(cy, cached[strategy]); applySelection(cy, 'A');
      const fit = vi.spyOn(cy, 'fit');
      const restored = resetLayout(cy, canonical, strategy, cached);
      expect(restored[strategy]).toEqual(expected);
      expect(restored[strategy]).not.toEqual(cached[strategy]);
      expect(restored[other]).toBe(cached[other]);
      expect(Object.fromEntries(cy.nodes().map(n => [n.data('personId'), n.position()]))).toEqual(expected);
      expect(fit).toHaveBeenCalledWith(undefined, 65);
      expect(cy.$('node:selected').data('personId')).toBe('A');
      expect(canonical).toEqual(before);
      // A second reset also recomputes; it never reuses a cached position object.
      const again = resetLayout(cy, canonical, strategy, restored);
      expect(again[strategy]).not.toBe(restored[strategy]);
      expect(again[other]).toBe(cached[other]);
    } finally { cy.destroy(); random.mockRestore(); }
  });
});
