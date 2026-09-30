import { expect, type Page } from '@playwright/test';

/** No horizontal scrolling, and inputs are ≥16px (so iOS doesn't zoom). */
export async function expectPhoneFriendly(page: Page) {
  const { overflow, smallInputs } = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    smallInputs: [...document.querySelectorAll('input, textarea')].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length,
  }));
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
  expect(smallInputs, 'inputs with font-size < 16px').toBe(0);
}

export async function createRoom(page: Page, name: string, opts: { short?: boolean } = {}) {
  await page.goto('/#/new');
  await page.getByPlaceholder('e.g. Sofie').fill(name);
  if (opts.short) await page.getByRole('radio', { name: /Short/ }).click();
  await expectPhoneFriendly(page);
  await page.getByRole('button', { name: 'Create room' }).click();
  const code = (await page.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);
  return code;
}

export async function joinRoom(page: Page, code: string, name: string) {
  await page.goto('/');
  await page.getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await page.getByPlaceholder('e.g. Sofie').fill(name);
  await expectPhoneFriendly(page);
  await page.getByRole('button', { name: 'Join the game' }).click();
  await expect(page.getByTestId('players')).toBeVisible();
}

let lieCounter = 0;

/**
 * Do whatever this player can do on the current screen. Returns a label of what it did.
 * Used to drive several phones through a full game without scripting every step.
 */
export async function step(page: Page, isHost: boolean): Promise<string> {
  const truths = page.getByPlaceholder('Your true answer');
  if (await truths.count()) {
    for (let i = 0; i < (await truths.count()); i++) {
      const input = truths.nth(i);
      if (!(await input.inputValue())) {
        await input.fill(`true fact ${i} ${Math.random().toString(36).slice(2, 7)}`);
        await input.press('Enter');
      }
    }
    return 'truths';
  }
  const lie = page.getByTestId('lie-input');
  if (await lie.isVisible().catch(() => false)) {
    await lie.fill(`fake answer ${++lieCounter}`);
    await page.getByTestId('lie-submit').click();
    return 'lie';
  }
  const options = page.locator('[data-testid="options"] .option-btn:not(:disabled)');
  if ((await options.count()) && !(await page.locator('.option-btn.selected').count())) {
    await options.first().click();
    return 'pick';
  }
  if (await page.getByTestId('final-truth').isVisible().catch(() => false)) {
    await page.getByTestId('final-truth').fill(`I have been to ${Math.random().toString(36).slice(2, 7)}`);
    await page.getByTestId('final-lie').fill(`I own a ${Math.random().toString(36).slice(2, 7)}`);
    await page.getByTestId('final-submit').click();
    return 'final-write';
  }
  const tf = page.locator('[data-testid="tf-options"] .tf-option:not(:disabled)');
  if ((await tf.count()) && !(await page.locator('.tf-option.selected').count())) {
    await tf.first().click();
    return 'final-pick';
  }
  if (isHost) {
    const next = page.getByTestId('host-next');
    const onHostPaced = (await page.getByTestId('reveal-card').count()) || (await page.getByTestId('scoreboard').count()) || (await page.locator('.points-list').count()) || (await page.getByTestId('final-reveal').count());
    if (onHostPaced && (await next.isEnabled().catch(() => false))) {
      await next.click();
      await page.waitForTimeout(800);
      return 'next';
    }
  }
  return 'idle';
}
