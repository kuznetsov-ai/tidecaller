import { describe, expect, it } from 'vitest';
import { CARD_LIST, CARDS } from '../src/game/cards';
import { cardCost, drinkPhial, endTurn, incomingAttack, playCard, previewIntents, reassemble, strikeValue, writeCombatBack } from '../src/game/combat';
import { cardLines } from '../src/game/describe';
import { ENEMIES, ENEMY_LIST, rawIntents } from '../src/game/enemies';
import { startCombat } from '../src/game/combat';
import { card, give, mkCombat, mkRun, rng } from './helpers';
import type { CombatState } from '../src/game/types';

function invariants(c: CombatState) {
  expect(c.tide).toBeGreaterThanOrEqual(0);
  expect(c.tide).toBeLessThanOrEqual(8);
  expect(Number.isInteger(c.tide)).toBe(true);
  expect(c.energy).toBeGreaterThanOrEqual(0);
  expect(c.player.hp).toBeLessThanOrEqual(c.player.maxHp);
  expect(c.player.hp).toBeGreaterThanOrEqual(0);
  expect(c.player.block).toBeGreaterThanOrEqual(0);
  expect(c.hand.length).toBeLessThanOrEqual(10);
  for (const e of c.enemies) {
    expect(Number.isFinite(e.hp)).toBe(true);
    expect(e.block).toBeGreaterThanOrEqual(0);
  }
  const uids = [...c.hand, ...c.draw, ...c.discard, ...c.exhaustPile].map((x) => x.uid);
  expect(new Set(uids).size).toBe(uids.length);
}

describe('every card, base and upgraded, at every tide', () => {
  for (const def of CARD_LIST) {
    for (const up of [false, true]) {
      it(`${def.id}${up ? '+' : ''}`, () => {
        for (let tide = 0; tide <= 8; tide++) {
          const c = mkCombat(['brinecrab', 'kelppup'], { tide });
          for (const e of c.enemies) { e.hp = 500; e.maxHp = 500; }
          c.energy = 9;
          const inst = card(def.id, up);
          give(c, inst);
          const handBefore = c.hand.length;
          const r = playCard(c, inst.uid, rng(tide + 1), { target: 0 });
          if (def.unplayable) {
            expect(c.hand.some((x) => x.uid === inst.uid)).toBe(true);
            continue;
          }
          if (r.needsTide) {
            for (const dir of [1, -1] as const) {
              const cc = structuredClone(c);
              playCard(cc, inst.uid, rng(2), { target: 0, tideDir: dir });
              expect(cc.tide).toBe(Math.max(0, Math.min(8, tide + dir * r.needsTide)));
              invariants(cc);
            }
            continue;
          }
          expect(c.hand.some((x) => x.uid === inst.uid)).toBe(false);
          const where = def.exhaust || def.token ? c.exhaustPile : c.discard;
          expect(where.some((x) => x.uid === inst.uid)).toBe(true);
          expect(c.energy).toBe(9 - def.cost);
          expect(c.hand.length).toBeGreaterThanOrEqual(handBefore - 1);
          invariants(c);
        }
      });
    }
  }
});

