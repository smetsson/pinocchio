import { expect, test, type Page } from '@playwright/test';
import { createRoom, expectPhoneFriendly, joinRoom, step } from './helpers';

test('three phones play a full game from lobby to podium', async ({ browser, browserName }, info) => {
  const device = info.project.use;
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ ...device })));
  const [host, ann, bob] = await Promise.all(contexts.map((c) => c.newPage()));
  const pages: Page[] = [host, ann, bob];

  const code = await createRoom(host, 'Hostie', { short: true });
  // A laptop showing the big-screen view (watches only, doesn't join).
  const screenCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const screen = await screenCtx.newPage();
  await screen.goto(`/#/screen/${code}`);
  await expect(screen.locator('.room-code')).toHaveText(code);

  await joinRoom(ann, code, 'Ann');
  await joinRoom(bob, code, 'Bob');
  await expect(host.getByTestId('players').locator('.player')).toHaveCount(3);
  await expect(screen.locator('.player')).toHaveCount(3);

  await host.getByTestId('host-next').click(); // Start game
  await expect(host.getByText('Tell the truth!')).toBeVisible();

  // A refresh mid-game rejoins the same seat.
  await ann.reload();
  await expect(ann.getByText('Tell the truth!')).toBeVisible();

  const seen = new Set<string>();
  const deadline = Date.now() + 200_000;
  while (Date.now() < deadline) {
    if (await host.getByTestId('podium').isVisible().catch(() => false)) break;
    for (const [i, page] of pages.entries()) {
      const did = await step(page, i === 0).catch(() => 'error');
      seen.add(did);
    }
    // Check the layout on every phone once per screen type.
    for (const page of pages) await expectPhoneFriendly(page);
  }

  for (const page of pages) await expect(page.getByTestId('podium')).toBeVisible();
  for (const label of ['truths', 'lie', 'pick', 'next', 'final-write', 'final-pick']) expect(seen, `never did: ${label}`).toContain(label);
  await expect(host.getByTestId('scoreboard').locator('.points-row')).toHaveCount(3);
  await expect(screen.getByTestId('podium')).toBeVisible();
  await expect(screen.getByRole('button', { name: /New game/ })).toHaveCount(0);

  // "Play again": everyone (and the big screen) moves to a fresh lobby with the same players.
  await host.getByTestId('play-again').click();
  const nextCode = (await host.getByTestId('room-code').textContent())!.trim();
  expect(nextCode).not.toBe(code);
  for (const page of pages) {
    await expect(page.getByTestId('room-code')).toHaveText(nextCode);
    await expect(page.getByTestId('players').locator('.player')).toHaveCount(3);
  }
  await expect(screen.locator('.room-code')).toHaveText(nextCode);
  await screenCtx.close();
  void browserName;
  await Promise.all(contexts.map((c) => c.close()));
});

test('home and join screens fit the phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Create a room')).toBeVisible();
  await expectPhoneFriendly(page);
  // The rules start closed and open on tap, with point values from the scoring config.
  await expect(page.getByText('Find the truth: +1,000')).toBeHidden();
  await page.getByText('📖 How to play').click();
  await expect(page.getByText('Find the truth: +1,000')).toBeVisible();
  await expect(page.getByText('Round 2 counts double!')).toBeVisible();
  await page.getByText('📖 How to play').click();
  await expect(page.getByText('Find the truth: +1,000')).toBeHidden();
  await page.getByLabel('Room code').fill('ZZZZ');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText("That room doesn't exist")).toBeVisible();
});

