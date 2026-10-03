import { randomUUID } from 'node:crypto';
import { FamilyExplorer } from '@/components/graph/FamilyExplorer';
import { SignIn, Logout } from '@/components/auth/SignIn';
import { verifiedSession } from '@/server/auth';
import { bootstrap, AccessDenied } from '@/server/auth/domain';
import { getDatabase } from '@/server/db';
import { events } from '@/server/db/schema';
import { getExplorerGraph } from '@/server/graph/service';
export const dynamic = 'force-dynamic';
async function load(family: string) {
    const session = await verifiedSession();
    if (!session) return null;
    const db = getDatabase();
    const membership = await bootstrap(db, session.user, family);
    const graph = await getExplorerGraph(family);
    await db.insert(events).values(['family_accessed', membership.personId ? 'explorer_viewed' : 'onboarding_started'].map(eventType => ({
      id: randomUUID(), eventType: eventType as 'family_accessed' | 'explorer_viewed' | 'onboarding_started',
      accountId: membership.accountId, membershipId: membership.id, familyId: family,
    })));
    return { graph, membership, authenticatedEmail: session.user.email };
}
export default async function Home({ searchParams }: { searchParams: Promise<{ family?: string }> }) {
  const { family = 'sample-family' } = await searchParams;
  let result;
  try { result = await load(family); } catch (error) {
    return <main className="notice"><h1>Family Network</h1><p role="alert">{error instanceof AccessDenied ? 'You do not have access to this family.' : 'The family network is temporarily unavailable. Check the server configuration and database, then reload.'}</p><Logout /></main>;
  }
  if (!result) return <SignIn />;
  return <FamilyExplorer graph={result.graph} familyId={family} ownPersonId={result.membership.personId} authenticatedEmail={result.authenticatedEmail} />;
}
