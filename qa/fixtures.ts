/**
 * QA harness: builds saved GameState snapshots for every screen / edge case.
 * Each fixture is injected into localStorage ('tidecaller-save-v1') by the
 * Playwright screen sweep (qa/screens.spec.ts). Test-only; not part of the bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CARD_LIST } from '../src/game/cards';
import { startCombat } from '../src/game/combat';
import { ENEMY_LIST } from '../src/game/enemies';
import { EVENT_LIST } from '../src/game/events';
import { generateMap } from '../src/game/map';
import { freshState, reduce } from '../src/game/reducer';
import { RELIC_LIST } from '../src/game/relics';
import { Rng } from '../src/game/rng';
import type { CharacterId, FightKind, GameState, PickerState } from '../src/game/types';

export interface Fixture {
  name: string;
  state: GameState;
  /** optional UI steps performed before the screenshot */
  steps?: Step[];
  /** leave first-visit coach marks on (all other fixtures run with tips off) */
  hints?: boolean;
}
export type Step =
  | { click: string; nth?: number }
  | { key: string }
  | { wait: number };

const clone = <T>(x: T): T => structuredClone(x);

function metaUnlocked(s: GameState): GameState {
  s.meta.tutorialDone = true;
  s.meta.unlocks.keel = true;
  s.meta.unlocks.moth = true;
  return s;
}

export function runState(character: CharacterId = 'brine', seed = 4242, act: 1 | 2 | 3 = 1): GameState {
  let s = metaUnlocked(freshState(seed));
  s = reduce(s, { type: 'beginSelect' });
  s = reduce(s, { type: 'startRun', character, chart: 0, seed });
  s = reduce(s, { type: 'ackStory' });
  if (act > 1) {
    s.run!.act = act;
    s.run!.map = generateMap(new Rng(seed + act), act);
  }
  return s;
}

interface CombatOpts {
  character?: CharacterId;
  act?: 1 | 2 | 3;
  kind?: FightKind;
  tide?: number;
  hand?: { id: string; up?: boolean }[];
  relics?: string[];
  hp?: number;
  seed?: number;
  mutate?: (s: GameState) => void;
}

export function combatState(enemies: string[], o: CombatOpts = {}): GameState {
  const s = runState(o.character ?? 'brine', o.seed ?? 777, o.act ?? 1);
  const run = s.run!;
  if (o.relics) for (const r of o.relics) if (!run.relics.includes(r)) run.relics.push(r);
  const rng = new Rng(o.seed ?? 99);
  run.fightKind = o.kind ?? 'combat';
  s.combat = startCombat(run, enemies, rng, { fightKind: o.kind ?? 'combat', row: 3, startTide: 4 });
  s.screen = 'combat';
  if (o.tide != null) s.combat.tide = o.tide;
  if (o.hp != null) s.combat.player.hp = o.hp;
  if (o.hand) {
    s.combat.discard.push(...s.combat.hand);
    s.combat.hand = o.hand.map((c, i) => ({ uid: `fx${i}`, id: c.id, up: !!c.up }));
  }
  o.mutate?.(s);
  return s;
}

const longHand = [
  { id: 'countercurrent' },
  { id: 'lantern_law', up: true },
  { id: 'widow_buoy' },
  { id: 'leviathan' },
  { id: 'still_water', up: true },
  { id: 'storm_oath' },
  { id: 'keelhaul' },
  { id: 'hole' },
  { id: 'barnacle' },
  { id: 'snag' },
];

