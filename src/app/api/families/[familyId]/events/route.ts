import { randomUUID } from 'node:crypto';
import { verifiedSession } from '@/server/auth';
import { authorize } from '@/server/auth/domain';
import { getDatabase } from '@/server/db';
import { events } from '@/server/db/schema';
export async function POST(request: Request, { params }: { params: Promise<{ familyId: string }> }) {
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return new Response(null, { status: 403 });
  try {
    const session = await verifiedSession();
    if (!session?.user.emailVerified) return new Response(null, { status: 401 });
    const { familyId } = await params;
    const db = getDatabase();
    const membership = await authorize(db, session.user.id, familyId);
    const { eventType } = await request.json();
    if (!['person_searched', 'person_selected'].includes(eventType)) return new Response(null, { status: 400 });
    // No raw search text, names, or client-supplied contextual IDs are retained.
    await db.insert(events).values({ id: randomUUID(), eventType, familyId, accountId: membership.accountId, membershipId: membership.id });
    return new Response(null, { status: 204 });
  } catch { return new Response(null, { status: 403 }); }
}
