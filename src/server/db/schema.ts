import { authUser } from './auth-schema';
export * from './auth-schema';
import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, text, boolean, date, timestamp, jsonb, check, uniqueIndex, index, foreignKey, unique, type AnyPgColumn } from 'drizzle-orm/pg-core';
export const relationshipType = pgEnum('relationship_type', ['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF']);
export const relationshipStatus = pgEnum('relationship_status', ['SEEDED', 'UNVERIFIED', 'VERIFIED']);
export const memberStatus = pgEnum('member_status', ['INVITED', 'JOINED']);
export const onboardingState = pgEnum('onboarding_state', ['UNCLAIMED', 'PRELINKED', 'IN_PROGRESS', 'COMPLETED']);
export const eventType = pgEnum('event_type', [
  'session_started', 'graph_viewed', 'graph_zoomed', 'graph_panned', 'graph_layout_changed',
  'person_searched', 'search_result_selected', 'person_selected', 'identity_claim_started',
  'identity_claimed', 'identity_not_found', 'person_created', 'relationship_created', 'onboarding_completed', 'auth_started', 'auth_succeeded', 'auth_failed', 'family_accessed', 'onboarding_started', 'identity_claim_succeeded', 'identity_claim_failed', 'explorer_viewed', 'logout',
]);
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
export const people = pgTable('people', {
  id: text('id').primaryKey(), familyId: text('family_id').notNull().references(() => families.id), displayName: text('display_name').notNull(),
  birthDate: date('birth_date'), isLiving: boolean('is_living'), nickname: text('nickname'), notes: text('notes'),
  createdAt: createdAt(), updatedAt: updatedAt(),
  createdByMemberId: text('created_by_member_id').references((): AnyPgColumn => legacyMembers.id),
}, t => [unique('person_family_id_unique').on(t.familyId, t.id), check('person_name_present', sql`length(trim(${t.displayName})) > 0`)]);
export const legacyMembers = pgTable('legacy_member_records', {
  id: text('id').primaryKey(), displayName: text('display_name').notNull(), email: text('email').notNull(),
  status: memberStatus('status').default('INVITED').notNull(),
  linkedPersonId: text('linked_person_id').unique().references((): AnyPgColumn => people.id),
  onboardingState: onboardingState('onboarding_state').default('UNCLAIMED').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }), createdAt: createdAt(),
}, t => [
  uniqueIndex('member_email_unique').on(sql`lower(trim(${t.email}))`),
  check('member_name_present', sql`length(trim(${t.displayName})) > 0`),
  check('member_email_present', sql`length(trim(${t.email})) > 0`),
  check('member_onboarding_link', sql`(${t.onboardingState} = 'UNCLAIMED' AND ${t.linkedPersonId} IS NULL) OR (${t.onboardingState} = 'IN_PROGRESS') OR (${t.onboardingState} IN ('PRELINKED', 'COMPLETED') AND ${t.linkedPersonId} IS NOT NULL)`),
]);
export const relationships = pgTable('relationships', {
  id: text('id').primaryKey(), familyId: text('family_id').notNull().references(() => families.id), fromPersonId: text('from_person_id').notNull().references(() => people.id),
  toPersonId: text('to_person_id').notNull().references(() => people.id),
  relationshipType: relationshipType('relationship_type').notNull(),
  status: relationshipStatus('status').default('UNVERIFIED').notNull(),
  createdByMemberId: text('created_by_member_id').references(() => legacyMembers.id),
  seedSource: text('seed_source'), notes: text('notes'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  foreignKey({ name: 'relationship_from_family_fk', columns: [t.familyId, t.fromPersonId], foreignColumns: [people.familyId, people.id] }),
  foreignKey({ name: 'relationship_to_family_fk', columns: [t.familyId, t.toPersonId], foreignColumns: [people.familyId, people.id] }),
  check('relationship_no_self', sql`${t.fromPersonId} <> ${t.toPersonId}`),
  check('relationship_provenance', sql`(${t.createdByMemberId} IS NOT NULL AND ${t.seedSource} IS NULL) OR (${t.createdByMemberId} IS NULL AND length(trim(${t.seedSource})) > 0 AND ${t.seedSource} IS NOT NULL)`),
  // Expression index catches symmetric reverse duplicates regardless of caller ordering/collation.
  uniqueIndex('relationship_canonical_unique').on(t.relationshipType,
    sql`(CASE WHEN ${t.relationshipType} = 'PARENT_OF' THEN ${t.fromPersonId} ELSE least(${t.fromPersonId}, ${t.toPersonId}) END)`,
    sql`(CASE WHEN ${t.relationshipType} = 'PARENT_OF' THEN ${t.toPersonId} ELSE greatest(${t.fromPersonId}, ${t.toPersonId}) END)`),
  index('relationship_from_idx').on(t.fromPersonId), index('relationship_to_idx').on(t.toPersonId),
]);
export const profilePrivacy = pgTable('profile_privacy', {
  personId: text('person_id').primaryKey().references(() => people.id, { onDelete: 'cascade' }),
  shareBirthMonthDay: boolean('share_birth_month_day').default(false).notNull(),
  shareBirthYear: boolean('share_birth_year').default(false).notNull(),
});
export const events = pgTable('events', {
  id: text('id').primaryKey(), timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  familyId: text('family_id').references(() => families.id),
  accountId: text('account_id').references(() => accounts.id),
  membershipId: text('membership_id').references(() => memberships.id),
  memberId: text('member_id').references(() => legacyMembers.id), eventType: eventType('event_type').notNull(),
  relatedPersonId: text('related_person_id').references(() => people.id),
  relatedRelationshipId: text('related_relationship_id').references(() => relationships.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, t => [index('events_timestamp_idx').on(t.timestamp), index('events_member_idx').on(t.memberId)]);

export const accessStatus = pgEnum('access_status', ['ACTIVE', 'REVOKED']);
export const familyRole = pgEnum('family_role', ['MEMBER', 'ADMIN']);
export const accounts = pgTable('app_accounts', {
  id: text('id').primaryKey(), authUserId: text('auth_user_id').notNull().unique().references(() => authUser.id),
  enabled: boolean('enabled').default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
});
export const families = pgTable('families', {
  id: text('id').primaryKey(), name: text('name').notNull(), createdAt: createdAt(),
  createdByAccountId: text('created_by_account_id').references(() => accounts.id),
});
export const admissions = pgTable('family_admissions', {
  id: text('id').primaryKey(), email: text('email').notNull(),
  familyId: text('family_id').notNull().references(() => families.id),
  expectedPersonId: text('expected_person_id'),
  role: familyRole('role').default('MEMBER').notNull(), status: accessStatus('status').default('ACTIVE').notNull(),
  boundAccountId: text('bound_account_id').references(() => accounts.id),
  legacyMemberId: text('legacy_member_id').unique().references(() => legacyMembers.id),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [foreignKey({ name: 'admission_expected_person_family_fk', columns: [t.familyId, t.expectedPersonId], foreignColumns: [people.familyId, people.id] }),
  uniqueIndex('admission_family_email_unique').on(t.familyId, sql`lower(trim(${t.email}))`),
  unique('admission_id_family_unique').on(t.id, t.familyId)]);
export const memberships = pgTable('memberships', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull().references(() => accounts.id),
  familyId: text('family_id').notNull().references(() => families.id),
  admissionId: text('admission_id').notNull(), status: accessStatus('status').default('ACTIVE').notNull(),
  role: familyRole('role').default('MEMBER').notNull(), personId: text('person_id'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [unique('membership_account_family_unique').on(t.accountId, t.familyId),
  foreignKey({ name: 'membership_person_family_fk', columns: [t.familyId, t.personId], foreignColumns: [people.familyId, people.id] }),
  foreignKey({ name: 'membership_admission_family_fk', columns: [t.admissionId, t.familyId], foreignColumns: [admissions.id, admissions.familyId] }),
  uniqueIndex('membership_active_person_unique').on(t.familyId, t.personId).where(sql`${t.status} = 'ACTIVE' AND ${t.personId} IS NOT NULL`),
]);
