import { chromium } from '@playwright/test';
import { buildFixtures } from '/workspace/tidecaller-qa/tidecaller/qa/fixtures';
const fx = buildFixtures().filter((f) => /^(combat-|map-|pause)/.test(f.name));
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1280, 800], [1440, 900], [1024, 768]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('http://127.0.0.1:4319/');
    for (const f of fx) {
      await p.evaluate(([s]) => { localStorage.setItem('tidecaller-save-v1', s); localStorage.setItem('tidecaller-hints-v1', '{"off":true,"seen":[]}'); }, [JSON.stringify(f.state)]);
      await p.reload(); await p.waitForTimeout(150);
      const r = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, mapClip: (() => { const m = document.querySelector('.map-wrap'); return m ? m.scrollHeight - m.clientHeight : 0; })() }));
      if (r.sh > h || r.mapClip > 0) console.log(w, f.name, 'doc', r.sh, 'mapOverflow', r.mapClip);
    }
    await p.close();
  }
  await b.close();
})();
