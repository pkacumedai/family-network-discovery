import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from 'cytoscape';
import type { ExplorerGraph } from '../../domain/explorer';
import type { LayoutState } from './types';
import { generationalPositions } from './layouts';
export const nodeId = (id: string) => `person:${id}`;
export const edgeAppearance = {
  PARENT_OF: { label: 'Parent → Child', color: '#35695b', line: 'solid', arrow: 'triangle' },
  SPOUSE_OF: { label: 'Spouse / Partner', color: '#9c6842', line: 'dashed', arrow: 'none' },
  SIBLING_OF: { label: 'Sibling', color: '#6876a1', line: 'dotted', arrow: 'none' },
} as const;
export function toElements(graph: ExplorerGraph): ElementDefinition[] {
  return [
    ...graph.people.map(p => ({ data: { id: nodeId(p.id), personId: p.id, label: p.displayName } })),
    ...graph.relationships.map(r => ({ data: { id: `relationship:${r.id}`, relationshipId: r.id,
      source: nodeId(r.fromPersonId), target: nodeId(r.toPersonId), type: r.relationshipType,
      label: edgeAppearance[r.relationshipType].label } })),
  ];
}
export const graphStyles: StylesheetJson = [
  { selector: 'node', style: { label: 'data(label)', shape: 'round-rectangle', width: 166, height: 58,
    'background-color': '#fffefb', 'border-color': '#b7c8be', 'border-width': 1.5,
    color: '#273e35', 'font-family': 'system-ui', 'font-size': 13, 'font-weight': 500,
    'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': '146px' } },
  { selector: 'edge', style: { label: 'data(label)', width: 2, 'curve-style': 'bezier',
    'font-size': 10, 'text-background-color': '#f5f6ef', 'text-background-opacity': 1,
    'text-background-padding': '3px', 'text-rotation': 'autorotate', 'arrow-scale': 1.1 } },
  ...Object.entries(edgeAppearance).map(([type, style]) => ({ selector: `edge[type = "${type}"]`, style: {
    'line-color': style.color, 'target-arrow-color': style.color, color: style.color,
    'line-style': style.line, 'target-arrow-shape': style.arrow,
  } })),
  { selector: '.muted', style: { opacity: 0.24 } },
  { selector: '.neighbor', style: { 'border-color': '#35695b', 'border-width': 2.5 } },
  { selector: 'node:selected', style: { 'background-color': '#244f40', color: '#ffffff', 'border-color': '#163e2f', 'border-width': 3 } },
];
export function applySelection(cy: Core, personId: string | null, center = false) {
  cy.batch(() => {
    cy.elements().removeClass('muted neighbor'); cy.nodes().unselect();
    if (!personId) return;
    const node = cy.getElementById(nodeId(personId));
    if (node.empty()) return;
    node.select(); node.neighborhood('node').addClass('neighbor');
    cy.elements().difference(node.closedNeighborhood()).addClass('muted');
    if (center) { cy.zoom(Math.max(cy.zoom(), 0.9)); cy.center(node); }
  });
}
export function layoutPositions(graph: ExplorerGraph, strategy: LayoutState['strategy']): LayoutState['positions'] {
  const initial = generationalPositions(graph);
  if (strategy === 'generational' || !graph.people.length) return initial;
  // The force algorithm receives newly allocated elements, never canonical records.
  const cy = cytoscape({ headless: true, styleEnabled: true, style: graphStyles,
    elements: toElements(graph).map(e => e.data.personId ? { ...e, position: { ...initial[e.data.personId] } } : e) });
  try {
    cy.layout({ name: 'cose', animate: false, randomize: false, nodeRepulsion: () => 18000,
      idealEdgeLength: () => 150, componentSpacing: 100, nodeOverlap: 20, numIter: 600 }).run();
    return Object.fromEntries(cy.nodes().map(n => [n.data('personId'), { ...n.position() }]));
  } finally { cy.destroy(); }
}
export function applyPositions(cy: Core, positions: LayoutState['positions']) {
  cy.nodes().positions(n => ({ ...positions[n.data('personId')] }));
}

export type LayoutPositionsCache = Partial<Record<LayoutState['strategy'], LayoutState['positions']>>;

/** Replace only this layout's presentation state; selection and graph data stay intact. */
export function resetLayout(cy: Core, graph: ExplorerGraph, strategy: LayoutState['strategy'], cached: LayoutPositionsCache): LayoutPositionsCache {
  const restored = layoutPositions(graph, strategy);
  applyPositions(cy, restored);
  cy.fit(undefined, 65);
  return { ...cached, [strategy]: restored };
}