export function buildFixtures(): Fixture[] {
  const F: Fixture[] = [];
  const add = (name: string, state: GameState, steps?: Step[]) => F.push({ name, state: clone(state), steps });

  // ---------- home ----------
  add('menu-fresh', freshState(1));
  const menuRun = runState();
  menuRun.screen = 'menu';
  menuRun.meta.stats = { runs: 12, wins: 3, bestFloor: 27, bestAct: 3, combats: 80, bosses: 7, marksEarned: 900 };
  menuRun.meta.marks = 1234;
  add('menu-with-run', menuRun);
  const sel = metaUnlocked(freshState(2));
  sel.screen = 'select';
  const selLocked = freshState(2);
  selLocked.meta.tutorialDone = true;
  selLocked.screen = 'select';
  add('select-locked', selLocked);
  const selAll = clone(sel);
  selAll.meta.maxChart = 2;
  add('select-brine', selAll);
  add('select-keel', selAll, [{ click: '.cast button', nth: 1 }]);
  add('select-moth-chart2', selAll, [{ click: '.cast button', nth: 2 }, { click: '.charts button', nth: 2 }]);
  const dry0 = freshState(3);
  dry0.screen = 'drydock';
  add('drydock-empty', dry0);
  const dryRich = clone(dry0);
  dryRich.meta.marks = 999;
  dryRich.meta.unlocks.keel = true;
  dryRich.meta.unlocks.hull = 1;
  add('drydock-rich', dryRich);
  const codex = freshState(4);
  codex.screen = 'codex';
  add('codex-empty', codex);
  const codexAll = clone(codex);
  codexAll.meta.seen = {
    cards: CARD_LIST.map((c) => c.id),
    enemies: ENEMY_LIST.map((e) => e.id),
    relics: RELIC_LIST.map((r) => r.id),
  };
  add('codex-enemies', codexAll);
  add('codex-cards', codexAll, [{ click: '.codex .row-actions button', nth: 1 }]);
  add('codex-relics', codexAll, [{ click: '.codex .row-actions button', nth: 2 }]);
  const help = freshState(5);
  help.screen = 'help';
  add('help', help);
  const settings = freshState(6);
  settings.screen = 'settings';
  add('settings', settings);
  add('settings-armed-wipe', settings, [{ click: '.settings > button' }]);

  // ---------- tutorial ----------
  for (let step = 0; step <= 4; step++) {
    let t = reduce(freshState(11), { type: 'startTutorial' });
    t.tutorialStep = step;
    add(`tutorial-step${step}`, t);
  }

  // ---------- story ----------
  for (const id of ['afterTutorial', 'act1', 'act2', 'act3']) {
    const st = id === 'afterTutorial' ? freshState(7) : runState('brine', 7, Number(id.slice(3)) as 1 | 2 | 3);
    st.screen = 'story';
    st.storyId = id;
    if (id === 'afterTutorial') st.meta.tutorialDone = true;
    add(`story-${id}`, st);
  }

  // ---------- map ----------
  for (const ch of ['brine', 'keel', 'moth'] as CharacterId[]) add(`map-act1-start-${ch}`, runState(ch, 100 + ch.length));
  const mid = runState('brine', 55);
  {
    const m = mid.run!.map;
    let cur = m.nodes.find((n) => n.row === 0)!;
    m.path = [cur.id];
    for (let r = 1; r <= 5; r++) {
      const nx = m.nodes.find((n) => n.id === cur.next[0])!;
      m.path.push(nx.id);
      cur = nx;
    }
    m.current = cur.id;
    mid.run!.floors = 6;
    mid.run!.relics.push('salt_compass', 'pearl_ear', 'rusted_anchor', 'merchant_teeth', 'kelp_heart', 'glass_moon', 'bloodwake', 'choir_shell');
  }
  add('map-act1-mid-many-relics', mid);
  add('map-deck-modal', mid, [{ click: '.map-screen .topbar button.ghost', nth: 0 }]);
  add('map-act2', runState('keel', 56, 2));
  const a3 = runState('moth', 57, 3);
  {
    const m = a3.run!.map;
    const rest = m.nodes.find((n) => n.row === 7)!;
    m.current = rest.id;
    m.path = [rest.id];
  }
  add('map-act3-before-boss', a3);
  add('pause-on-map', mid, [{ key: 'Escape' }]);

  // ---------- combat ----------
  add('combat-basic', combatState(['gullthief', 'kelppup']));
  add('combat-crab-pup', combatState(['brinecrab', 'kelppup'], { tide: 2 }));
  add('combat-netwraith-snag', combatState(['netwraith'], { mutate: (s) => s.combat!.hand.push({ uid: 'sn', id: 'snag', up: false }) }));
  add('combat-hand-10-tide0', combatState(['gullthief'], { tide: 0, hand: longHand }));
  add(
    'combat-hand-10-tide8-statuses',
    combatState(['brinecrab', 'kelppup', 'gullthief'], {
      tide: 8,
      hand: longHand,
      relics: ['salt_compass', 'pearl_ear', 'glass_moon', 'twin_hooks', 'counterweight', 'wreck_candle', 'brine_flask'],
      mutate: (s) => {
        const c = s.combat!;
        c.player = { ...c.player, block: 999, salt: 12, weak: 3, strength: 9 };
        c.powers.lighthouse = 4;
        c.cheapNext = 1;
        c.energy = 0;
        c.phials = ['stormglass', 'saltspike', 'ironkelp'];
        for (const e of c.enemies) Object.assign(e, { block: 88, salt: 14, weak: 3, strength: 5 });
        c.gold = 99999;
        s.combatLog = Array.from({ length: 16 }, (_, i) => ({ t: 'tide' as const, from: i % 8, to: (i + 1) % 8 }));
      },
    }),
  );
  add('combat-elite-knight', combatState(['salt_knight'], { kind: 'elite' }));
  add('combat-boss-warden-minions', combatState(['kelp_warden', 'kelp_minion', 'kelp_minion'], { kind: 'boss', tide: 6 }));
  add('combat-act2-eel-gull', combatState(['ledger_eel', 'reef_gull'], { act: 2, character: 'keel' }));
  add('combat-act2-merchant', combatState(['bell_merchant'], { act: 2, character: 'keel' }));
  add('combat-act2-chorister', combatState(['chorister'], { act: 2 }));
  add('combat-act2-shark', combatState(['contract_shark'], { act: 2 }));
  add('combat-act2-elite-auctioneer', combatState(['auctioneer'], { act: 2, kind: 'elite' }));
  add('combat-act2-boss-madam', combatState(['madam_bell'], { act: 2, kind: 'boss', mutate: (s) => (s.combat!.echo = { kind: 'damage', n: 14 }) }));
  add('combat-act3-saint-lantern', combatState(['pressure_saint', 'blind_lantern'], { act: 3, character: 'moth' }));
  add('combat-act3-notary-saint', combatState(['abyss_notary', 'pressure_saint'], { act: 3, character: 'moth' }));
  add('combat-act3-whale', combatState(['glass_whale'], { act: 3, tide: 7 }));
  add('combat-act3-elite-debt', combatState(['debt_of_depth'], { act: 3, kind: 'elite', tide: 2 }));
  add('combat-act3-boss-moon', combatState(['moon'], { act: 3, kind: 'boss', mutate: (s) => (s.combat!.enemies[0].doom = 3) }));
  const pending = combatState(['gullthief'], { hand: [{ id: 'moonstep' }, { id: 'reed_strike' }] });
  pending.pending = { type: 'tide', uid: 'fx0', mag: 2 };
  add('combat-tide-choice-modal', pending);
  add('combat-win-modal', combatState(['gullthief'], { mutate: (s) => { s.combat!.phase = 'win'; s.combat!.enemies = []; } }));
  add('combat-lose-modal', combatState(['gullthief'], { mutate: (s) => { s.combat!.phase = 'lose'; s.combat!.player.hp = 0; } }));
  add('combat-discard-pile-modal', combatState(['gullthief']), [{ click: '.piles .pile', nth: 0 }]);
  add('pause-in-combat', combatState(['gullthief']), [{ key: 'Escape' }]);

  // ---------- reward ----------
  const rewardBase = (kind: FightKind, act: 1 | 2 | 3 = 1) => {
    let s = combatState(kind === 'boss' ? ['kelp_warden'] : kind === 'elite' ? ['salt_knight'] : ['gullthief'], { kind, act });
    s.combat!.phase = 'win';
    s.combat!.enemies = [];
    s = reduce(s, { type: 'ackWin' });
    return s;
  };
  add('reward-combat', rewardBase('combat'));
  add('reward-elite-relic', rewardBase('elite'));
  add('reward-boss-relics', rewardBase('boss'));
  const taken = rewardBase('combat');
  taken.reward!.cardTaken = true;
  add('reward-card-taken', taken);

  // ---------- shop ----------
  const shopRich = runState('brine', 321);
  shopRich.run!.gold = 999;
  {
    const m = shopRich.run!.map;
    const shopNode = m.nodes.find((n) => n.kind === 'shop')!;
    const parent = m.nodes.find((n) => n.next.includes(shopNode.id))!;
    m.current = parent.id;
    m.path = [parent.id];
  }
  const shopOpen = reduce(shopRich, { type: 'chooseNode', id: shopRich.run!.map.nodes.find((n) => n.id === shopRich.run!.map.nodes.find((x) => x.id === shopRich.run!.map.current)!.next.find((id) => shopRich.run!.map.nodes.find((y) => y.id === id)!.kind === 'shop'))!.id });
  add('shop-rich', shopOpen);
  const shopPoor = clone(shopOpen);
  shopPoor.run!.gold = 0;
  add('shop-broke', shopPoor);
  const shopSold = clone(shopOpen);
  for (const o of [...shopSold.shop!.cards, ...shopSold.shop!.relics, ...shopSold.shop!.phials]) o.sold = true;
  shopSold.run!.phials = ['springwater', 'stormglass', 'ironkelp'];
  add('shop-all-sold-phials-full', shopSold);
  add('shop-remove-picker', shopOpen, [{ click: '.shop .row-actions button', nth: 0 }]);

  // ---------- rest ----------
  const rest = runState('moth', 654);
  rest.screen = 'rest';
  add('rest', rest);
  add('rest-upgrade-picker', rest, [{ click: '.rest .choices button', nth: 1 }]);
  add('rest-attune', rest, [{ click: '.rest .choices button', nth: 2 }]);
  const restNoUp = clone(rest);
  for (const c of restNoUp.run!.deck) c.up = true;
  add('rest-nothing-to-upgrade', restNoUp);

  // ---------- events ----------
  for (const ev of EVENT_LIST) {
    const e = runState('brine', 900 + ev.id.length);
    e.screen = 'event';
    e.eventId = ev.id;
    add(`event-${ev.id}`, e);
  }
  const lowEv = runState('brine', 901);
  lowEv.run!.hp = 5;
  lowEv.run!.gold = 0;
  for (const id of ['wreck', 'shrine', 'smuggler', 'argument']) {
    const e = clone(lowEv);
    e.screen = 'event';
    e.eventId = id;
    add(`event-${id}-low-hp-gold`, e);
  }
  const pickers: [string, PickerState][] = [
    ['choir', { mode: 'remove', context: 'event', left: 1 }],
    ['choir', { mode: 'upgrade', context: 'event', left: 1 }],
    ['smuggler', { mode: 'duplicate', context: 'event', left: 1, pay: 35 }],
    ['moonwell', { mode: 'transform', context: 'event', left: 1 }],
    ['moonwell', { mode: 'upgrade', context: 'event', left: 2 }],
  ];
  for (const [id, picker] of pickers) {
    const e = runState('keel', 950);
    e.screen = 'event';
    e.eventId = id;
    e.picker = picker;
    add(`event-${id}-picker-${picker.mode}`, e);
  }

  // ---------- end ----------
  const lose = combatState(['gullthief'], { mutate: (s) => { s.combat!.phase = 'lose'; s.combat!.player.hp = 0; s.combat!.lastSource = 'storm'; } });
  add('defeat', reduce(lose, { type: 'ackLose' }));
  const win = rewardBase('boss', 3);
  win.run!.act = 3;
  win.reward!.cardTaken = true;
  win.reward!.relicTaken = true;
  add('victory', reduce(win, { type: 'leaveReward' }));

  // ---------- onboarding coach marks ----------
  const tour = (name: string, state: GameState, n: number) => {
    for (let k = 1; k <= n; k++) {
      const steps: Step[] = [{ wait: 450 }];
      for (let j = 1; j < k; j++) steps.push({ click: '[data-testid=coach-next]' }, { wait: 450 });
      F.push({ name: `hint-${name}-${k}`, state: clone(state), steps, hints: true });
    }
  };
  tour('select', selAll, 3);
  tour('map', runState('brine', 104), 3);
  tour('combat', combatState(['gullthief', 'kelppup']), 6);
  tour('combat-boss', combatState(['kelp_warden', 'kelp_minion', 'kelp_minion'], { kind: 'boss', tide: 6 }), 6);
  tour('reward', rewardBase('combat'), 2);
  tour('shop', shopOpen, 3);
  tour('rest', rest, 1);
  return F;
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith('fixtures')) {
  const out = path.resolve(process.argv[2] ?? 'qa/fixtures.json');
  const fx = buildFixtures();
  fs.writeFileSync(out, JSON.stringify(fx));
  console.log(`wrote ${fx.length} fixtures -> ${out}`);
  for (const f of fx) console.log(f.name, f.state.screen);
}
