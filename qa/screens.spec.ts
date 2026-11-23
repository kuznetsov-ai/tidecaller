import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { buildFixtures, type Fixture } from './fixtures';
import { LAYOUT_SRC } from './layout';

const SHOTS = process.env.SHOTS ?? '/workspace/tidecaller-qa/shots/run';
const REPORT = process.env.REPORT ?? '/workspace/tidecaller-qa/qa-report/run';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
export const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '360x740', width: 360, height: 740, mobile: true },
];
const LANGS = (process.env.LANGS ?? 'ru,en').split(',') as ('ru' | 'en')[];
const fixtures: Fixture[] = buildFixtures().filter((f) => !ONLY || ONLY.test(f.name));

for (const vp of VIEWPORTS) {
  for (const lang of LANGS) {
    test(`screens ${vp.name} ${lang}`, async ({ browser }) => {
      test.setTimeout(900_000);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: !!vp.mobile,
        hasTouch: !!vp.mobile,
      });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
      const dir = path.join(SHOTS, vp.name, lang);
      fs.mkdirSync(dir, { recursive: true });
      fs.mkdirSync(REPORT, { recursive: true });
      const report: Record<string, { screen: string | null; issues: { type: string; detail: string }[]; errors: string[] }> = {};
      await page.goto('/');
      for (const fx of fixtures) {
        const state = structuredClone(fx.state);
        state.meta.settings.lang = lang;
        const before = errors.length;
        await page.evaluate((s) => localStorage.setItem('tidecaller-save-v1', s), JSON.stringify(state));
        await page.reload();
        await page.waitForSelector('[data-testid=app]');
        await page.evaluate(() => document.fonts.ready.then(() => 1));
        for (const step of fx.steps ?? []) {
          if ('click' in step) await page.locator(step.click).nth(step.nth ?? 0).click();
          else if ('key' in step) await page.keyboard.press(step.key);
          else await page.waitForTimeout(step.wait);
        }
        await page.waitForTimeout(120);
        const screen = await page.getByTestId('app').getAttribute('data-screen');
        await page.screenshot({ path: path.join(dir, `${fx.name}.png`), fullPage: true, animations: 'disabled' });
        const issues = await page.evaluate(LAYOUT_SRC);
        report[fx.name] = { screen, issues, errors: errors.slice(before) };
      }
      // one-pager
      for (const p of ['onepager.html']) {
        const before = errors.length;
        await page.goto(`/${p}`);
        await page.evaluate(() => document.fonts.ready.then(() => 1));
        await page.screenshot({ path: path.join(dir, `onepager.png`), fullPage: true, animations: 'disabled' });
        report.onepager = { screen: 'onepager', issues: await page.evaluate(LAYOUT_SRC), errors: errors.slice(before) };
      }
      fs.writeFileSync(path.join(REPORT, `${vp.name}-${lang}.json`), JSON.stringify(report, null, 1));
      await ctx.close();
      const bad = Object.entries(report).filter(([, r]) => r.issues.length || r.errors.length);
      expect.soft(bad.map(([k, r]) => `${k}: ${r.issues.length} issues, ${r.errors.length} errors`)).toEqual([]);
    });
  }
}
