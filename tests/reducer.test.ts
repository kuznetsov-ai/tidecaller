import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/cards';
import { generateMap, allNodesReachable, mapReachesBoss, reachableIds } from '../src/game/map';
import { policyAction } from '../src/game/policy';
import { freshState, reduce, sanitize } from '../src/game/reducer';
import { Rng } from '../src/game/rng';
import type { CharacterId, GameState } from '../src/game/types';
import { atEvent, inRun } from './helpers';

function toNode(s: GameState, kind: string): GameState {
  const m = s.run!.map;
  const node = m.nodes.find((n) => n.kind === kind)!;
  const parent = m.nodes.find((n) => n.next.includes(node.id));
  m.current = parent ? parent.id : null;
  return reduce(s, { type: 'chooseNode', id: node.id });
}

describe('start / select / save', () => {
  it('locked heroes and charts cannot be started', () => {
    let s = freshState(1);
    s.meta.tutorialDone = true;
    s = reduce(s, { type: 'beginSelect' });
    expect(reduce(s, { type: 'startRun', character: 'keel', chart: 0 }).run).toBeNull();
    expect(reduce(s, { type: 'startRun', character: 'moth', chart: 0 }).run).toBeNull();
    expect(reduce(s, { type: 'startRun', character: 'brine', chart: 1 }).run).toBeNull();
    expect(reduce(s, { type: 'startRun', character: 'brine', chart: 0 }).run).not.toBeNull();
  });
  it.each(['brine', 'keel', 'moth'] as CharacterId[])('%s starts with its deck, relic, hp and start tide', (ch) => {
    const s = inRun(ch);
    expect(s.screen).toBe('map');
    expect(s.run!.deck.length).toBeGreaterThanOrEqual(10);
    expect(s.run!.relics.length).toBe(1);
    expect(s.run!.hp).toBe(s.run!.maxHp);
    const f = reduce(s, { type: 'chooseNode', id: reachableIds(s.run!.map)[0] });
    expect(f.combat!.tide).toBe(ch === 'moth' ? 2 : 4);
  });
  it('save → load roundtrip keeps the run (sanitize)', () => {
    const s = inRun();
    const loaded = sanitize(JSON.parse(JSON.stringify(s)));
    expect(loaded.run).toEqual(s.run);
    expect(loaded.screen).toBe('map');
  });
  it('corrupt / old save falls back to a fresh state', () => {
    const s = inRun() as any;
    s.meta.version = 0;
    expect(sanitize(s).run).toBeNull();
  });
  it('combat screen without combat recovers to the map', () => {
    const s = inRun();
    s.screen = 'combat';
    expect(sanitize(s).screen).toBe('map');
  });
  it('park → resume returns to the exact screen (shop)', () => {
    let s = toNode(inRun(), 'shop');
    expect(s.screen).toBe('shop');
    s = reduce(s, { type: 'park' });
    expect(s.screen).toBe('menu');
    s = reduce(s, { type: 'resume' });
    expect(s.screen).toBe('shop');
  });
  it('settings: language, volume clamp, shake, reduced', () => {
    let s = freshState(2);
    s = reduce(s, { type: 'setLang', lang: 'en' });
    s = reduce(s, { type: 'setVolume', volume: 5 });
    expect(s.meta.settings.volume).toBe(1);
    s = reduce(s, { type: 'setVolume', volume: -1 });
    expect(s.meta.settings.volume).toBe(0);
    s = reduce(s, { type: 'setShake', shake: false });
    s = reduce(s, { type: 'setReduced', reduced: true });
    expect(s.meta.settings).toMatchObject({ lang: 'en', shake: false, reduced: true });
  });
  it('wipe clears meta and run', () => {
    let s = inRun();
    s.meta.marks = 50;
    s = reduce(s, { type: 'wipe' });
    expect(s.run).toBeNull();
    expect(s.meta.marks).toBe(0);
  });
});

