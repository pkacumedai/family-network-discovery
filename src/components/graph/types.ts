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
