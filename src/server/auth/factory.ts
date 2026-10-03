import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { Database } from '../db/connection';
import { authUser, authSession, authCredential, authVerification, authRateLimit, events } from '../db/schema';
import { eligibleEmail } from './domain';

export function createAuthentication(db: Database, secret: string, baseURL: string,
  sendCode: (email: string, code: string) => Promise<void>, production = false, ipHeader = 'x-forwarded-for') {
  return betterAuth({
    secret, baseURL, trustedOrigins: [baseURL], logger: { disabled: true },
    database: drizzleAdapter(db, { provider: 'pg', transaction: true, schema: {
      user: authUser, session: authSession, account: authCredential, verification: authVerification, rateLimit: authRateLimit,
    } }),
    emailAndPassword: { enabled: false },
    advanced: { useSecureCookies: production, ipAddress: { ipAddressHeaders: [ipHeader] } },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 60,
      customRules: { '/email-otp/send-verification-otp': { window: 60, max: 3 }, '/sign-in/email-otp': { window: 60, max: 10 } } },
    hooks: {
      before: createAuthMiddleware(async ctx => {
        if (ctx.path === '/email-otp/send-verification-otp' || ctx.path === '/sign-in/email-otp') {
          const allowed = typeof ctx.body?.email === 'string' && await eligibleEmail(db, ctx.body.email);
          if (ctx.path === '/email-otp/send-verification-otp') {
            await db.insert(events).values({ id: randomUUID(), eventType: 'auth_started' });
            if (!allowed || ctx.body?.type !== 'sign-in') return ctx.json({ success: true });
          } else if (!allowed) throw new APIError('BAD_REQUEST', { message: 'Code could not be verified.' });
        }
      }),
      after: createAuthMiddleware(async ctx => {
        if (ctx.path === '/sign-in/email-otp') await db.insert(events).values({ id: randomUUID(),
          eventType: ctx.context.newSession ? 'auth_succeeded' : 'auth_failed' });
        if (ctx.path === '/sign-out') await db.insert(events).values({ id: randomUUID(), eventType: 'logout' });
      }),
    },
    plugins: [emailOTP({ otpLength: 6, expiresIn: 300, allowedAttempts: 3,
      storeOTP: 'hashed', resendStrategy: 'rotate',
      async sendVerificationOTP({ email, otp, type }) {
        if (type === 'sign-in' && await eligibleEmail(db, email)) await sendCode(email, otp);
      },
    })],
  });
}