describe('tutorial', () => {
  it('only the coached card is playable at each step; end turn locked until step 3', () => {
    let s = reduce(freshState(11), { type: 'startTutorial' });
    const wrong = s.combat!.hand.find((c) => c.id !== 'reed_strike');
    if (wrong) expect(reduce(s, { type: 'playCard', uid: wrong.uid }).combat!.hand.length).toBe(s.combat!.hand.length);
    expect(reduce(s, { type: 'endTurn' }).combat!.turn).toBe(1);
    for (let i = 0; i < 100 && s.tutorialStep !== null; i++) s = reduce(s, policyAction(s)!);
    expect(s.meta.tutorialDone).toBe(true);
    expect(s.storyId).toBe('afterTutorial');
    s = reduce(s, { type: 'ackStory' });
    expect(s.storyId).toBe('act1');
  });
  it('skip tutorial goes to select', () => {
    const s = reduce(freshState(1), { type: 'skipTutorial' });
    expect(s.screen).toBe('select');
    expect(s.meta.tutorialDone).toBe(true);
  });
});

describe('shop', () => {
  it('cannot buy what you cannot afford; exact gold works and leaves 0', () => {
    let s = toNode(inRun(), 'shop');
    const price = s.shop!.cards[0].price;
    s.run!.gold = price - 1;
    let t = reduce(s, { type: 'shopBuyCard', index: 0 });
    expect(t.run!.gold).toBe(price - 1);
    expect(t.shop!.cards[0].sold).toBe(false);
    s.run!.gold = price;
    const deck = s.run!.deck.length;
    t = reduce(s, { type: 'shopBuyCard', index: 0 });
    expect(t.run!.gold).toBe(0);
    expect(t.run!.deck.length).toBe(deck + 1);
    expect(reduce(t, { type: 'shopBuyCard', index: 0 }).run!.deck.length).toBe(deck + 1);
  });
  it('relic purchase grants relic once; phial needs a free slot', () => {
    let s = toNode(inRun(), 'shop');
    s.run!.gold = 9999;
    if (s.shop!.relics.length) {
      const id = s.shop!.relics[0].id;
      s = reduce(s, { type: 'shopBuyRelic', index: 0 });
      expect(s.run!.relics).toContain(id);
    }
    s.run!.phials = ['springwater', 'springwater', 'springwater'];
    const g = s.run!.gold;
    s = reduce(s, { type: 'shopBuyPhial', index: 0 });
    expect(s.run!.gold).toBe(g);
    s.run!.phials[2] = null;
    s = reduce(s, { type: 'shopBuyPhial', index: 0 });
    expect(s.run!.phials[2]).not.toBeNull();
  });
  it('card removal costs 72, then +25; blocked at 5 real cards; curses always removable', () => {
    let s = toNode(inRun(), 'shop');
    s.run!.gold = 72;
    s = reduce(s, { type: 'shopRemove', uid: s.run!.deck[0].uid });
    expect(s.run!.gold).toBe(0);
    expect(s.run!.removeCost).toBe(97);
    s.run!.gold = 9999;
    s.run!.deck = s.run!.deck.slice(0, 5);
    s.run!.deck.push({ uid: 'curse1', id: 'hole', up: false });
    const t = reduce(s, { type: 'shopRemove', uid: s.run!.deck[0].uid });
    expect(t.run!.deck.length).toBe(6);
    const u = reduce(s, { type: 'shopRemove', uid: 'curse1' });
    expect(u.run!.deck.length).toBe(5);
  });
  it('merchant_teeth lowers shop prices by 25%', () => {
    const a = toNode(inRun('brine', 9), 'shop');
    const b0 = inRun('brine', 9);
    b0.run!.relics.push('merchant_teeth');
    const b = toNode(b0, 'shop');
    expect(b.shop!.cards[0].price).toBe(Math.round(a.shop!.cards[0].price * 0.75));
  });
  it('leaving returns to the map', () => {
    expect(reduce(toNode(inRun(), 'shop'), { type: 'shopLeave' }).screen).toBe('map');
  });
});