describe('card text', () => {
  for (const def of CARD_LIST) {
    it(`${def.id} has readable rules text in RU and EN`, () => {
      for (const lang of ['ru', 'en'] as const) {
        for (const up of [false, true]) {
          const lines = cardLines(def, up, lang);
          const all = lines.join(' ');
          expect(all).not.toMatch(/undefined|NaN|\[object/);
          if (!def.unplayable) expect(lines.length).toBeGreaterThan(0);
        }
        expect(def.name[lang].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('damage, block, strength, weak', () => {
  it('strikeValue applies strength then weak (floor ×0.75), never below 0', () => {
    expect(strikeValue(8, 0, 0)).toBe(8);
    expect(strikeValue(8, 2, 0)).toBe(10);
    expect(strikeValue(8, 0, 1)).toBe(6);
    expect(strikeValue(7, 0, 1)).toBe(5);
    expect(strikeValue(1, -5, 0)).toBe(0);
    expect(strikeValue(6, 0, 0, 2)).toBe(8);
  });
  it('enemy block absorbs before hp', () => {
    const c = mkCombat(['brinecrab'], { tide: 2 });
    const e = c.enemies[0];
    e.block = 5;
    const hp = e.hp;
    give(c, card('reed_strike'));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(e.block).toBe(0);
    expect(hp - e.hp).toBe(4); // 9 in ebb − 5 block
  });
  it('pierce ignores part of player block', () => {
    const c = mkCombat(['debt_of_depth'], { tide: 4 });
    c.hand = [];
    c.player.block = 20;
    const hp = c.player.hp;
    endTurn(c, rng()); // depth beat 0: 16 pierce 0.5 → 10 usable block → 6 hull
    expect(hp - c.player.hp).toBe(6);
  });
  it('weak on enemy lowers its attack intent', () => {
    const c = mkCombat(['gullthief']);
    const base = previewIntents(c.enemies[0], c)[0].n;
    c.enemies[0].weak = 1;
    expect(previewIntents(c.enemies[0], c)[0].n).toBe(Math.floor(base * 0.75));
  });
  it('No Retreat drops block before hitting', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.player.block = 15;
    c.energy = 3;
    give(c, card('no_retreat'));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(c.player.block).toBe(0);
  });
});

describe('energy', () => {
  it('cannot play a card that costs more than current energy', () => {
    const c = mkCombat();
    c.energy = 1;
    const b = give(c, card('breaker'))[0];
    const len = c.hand.length;
    playCard(c, b.uid, rng(), { target: 0 });
    expect(c.hand.length).toBe(len);
    expect(c.energy).toBe(1);
  });
  it('cheapNext discounts exactly one following card', () => {
    const c = mkCombat();
    c.energy = 3;
    c.cheapNext = 1;
    const b = give(c, card('breaker'))[0];
    expect(cardCost(b, c)).toBe(CARDS.breaker.cost - 1);
    playCard(c, b.uid, rng(), { target: 0 });
    expect(c.cheapNext).toBe(0);
  });
  it('energy refills to max at start of each turn and barnacle in hand drains 1', () => {
    const c = mkCombat();
    c.energy = 0;
    c.hand = [];
    c.draw = [card('barnacle'), card('reed_strike'), card('reed_strike'), card('reed_strike'), card('reed_strike')];
    endTurn(c, rng());
    expect(c.hand.some((x) => x.id === 'barnacle')).toBe(true);
    expect(c.energy).toBe(2);
  });
  it('Debt of Depth adds +1 cost only at tide ≤ 3', () => {
    const c = mkCombat(['debt_of_depth'], { tide: 3 });
    const r = card('reed_strike');
    expect(cardCost(r, c)).toBe(2);
    c.tide = 4;
    expect(cardCost(r, c)).toBe(1);
  });
});

describe('tide edges and thresholds', () => {
  it('tide cannot overflow 8 or go below 0 via cards', () => {
    const c = mkCombat(['brinecrab'], { tide: 8 });
    c.energy = 9;
    give(c, card('storm_oath'));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(c.tide).toBe(8);
    c.tide = 0;
    give(c, card('lantern_tap'));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(c.tide).toBe(0);
  });
  it('end of turn: natural drift +1, never above 8', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.hand = [];
    endTurn(c, rng());
    // crab beat 0 = block, so only drift moves the tide
    expect(c.tide).toBe(5);
    const d = mkCombat(['brinecrab'], { tide: 8 });
    d.hand = [];
    endTurn(d, rng());
    expect(d.tide).toBe(8);
  });
  it('storm (≥7) hits player for 3 ignoring block, and all enemies for 3', () => {
    const c = mkCombat(['brinecrab'], { tide: 6 });
    c.hand = [];
    c.player.block = 50;
    const hp = c.player.hp;
    const ehp = c.enemies[0].hp;
    endTurn(c, rng());
    expect(c.tide).toBe(7);
    expect(hp - c.player.hp).toBe(3);
    expect(ehp - c.enemies[0].hp).toBe(3);
  });
  it('tide 6 → 7 is the storm threshold; ending at 5 is safe', () => {
    const c = mkCombat(['brinecrab'], { tide: 5 });
    c.hand = [];
    const hp = c.player.hp;
    endTurn(c, rng());
    expect(c.tide).toBe(6);
    expect(c.player.hp).toBe(hp);
  });
  it('dead water (≤1) after drift: enemies −2, next draw −1', () => {
    const c = mkCombat(['brinecrab'], { tide: 0 });
    c.hand = [];
    const ehp = c.enemies[0].hp;
    endTurn(c, rng());
    expect(c.tide).toBe(1);
    expect(ehp - c.enemies[0].hp).toBe(2);
    expect(c.hand.length).toBe(4);
  });
  it('tide 1 → 2 by drift is no longer dead water', () => {
    const c = mkCombat(['brinecrab'], { tide: 1 });
    c.hand = [];
    const ehp = c.enemies[0].hp;
    endTurn(c, rng());
    expect(c.tide).toBe(2);
    expect(c.enemies[0].hp).toBe(ehp);
    expect(c.hand.length).toBe(5);
  });
  it('tideChoose asks for a direction first and spends nothing', () => {
    const c = mkCombat();
    c.energy = 3;
    const m = give(c, card('moonstep'))[0];
    const r = playCard(c, m.uid, rng(), { target: 0 });
    expect(r.needsTide).toBe(2);
    expect(c.energy).toBe(3);
    expect(c.hand.some((x) => x.uid === m.uid)).toBe(true);
  });
  it('tideSet (Still Water) sets exactly 4 from any tide', () => {
    for (const t of [0, 8]) {
      const c = mkCombat(['brinecrab'], { tide: t });
      c.energy = 3;
      give(c, card('still_water'));
      playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
      expect(c.tide).toBe(4);
    }
  });
  it('Moonhook scales with tide (3×tide)', () => {
    for (const t of [0, 4, 8]) {
      const c = mkCombat(['brinecrab'], { tide: t });
      const e = c.enemies[0];
      e.hp = 999;
      c.energy = 3;
      give(c, card('moonhook'));
      playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
      expect(999 - e.hp).toBe(3 * t);
    }
  });
  it('tideMoved conditional only after the player moved water this turn', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    const e = c.enemies[0];
    e.hp = 999;
    c.energy = 9;
    const id = CARD_LIST.find((d) => d.effects.some((x) => x.op === 'conditional' && x.when === 'tideMoved'))!.id;
    give(c, card(id));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    const first = 999 - e.hp;
    give(c, card('buoy_toss'));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    e.hp = 999;
    give(c, card(id));
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(999 - e.hp).toBeGreaterThan(first);
  });
});

describe('statuses', () => {
  it('player salt ticks at end of turn ignoring block, then fades by 1', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.salt = 4;
    c.player.block = 99;
    const hp = c.player.hp;
    endTurn(c, rng());
    expect(hp - c.player.hp).toBe(4);
    expect(c.player.salt).toBe(3);
  });
  it('enemy salt ticks on its turn, then fades by 1; salt can kill', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.tide = 3;
    c.enemies[0].salt = 5;
    c.enemies[0].hp = 5;
    endTurn(c, rng());
    expect(c.phase).toBe('win');
  });
  it('weak decays by 1 each end of turn', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.weak = 2;
    endTurn(c, rng());
    expect(c.player.weak).toBe(1);
  });
  it('block drops at the start of the next player turn unless retained', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.block = 30;
    endTurn(c, rng());
    expect(c.player.block).toBe(0);
    const d = mkCombat(['brinecrab']);
    d.energy = 3;
    give(d, card('mast'));
    const mastDef = CARDS.mast;
    playCard(d, d.hand[d.hand.length - 1].uid, rng(), { target: 0 });
    if (mastDef.effects.some((x) => x.op === 'retainBlock')) {
      d.hand = [];
      endTurn(d, rng());
      expect(d.player.block).toBeGreaterThan(0);
    }
  });
});

describe('deck, discard, hand limit', () => {
  it('empty draw pile reshuffles the discard', () => {
    const c = mkCombat();
    c.hand = [];
    c.draw = [];
    c.discard = [card('reed_strike'), card('reed_strike'), card('kelp_guard')];
    endTurn(c, rng());
    expect(c.hand.length).toBe(3);
    expect(c.discard.length).toBe(0);
  });
  it('both piles empty: drawing does nothing and does not crash', () => {
    const c = mkCombat();
    c.hand = [];
    c.draw = [];
    c.discard = [];
    c.energy = 3;
    give(c, card('read_water'));
    playCard(c, c.hand[0].uid, rng(), { target: 0 });
    expect(c.hand.length).toBe(0);
    expect(c.discard.map((x) => x.id)).toEqual(['read_water']);
  });
  it('hand is capped at 10; overflow draws go to discard', () => {
    const c = mkCombat();
    c.hand = Array.from({ length: 9 }, () => card('kelp_guard'));
    c.draw = Array.from({ length: 5 }, () => card('reed_strike'));
    c.energy = 3;
    give(c, card('buoy_toss', true)); // 10 in hand, plays → 9, draws 2 → 10 + 1 overflow
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(c.hand.length).toBe(10);
    expect(c.discard.filter((x) => x.id === 'reed_strike').length).toBe(1);
  });
  it('snag token goes to hand, exhausts at end of turn, never returns to the deck', () => {
    const c = mkCombat(['netwraith']);
    c.hand = [];
    endTurn(c, rng()); // wraith beat 0 = snag
    expect(c.hand.some((x) => x.id === 'snag')).toBe(true);
    const run = mkRun();
    endTurn(c, rng());
    writeCombatBack(run, c);
    expect(run.deck.some((x) => x.id === 'snag')).toBe(false);
  });
  it('retain cards stay in hand; ethereal cards exhaust', () => {
    const c = mkCombat();
    c.hand = [card('buoyant'), card('snag')];
    endTurn(c, rng());
    expect(c.hand.some((x) => x.id === 'buoyant')).toBe(true);
    expect(c.exhaustPile.some((x) => x.id === 'snag')).toBe(true);
  });
  it('deck is restored after combat (reassemble keeps every real card once)', () => {
    const run = mkRun();
    const ids = run.deck.map((x) => x.uid).sort();
    const c = startCombat(run, ['gullthief'], rng(), { startTide: 4, fightKind: 'combat', row: 0 });
    expect(reassemble(c).map((x) => x.uid).sort()).toEqual(ids);
  });
});

describe('curses', () => {
  it('Hole in hand costs 3 hull at end of turn; Soaked Chart pushes tide +1 (plus drift)', () => {
    const c = mkCombat(['brinecrab'], { tide: 3 });
    c.hand = [card('hole'), card('soaked_chart')];
    const hp = c.player.hp;
    endTurn(c, rng());
    expect(hp - c.player.hp).toBe(3);
    expect(c.tide).toBe(5);
  });
});

describe('hp 0, simultaneous death', () => {
  it('hp exactly 0 is a loss', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.hp = 3;
    c.tide = 6; // storm deals exactly 3
    endTurn(c, rng());
    expect(c.player.hp).toBe(0);
    expect(c.phase).toBe('lose');
  });
  it('hp 1 survives', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.hp = 4;
    c.tide = 6;
    endTurn(c, rng());
    expect(c.player.hp).toBe(1);
    expect(c.phase).not.toBe('lose');
  });
  it('storm killing both sides at once resolves as a loss (player first)', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.player.hp = 3;
    c.enemies[0].hp = 3;
    c.tide = 6;
    endTurn(c, rng());
    expect(c.phase).toBe('lose');
  });
  it('storm killing the last enemy only is a win', () => {
    const c = mkCombat(['brinecrab']);
    c.hand = [];
    c.enemies[0].hp = 3;
    c.tide = 6;
    endTurn(c, rng());
    expect(c.phase).toBe('win');
  });
  it('tutorial never drops below 1 hull', () => {
    const c = mkCombat(['tutor_gull']);
    c.tutorial = true;
    c.hand = [];
    c.player.hp = 2;
    c.player.block = 0;
    endTurn(c, rng());
    expect(c.player.hp).toBe(1);
  });
  it('killing all enemies mid-card stops further effects and sets win', () => {
    const c = mkCombat(['kelppup', 'kelppup'], { tide: 8 });
    for (const e of c.enemies) e.hp = 1;
    c.energy = 3;
    give(c, card('bell')); // aoe + tideSet 4
    playCard(c, c.hand[c.hand.length - 1].uid, rng(), { target: 0 });
    expect(c.phase).toBe('win');
    expect(c.enemies.length).toBe(0);
  });
});

