import { test, expect, Page } from '@playwright/test';

export async function admin_auth(page: Page) {
    await page.goto('http://localhost:3000/');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByPlaceholder('Your username').click();
    await page.getByPlaceholder('Your username').fill(process.env.ADMIN_USERNAME as string);
    await page.getByPlaceholder('Your password').click();
    await page.getByPlaceholder('Your password').fill(process.env.ADMIN_PASSWORD as string);
    await page.getByRole('button', { name: 'Login' }).click();
}

for (let cube_size = 2; cube_size <= 4; ++cube_size) {
    test(`test solve ${cube_size}x${cube_size}x${cube_size}`, async ({ page }) => {
        await admin_auth(page);

        // go to solo mode
        await page.getByRole('button', { name: 'Solo mode' }).click();
        await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Time list' })).toBeVisible();

        // set size to 2x2x2
        await page.locator('div').filter({ hasText: /^Cube size/ }).getByRole('button').first().click();

        // set appropriate cube size
        for (let i = 0; i < cube_size - 2; ++i) {
            await page.locator('div').filter({ hasText: /^Cube size/ }).getByRole('button').nth(1).click();
        }

        await page.getByRole('button', { name: 'Start solve [spacebar]' }).click();
        await page.waitForTimeout(7000);

        await expect(page.getByRole('heading', { name: 'Time list' })).not.toBeVisible();
        await expect(page.getByRole('heading', { name: 'Statistics' })).not.toBeVisible();

        await page.locator('body').press('Alt+Control+s');
        await page.waitForTimeout(15000);

        await expect(page.getByRole('heading', { name: 'Time list' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
    });
}
