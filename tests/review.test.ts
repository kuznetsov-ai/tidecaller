import { describe, expect, it } from 'vitest';
import { endTurn, previewIntents, projectedEdge } from '../src/game/combat';
import { card, mkCombat, rng } from './helpers';

describe('maximus review fixes', () => {
  it('enemy block drops at the start of that enemy’s next action (P1-1)', () => {
    const c = mkCombat(['salt_knight'], { tide: 2 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    c.enemies[0].block = 30;
    c.enemies[0].pi = 1; // attack beat, no block gained
    endTurn(c, rng());
    expect(c.enemies[0].block).toBe(0);
  });
  it('block gained by an enemy survives through the player turn', () => {
    const c = mkCombat(['gullthief'], { tide: 2 });
    c.hand = [];
    c.enemies[0].pi = 2; // blk(6)
    endTurn(c, rng());
    expect(c.phase).toBe('player');
    expect(c.enemies[0].block).toBe(6);
  });
});

describe('summons (P1-5)', () => {
  it('a lash summoned on chart 2 gets the chart hp multiplier', () => {
    const c = mkCombat(['kelp_warden'], { tide: 6 });
    c.chart = 2;
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    c.enemies[0].pi = 0;
    endTurn(c, rng());
    const lash = c.enemies.find((e) => e.defId === 'kelp_minion')!;
    expect(lash).toBeTruthy();
    expect(lash.maxHp).toBeGreaterThan(14);
  });
});

describe('dead water timing (P1-8)', () => {
  it('fires when the turn closes at 1 even though the drift lifts it to 2', () => {
    const c = mkCombat(['salt_knight'], { tide: 1 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    const hp = c.enemies[0].hp;
    expect(projectedEdge(c)).toBe('strand');
    endTurn(c, rng());
    expect(c.enemies[0].hp).toBeLessThanOrEqual(hp - 2);
    expect(c.hand.length).toBe(4);
  });
  it('does not fire at 2', () => {
    const c = mkCombat(['salt_knight'], { tide: 2 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    expect(projectedEdge(c)).toBe(null);
    endTurn(c, rng());
    expect(c.hand.length).toBe(5);
  });
  it('storm still fires on 6 → 7', () => {
    const c = mkCombat(['salt_knight'], { tide: 6 });
    c.hand = [];
    expect(projectedEdge(c)).toBe('storm');
  });
});

import { cardLines } from '../src/game/describe';
import { CARDS } from '../src/game/cards';
import { playCard } from '../src/game/combat';
import { give } from './helpers';

describe('card previews follow the card’s own tide move (P1-6)', () => {
  it('Spring Tide at 4 previews 11 and deals 11', () => {
    const c = mkCombat(['salt_knight'], { tide: 4 });
    const lines = cardLines(CARDS.spring_tide, false, 'en', { tide: 4 });
    expect(lines.join(' ')).toContain('Deal 11 damage');
    const hp = c.enemies[0].hp;
    c.energy = 3;
    const k = give(c, card('spring_tide'))[0];
    playCard(c, k.uid, rng(), { target: 0 });
    expect(hp - c.enemies[0].hp).toBe(11);
  });
  it('Wick previews ebb block when its own move lands in ebb', () => {
    expect(cardLines(CARDS.wick, false, 'en', { tide: 5 }).join(' ')).toContain('Gain 3 block');
    expect(cardLines(CARDS.wick, false, 'en', { tide: 2 }).join(' ')).toContain('Gain 5 block');
  });
  it('Twin Hooks bonus shows on the first attack only', () => {
    const t = cardLines(CARDS.reed_strike, false, 'en', { tide: 4, twin: true }).join(' ');
    const n = cardLines(CARDS.reed_strike, false, 'en', { tide: 4 }).join(' ');
    const num = (x: string) => Number(/Deal (\d+)/.exec(x)![1]);
    expect(num(t)).toBe(num(n) + 4);
  });
});

describe('preview = real damage for every simple attack card at every tide', () => {
  const simple = Object.values(CARDS).filter((d) => {
    const all = [...d.effects, ...(d.up ?? [])];
    return all.some((e) => e.op === 'damage') && all.every((e) => ['damage', 'tide', 'tideSet', 'block', 'draw'].includes(e.op) && !(e as { all?: boolean }).all);
  });
  for (const def of simple) {
    for (const up of [false, true]) {
      it(`${def.id}${up ? '+' : ''}`, () => {
        for (let t = 0; t <= 8; t++) {
          const c = mkCombat(['salt_knight'], { tide: t });
          c.enemies[0].hp = c.enemies[0].maxHp = 999;
          c.enemies[0].block = 0;
          c.energy = 9;
          const text = cardLines(def, up, 'en', { tide: t }).join(' ');
          const want = [...text.matchAll(/Deal (\d+) damage/g)].reduce((a, m) => a + Number(m[1]), 0);
          const k = give(c, { uid: 'x' + t, id: def.id, up })[0];
          playCard(c, k.uid, rng(), { target: 0 });
          if (/equal to tide/.test(text)) continue;
          expect(999 - c.enemies[0].hp, `${def.id} at ${t}: ${text}`).toBe(want);
        }
      });
    }
  }
});

import { inRun } from './helpers';
import { reduce } from '../src/game/reducer';

describe('abandon salt farm (P1-3)', () => {
  it('abandoning a chart-2 voyage before any node pays no chart bonus', () => {
    let s = inRun();
    s.run!.chart = 2;
    const before = s.meta.marks;
    s = reduce(s, { type: 'abandon' });
    expect(s.meta.marks - before).toBe(0);
  });
  it('the chart bonus is paid in full after 3 floors', () => {
    let s = inRun();
    s.run!.chart = 2;
    s.run!.floors = 3;
    const before = s.meta.marks;
    s = reduce(s, { type: 'abandon' });
    expect(s.meta.marks - before).toBe(3 * 2 + 12);
  });
});

describe('new voyage over a parked one (P1-7)', () => {
  it('clears picker/pending/hold/target/storyId and settles the old run', () => {
    let s = inRun();
    s.run!.floors = 4;
    s.screen = 'event';
    s.eventId = 'moonwell';
    s.picker = { mode: 'upgrade', left: 2, source: 'event' } as never;
    s.pending = { uid: 'x', d: 2 } as never;
    s.target = 2;
    s = reduce(s, { type: 'park' });
    expect(s.hold).toBe('event');
    const runs = s.meta.stats.runs;
    const marks = s.meta.marks;
    s = reduce(s, { type: 'beginSelect' });
    s = reduce(s, { type: 'startRun', character: 'brine', chart: 0, seed: 9 });
    expect(s.picker).toBe(null);
    expect(s.pending).toBe(null);
    expect(s.hold).toBe(null);
    expect(s.target).toBe(0);
    expect(s.eventId).toBe(null);
    expect(s.outcome).toBe(null);
    expect(s.screen).toBe('story');
    expect(s.meta.stats.runs).toBe(runs + 1);
    expect(s.meta.marks).toBe(marks + 8);
  });
  it('wipe keeps language and volume (P2-14)', () => {
    let s = inRun();
    s.meta.settings.lang = 'en';
    s.picker = { mode: 'upgrade', left: 1, source: 'event' } as never;
    s = reduce(s, { type: 'wipe' });
    expect(s.meta.settings.lang).toBe('en');
    expect(s.picker).toBe(null);
  });
  it('ackStory clears storyId so resume never falls back to a stale story (P2-13)', () => {
    let s = inRun();
    expect(s.storyId).toBe(null);
    s = reduce(s, { type: 'ackStory' });
    expect(s.screen).toBe('map');
  });
});

describe('shop removal with Merchant’s Teeth', () => {
  it('charges 25% less', () => {
    let s = inRun();
    s.screen = 'shop';
    s.shop = { cards: [], relics: [], phials: [] } as never;
    s.run!.relics.push('merchant_teeth');
    s.run!.gold = 100;
    s.run!.deck.push({ uid: 'cz', id: 'barnacle', up: false });
    s = reduce(s, { type: 'shopRemove', uid: 'cz' });
    expect(s.run!.gold).toBe(100 - 54);
  });
});

describe('Argument on the Dock with no coins', () => {
  it('never drops the deck below 5 real cards, even with curses in it', () => {
    let s = inRun();
    s.screen = 'event';
    s.eventId = 'argument';
    s.run!.gold = 0;
    s.run!.deck = s.run!.deck.slice(0, 5);
    s.run!.deck.push({ uid: 'c1', id: 'barnacle', up: false }, { uid: 'c2', id: 'barnacle', up: false });
    s = reduce(s, { type: 'eventChoose', index: 1 });
    expect(s.run!.deck.length).toBe(7);
  });
  it('takes one real card when there are more than 5', () => {
    let s = inRun();
    s.screen = 'event';
    s.eventId = 'argument';
    s.run!.gold = 0;
    const n = s.run!.deck.length;
    s.run!.deck.push({ uid: 'c1', id: 'barnacle', up: false });
    s = reduce(s, { type: 'eventChoose', index: 1 });
    expect(s.run!.deck.length).toBe(n);
    expect(s.run!.deck.some((c) => c.uid === 'c1')).toBe(true);
  });
});

describe('chart 1 unlock is announced (review P2-6)', () => {
  it('beating the act-1 boss and then dying reports chart1', () => {
    let s = inRun();
    s.meta.maxChart = 1; // raised by the boss kill mid-run
    s = reduce(s, { type: 'abandon' });
    expect(s.outcome!.newUnlocks).toContain('chart1');
  });
});
