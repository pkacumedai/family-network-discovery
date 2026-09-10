// Presentation-only contracts. No coordinates or selections belong in FamilyGraph.
export interface VisualizationState {
  selectedPersonId: string | null;
  zoom: number;
  pan: { x: number; y: number };
}
export interface LayoutState {
  strategy: 'generational' | 'network';
  positions: Readonly<Record<string, { x: number; y: number }>>;
}
// A future Cytoscape adapter will consume privacy-filtered data from the server.
// Never pass raw Person records (which contain DOB) to a renderer.
export interface VisualGraph {
  nodes: readonly { id: string; label: string }[];
  edges: readonly { id: string; source: string; target: string; label: string }[];
}
