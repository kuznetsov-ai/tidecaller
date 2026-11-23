import { describe, expect, it } from 'vitest';
import { endTurn, playCard } from '../src/game/combat';
import { card, give, mkCombat, rng } from './helpers';

const play = (c: ReturnType<typeof mkCombat>, id: string, up = false) => {
  c.energy = Math.max(c.energy, 3);
  const inst = give(c, card(id, up))[0];
  return playCard(c, inst.uid, rng(), { target: 0 });
};

describe('relics', () => {
  it('copper_buoy: first in-element card each combat draws 1, only once', () => {
    const c = mkCombat(['brinecrab'], { tide: 2 }); // brine starts with copper_buoy
    c.draw = [card('kelp_guard'), card('kelp_guard'), card('kelp_guard')];
    c.hand = [];
    play(c, 'reed_strike'); // ebb at 2 → draw 1
    expect(c.hand.length).toBe(1);
    play(c, 'reed_strike');
    expect(c.hand.length).toBe(1);
  });
  it('storm_nail: +1 strength the first time a card pushes into flood (not drift)', () => {
    const c = mkCombat(['brinecrab'], { tide: 4, character: 'keel' });
    c.hand = [];
    endTurn(c, rng()); // drift 4→5: no strength
    expect(c.player.strength).toBe(0);
    c.tide = 3;
    play(c, 'storm_oath'); // card 3→5 → +1 nail, +1 oath
    expect(c.player.strength).toBe(2);
    c.tide = 3;
    play(c, 'buoy_toss');
    play(c, 'buoy_toss');
    expect(c.player.strength).toBe(2);
  });
  it('lantern_wick: heal 3 the first time tide enters 0–1', () => {
    const c = mkCombat(['brinecrab'], { tide: 2, character: 'moth' });
    c.player.hp = 20;
    play(c, 'lantern_tap');
    expect(c.player.hp).toBe(23);
    c.tide = 2;
    play(c, 'lantern_tap');
    expect(c.player.hp).toBe(23);
  });
  it('salt_compass: draw 1 when tide moves ≥2 at once, once per turn', () => {
    const c = mkCombat(['brinecrab'], { tide: 4, relics: ['salt_compass'] });
    c.relics = ['salt_compass'];
    c.draw = [card('kelp_guard'), card('kelp_guard'), card('kelp_guard')];
    c.hand = [];
    play(c, 'storm_oath'); // +2
    expect(c.hand.length).toBe(1);
    c.tide = 2;
    play(c, 'storm_oath');
    expect(c.hand.length).toBe(1);
  });
  it('pearl_ear: slack card in slack gives +3 block', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.relics = ['pearl_ear'];
    play(c, 'kelp_guard');
    expect(c.player.block).toBe(8 + 3);
  });
  it('rusted_anchor: no drift on even turns', () => {
    const c = mkCombat(['brinecrab'], { tide: 2 });
    c.relics = ['rusted_anchor'];
    c.hand = [];
    endTurn(c, rng()); // turn 1 → drift
    expect(c.tide).toBe(3);
    c.hand = [];
    endTurn(c, rng()); // turn 2 → anchored
    expect(c.tide).toBe(3);
  });
  it('glass_moon: first entry into storm sets tide to 4 and deals 8 to all', () => {
    const c = mkCombat(['brinecrab', 'kelppup'], { tide: 6 });
    c.relics = ['glass_moon'];
    for (const e of c.enemies) e.hp = 50;
    play(c, 'storm_oath');
    expect(c.tide).toBe(4);
    for (const e of c.enemies) expect(e.hp).toBe(42);
    c.tide = 6;
    play(c, 'storm_oath');
    expect(c.tide).toBe(8);
  });
  it('bloodwake: enemy hit that removes hull gives that enemy 2 salt', () => {
    const c = mkCombat(['gullthief']);
    c.relics = ['bloodwake'];
    c.hand = [];
    c.tide = 3;
    endTurn(c, rng()); // gull beat 0 atk 6
    expect(c.enemies[0].salt).toBe(1); // 2 applied, then ticks: dealt 2, fades to 1
  });
  it('choir_shell: +1 salt on cards and phial', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.relics = ['choir_shell'];
    play(c, 'debt_salt');
    expect(c.enemies[0].salt).toBe(7);
  });
  it('twin_hooks: +4 on the first attack each turn only', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.relics = ['twin_hooks'];
    const e = c.enemies[0];
    e.hp = 999;
    play(c, 'reed_strike');
    expect(999 - e.hp).toBe(6 + 4);
    e.hp = 999;
    play(c, 'reed_strike');
    expect(999 - e.hp).toBe(6);
  });
  it('counterweight: tide-moving card gives 3 block', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.relics = ['counterweight'];
    play(c, 'buoy_toss');
    expect(c.player.block).toBe(3);
  });
  it('wreck_candle: 6 cards on turn 1', () => {
    const c = mkCombat(['brinecrab'], { relics: ['wreck_candle'] });
    expect(c.hand.length).toBe(6);
  });
  it('brine_flask: free Springwater at combat start if a slot is empty', () => {
    const c = mkCombat(['brinecrab'], { relics: ['brine_flask'] });
    expect(c.phials).toContain('springwater');
  });
  it('lighthouse power: block every time tide moves', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    play(c, 'lighthouse');
    const b = c.player.block;
    play(c, 'buoy_toss');
    expect(c.player.block).toBe(b + 3);
  });
});