describe('rest', () => {
  it('heal is 30% (min 12) capped at max; dry_map adds 10', () => {
    let s = toNode(inRun(), 'rest');
    s.run!.hp = 1;
    const max = s.run!.maxHp;
    expect(reduce(s, { type: 'restHeal' }).run!.hp).toBe(1 + Math.max(12, Math.round(max * 0.3)));
    s.run!.relics.push('dry_map');
    expect(reduce(s, { type: 'restHeal' }).run!.hp).toBe(1 + Math.max(12, Math.round(max * 0.3)) + 10);
    s.run!.hp = max - 1;
    expect(reduce(s, { type: 'restHeal' }).run!.hp).toBe(max);
  });
  it('upgrade marks one card, refuses already-upgraded and curses', () => {
    const s = toNode(inRun(), 'rest');
    const c = s.run!.deck[0];
    const t = reduce(s, { type: 'restUpgrade', uid: c.uid });
    expect(t.run!.deck[0].up).toBe(true);
    expect(t.screen).toBe('map');
    s.run!.deck.push({ uid: 'h', id: 'hole', up: false });
    expect(reduce(s, { type: 'restUpgrade', uid: 'h' }).screen).toBe('rest');
  });
  it('attune: only 1/4/6 accepted; next fight starts there, then resets', () => {
    let s = toNode(inRun(), 'rest');
    expect(reduce(s, { type: 'restAttune', tide: 8 }).screen).toBe('rest');
    s = reduce(s, { type: 'restAttune', tide: 6 });
    expect(s.run!.nextTide).toBe(6);
    s = toNode(s, 'boss');
    expect(s.combat!.tide).toBe(6);
    expect(s.run!.nextTide).toBeNull();
  });
});

