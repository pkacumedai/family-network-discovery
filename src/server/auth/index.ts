import 'server-only';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';
import { getDatabase } from '../db';
import { createAuthentication } from './factory';
import { authConfiguration } from './config';
let instance: ReturnType<typeof createAuthentication> | undefined;
export function getAuth() {
  if (instance) return instance;
  const config = authConfiguration(process.env);
  const local = process.env.MAIL_TRANSPORT === 'mailpit';
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? '127.0.0.1', port: Number(process.env.SMTP_PORT ?? (local ? 1025 : 465)),
    secure: !local, auth: local ? undefined : { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    logger: false, debug: false,
  });
  instance = createAuthentication(getDatabase(), config.secret, config.baseURL, async (email, code) => {
    await transport.sendMail({ from: process.env.MAIL_FROM ?? 'Family Network <auth@example.test>', to: email,
      subject: 'Your Family Network sign-in code', text: `Your sign-in code is ${code}. It expires in five minutes. If you did not request it, ignore this email.` });
  }, config.production, process.env.AUTH_IP_HEADER);
  return instance;
}
export async function verifiedSession() {
  return getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
}
