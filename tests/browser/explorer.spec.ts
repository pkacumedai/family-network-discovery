import { test, expect } from '@playwright/test';
test('explores the database fixture with search, selection and interchangeable layouts', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore the people who connect us.');
  await expect(page.getByRole('list', { name: 'People', exact: true }).getByRole('button')).toHaveCount(6);
  const search = page.getByRole('searchbox');
  await search.fill('sAm');
  const results = page.getByRole('list', { name: 'People', exact: true }).getByRole('button');
  await expect(results).toHaveCount(2);
  await expect(results.nth(0)).toContainText('Parent: Alex Example');
  await expect(results.nth(1)).not.toContainText('Parent: Alex Example');
  await results.nth(0).click();
  const context = page.getByRole('complementary', { name: 'Selected person' });
  await expect(context.getByRole('heading', { level: 2 })).toHaveText('Sam Example');
  await expect(context).toContainText('Immediate connections 4');
  const graph = page.getByRole('region', { name: 'Interactive family network', exact: true });
  await expect(graph.locator('canvas').first()).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  // Search centers its node; clear via the graph background, then select that same canvas node.
  await graph.click({ position: { x: 10, y: 10 } });
  await expect(context).toContainText('Every connection has a story.');
  const bounds = await graph.boundingBox();
  await graph.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(context.getByRole('heading', { level: 2 })).toHaveText('Sam Example');
  await page.getByRole('button', { name: 'Network', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Network', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect(context.getByRole('heading', { level: 2 })).toHaveText('Sam Example');
  await page.getByRole('button', { name: 'Generational', exact: true }).click();
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect(context.getByRole('heading', { level: 2 })).toHaveText('Sam Example');
  await context.getByRole('button', { name: 'Center in graph' }).click();
  const zoom = page.getByLabel('Zoom level');
  const initialZoom = await zoom.textContent();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(zoom).not.toHaveText(initialZoom!);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await search.fill('no such person');
  await expect(page.getByText('No people match')).toBeVisible();
  await search.fill('Jordan');
  await page.getByRole('list', { name: 'People', exact: true }).getByRole('button').click();
  await expect(context).toContainText('No relationships recorded for this person.');
  await search.fill('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Neither SSR/RSC payloads nor rendered text may contain fixture DOB, notes, or Member emails.
  const html = await (await page.request.get('/')).text();
  expect(html).not.toMatch(/1950-06-12|1978-02-14|alex@example.com|Disconnected ancestor|birthDate|seedSource/);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.screenshot({ path: `test-results/explorer-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('pointer navigation and touch selection keep records unchanged', async ({ page }, testInfo) => {

  await page.goto('/');
  await page.getByRole('searchbox').fill('Alex');
  await page.getByRole('list', { name: 'People', exact: true }).getByRole('button').click();
  const graph = page.getByRole('region', { name: 'Interactive family network', exact: true });
  await expect(graph.locator('canvas').first()).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  const bounds = (await graph.boundingBox())!;
  if (testInfo.project.name === 'mobile') {
    await graph.tap({ position: { x: 10, y: 10 } });
    await graph.tap({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.getByRole('complementary', { name: 'Selected person' }).getByRole('heading', { level: 2 })).toHaveText('Alex Example');
    return;
  }
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 100, y + 65, { steps: 15 }); await page.mouse.up();
  await graph.click({ position: { x: 10, y: 10 } });
  await page.mouse.click(x + 100, y + 65);
  await expect(page.getByRole('complementary', { name: 'Selected person' }).getByRole('heading', { level: 2 })).toHaveText('Alex Example');
  await graph.focus(); await page.keyboard.press('ArrowRight');
  await graph.click({ position: { x: 10, y: 10 } });
  await page.mouse.click(x + 60, y + 65);
  await expect(page.getByRole('complementary', { name: 'Selected person' }).getByRole('heading', { level: 2 })).toHaveText('Alex Example');
  // Global teardown verifies every stored row stayed unchanged across all browser tests.
});
