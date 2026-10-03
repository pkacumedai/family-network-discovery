import { test, expect } from '@playwright/test';
import { login, selectExpectedPerson } from './login';
import { connectDatabase } from '../../src/server/db/connection';
import { eq } from 'drizzle-orm';
import { memberships, admissions, events } from '../../src/server/db/schema';
test('OTP → authorized setup → explicit claim → returning explorer → logout', async ({ page }) => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Test database required');
  const { db, pool } = connectDatabase(url);
  try {
    // Each device exercises the first-time journey independently with the same fixture identity.
    await db.update(memberships).set({ personId: null, onboardingCompletedAt: null }).where(eq(memberships.admissionId, 'M002'));
    await login(page, 'sam@example.com');
    const identity = page.getByLabel('Signed-in identity');
    await expect(identity).toHaveText('Signed in as sam@example.com');
    await expect(identity).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Who are you in this family?' })).toBeVisible();
    await selectExpectedPerson(page, 'sam@example.com');
    await page.getByRole('button', { name: 'This is me', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Who are you in this family?' })).toHaveCount(0);
    await expect(page.getByText('Sam Example (You)', { exact: true })).toBeVisible();
    await expect(identity).toHaveText('Signed in as sam@example.com');
    await expect(identity).toBeVisible();
    await page.reload();
    await expect(identity).toHaveText('Signed in as sam@example.com');
    await expect(page.getByRole('button', { name: 'This is me' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(identity).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await login(page, 'sam@example.com');
    await expect(identity).toHaveText('Signed in as sam@example.com');
    await expect(identity).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Who are you in this family?' })).toHaveCount(0);
    const reassignment = await page.request.post('/api/families/sample-family/claim', { headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId: 'P001' } });
    expect(reassignment.status()).toBe(409);
    const forbidden = await page.request.post('/api/families/other/claim', { headers: { Origin: 'http://127.0.0.1:3100' }, data: { personId: 'P001' } });
    expect(forbidden.status()).toBe(403);
    await page.goto('/?family=other');
    await expect(page.locator('main [role=alert]')).toHaveText('You do not have access to this family.');
    await page.goto('/');
    await db.update(admissions).set({ status: 'REVOKED' }).where(eq(admissions.id, 'M002'));
    await page.reload(); await expect(page.locator('main [role=alert]')).toHaveText('You do not have access to this family.');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(identity).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    const recorded = await db.select().from(events);
    expect(recorded.map(e => e.eventType)).toEqual(expect.arrayContaining(['auth_started', 'auth_succeeded', 'family_accessed', 'onboarding_started', 'person_selected', 'identity_claim_started', 'identity_claim_succeeded', 'identity_claim_failed', 'onboarding_completed', 'explorer_viewed', 'logout']));
    expect(JSON.stringify(recorded)).not.toMatch(/sam@example.com|1978-02-14/);
  } finally {
    await db.update(admissions).set({ status: 'ACTIVE' }).where(eq(admissions.id, 'M002'));
    await pool.end();
  }
});
