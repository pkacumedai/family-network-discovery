import { FamilyExplorer } from '@/components/graph/FamilyExplorer';
import { getExplorerGraph } from '@/server/graph/service';
import { localExplorerEnabled } from '@/server/graph/access';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (!localExplorerEnabled(process.env)) return <main className="notice"><h1>Family Network</h1>
    <p>The local explorer is disabled.</p><p>See the developer README for local setup.</p></main>;
  let graph;
  try { graph = await getExplorerGraph(); }
  catch { return <main className="notice"><h1>Family Network</h1><p role="alert">The family network could not be loaded.</p>
    <p>Check the local database connection and migrations, then reload.</p><form action="/" method="get"><button>Try again</button></form></main>; }
  return <FamilyExplorer graph={graph} />;
}
