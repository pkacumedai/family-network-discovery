'use client';
import cytoscape, { type Core } from 'cytoscape';
import { useEffect, useRef, useState } from 'react';
import type { ExplorerGraph } from '../../domain/explorer';
import type { LayoutState } from './types';
import { applyPositions, applySelection, graphStyles, layoutPositions, resetLayout, toElements, type LayoutPositionsCache } from './adapter';
export interface Selection { id: string | null; center: boolean; revision: number }
export function GraphCanvas({ graph, selection, onSelect }: {
  graph: ExplorerGraph; selection: Selection; onSelect: (id: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Core | null>(null);
  const [strategy, setStrategy] = useState<LayoutState['strategy']>('generational');
  const activeStrategy = useRef(strategy);
  const positions = useRef<LayoutPositionsCache>({});
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({ container: container.current, elements: toElements(graph), style: graphStyles,
      layout: { name: 'preset' }, minZoom: 0.15, maxZoom: 2.5, boxSelectionEnabled: false,
      selectionType: 'single', autounselectify: false });
    instance.current = cy;
    const observer = new ResizeObserver(() => cy.resize());
    observer.observe(container.current);
    cy.on('tap', 'node', event => onSelect(event.target.data('personId')));
    cy.on('tap', event => { if (event.target === cy) onSelect(null); });
    cy.on('zoom', () => setZoom(Math.round(cy.zoom() * 100)));
    cy.on('dragfree', 'node', () => {
      positions.current[activeStrategy.current] = Object.fromEntries(cy.nodes().map(n => [n.data('personId'), { ...n.position() }]));
    });
    return () => { observer.disconnect(); cy.destroy(); instance.current = null; positions.current = {}; };
  }, [graph, onSelect]);
  useEffect(() => {
    const cy = instance.current;
    if (!cy) return;
    activeStrategy.current = strategy;
    positions.current[strategy] ??= layoutPositions(graph, strategy);
    applyPositions(cy, positions.current[strategy]);
    cy.fit(undefined, 65);
  }, [graph, strategy]);
  useEffect(() => {
    if (instance.current) applySelection(instance.current, selection.id, selection.center);
  }, [selection]);
  function zoomBy(factor: number) {
    const cy = instance.current;
    if (cy) cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }
  return <section className="graph-panel" aria-label="Family graph">
    <div className="graph-toolbar">
      <div className="layout-switch" role="group" aria-label="Graph layout">
        <button aria-pressed={strategy === 'generational'} onClick={() => setStrategy('generational')}>Generational</button>
        <button aria-pressed={strategy === 'network'} onClick={() => setStrategy('network')}>Network</button>
      </div>
      <button className="reset-layout" title={`Restore the default ${strategy} arrangement`} onClick={() => {
        if (instance.current) positions.current = resetLayout(instance.current, graph, strategy, positions.current);
      }}>Reset layout</button>
      <div className="zoom-controls" role="group" aria-label="Graph view controls">
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
        <output aria-label="Zoom level">{zoom}%</output>
        <button aria-label="Zoom in" onClick={() => zoomBy(1.2)}>+</button>
        <button onClick={() => instance.current?.fit(undefined, 65)}>Fit all</button>
      </div>
    </div>
    <div ref={container} className="graph-canvas" tabIndex={0} role="region" aria-label="Interactive family network"
      aria-describedby="graph-instructions" onKeyDown={event => {
        const deltas: Record<string, { x: number; y: number }> = { ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 }, ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 } };
        if (deltas[event.key]) { event.preventDefault(); instance.current?.panBy(deltas[event.key]); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomBy(1.2); }
        if (event.key === '-') { event.preventDefault(); zoomBy(1 / 1.2); }
      }} />
    <div className="graph-caption"><span>{strategy === 'generational' ? 'Generations, best effort' : 'Connections, freely arranged'}</span>
      <span>Positions are personal to this view</span></div>
    <div className="legend" aria-label="Relationship legend">
      <span><i className="line parent" />Parent → Child</span>
      <span><i className="line spouse" />Spouse / Partner</span>
      <span><i className="line sibling" />Sibling</span>
    </div>
    <p id="graph-instructions" className="graph-help">Drag the background to pan, scroll or pinch to zoom, and drag a person to reposition. Use the people list to select with a keyboard; arrow keys pan the focused graph.</p>
  </section>;
}
