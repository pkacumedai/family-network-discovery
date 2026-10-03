import { pgTable, text, boolean, timestamp, index, integer, bigint } from 'drizzle-orm/pg-core';
const time = (name: string) => timestamp(name, { withTimezone: true }).notNull();
export const authUser = pgTable('auth_user', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(), image: text('image'),
  createdAt: time('created_at').defaultNow(), updatedAt: time('updated_at').defaultNow(),
});
export const authSession = pgTable('auth_session', {
  id: text('id').primaryKey(), token: text('token').notNull().unique(), expiresAt: time('expires_at'),
  createdAt: time('created_at').defaultNow(), updatedAt: time('updated_at').defaultNow(),
  ipAddress: text('ip_address'), userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
}, t => [index('auth_session_user_idx').on(t.userId)]);
// Better Auth provider credentials, never the application Account.
export const authCredential = pgTable('auth_credential', {
  id: text('id').primaryKey(), accountId: text('account_id').notNull(), providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'), refreshToken: text('refresh_token'), idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'), password: text('password'),
  createdAt: time('created_at').defaultNow(), updatedAt: time('updated_at').defaultNow(),
});
export const authVerification = pgTable('auth_verification', {
  id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(),
  expiresAt: time('expires_at'), createdAt: time('created_at').defaultNow(), updatedAt: time('updated_at').defaultNow(),
}, t => [index('auth_verification_identifier_idx').on(t.identifier)]);

export const authRateLimit = pgTable('auth_rate_limit', {
  id: text('id').primaryKey(), key: text('key').notNull().unique(),
  count: integer('count').notNull(), lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
