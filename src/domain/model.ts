import type { RelationshipType } from './relationships';
// Canonical records are internal domain data, never unrestricted API response types.
export interface Person {
  id: string; displayName: string; birthDate: string | null; isLiving: boolean | null;
  nickname: string | null; createdAt: Date; updatedAt: Date; createdByMemberId: string | null;
}
export interface Member {
  id: string; displayName: string; email: string; status: 'INVITED' | 'JOINED';
  linkedPersonId: string | null; joinedAt: Date | null; createdAt: Date;
  onboardingState: 'UNCLAIMED' | 'PRELINKED' | 'IN_PROGRESS' | 'COMPLETED';
}
export interface Relationship {
  id: string; fromPersonId: string; toPersonId: string; relationshipType: RelationshipType;
  status: 'SEEDED' | 'UNVERIFIED' | 'VERIFIED'; createdByMemberId: string | null;
  seedSource: string | null; createdAt: Date; updatedAt: Date;
}
export interface FamilyGraph { people: readonly Person[]; relationships: readonly Relationship[] }
export interface ProfilePrivacy { personId: string; shareBirthMonthDay: boolean; shareBirthYear: boolean }
