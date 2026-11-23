import { describe, expect, it } from 'vitest';
import { endTurn, previewIntents } from '../src/game/combat';
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
