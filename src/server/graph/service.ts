import 'server-only';
import { getDatabase } from '../db';
import { verifiedSession } from '../auth';
import { authorize, AccessDenied } from '../auth/domain';
import { retrieveExplorerGraph } from './query';
export async function getExplorerGraph(familyId: string) {
  const session = await verifiedSession();
  if (!session?.user.emailVerified) throw new AccessDenied();
  const membership = await authorize(getDatabase(), session.user.id, familyId);
  return retrieveExplorerGraph(getDatabase(), familyId, membership.personId ? undefined : { expectedPersonId: membership.expectedPersonId });
}