describe('events: every option', () => {
  const choose = (id: string, i: number, mut?: (s: GameState) => void) => reduce(atEvent(id, mut), { type: 'eventChoose', index: i });
  it('bottle', () => {
    const base = atEvent('bottle');
    expect(choose('bottle', 0).run!.deck.length).toBe(base.run!.deck.length + 1);
    expect(CARDS[choose('bottle', 0).run!.deck.at(-1)!.id].rarity).toBe('rare');
    expect(choose('bottle', 1).run!.gold).toBe(base.run!.gold + 35);
    const h = choose('bottle', 2, (s) => (s.run!.hp = 10));
    expect(h.run!.hp).toBe(22);
    expect(h.screen).toBe('map');
  });
  it('wreck: relic for 10 hull (refused at ≤10 hull), nails +28, leave', () => {
    const a = choose('wreck', 0);
    expect(a.run!.relics.length).toBe(2);
    expect(a.run!.hp).toBe(a.run!.maxHp - 10);
    const low = choose('wreck', 0, (s) => (s.run!.hp = 10));
    expect(low.screen).toBe('event');
    expect(choose('wreck', 1).run!.gold).toBe(atEvent('wreck').run!.gold + 28);
    expect(choose('wreck', 2).screen).toBe('map');
  });
  it('choir: remove / upgrade via picker, hole gives +16 max', () => {
    const r = choose('choir', 0);
    expect(r.picker?.mode).toBe('remove');
    const done = reduce(r, { type: 'pickerPick', uid: r.run!.deck[0].uid });
    expect(done.run!.deck.length).toBe(r.run!.deck.length - 1);
    expect(done.screen).toBe('map');
    const u = choose('choir', 1);
    const up = reduce(u, { type: 'pickerPick', uid: u.run!.deck[0].uid });
    expect(up.run!.deck[0].up).toBe(true);
    const h = choose('choir', 2);
    expect(h.run!.maxHp).toBe(atEvent('choir').run!.maxHp + 16);
    expect(h.run!.deck.some((c) => c.id === 'hole')).toBe(true);
  });
  it('smuggler: copy for 35 (refused if poor), phial or 15 coins, wick for 8 hull', () => {
    const poor = choose('smuggler', 0, (s) => (s.run!.gold = 34));
    expect(poor.picker).toBeNull();
    const c = choose('smuggler', 0, (s) => (s.run!.gold = 35));
    const d = reduce(c, { type: 'pickerPick', uid: c.run!.deck[0].uid });
    expect(d.run!.gold).toBe(0);
    expect(d.run!.deck.length).toBe(c.run!.deck.length + 1);
    expect(choose('smuggler', 1).run!.phials.filter(Boolean).length).toBe(1);
    const full = choose('smuggler', 1, (s) => (s.run!.phials = ['ironkelp', 'ironkelp', 'ironkelp']));
    expect(full.run!.gold).toBe(atEvent('smuggler').run!.gold + 15);
    const w = choose('smuggler', 2);
    expect(w.run!.hp).toBe(w.run!.maxHp - 8);
    expect(choose('smuggler', 2, (s) => (s.run!.hp = 8)).screen).toBe('event');
  });
  it('pool: heal 25%, low → next tide 1, high → next tide 6', () => {
    expect(choose('pool', 0, (s) => (s.run!.hp = 1)).run!.hp).toBe(1 + Math.round(atEvent('pool').run!.maxHp * 0.25));
    expect(choose('pool', 1).run!.nextTide).toBe(1);
    expect(choose('pool', 2).run!.nextTide).toBe(6);
  });
  it('shrine: relic for 14 hull, prayer removes a curse else +20', () => {
    expect(choose('shrine', 0).run!.relics.length).toBe(2);
    expect(choose('shrine', 0, (s) => (s.run!.hp = 14)).screen).toBe('event');
    const cursed = choose('shrine', 1, (s) => s.run!.deck.push({ uid: 'x', id: 'hole', up: false }));
    expect(cursed.run!.deck.some((c) => c.id === 'hole')).toBe(false);
    expect(choose('shrine', 1).run!.gold).toBe(atEvent('shrine').run!.gold + 20);
  });
  it('argument: elite fight, or pay 20 / lose a card', () => {
    const f = choose('argument', 0);
    expect(f.screen).toBe('combat');
    expect(f.run!.fightKind).toBe('elite');
    expect(choose('argument', 1).run!.gold).toBe(atEvent('argument').run!.gold - 20);
    const poor = choose('argument', 1, (s) => (s.run!.gold = 0));
    expect(poor.run!.deck.length).toBe(atEvent('argument').run!.deck.length - 1);
  });
  it('cartographer: dry map (or 40 coins if owned), or heal 10', () => {
    expect(choose('cartographer', 0).run!.relics).toContain('dry_map');
    expect(choose('cartographer', 0, (s) => s.run!.relics.push('dry_map')).run!.gold).toBe(atEvent('cartographer').run!.gold + 40);
    expect(choose('cartographer', 1, (s) => (s.run!.hp = 1)).run!.hp).toBe(11);
  });
  it('eel: +55 and barnacle, or remove + 25', () => {
    const a = choose('eel', 0);
    expect(a.run!.gold).toBe(atEvent('eel').run!.gold + 55);
    expect(a.run!.deck.some((c) => c.id === 'barnacle')).toBe(true);
    const b = choose('eel', 1);
    const c = reduce(b, { type: 'pickerPick', uid: b.run!.deck[0].uid });
    expect(c.run!.gold).toBe(atEvent('eel').run!.gold + 25);
  });
  it('moonwell: upgrade two, or transform one into a rare', () => {
    let a = choose('moonwell', 0);
    a = reduce(a, { type: 'pickerPick', uid: a.run!.deck[0].uid });
    expect(a.picker?.left).toBe(1);
    a = reduce(a, { type: 'pickerPick', uid: a.run!.deck[1].uid });
    expect(a.run!.deck.filter((c) => c.up).length).toBe(2);
    expect(a.screen).toBe('map');
    let t = choose('moonwell', 1);
    t = reduce(t, { type: 'pickerPick', uid: t.run!.deck[0].uid });
    expect(CARDS[t.run!.deck[0].id].rarity).toBe('rare');
  });
  it('moonwell: cancelling after the first upgrade must not restart the event (no infinite upgrades)', () => {
    let a = choose('moonwell', 0);
    a = reduce(a, { type: 'pickerPick', uid: a.run!.deck[0].uid });
    a = reduce(a, { type: 'pickerCancel' });
    a = reduce(a, { type: 'eventChoose', index: 0 });
    for (const c of a.run!.deck) if (a.picker) a = reduce(a, { type: 'pickerPick', uid: c.uid });
    expect(a.run!.deck.filter((c) => c.up).length).toBeLessThanOrEqual(2);
  });
  it('event picker shows nothing it would refuse: upgrade with nothing to upgrade finishes cleanly', () => {
    let a = choose('choir', 1, (s) => s.run!.deck.forEach((c) => (c.up = true)));
    // no upgradable cards → choice should not trap the player in an empty picker
    if (a.picker) a = reduce(a, { type: 'pickerCancel' });
    expect(['event', 'map']).toContain(a.screen);
  });
});