test('pre-call mode: answer days ahead, and the host can recover on a new phone', async ({ browser }, info) => {
  const device = info.project.use;
  const [hostCtx, annCtx, bobCtx, newPhoneCtx] = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ ...device })));
  const host = await hostCtx.newPage();
  await host.goto('/#/new');
  await host.getByPlaceholder('e.g. Sofie').fill('Hostie');
  await host.getByRole('radio', { name: /Before the call/ }).click();
  await host.getByRole('button', { name: 'Create room' }).click();
  // Pre-call rooms open the truth phase straight away (no timer).
  await expect(host.getByText('Tell the truth!')).toBeVisible();
  await expect(host.locator('.timer')).toHaveCount(0);
  const code = (await host.locator('.header .chip.accent').textContent())!.trim();

  for (const [ctx, name] of [[annCtx, 'Ann'], [bobCtx, 'Bob']] as const) {
    const page = await ctx.newPage();
    await page.goto(`/#/r/${code}`);
    await page.getByPlaceholder('e.g. Sofie').fill(name);
    await page.getByRole('button', { name: 'Join the game' }).click();
    const inputs = page.getByPlaceholder('Your true answer');
    await expect(inputs).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await inputs.nth(i).fill(`${name} truth ${i}`);
      await inputs.nth(i).press('Enter');
      if (i === 0) await expect(page.getByText('Saved ✓')).toBeVisible();
    }
    await expect(page.getByText('All done! 🎉')).toBeVisible();
  }

  // The host's phone "breaks": open the host recovery link on a new phone.
  const hostKey = await host.evaluate((c) => JSON.parse(localStorage.getItem('pinocchio:v1')!).seats[c].hostKey, code);
  await hostCtx.close();
  const newPhone = await newPhoneCtx.newPage();
  await newPhone.goto(`/#/r/${code}?host=${hostKey}`);
  await expect(newPhone.getByTestId('host-next')).toHaveText('Start game');
  await newPhone.getByTestId('host-next').click();
  await expect(newPhone.getByText('Round 1')).toBeVisible();
  await Promise.all([annCtx, bobCtx, newPhoneCtx].map((c) => c.close()));
});

test('a latecomer can jump in, and a backup host keeps the game going when the host drops', async ({ browser }, info) => {
  const device = info.project.use;
  const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ ...device })));
  const [host, ann, bob, late] = await Promise.all(contexts.map((c) => c.newPage()));
  const code = await createRoom(host, 'Hostie', { short: true });
  await joinRoom(ann, code, 'Ann');
  await joinRoom(bob, code, 'Bob');
  await host.getByTestId('host-next').click();
  for (const page of [host, ann, bob]) await step(page, false); // answer truths
  await expect(host.getByTestId('host-next')).toHaveText(/Skip/);
  await expect(host.getByText('Round 1')).toBeVisible();

  // A latecomer joins mid-round and can play right away.
  await late.goto(`/#/r/${code}`);
  await expect(late.getByText(/already going/)).toBeVisible();
  await late.getByPlaceholder('e.g. Sofie').fill('Latecomer');
  await late.getByRole('button', { name: 'Join the game' }).click();
  await expect(late.getByText('Round 1')).toBeVisible();

  // The host's phone drops out: after ± 15 s, the first connected player (Ann) stands in.
  await host.goto('about:blank');
  await expect(ann.getByTestId('host-next')).toBeVisible({ timeout: 40_000 });
  await expect(ann.getByText(/You're hosting until Hostie is back/)).toBeVisible();
  await expect(bob.getByTestId('host-next')).toHaveCount(0);
  // ...and the game keeps moving: once the connected players have lied, the stand-in moves on to picking.
  const picking = bob.getByText('Find the truth!').or(bob.getByText('Who will find your truth?'));
  await expect(async () => {
    for (const page of [ann, bob, late]) await step(page, false);
    await expect(picking).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  // The host comes back and automatically gets hosting back.
  await host.goto(`/#/r/${code}`);
  await expect(host.getByTestId('host-next')).toBeVisible({ timeout: 15_000 });
  await expect(ann.getByTestId('host-next')).toHaveCount(0, { timeout: 15_000 });
  await expect(ann.getByText('Round 1')).toBeVisible(); // Ann is back to a normal player
  await Promise.all(contexts.map((c) => c.close()));
});
