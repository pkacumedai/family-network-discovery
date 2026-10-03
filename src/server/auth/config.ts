export function authConfiguration(env: NodeJS.ProcessEnv) {
  const secret = env.BETTER_AUTH_SECRET;
  const baseURL = env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || secret.includes('replace-with') || !baseURL) throw new Error('Authentication configuration is incomplete');
  const production = env.NODE_ENV === 'production';
  const origin = new URL(baseURL);
  if (production && (origin.protocol !== 'https:' || env.MAIL_TRANSPORT !== 'smtp')) throw new Error('Production requires HTTPS and production SMTP');
  if (!['mailpit', 'smtp'].includes(env.MAIL_TRANSPORT ?? '')) throw new Error('Select an email transport');
  if (env.MAIL_TRANSPORT === 'mailpit' && !['127.0.0.1', 'localhost'].includes(env.SMTP_HOST ?? '127.0.0.1')) throw new Error('Mailpit must be local');
  if (production && !env.AUTH_IP_HEADER) throw new Error('Production requires a trusted proxy IP header');
  if (production && (!env.SMTP_HOST || ['localhost', '127.0.0.1', 'mailpit'].includes(env.SMTP_HOST) || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.MAIL_FROM)) throw new Error('Production SMTP configuration is incomplete');
  return { secret, baseURL: origin.origin, production };
}