describe('rewards, acts, victory, defeat', () => {
  const win = (s: GameState) => {
    s.combat!.phase = 'win';
    s.combat!.enemies = [];
    return reduce(s, { type: 'ackWin' });
  };
  it('combat reward: gold added, card or skip, must choose before leaving', () => {
    const s0 = reduce(inRun(), { type: 'chooseNode', id: reachableIds(inRun().run!.map)[0] });
    const g = s0.combat!.gold;
    let s = win(s0);
    expect(s.screen).toBe('reward');
    expect(s.run!.gold).toBe(g + s.reward!.gold);
    expect(reduce(s, { type: 'leaveReward' }).screen).toBe('reward');
    s = reduce(s, { type: 'pickCard', id: null });
    s = reduce(s, { type: 'leaveReward' });
    expect(s.screen).toBe('map');
  });
  it('boss reward heals 30%, needs a relic pick, act 1 → 2 → 3 → victory', () => {
    let s = inRun();
    for (const act of [1, 2, 3]) {
      s = toNode(s, 'boss');
      expect(s.combat!.enemies[0].defId).toBe(act === 1 ? 'kelp_warden' : act === 2 ? 'madam_bell' : 'moon');
      s = win(s);
      expect(s.reward!.kind).toBe('boss');
      s = reduce(s, { type: 'pickCard', id: s.reward!.cards[0] });
      expect(reduce(s, { type: 'leaveReward' }).screen).toBe('reward');
      if (s.reward!.bossRelics) s = reduce(s, { type: 'pickRelic', id: s.reward!.bossRelics[0] });
      s = reduce(s, { type: 'leaveReward' });
      if (act < 3) {
        expect(s.screen).toBe('story');
        expect(s.storyId).toBe(`act${act + 1}`);
        s = reduce(s, { type: 'ackStory' });
        expect(s.run!.act).toBe(act + 1);
      }
    }
    expect(s.screen).toBe('victory');
    expect(s.outcome!.victory).toBe(true);
    expect(s.meta.maxChart).toBe(2);
  });
  it('defeat writes an outcome and marks', () => {
    let s = reduce(inRun(), { type: 'chooseNode', id: reachableIds(inRun().run!.map)[0] });
    s.combat!.phase = 'lose';
    s.combat!.player.hp = 0;
    s = reduce(s, { type: 'ackLose' });
    expect(s.screen).toBe('defeat');
    expect(s.run).toBeNull();
    expect(s.outcome!.victory).toBe(false);
    expect(s.meta.stats.runs).toBe(1);
  });
  it('abandon ends the run as a loss', () => {
    const s = reduce(inRun(), { type: 'abandon' });
    expect(s.screen).toBe('defeat');
  });
  it('drydock unlocks spend marks and cap hull at 2', () => {
    let s = freshState(1);
    s.meta.marks = 200;
    s = reduce(s, { type: 'buyUnlock', id: 'keel' });
    s = reduce(s, { type: 'buyUnlock', id: 'keel' });
    expect(s.meta.marks).toBe(170);
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'buyUnlock', id: 'hull' });
    expect(s.meta.unlocks.hull).toBe(2);
    s.meta.marks = 10;
    s = reduce(s, { type: 'buyUnlock', id: 'moth' });
    expect(s.meta.unlocks.moth).toBe(false);
  });
  it('kelp_heart from a reward raises max and current hull by 8', () => {
    let s = toNode(inRun(), 'shop');
    s.shop!.relics = [{ id: 'kelp_heart', price: 1, sold: false }];
    const { hp, maxHp } = s.run!;
    s = reduce(s, { type: 'shopBuyRelic', index: 0 });
    expect(s.run!.maxHp).toBe(maxHp + 8);
    expect(s.run!.hp).toBe(hp + 8);
  });
});

describe('map generation', () => {
  it('200 seeds × 3 acts: every node reachable, boss reachable, row kinds fixed', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const act of [1, 2, 3] as const) {
        const m = generateMap(new Rng(seed), act);
        expect(mapReachesBoss(m)).toBe(true);
        expect(allNodesReachable(m)).toBe(true);
        expect(m.nodes.filter((n) => n.row === 6 && n.kind === 'elite').length).toBe(1);
        expect(m.nodes.filter((n) => n.kind === 'boss').length).toBe(1);
        for (const n of m.nodes) for (const id of n.next) expect(m.nodes.find((x) => x.id === id)!.row).toBe(n.row + 1);
      }
    }
  });
  it('cannot jump to an unreachable node', () => {
    const s = inRun();
    const far = s.run!.map.nodes.find((n) => n.row === 3)!;
    expect(reduce(s, { type: 'chooseNode', id: far.id }).screen).toBe('map');
  });
});

