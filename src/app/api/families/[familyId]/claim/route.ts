import { randomUUID } from 'node:crypto';
import { verifiedSession } from '@/server/auth';
import { getDatabase } from '@/server/db';
import { authorize, claimPerson, AccessDenied } from '@/server/auth/domain';
import { events } from '@/server/db/schema';
export async function POST(request: Request, { params }: { params: Promise<{ familyId: string }> }) {
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return new Response(null, { status: 403 });
  const { familyId } = await params;
  try {
    const session = await verifiedSession();
    if (!session?.user.emailVerified) throw new AccessDenied();
    const db = getDatabase();
    const membership = await authorize(db, session.user.id, familyId);
    const body = await request.json();
    if (typeof body.personId !== 'string' || body.personId.length > 200) return new Response(null, { status: 400 });
    const event = { accountId: membership.accountId, membershipId: membership.id, familyId };
    await db.insert(events).values({ ...event, id: randomUUID(), eventType: 'identity_claim_started' });
    try { await claimPerson(db, session.user.id, familyId, body.personId); }
    catch (error) {
      await db.insert(events).values({ ...event, id: randomUUID(), eventType: 'identity_claim_failed' });
      throw error;
    }
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error && ['Your identity is already linked.', 'This person has already been claimed. Please select another person.', 'This is not the person associated with your invitation.'].includes(error.message) ? error.message : 'Unable to claim this person. Check your family access and try again.';
    return Response.json({ message }, { status: error instanceof AccessDenied ? 403 : 409 });
  }
}
