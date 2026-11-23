import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const byType: Record<string, number> = {};
const uniq = new Map<string, Set<string>>();
let screens = 0, errs = 0;
for (const f of files) {
  const rep = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [name, r] of Object.entries<any>(rep)) {
    screens++;
    for (const e of r.errors) { errs++; console.log('ERR', f, name, e); }
    for (const i of r.issues) {
      byType[i.type] = (byType[i.type] ?? 0) + 1;
      const key = `${i.type}: ${i.detail.replace(/\(\d+x\d+\)|by \d+px|\d+px|x=-?\d+\.\.\d+|scroll \d+ > \d+|right=\d+/g, '#')}`;
      if (!uniq.has(key)) uniq.set(key, new Set());
      uniq.get(key)!.add(`${f.replace('.json', '')}:${name}`);
    }
  }
}
console.log(`checked ${screens} screen×viewport×lang, console errors ${errs}`);
console.log(byType);
for (const [k, v] of [...uniq.entries()].sort((a, b) => b[1].size - a[1].size)) {
  const list = [...v];
  console.log(`${v.size}\t${k}\n\t${list.slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}`);
}