describe('whole runs with the greedy policy (all heroes)', () => {
  for (const ch of ['brine', 'keel', 'moth'] as CharacterId[]) {
    it(`${ch}: 8 seeded runs end in victory or defeat, invariants hold every step`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        let s = inRun(ch, seed * 31);
        for (let guard = 0; guard < 6000 && s.screen !== 'victory' && s.screen !== 'defeat'; guard++) {
          const a = policyAction(s);
          expect(a, `stuck on ${s.screen}`).toBeTruthy();
          s = reduce(s, a!);
          if (s.combat) {
            expect(s.combat.tide).toBeGreaterThanOrEqual(0);
            expect(s.combat.tide).toBeLessThanOrEqual(8);
            expect(s.combat.player.hp).toBeLessThanOrEqual(s.combat.player.maxHp);
            expect(s.combat.turn).toBeLessThan(60);
          }
          if (s.run) {
            expect(s.run.gold).toBeGreaterThanOrEqual(0);
            expect(s.run.hp).toBeLessThanOrEqual(s.run.maxHp);
          }
        }
        expect(['victory', 'defeat']).toContain(s.screen);
      }
    });
  }
});

describe('event guards are visible, not silent', () => {
  it('blocked options report a reason and do nothing', async () => {
    const { eventChoiceBlock } = await import('../src/game/reducer');
    const low = atEvent('wreck', (s) => (s.run!.hp = 10));
    expect(eventChoiceBlock(low, 0)).not.toBeNull();
    expect(eventChoiceBlock(low, 1)).toBeNull();
    const poor = atEvent('smuggler', (s) => (s.run!.gold = 0));
    expect(eventChoiceBlock(poor, 0)?.en).toMatch(/35/);
    const noUp = atEvent('moonwell', (s) => s.run!.deck.forEach((c) => (c.up = true)));
    expect(eventChoiceBlock(noUp, 0)).not.toBeNull();
    expect(reduce(noUp, { type: 'eventChoose', index: 0 }).picker).toBeNull();
  });
  it('remove pickers only list removable cards (5 real cards left → only curses)', async () => {
    const { pickerCards } = await import('../src/game/reducer');
    const s = inRun();
    s.run!.deck = s.run!.deck.slice(0, 5);
    s.run!.deck.push({ uid: 'c', id: 'hole', up: false });
    expect(pickerCards(s.run!, 'remove').map((c) => c.id)).toEqual(['hole']);
  });
  it('moonwell upgrade ends after one pick when nothing else can be upgraded', () => {
    let s = atEvent('moonwell', (st) => st.run!.deck.forEach((c, i) => (c.up = i > 0)));
    s = reduce(s, { type: 'eventChoose', index: 0 });
    s = reduce(s, { type: 'pickerPick', uid: s.run!.deck[0].uid });
    expect(s.picker).toBeNull();
    expect(s.screen).toBe('map');
  });
});

describe('targeting survives deaths', () => {
  it('when an earlier enemy dies, the selected enemy stays selected', () => {
    let s = inRun();
    s = reduce(s, { type: 'chooseNode', id: reachableIds(s.run!.map)[0] });
    const c = s.combat!;
    c.enemies = [structuredClone(c.enemies[0]), structuredClone(c.enemies[0]), structuredClone(c.enemies[0])].map((e, i) => ({ ...e, uid: `e${i}`, hp: 50 }));
    c.enemies[0].hp = 1;
    s = reduce(s, { type: 'setTarget', index: 2 });
    c.energy = 3;
    s.combat!.enemies[0].salt = 0;
    // kill enemy 0 with an AoE
    s.combat!.hand.push({ uid: 'bellx', id: 'bell', up: false });
    s.combat!.energy = 3;
    s = reduce(s, { type: 'playCard', uid: 'bellx' });
    expect(s.combat!.enemies.length).toBe(2);
    expect(s.combat!.enemies[s.target].uid).toBe('e2');
  });
});
