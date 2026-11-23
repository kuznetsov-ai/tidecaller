import { chromium } from '@playwright/test';
(async () => {
  const b = await chromium.launch();
  for (const w of [390, 360]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
    await p.goto('http://127.0.0.1:4319/onepager.html');
    console.log(w, await p.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth, innerWidth]));
    const p2 = await b.newPage({ viewport: { width: w, height: 800 } });
    await p2.goto('http://127.0.0.1:4319/onepager.html');
    console.log(w, 'desktop-emu', await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  }
  await b.close();
})();
