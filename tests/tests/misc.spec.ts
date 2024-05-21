import { test, expect } from '@playwright/test';

test('search bar test', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.getByPlaceholder('Find User by Username').click();
    await page.getByPlaceholder('Find User by Username').fill('non_existing_account');
    await page.getByPlaceholder('Find User by Username').press('Enter');
    await expect(page).not.toHaveURL(/user/);

    await page.getByPlaceholder('Find User by Username').fill('admin');
    await page.getByPlaceholder('Find User by Username').press('Enter');
    await expect(page).toHaveURL(/user/);
});

test('admin rights + suspend', async ({ page }) => {
    const random = "username" + Math.random();
    const pass = String(Math.random());
    await page.goto('http://localhost:3000/');

    // create new account
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('Your username').click();
    await page.getByPlaceholder('Your username').fill(random);
    await page.getByLabel('Password *', { exact: true }).fill(pass);
    await page.getByLabel('Confirm password *').fill(pass);
    await page.getByLabel('Confirm password *').press('Enter');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();

    // login with admin acc
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByPlaceholder('Your username').click();
    await page.getByPlaceholder('Your username').fill(process.env.ADMIN_USERNAME as string);
    await page.getByPlaceholder('Your password').click();
    await page.getByPlaceholder('Your password').fill(process.env.ADMIN_PASSWORD as string);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByPlaceholder('Find User by Username').fill(random);
    await page.getByPlaceholder('Find User by Username').press('Enter');
    await expect(page).toHaveURL(/user/);

    // suspend and unsuspend
    await expect(page.getByRole('button', { name: 'ban account' })).toBeVisible();
    await page.getByRole('button', { name: 'ban account' }).click();
    await expect(page.getByText('This account has been suspended')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unban account' })).toBeVisible();
    await page.getByRole('button', { name: 'Unban account' }).click();
    await expect(page.getByText('This account has been suspended')).not.toBeVisible();

    // user is not admin
    await expect(page.locator('#root div').filter({ hasText: 'Profile pageusername0.' }).getByRole('img').nth(1)).not.toBeVisible();

    await page.getByRole('button', { name: 'Make admin' }).click();

    // user is admin
    await expect(page.locator('#root div').filter({ hasText: 'Profile pageusername0.' }).getByRole('img').nth(1)).toBeVisible();
});