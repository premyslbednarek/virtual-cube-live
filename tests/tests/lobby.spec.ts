import { test, expect } from '@playwright/test';

// create lobby and copy its invitation link, a second users opens the link
// and joins the lobby, after that, the lobby creator disconnects
test('join a lobby via invitation link', async ({ browser }) => {
    // Create two isolated browser contexts
    const creatorContext = await browser.newContext();
    const joinerContext = await browser.newContext();
     await creatorContext.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Create pages and interact with contexts independently
    const creator = await creatorContext.newPage();
    const joiner = await joinerContext.newPage();

    await creator.goto('http://localhost:3000/');
    const creatorUsername = await creator.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;

    await joiner.goto('http://localhost:3000/');
    const joinerUsername = await joiner.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;

    await creator.getByRole('button', { name: 'Create lobby' }).click();

    await creator.waitForTimeout(1000);

    await creator.getByRole('button', { name: 'Generate invite link' }).click();

    await creator.getByRole('button', { name: 'Copy to clipboard' }).click();

    let inviteURL: string = await creator.evaluate("navigator.clipboard.readText()");

    await joiner.goto(inviteURL);

    await expect(creator.getByText(creatorUsername).first()).toBeVisible();
    await expect(creator.getByText(joinerUsername).first()).toBeVisible();
    await expect(joiner.getByText(creatorUsername).first()).toBeVisible();
    await expect(joiner.getByText(joinerUsername).first()).toBeVisible();

    // leave lobby
    await expect(joiner.locator('span').getByText(creatorUsername)).toBeVisible();
    await creator.locator('div').filter({ hasText: /^admin panel$/ }).getByRole('button').nth(1).click();
    await expect(joiner.locator('span').getByText(creatorUsername)).not.toBeVisible();
});

test('kick user out of lobby', async ({ browser }) => {
    // Create two isolated browser contexts
    const page1Context = await browser.newContext();
    const page2Context = await browser.newContext();
    await page1Context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // Create pages and interact with contexts independently
    const page1 = await page1Context.newPage();
    const page2 = await page2Context.newPage();

    await page1.goto('http://localhost:3000/');
    const page1username = await page1.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;
    await page2.goto('http://localhost:3000/');
    const page2username = await page2.getByText(/Welcome, Anonymous/).textContent().then(val => val?.split(" ")[1]) as string;

    await page1.getByRole('button', { name: 'Create lobby' }).click();

    await page1.waitForTimeout(1000);
    await page1.getByRole('button', { name: 'Generate invite link' }).click();

    await page1.getByRole('button', { name: 'Copy to clipboard' }).click();

    let inviteURL: string = await page1.evaluate("navigator.clipboard.readText()");

    await page2.goto(inviteURL);

    await expect(page1.getByText(page1username).first()).toBeVisible();
    await expect(page1.getByText(page1username).first()).toBeVisible();
    await expect(page2.getByText(page1username).first()).toBeVisible();
    await expect(page2.getByText(page1username).first()).toBeVisible();

    // kick the user out of the lobby
    await page1.getByRole('button', { name: 'admin panel' }).click();
    await page1.getByRole('button', { name: 'Kick out of lobby' }).click();
    await expect(page1.getByText('There are no other users in this lobby')).toBeVisible();

    await expect(page1.locator('span').getByText(page2username)).not.toBeVisible();
    await expect(page2.getByText("kicked")).toBeVisible();

    // try to go back into the lobby
    await page2.goto(inviteURL);
    await expect(page2).not.toHaveURL(/lobby/);
});

test('lobby race', async ({ browser }) => {
    test.setTimeout(120000);
    // Create two isolated browser contexts
    const page1Context = await browser.newContext();
    const page2Context = await browser.newContext();
    const page3Context = await browser.newContext();

    await page1Context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page1 = await page1Context.newPage();

    // login page1 to admin acc
    await page1.goto('http://localhost:3000/');
    await page1.getByRole('button', { name: 'Login' }).click();
    await page1.getByPlaceholder('Your username').click();
    await page1.getByPlaceholder('Your username').fill(process.env.ADMIN_USERNAME as string);
    await page1.getByPlaceholder('Your password').click();
    await page1.getByPlaceholder('Your password').fill(process.env.ADMIN_PASSWORD as string);
    await page1.getByRole('button', { name: 'Login' }).click();

    const page2 = await page2Context.newPage();
    const page3 = await page3Context.newPage();

    await page2.goto('http://localhost:3000/');
    await page3.goto('http://localhost:3000/');

    await page1.getByRole('button', { name: 'Create lobby' }).click();

    await page1.waitForTimeout(1000);
    await page1.getByRole('button', { name: 'Generate invite link' }).click();

    await page1.getByRole('button', { name: 'Copy to clipboard' }).click();

    let inviteURL: string = await page1.evaluate("navigator.clipboard.readText()");

    await page2.goto(inviteURL);
    await page3.goto(inviteURL);

    // see that the lobby cant be started
    await expect(page1.getByRole('button', { name: 'Start race' })).toBeDisabled();

    // all three click the ready button
    await page1.getByRole('button', { name: 'YOU ARE UNREADY' }).click();
    await page2.getByRole('button', { name: 'YOU ARE UNREADY' }).click();
    await page3.getByRole('button', { name: 'YOU ARE UNREADY' }).click();

    // start race should be enabled
    await expect(page1.getByRole('button', { name: 'Start race' })).toBeEnabled();

    await page3.getByRole('button', { name: 'YOU ARE READY' }).click();
    await expect(page1.getByRole('button', { name: 'Start race' })).toBeDisabled();
    await page3.getByRole('button', { name: 'YOU ARE UNREADY' }).click();
    await expect(page1.getByRole('button', { name: 'Start race' })).toBeEnabled();

    await page1.getByRole('button', { name: 'Start race' }).click();

    await expect(page1.getByRole('heading', { name: 'Last race results' })).not.toBeVisible();
    await expect(page1.getByRole('heading', { name: 'Total points' })).not.toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Last race results' })).not.toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Last race results' })).not.toBeVisible();
    await expect(page3.getByRole('heading', { name: 'Total points' })).not.toBeVisible();
    await expect(page3.getByRole('heading', { name: 'Total points' })).not.toBeVisible();

    await page1.waitForTimeout(5000);
    await page1.keyboard.press("Control+Alt+s");

    await expect(page1.getByRole('heading', { name: 'Last race results' })).toBeVisible({timeout: 25000});
    await expect(page1.getByRole('heading', { name: 'Total points' })).toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Last race results' })).toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Last race results' })).toBeVisible();
    await expect(page3.getByRole('heading', { name: 'Total points' })).toBeVisible();
    await expect(page3.getByRole('heading', { name: 'Total points' })).toBeVisible();
});