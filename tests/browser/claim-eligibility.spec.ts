import { test, expect } from '@playwright/test';
import { login, selectExpectedPerson } from './login';
import { connectDatabase } from '../../src/server/db/connection';
import { memberships, events } from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';

test('expected, unavailable and stale claims stay safe across logout and login', async ({ page, context }) => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Test database required');
  const { db, pool } = connectDatabase(url);
  const state = () => db.select().from(memberships).orderBy(memberships.admissionId);
  const claim = (personId: string) => page.request.post('/api/families/sample-family/claim', {
    headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId },
  });
  const select = async (name: string) => {
    await page.getByRole('searchbox').fill(name);
    await page.getByRole('list', { name: 'People', exact: true }).getByRole('button').first().click();
  };
  try {
    // Reset only disposable test Membership associations, never development data.
    await db.update(memberships).set({ personId: null, onboardingCompletedAt: null });
    await login(page, 'alex@example.com');
    await select('Alex');
    // Historical PRELINKED Member data is not a live claim.
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toBeEnabled();
    expect((await claim('P001')).status()).toBe(200);
    await page.reload();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await login(page, 'sam@example.com');
    const before = await state();
    await select('Robin');
    await expect(page.getByLabel('Signed-in identity')).toHaveText('Signed in as sam@example.com');
    await expect(page.getByText('This is not the person associated with your invitation.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toHaveCount(0);
    expect((await claim('P002')).status()).toBe(409);
    expect(await state()).toEqual(before);
    const failures = await db.select().from(events).where(eq(events.eventType, 'identity_claim_failed'));
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.at(-1)?.metadata).toBeNull();
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('sam@example.com');
    for (const membership of before) {
      for (const privateId of [membership.id, membership.accountId, membership.admissionId]) expect(html).not.toContain(privateId);
    }
    expect(html).not.toMatch(/alex@example.com|casey@example.com|accountId|membershipId|admissionId|authUserId|sessionId|boundAccountId|expectedPersonId|1978-02-14/);
    await select('Alex');
    await expect(page.getByText('Already associated with a family member account', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toHaveCount(0);
    const expectedPersonId = await selectExpectedPerson(page, 'sam@example.com');
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This is me', exact: true })).toBeEnabled();
    // Keep Sam's page open while another session claims the expected Person.
    const browser = context.browser()!;
    const otherContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' });
    try {
      const other = await otherContext.newPage();
      await login(other, 'casey@example.com');
      // Null expectation: may self-identify, but cannot claim an active claim.
      expect((await other.request.post('/api/families/sample-family/claim', {
        headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId: 'P001' },
      })).status()).toBe(409);
      expect(await state().then(rows => rows.find(m => m.admissionId === 'M001'))).toEqual(before.find(m => m.admissionId === 'M001'));
      expect((await other.request.post('/api/families/sample-family/claim', {
        headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId: expectedPersonId },
      })).status()).toBe(200);
      const claimed = await state();
      await page.getByRole('button', { name: 'This is me', exact: true }).click();
      await expect(page.getByText('This person has already been claimed. Please select another person.', { exact: true })).toBeVisible();
      expect(await state()).toEqual(claimed);
      await page.reload(); await selectExpectedPerson(page, 'sam@example.com');
      await expect(page.getByText('Already associated with a family member account', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'This is me', exact: true })).toHaveCount(0);
      await other.reload();
      await expect(other.getByRole('heading', { name: 'Who are you in this family?' })).toHaveCount(0);
      await other.getByRole('button', { name: 'Log out' }).click();
      await expect(other.getByLabel('Email address')).toBeVisible();
      await login(other, 'casey@example.com');
      await expect(other.getByRole('heading', { name: 'Who are you in this family?' })).toHaveCount(0);
      expect((await other.request.post('/api/families/sample-family/claim', {
        headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId: 'P002' },
      })).status()).toBe(409);
    } finally { await otherContext.close(); }
  } finally {
    await db.update(memberships).set({ personId: null, onboardingCompletedAt: null });
    await pool.end();
  }
});
