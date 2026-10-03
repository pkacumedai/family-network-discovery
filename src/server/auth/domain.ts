import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { accounts, admissions, memberships, people, events } from '../db/schema';
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export class AccessDenied extends Error { constructor() { super('Family access unavailable'); } }
export type VerifiedIdentity = { id: string; email: string; emailVerified: boolean };
export async function eligibleEmail(db: Database, email: string) {
  return (await db.select({ id: admissions.id }).from(admissions).where(and(
    eq(admissions.email, normalizeEmail(email)), eq(admissions.status, 'ACTIVE'))).limit(1)).length > 0;
}
// Called only with a Better Auth server-verified session, never client identity fields.
export async function bootstrap(db: Database, identity: VerifiedIdentity, familyId: string) {
  if (!identity.emailVerified) throw new AccessDenied();
  return db.transaction(async tx => {
    // Serializes retries and first-use creation for one immutable auth subject.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity.id}, 0))`);
    let [account] = await tx.select().from(accounts).where(eq(accounts.authUserId, identity.id));
    if (account && !account.enabled) throw new AccessDenied();
    const [admission] = await tx.select().from(admissions).where(and(eq(admissions.familyId, familyId),
      account ? sql`(${admissions.boundAccountId} = ${account.id} OR (${admissions.boundAccountId} IS NULL AND ${admissions.email} = ${normalizeEmail(identity.email)}))`
        : eq(admissions.email, normalizeEmail(identity.email)))).for('update');
    if (!admission || admission.status !== 'ACTIVE' || (admission.boundAccountId && admission.boundAccountId !== account?.id)) throw new AccessDenied();
    if (!account) [account] = await tx.insert(accounts).values({ id: randomUUID(), authUserId: identity.id }).returning();
    await tx.update(admissions).set({ boundAccountId: account.id, updatedAt: new Date() }).where(eq(admissions.id, admission.id));
    await tx.insert(memberships).values({ id: randomUUID(), accountId: account.id, familyId,
      admissionId: admission.id, role: admission.role }).onConflictDoNothing();
    // Never reactivates a revoked Membership on subsequent login.
    const [membership] = await tx.select().from(memberships).where(and(eq(memberships.accountId, account.id), eq(memberships.familyId, familyId)));
    if (!membership || membership.status !== 'ACTIVE') throw new AccessDenied();
    return membership;
  });
}
export async function authorize(db: Pick<Database, 'select'>, authUserId: string, familyId: string) {
  const [row] = await db.select({ membership: memberships, expectedPersonId: admissions.expectedPersonId }).from(accounts)
    .innerJoin(memberships, eq(memberships.accountId, accounts.id))
    .innerJoin(admissions, and(eq(admissions.id, memberships.admissionId), eq(admissions.boundAccountId, accounts.id)))
    .where(and(eq(accounts.authUserId, authUserId), eq(accounts.enabled, true), eq(memberships.familyId, familyId),
      eq(memberships.status, 'ACTIVE'), eq(admissions.status, 'ACTIVE')));
  if (!row) throw new AccessDenied();
  return { ...row.membership, expectedPersonId: row.expectedPersonId };
}
export async function claimPerson(db: Database, authUserId: string, familyId: string, personId: string) {
  return db.transaction(async tx => {
    const membership = await authorize(tx, authUserId, familyId);
    // Lock all authorization rows, so revocation/disablement cannot race the commit.
    await tx.select().from(accounts).where(eq(accounts.id, membership.accountId)).for('update');
    await tx.select().from(admissions).where(eq(admissions.id, membership.admissionId)).for('update');
    const [locked] = await tx.select().from(memberships).where(eq(memberships.id, membership.id)).for('update');
    const authorized = await authorize(tx, authUserId, familyId);
    if (locked.personId === personId) return locked;
    if (locked.personId) throw new Error('Your identity is already linked.');
    if (authorized.expectedPersonId && authorized.expectedPersonId !== personId) {
      throw new Error('This is not the person associated with your invitation.');
    }
    const [person] = await tx.select({ id: people.id }).from(people).where(and(eq(people.id, personId), eq(people.familyId, familyId))).for('update');
    if (!person) throw new AccessDenied();
    const [existing] = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.familyId, familyId), eq(memberships.personId, personId), eq(memberships.status, 'ACTIVE')));
    if (existing) throw new Error('This person has already been claimed. Please select another person.');
    const [result] = await tx.update(memberships).set({ personId, onboardingCompletedAt: new Date(), updatedAt: new Date() }).where(eq(memberships.id, membership.id)).returning();
    await tx.insert(events).values(['identity_claim_succeeded', 'onboarding_completed'].map(eventType => ({
      id: randomUUID(), eventType: eventType as 'identity_claim_succeeded' | 'onboarding_completed', familyId,
      accountId: membership.accountId, membershipId: membership.id, relatedPersonId: personId,
    })));
    return result;
  });
}
