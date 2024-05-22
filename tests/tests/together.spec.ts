import { test, expect } from '@playwright/test';

// create a together lobby, get invitation link, two other users join the lobby
// a solve is started, the solve is ended
test('Together lobby with 3 users and a solve', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();
    const user3Context = await browser.newContext();
    await user1Context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const page1 = await user1Context.newPage();
    const page2 = await user2Context.newPage();
    const page3 = await user3Context.newPage();

    await page1.goto('http://localhost:3000/');
    await page2.goto('http://localhost:3000/');
    await page3.goto('http://localhost:3000/');

    // login page1 as admin
    await page1.getByRole('button', { name: 'Login' }).click();
    await page1.getByPlaceholder('Your username').click();
    await page1.getByPlaceholder('Your username').fill(process.env.ADMIN_USERNAME as string);
    await page1.getByPlaceholder('Your password').click();
    await page1.getByPlaceholder('Your password').fill(process.env.ADMIN_PASSWORD as string);
    await page1.getByRole('button', { name: 'Login' }).click();
    await expect(page1.locator('#root')).toContainText('Welcome, admin');

    const page1username = "admin";
    const page2username = await page2.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;
    const page3username = await page3.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;

    // create together lobby and get invitation link
    await page1.getByRole('button', { name: 'Together room' }).click();
    await page1.getByRole('button', { name: 'Generate invite link' }).click();
    await page1.waitForTimeout(500);
    await page1.getByRole('button', { name: 'Copy to clipboard' }).click();
    let inviteURL: string = await page1.evaluate("navigator.clipboard.readText()");

    await page2.goto(inviteURL);
    await page3.goto(inviteURL);

    // check whether all users connected
    for (const context of [page1, page2, page3]) {
        for (const username of [page1username, page2username, page3username]) {
            await context.getByText(username).isVisible();
        }
    }

    // assert that there is no current solve
    await expect(page1.getByRole('button', { name: 'Solve start' })).toBeVisible();
    await expect(page1.getByText('StatisticsTotal solves:')).toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).toBeVisible();

    // start the solve, wait for inspection end and solve the cube
    await page1.getByRole('button', { name: 'Solve start' }).click();
    await page1.waitForTimeout(4000);

    // check that we are in a solve
    await expect(page1.getByRole('button', { name: 'Solve start' })).not.toBeVisible();
    await expect(page1.getByText('StatisticsTotal solves:')).not.toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).not.toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).not.toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).not.toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).not.toBeVisible();

    await page1.keyboard.press("Control+Alt+S");
    // asert that the solve has ended
    await expect(page1.getByRole('button', { name: 'Solve start' })).toBeVisible({timeout: 10000});
    await expect(page1.getByText('StatisticsTotal solves:')).toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).toBeVisible();
    await expect(page2.getByRole('button', { name: 'Solve start' })).toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).toBeVisible();
    await expect(page3.getByText('StatisticsTotal solves:')).toBeVisible();


    await page1.locator('.m_8bffd616 > div > button:nth-child(3)').click();
    await expect(page2.getByText(page1username)).not.toBeVisible();
    await expect(page3.getByText(page1username)).not.toBeVisible();

    await page2.locator('.m_8bffd616 > div > button:nth-child(3)').click();
    await expect(page3.getByText(page2username)).not.toBeVisible();
});