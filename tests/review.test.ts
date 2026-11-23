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
