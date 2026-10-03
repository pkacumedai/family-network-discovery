import { expect, type Page } from '@playwright/test';
import { connectDatabase } from '../../src/server/db/connection';
import { eq, sql } from 'drizzle-orm';
import { admissions, people } from '../../src/server/db/schema';
export async function login(page: Page, email: string) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Test database required');
  const { db, pool } = connectDatabase(url);
  try { await db.execute(sql`TRUNCATE auth_rate_limit`); } finally { await pool.end(); }
  const mail = 'http://127.0.0.1:8025';
  await page.request.delete(`${mail}/api/v1/messages`);
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  let messageId = '';
  await expect.poll(async () => {
    const response = await page.request.get(`${mail}/api/v1/messages`);
    const data = await response.json();
    messageId = data.messages?.find((m: { ID: string; To: { Address: string }[] }) => m.To.some(t => t.Address === email))?.ID ?? '';
    return Boolean(messageId);
  }).toBe(true);
  const message = await (await page.request.get(`${mail}/api/v1/message/${messageId}`)).json();
  const code = message.Text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error('No code in local test mail');
  await page.getByLabel('Six-digit code').fill(code);
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
}

// Follow the explicit fixture admission rather than guessing between equal names.
export async function selectExpectedPerson(page: Page, email: string) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Test database required');
  const { db, pool } = connectDatabase(url);
  try {
    const [expected] = await db.select({ id: people.id, name: people.displayName }).from(admissions)
      .innerJoin(people, eq(people.id, admissions.expectedPersonId)).where(eq(admissions.email, email));
    if (!expected) throw new Error('Expected Person fixture required');
    const matches = await db.select({ id: people.id }).from(people).where(eq(people.displayName, expected.name)).orderBy(people.id);
    await page.getByRole('searchbox').fill(expected.name);
    await page.getByRole('list', { name: 'People', exact: true }).getByRole('button').nth(matches.findIndex(p => p.id === expected.id)).click();
    return expected.id;
  } finally { await pool.end(); }
}
