import type { RelationshipType } from './relationships';
// Canonical records are internal domain data, never unrestricted API response types.
export interface Person {
  id: string; familyId: string; displayName: string; birthDate: string | null; isLiving: boolean | null;
  nickname: string | null; createdAt: Date; updatedAt: Date; createdByMemberId: string | null;
}
// Historical migration shape; not used for authorization.
export interface LegacyMember {
  id: string; displayName: string; email: string; status: 'INVITED' | 'JOINED';
  linkedPersonId: string | null; joinedAt: Date | null; createdAt: Date;
  onboardingState: 'UNCLAIMED' | 'PRELINKED' | 'IN_PROGRESS' | 'COMPLETED';
}
export interface Relationship {
  id: string; familyId: string; fromPersonId: string; toPersonId: string; relationshipType: RelationshipType;
  status: 'SEEDED' | 'UNVERIFIED' | 'VERIFIED'; createdByMemberId: string | null;
  seedSource: string | null; createdAt: Date; updatedAt: Date;
}
export interface FamilyGraph { people: readonly Person[]; relationships: readonly Relationship[] }
export interface ProfilePrivacy { personId: string; shareBirthMonthDay: boolean; shareBirthYear: boolean }

export interface Account { id: string; authUserId: string; enabled: boolean }
export interface Family { id: string; name: string }
export interface Membership { id: string; accountId: string; familyId: string; personId: string | null; status: 'ACTIVE' | 'REVOKED'; role: 'MEMBER' | 'ADMIN' }
