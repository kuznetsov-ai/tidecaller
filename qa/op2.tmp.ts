import { chromium } from '@playwright/test';
import { LAYOUT_SRC } from './layout';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://127.0.0.1:4319/onepager.html');
  console.log(JSON.stringify(await p.evaluate(LAYOUT_SRC)).slice(0, 600));
  console.log(await p.evaluate(() => [innerWidth, document.documentElement.clientWidth, document.documentElement.scrollWidth]));
  await b.close();
})();