describe('enemies and intents', () => {
  for (const def of ENEMY_LIST) {
    it(`${def.id} produces valid intents for every beat and tide`, () => {
      const c = mkCombat([def.id]);
      const e = c.enemies[0];
      for (let pi = 0; pi < 6; pi++) {
        for (let t = 0; t <= 8; t++) {
          e.pi = pi;
          c.tide = t;
          for (const i of previewIntents(e, c)) {
            expect(['attack', 'block', 'tide', 'tideSet', 'salt', 'weak', 'strength', 'summon', 'heal', 'curse', 'snag']).toContain(i.kind);
            expect(Number.isFinite(i.n)).toBe(true);
            if (i.kind === 'summon' || i.kind === 'curse') expect(ENEMIES[i.id!] ?? CARDS[i.id!]).toBeTruthy();
          }
        }
      }
    });
    it(`${def.id}: 6 full turns resolve without breaking invariants`, () => {
      const c = mkCombat([def.id]);
      c.player.hp = c.player.maxHp = 999;
      for (let k = 0; k < 6 && c.phase === 'player'; k++) {
        c.hand = [];
        endTurn(c, rng(k));
        invariants(c);
      }
    });
  }
  it('Kelp Warden summons a lash on flood, at most 2', () => {
    const c = mkCombat(['kelp_warden'], { tide: 6 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    c.enemies[0].pi = 0;
    endTurn(c, rng());
    expect(c.enemies.filter((e) => e.defId === 'kelp_minion').length).toBe(1);
  });
  it('a summoned lash shows its intent on the next player turn and performs it', () => {
    const c = mkCombat(['kelp_warden'], { tide: 6 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    endTurn(c, rng());
    const lash = c.enemies.find((e) => e.defId === 'kelp_minion')!;
    expect(lash.summoned).toBe(false);
    const shown = previewIntents(lash, c).filter((i) => i.kind === 'attack').reduce((a, i) => a + i.n, 0);
    expect(shown).toBeGreaterThan(0);
    const hp = c.player.hp;
    c.player.block = 0;
    c.hand = [];
    c.enemies[0].pi = 2; // warden: tide −2 + block, no attack
    c.tide = 3; // keep storm out of the sum
    endTurn(c, rng());
    expect(hp - c.player.hp).toBe(shown);
  });
  it('shown attack equals damage taken (end-of-turn drift accounted for) — Salt Knight at tide 4', () => {
    const c = mkCombat(['salt_knight'], { tide: 4 });
    c.hand = [];
    c.enemies[0].pi = 1; // heavy beat: 20 on flood (5+), 14 otherwise
    const shown = incomingAttack(c);
    const hp = c.player.hp;
    endTurn(c, rng());
    expect(hp - c.player.hp).toBe(shown);
  });
  it('Ledger Eel docks gold only when its hit removes hull', () => {
    const c = mkCombat(['ledger_eel']);
    c.hand = [];
    c.enemies[0].pi = 1;
    c.player.block = 100;
    const g = c.gold;
    endTurn(c, rng());
    expect(c.gold).toBe(g);
    const d = mkCombat(['ledger_eel']);
    d.hand = [];
    d.enemies[0].pi = 1;
    d.gold = 3;
    endTurn(d, rng());
    expect(d.gold).toBe(0); // never negative
  });
  it('enemy heal is capped at max hp', () => {
    const c = mkCombat(['glass_whale'], { tide: 7 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    c.enemies[0].pi = 2;
    c.enemies[0].hp = c.enemies[0].maxHp - 3;
    endTurn(c, rng());
    expect(c.enemies[0].hp).toBeLessThanOrEqual(c.enemies[0].maxHp);
  });
  it('Moon counts storm entries as doom', () => {
    const c = mkCombat(['moon'], { tide: 6 });
    c.player.hp = c.player.maxHp = 999;
    c.hand = [];
    endTurn(c, rng());
    expect(c.enemies[0].doom).toBe(1);
  });
});

describe('phials', () => {
  it('each phial does its thing and empties the slot', () => {
    const c = mkCombat(['brinecrab'], { tide: 4 });
    c.phials = ['springwater', 'ironkelp', 'stormglass'];
    c.player.hp = 10;
    drinkPhial(c, 0, rng(), 0);
    expect(c.player.hp).toBe(24);
    drinkPhial(c, 1, rng(), 0);
    expect(c.player.block).toBe(16);
    drinkPhial(c, 2, rng(), 0);
    expect(c.tide).toBe(7);
    expect(c.phials).toEqual([null, null, null]);
    c.phials = ['ebb_ash', 'saltspike', null];
    drinkPhial(c, 0, rng(), 0);
    expect(c.tide).toBe(1);
    drinkPhial(c, 1, rng(), 0);
    expect(c.enemies[0].salt).toBe(7);
    drinkPhial(c, 2, rng(), 0); // empty slot: no-op
  });
  it('heal phial never exceeds max hull', () => {
    const c = mkCombat();
    c.phials = ['springwater', null, null];
    c.player.hp = c.player.maxHp - 2;
    drinkPhial(c, 0, rng(), 0);
    expect(c.player.hp).toBe(c.player.maxHp);
  });
});

describe('tide choice needs energy first', () => {
  it('an unaffordable Moonstep does not open the direction prompt', () => {
    const c = mkCombat();
    c.energy = 0;
    const m = give(c, card('moonstep'))[0];
    expect(playCard(c, m.uid, rng(), { target: 0 }).needsTide).toBeUndefined();
  });
});
