import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
/** Browser-side checker source (plain JS, kept free of bundler helpers). */
export const LAYOUT_SRC =
  '(() => {\n' + fs.readFileSync(path.join(here, 'layout.browser.js'), 'utf8') + '\nreturn [...layoutCheck(), ...mapCheck(), ...cardCheck(), ...hintCheck(), ...contrastCheck(), ...mobileCombatCheck()];\n})()';
