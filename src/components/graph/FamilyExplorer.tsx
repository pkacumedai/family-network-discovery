'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Logout } from '../auth/SignIn';
import { immediateFamily, personContext, searchPeople, type ExplorerGraph } from '../../domain/explorer';
import type { Selection } from './GraphCanvas';
const GraphCanvas = dynamic(() => import('./GraphCanvas').then(module => module.GraphCanvas), {
  ssr: false, loading: () => <div className="graph-panel graph-loading" role="status">Preparing the family graph…</div>,
});
export function FamilyExplorer({ graph, familyId, ownPersonId, authenticatedEmail }: { graph: ExplorerGraph; familyId: string; ownPersonId: string | null; authenticatedEmail: string }) {
  const [claimMessage, setClaimMessage] = useState('');
  const [claiming, setClaiming] = useState(false);
  const record = useCallback((eventType: string) => { void fetch(`/api/families/${encodeURIComponent(familyId)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType }) }).catch(() => {}); }, [familyId]);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>({ id: null, center: false, revision: 0 });
  const selectFromGraph = useCallback((id: string | null) => {
    setSelection(previous => ({ id, center: false, revision: previous.revision + 1 }));
  }, []);
  const selectPerson = (id: string) => setSelection(previous => ({ id, center: true, revision: previous.revision + 1 }));
  useEffect(() => { if (!query.trim()) return; const timer = setTimeout(() => record('person_searched'), 700); return () => clearTimeout(timer); }, [query, record]);
  useEffect(() => { if (selection.id) record('person_selected'); }, [selection.id, record]);
  const selected = graph.people.find(p => p.id === selection.id);
  const relatives = selected ? immediateFamily(graph, selected.id) : [];
  const results = searchPeople(graph, query);
  return <main className="explorer">
    <header className="app-header"><Link className="brand" href="/" aria-label="Family Network home"><span className="brand-mark" aria-hidden="true">✳</span> Family Network</Link>
      <span className="preview-badge">{ownPersonId ? 'Read-only explorer' : 'Set up your identity'}</span><div className="session-controls"><p className="session-identity" aria-label="Signed-in identity">Signed in as <span>{authenticatedEmail}</span></p><Logout /></div></header>
    {!ownPersonId && <section className="setup-panel"><h2>Who are you in this family?</h2><p>Explore the graph, select yourself, and choose “This is me.” Family records will stay unchanged.</p></section>}
    <div className="intro"><div><p className="eyebrow">A family, connected</p><h1>Explore the people who connect us.</h1>
      <p>Find a familiar name, follow a connection, and see the family from a new perspective.</p></div>
      <p className="graph-count"><strong>{graph.people.length}</strong> people <span>·</span> <strong>{graph.relationships.length}</strong> relationships</p></div>
    {!graph.people.length ? <section className="empty-state"><h2>No people yet</h2><p>This family has no graph to explore.</p></section> :
      <div className="explorer-grid">
        <aside className="people-panel" aria-label="Find a person">
          <h2>Find a person</h2><label htmlFor="person-search" className="sr-only">Search people by name</label>
          <div className="search-box"><span aria-hidden="true">⌕</span><input id="person-search" type="search" placeholder="Search a name…" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <p className="list-heading" aria-live="polite">{query.trim() ? `${results.length} matching people` : 'Everyone in this network'}</p>
          <ul className="people-list" aria-label="People">
            {results.map(person => <li key={person.id}><button className="person-result" aria-pressed={selection.id === person.id}
              onClick={() => selectPerson(person.id)}>
              <span className="person-avatar" aria-hidden="true">{person.displayName.split(/\s+/).map(n => n[0]).slice(0, 2).join('')}</span>
              <span><strong>{person.displayName}{person.id === ownPersonId ? ' (You)' : ''}</strong><small>{personContext(graph, person.id)}</small></span>
            </button></li>)}
          </ul>
          {!results.length && <p className="no-results">No people match “{query}”. Try part of a name.</p>}
        </aside>
        <GraphCanvas graph={graph} selection={selection} onSelect={selectFromGraph} />
        <aside className="context-panel" aria-label="Selected person" aria-live="polite">
          {selected ? <><p className="eyebrow">Selected person</p><h2>{selected.displayName}</h2>
            <button className="center-button" onClick={() => selectPerson(selected.id)}>Center in graph <span aria-hidden="true">↗</span></button>
            {!ownPersonId && <div>{selected.claimability === 'EXPECTED' || selected.claimability === 'AVAILABLE' ? <button className="claim-button" disabled={claiming} onClick={async () => {
              setClaiming(true); setClaimMessage('');
              try { const response = await fetch(`/api/families/${encodeURIComponent(familyId)}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: selected.id }) });
                if (!response.ok) { const data = await response.json(); setClaimMessage(data.message); }
                else window.location.reload();
              } catch { setClaimMessage('Unable to connect. Please try again.'); }
              finally { setClaiming(false); }
            }}>{claiming ? 'Linking…' : 'This is me'}</button> : <p>{selected.claimability === 'ALREADY_CLAIMED'
              ? 'Already associated with a family member account'
              : 'This is not the person associated with your invitation.'}</p>}<p role="status">{claimMessage}</p></div>}
            <h3>Immediate connections <span>{relatives.length}</span></h3>
            {relatives.length ? <ul className="relative-list">{relatives.map(relative => <li key={relative.relationshipId}>
              <span className="relation-label">{relative.label}</span>
              <button onClick={() => selectPerson(relative.person.id)}>{relative.person.displayName}<span aria-hidden="true"> →</span></button>
              <small>{relative.status === 'SEEDED' ? 'Initial family record' : relative.status === 'VERIFIED' ? 'Verified record' : 'Unverified record'}</small>
            </li>)}</ul> : <p>No relationships recorded for this person.</p>}
          </> : <div className="context-empty"><span aria-hidden="true">◎</span><h2>Every connection has a story.</h2><p>Select a person in the graph or search by name to explore their immediate family.</p></div>}
        </aside>
      </div>}
    <footer className="app-footer">Your family network <span>Explore freely. Family records stay unchanged.</span></footer>
  </main>;
}
