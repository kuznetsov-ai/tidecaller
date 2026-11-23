import { chromium } from 'playwright';
import { buildFixtures } from './fixtures';
import { LAYOUT_SRC } from './layout';
const name = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://127.0.0.1:4318/');
const fx = buildFixtures().find((f) => f.name === name)!;
await p.evaluate((s) => localStorage.setItem('tidecaller-save-v1', s), JSON.stringify(fx.state));
await p.reload();
try { console.log(await p.evaluate(LAYOUT_SRC)); } catch (e) { console.log('ERR', String(e).slice(0, 500)); }
await b.close();
