import { expect, test } from '@playwright/test';

test('a prospect call runs through booking, CRM, quote email, follow-up, and salesperson alert', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good morning, Morgan' })).toBeVisible();
  const runButton = page.getByRole('button', { name: 'Run inbound demo' });
  await expect(runButton).toBeEnabled({ timeout: 30_000 });
  await runButton.click();
  await expect(page.getByText('Contact created · visit booked · quote emailed · salesperson alerted')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Hash chain verified').first()).toBeVisible();
});
