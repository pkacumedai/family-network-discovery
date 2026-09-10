import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, text, boolean, date, timestamp, jsonb, check, uniqueIndex, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
export const relationshipType = pgEnum('relationship_type', ['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF']);
export const relationshipStatus = pgEnum('relationship_status', ['SEEDED', 'UNVERIFIED', 'VERIFIED']);
export const memberStatus = pgEnum('member_status', ['INVITED', 'JOINED']);
export const onboardingState = pgEnum('onboarding_state', ['UNCLAIMED', 'PRELINKED', 'IN_PROGRESS', 'COMPLETED']);
export const eventType = pgEnum('event_type', [
  'session_started', 'graph_viewed', 'graph_zoomed', 'graph_panned', 'graph_layout_changed',
  'person_searched', 'search_result_selected', 'person_selected', 'identity_claim_started',
  'identity_claimed', 'identity_not_found', 'person_created', 'relationship_created', 'onboarding_completed',
]);
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
export const people = pgTable('people', {
  id: text('id').primaryKey(), displayName: text('display_name').notNull(),
  birthDate: date('birth_date'), isLiving: boolean('is_living'), nickname: text('nickname'), notes: text('notes'),
  createdAt: createdAt(), updatedAt: updatedAt(),
  createdByMemberId: text('created_by_member_id').references((): AnyPgColumn => members.id),
}, t => [check('person_name_present', sql`length(trim(${t.displayName})) > 0`)]);
export const members = pgTable('members', {
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
  id: text('id').primaryKey(), fromPersonId: text('from_person_id').notNull().references(() => people.id),
  toPersonId: text('to_person_id').notNull().references(() => people.id),
  relationshipType: relationshipType('relationship_type').notNull(),
  status: relationshipStatus('status').default('UNVERIFIED').notNull(),
  createdByMemberId: text('created_by_member_id').references(() => members.id),
  seedSource: text('seed_source'), notes: text('notes'), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
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
  memberId: text('member_id').references(() => members.id), eventType: eventType('event_type').notNull(),
  relatedPersonId: text('related_person_id').references(() => people.id),
  relatedRelationshipId: text('related_relationship_id').references(() => relationships.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, t => [index('events_timestamp_idx').on(t.timestamp), index('events_member_idx').on(t.memberId)]);
