import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Screenshots go to E2E_SHOTS if set, otherwise a temp folder — never a hard-coded system path.
const shots = process.env.E2E_SHOTS ?? path.join(os.tmpdir(), 'tidecaller-e2e');
test.beforeAll(() => {
  fs.mkdirSync(shots, { recursive: true });
});

test('first act is playable without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Зов прилива' })).toBeVisible();
  await page.screenshot({ path: `${shots}/01-menu.png` });

  await page.getByTestId('start').click();
  await expect(page.getByTestId('combat')).toBeVisible();
  await expect(page.getByTestId('coach')).toBeVisible();
  await expect(page.getByTestId('tide')).toHaveAttribute('data-tide', '4');
  await page.screenshot({ path: `${shots}/02-tutorial.png` });

  const hot = page.locator('[data-testid=card][data-playable="1"]').first();
  await hot.click();
  await expect(page.getByTestId('coach')).toContainText(/Ламинария|Kelp Guard/);
  await page.locator('[data-testid=card][data-playable="1"]').first().click();
  await page.locator('[data-testid=card][data-playable="1"]').first().click();
  await page.getByTestId('end-turn').click();
  await expect(page.getByTestId('tide')).not.toHaveAttribute('data-tide', '4');
  await page.screenshot({ path: `${shots}/03-after-turn.png` });

  for (let i = 0; i < 40 && (await page.getByTestId('combat').count()); i++) {
    const phase = await page.getByTestId('combat').getAttribute('data-phase');
    if (phase === 'win') {
      await page.getByTestId('ack-win').click();
      break;
    }
    const playable = page.locator('[data-testid=card][data-playable="1"]');
    if (await playable.count()) await playable.first().click();
    else await page.getByTestId('end-turn').click();
  }

  await expect(page.getByTestId('story')).toBeVisible();
  await page.screenshot({ path: `${shots}/04-after-cove.png` });
  await page.getByTestId('ack-story').click();
  await page.getByTestId('ack-story').click();
  await expect(page.getByTestId('map')).toBeVisible();
  await page.screenshot({ path: `${shots}/05-map.png` });

  const seen = new Set<string>();
  for (let step = 0; step < 700; step++) {
    const screen = await page.getByTestId('app').getAttribute('data-screen');
    if (!screen) break;
    seen.add(screen);
    if (screen === 'map' && !seen.has('shot-map')) {
      seen.add('shot-map');
    }
    if (screen === 'event' && !seen.has('shot-event')) {
      seen.add('shot-event');
      await page.screenshot({ path: `${shots}/06-event.png` });
    }
    if (screen === 'shop' && !seen.has('shot-shop')) {
      seen.add('shot-shop');
      await page.screenshot({ path: `${shots}/07-shop.png` });
    }
    if (screen === 'combat' && !seen.has('shot-combat')) {
      const phase = await page.getByTestId('combat').getAttribute('data-phase');
      const hull = (await page.getByTestId('hull').textContent()) ?? '';
      if (phase === 'player' && !/Корпус 0\//.test(hull) && !/Hull 0\//.test(hull)) {
        seen.add('shot-combat');
        await page.screenshot({ path: `${shots}/08-combat.png` });
      }
    }
    if (screen === 'reward' && !seen.has('shot-reward')) {
      seen.add('shot-reward');
      await page.screenshot({ path: `${shots}/09-reward.png` });
    }
    if (screen === 'rest' && !seen.has('shot-rest')) {
      seen.add('shot-rest');
      await page.screenshot({ path: `${shots}/10-rest.png` });
    }
    if (step < 36) await page.waitForTimeout(280);
    if (screen === 'victory' || screen === 'defeat') break;
    const act = await page.locator('.kicker').first().textContent();
    if (act && /Акт\s+2|Act\s+2/.test(act) && screen === 'map') {
      await page.screenshot({ path: `${shots}/11-act2.png` });
      break;
    }
    const action = await page.evaluate(() => window.__TIDECALLER__?.policyStep() ?? null);
    if (!action) break;
  }

  const finalScreen = await page.getByTestId('app').getAttribute('data-screen');
  await page.screenshot({ path: `${shots}/12-act1-end.png` });
  expect(seen.has('combat') || finalScreen === 'combat').toBeTruthy();
  expect(seen.has('event') || seen.has('shop') || seen.has('reward')).toBeTruthy();
  expect(['map', 'combat', 'story', 'reward', 'event', 'shop', 'rest', 'victory', 'defeat']).toContain(finalScreen);
  const floors = await page.evaluate(() => window.__TIDECALLER__?.getState().run?.floors ?? window.__TIDECALLER__?.getState().outcome?.floors ?? 0);
  expect(floors).toBeGreaterThanOrEqual(4);
  expect(errors, errors.join('\n')).toEqual([]);
});
