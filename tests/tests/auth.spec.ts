import { test, expect } from '@playwright/test';

test('register and login sucess', async ({ page }) => {
  // random username
  const username = "username" + Math.random();

  await page.goto('http://localhost:3000/');
  await expect(page.locator('#root')).toContainText(/Welcome, Anonymous*/);

  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByPlaceholder('Your username').click();
  await page.getByPlaceholder('Your username').fill(username);

  await page.getByLabel('Password *', { exact: true }).click();
  await page.getByLabel('Password *', { exact: true }).fill('password');
  await page.getByLabel('Password *', { exact: true }).press('Tab');

  await page.getByLabel('Confirm password *').fill('password');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.locator('#root')).toContainText('Welcome, username');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.locator('#root')).toContainText(/Welcome, Anonymous*/);

  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByPlaceholder('Your username').click();
  await page.getByPlaceholder('Your username').fill(username);
  await page.getByPlaceholder('Your password').click();
  await page.getByPlaceholder('Your password').fill('password');
  await page.getByPlaceholder('Your password').press('Enter');

  await expect(page.locator('#root')).toContainText('Welcome, username');

  await page.getByRole('button', { name: 'Logout' }).click();

  await expect(page.locator('#root')).toContainText(/Welcome, Anonymous*/);
});

test('register and login failures', async ({ page }) => {
  const username = "username" + Math.random();
  await page.goto('http://localhost:3000/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByPlaceholder('Your username').click();
  await page.getByPlaceholder('Your username').fill('');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Fill in all form fields')).toBeVisible();
  await page.getByPlaceholder('Your username').click();
  await page.getByPlaceholder('Your username').fill(username);
  await page.getByPlaceholder('Your username').press('Tab');
  await page.getByPlaceholder('Your email').press('Tab');
  await page.getByLabel('Password *', { exact: true }).fill('aaaaa');
  await page.getByLabel('Password *', { exact: true }).press('Tab');
  await page.getByLabel('Confirm password *').fill('aaa');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();
  await page.getByLabel('Password *', { exact: true }).click();
  await page.getByLabel('Password *', { exact: true }).fill('short');
  await page.getByLabel('Password *', { exact: true }).press('Tab');
  await page.getByLabel('Confirm password *').fill('short');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Password should be at least 6')).toBeVisible();
  await page.getByLabel('Password *', { exact: true }).click();
  await page.getByLabel('Password *', { exact: true }).fill('short1');
  await page.getByLabel('Confirm password *').click();
  await page.getByLabel('Confirm password *').fill('short1');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.locator('#root')).toContainText(`Welcome, ${username}`);
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByPlaceholder('Your username').click();
  await page.getByPlaceholder('Your username').fill(username);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Fill in all form fields')).toBeVisible();
  await page.getByPlaceholder('Your password').click();
  await page.getByPlaceholder('Your password').fill('aa');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByText('Wrong username or password')).toBeVisible();
  await page.getByPlaceholder('Your password').click();
  await page.getByPlaceholder('Your password').fill('short1');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('#root')).toContainText(`Welcome, ${username}`);
  await page.getByRole('button', { name: 'Logout' }).click();
});