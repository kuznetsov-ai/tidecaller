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
