import { CARDS, cardRate, effectsOf } from './cards';
import { cardCost, incomingAttack } from './combat';
import { reachableIds } from './map';
import { affinityOn, clampTide, willDrift } from './tide';
import type { Action, Affinity, CardInst, CombatState, Effect, GameState, RunState } from './types';

const RELIC_SCORE: Record<string, number> = {
  glass_moon: 10,
  wreck_candle: 9,
  twin_hooks: 9,
  rusted_anchor: 8,
  choir_shell: 8,
  counterweight: 8,
  kelp_heart: 7,
  brine_flask: 7,
  bloodwake: 6,
  salt_compass: 6,
  pearl_ear: 6,
  dry_map: 6,
  merchant_teeth: 5,
};

function cond(when: string, combat: CombatState, tide: number): boolean {
  if (when === 'tideMoved') return combat.tideMoved || tide !== combat.tide;
  if (when === 'deepEbb') return tide <= 1;
  if (when === 'storm') return tide >= 7;
  if (when === 'lowHp') return combat.player.hp * 2 <= combat.player.maxHp;
  if (when === 'enemyMovesTide') {
    return combat.enemies.some((e) => e.hp > 0);
  }
  return false;
}

function valueAt(effect: Effect, tide: number, affinity: Affinity, combat: CombatState): number {
  if (!('n' in effect)) return 0;
  if (effect.op === 'damage' && effect.timesTide) return effect.timesTide * tide + effect.n;
  if ('affN' in effect && effect.affN != null && affinityOn(affinity, tide)) return effect.affN;
  return effect.n;
}

function effectValue(effects: Effect[], combat: CombatState, tide: number, affinity: Affinity): number {
  let score = 0;
  const need = Math.max(0, incomingAttack(combat) - combat.player.block);
  for (const e of effects) {
    if (e.op === 'conditional') {
      const ok = cond(e.when, combat, tide);
      score += effectValue(ok ? e.effects : (e.else ?? []), combat, tide, affinity) * (ok ? 1 : 0.15);
      continue;
    }
    const n = valueAt(e, tide, affinity, combat) + (e.op === 'damage' ? combat.player.strength : 0);
    if (e.op === 'damage') {
      const hits = e.all ? Math.max(1, combat.enemies.filter((x) => x.hp > 0).length) : 1;
      score += n * hits;
      const prey = combat.enemies.filter((x) => x.hp > 0).sort((a, b) => a.hp - b.hp)[0];
      if (prey && n >= prey.hp + prey.block) score += 8;
    } else if (e.op === 'block') {
      if (need <= 0) score += n * 0.18;
      else score += Math.min(n, need) * 1.25 + Math.max(0, n - need) * 0.12;
    }
    else if (e.op === 'salt') score += n * 2.3;
    else if (e.op === 'draw') score += n * 2.1;
    else if (e.op === 'heal') score += n * (combat.player.hp < combat.player.maxHp * 0.65 ? 1.4 : 0.4);
    else if (e.op === 'strength') score += n * 7;
    else if (e.op === 'weak') score += n * 3.2;
    else if (e.op === 'loseHp') score -= n * (combat.player.hp < 24 ? 2.4 : 1.15);
    else if (e.op === 'loseBlock') score -= Math.min(10, combat.player.block) * 0.35;
    else if (e.op === 'power') score += 9;
    else if (e.op === 'retainBlock' || e.op === 'cheapNext') score += 3;
  }
  return score;
}

function tideAfter(effects: Effect[], tide: number, dir: 1 | -1): number {
  let t = tide;
  const walk = (list: Effect[]) => {
    for (const e of list) {
      if (e.op === 'tide') t += e.d;
      else if (e.op === 'tideSet') t = e.v;
      else if (e.op === 'tideChoose') t += dir * e.d;
      else if (e.op === 'conditional') walk(e.effects);
    }
  };
  walk(effects);
  return clampTide(t);
}

function handScore(combat: CombatState, tide: number, skipUid: string): number {
  let best = 0;
  for (const card of combat.hand) {
    if (card.uid === skipUid) continue;
    const def = CARDS[card.id];
    if (!def || def.unplayable) continue;
    best = Math.max(best, effectValue(effectsOf(def, card.up), combat, tide, def.affinity));
  }
  return best;
}

function scorePlay(card: CardInst, combat: CombatState, dir: 1 | -1): number {
  const def = CARDS[card.id];
  if (!def || def.unplayable) return -999;
  const cost = cardCost(card, combat);
  if (cost > combat.energy) return -999;
  const effects = effectsOf(def, card.up);
  const next = tideAfter(effects, combat.tide, dir);
  let score = effectValue(effects, combat, combat.tide, def.affinity);
  score += Math.max(0, handScore(combat, next, card.uid) - handScore(combat, combat.tide, card.uid)) * 0.85;
  const drift = willDrift(combat.turn, combat.relics.includes('rusted_anchor'));
  const endTide = clampTide(next + (drift ? 1 : 0));
  if (endTide >= 7) score -= 10;
  if (endTide <= 1) score -= 3;
  if (cost === 0) score += 1.2;
  const self = effects.reduce((sum, e) => sum + (e.op === 'loseHp' ? e.n : 0), 0);
  if (self >= combat.player.hp) return -999;
  if (incomingAttack(combat) >= combat.player.hp + combat.player.block && !effects.some((e) => e.op === 'block')) {
    score -= 4;
  }
  return score;
}

function bestTideDir(state: GameState): 1 | -1 {
  const combat = state.combat;
  const pending = state.pending;
  if (!combat || !pending) return 1;
  const card = combat.hand.find((c) => c.uid === pending.uid);
  if (!card) return 1;
  const plus = scorePlay(card, combat, 1);
  const minus = scorePlay(card, combat, -1);
  return plus >= minus ? 1 : -1;
}

function combatAction(state: GameState): Action {
  const combat = state.combat!;
  if (combat.phase === 'win') return { type: 'ackWin' };
  if (combat.phase === 'lose') return { type: 'ackLose' };
  const step = state.tutorialStep;
  if (step === 0 || step === 1 || step === 2) {
    const id = step === 0 ? 'reed_strike' : step === 1 ? 'kelp_guard' : 'buoy_toss';
    const card =
      combat.hand.find((c) => c.id === id) ??
      (step === 2 ? combat.hand.find((c) => c.id === 'lantern_tap') : undefined);
    if (card) return { type: 'playCard', uid: card.uid };
  }
  if (step === 3) return { type: 'endTurn' };
  const living = combat.enemies.filter((e) => e.hp > 0);
  if (living.length > 1) {
    const weakest = [...living].sort((a, b) => a.hp - b.hp)[0];
    const index = combat.enemies.findIndex((e) => e.uid === weakest.uid);
    if (index >= 0 && index !== state.target) return { type: 'setTarget', index };
  }
  const incoming = incomingAttack(combat);
  if (combat.player.hp <= incoming - combat.player.block && combat.player.hp < 28) {
    const heal = combat.phials.findIndex((p) => p === 'springwater' || p === 'ironkelp');
    if (heal >= 0 && combat.player.block < incoming) return { type: 'drink', index: heal };
  }
  let best: CardInst | null = null;
  let bestScore = 1.4;
  for (const card of combat.hand) {
    const score = Math.max(scorePlay(card, combat, 1), scorePlay(card, combat, -1));
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  if (best) return { type: 'playCard', uid: best.uid };
  return { type: 'endTurn' };
}

function upgradeable(run: RunState): CardInst[] {
  return run.deck.filter((c) => {
    const def = CARDS[c.id];
    return def && def.up && !c.up && def.rarity !== 'curse' && def.rarity !== 'status';
  });
}

function rewardAction(state: GameState): Action {
  const reward = state.reward!;
  const run = state.run!;
  if (!reward.cardTaken) {
    let best = reward.cards[0];
    let bestScore = -999;
    for (const id of reward.cards) {
      const copies = run.deck.filter((c) => c.id === id).length;
      const score = cardRate(id) - copies * 0.45;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return { type: 'pickCard', id: best };
  }
  if (!reward.relicTaken && reward.bossRelics?.length) {
    const id = [...reward.bossRelics].sort((a, b) => (RELIC_SCORE[b] ?? 4) - (RELIC_SCORE[a] ?? 4))[0];
    return { type: 'pickRelic', id };
  }
  return { type: 'leaveReward' };
}

function mapAction(state: GameState): Action {
  const run = state.run!;
  const ids = reachableIds(run.map);
  const hp = run.hp / run.maxHp;
  let best = ids[0];
  let bestScore = -999;
  for (const id of ids) {
    const node = run.map.nodes.find((n) => n.id === id);
    if (!node) continue;
    let score = 40;
    if (node.kind === 'rest') score = hp < 0.64 ? 100 : 22;
    else if (node.kind === 'shop') score = run.gold >= 68 ? 86 : 28;
    else if (node.kind === 'elite') score = hp > 0.74 ? 74 : 8;
    else if (node.kind === 'event') score = 58;
    else if (node.kind === 'boss') score = 36;
    else score = 50;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return { type: 'chooseNode', id: best };
}

function restAction(state: GameState): Action {
  const run = state.run!;
  if (run.hp / run.maxHp < 0.72) return { type: 'restHeal' };
  const ups = upgradeable(run).sort((a, b) => cardRate(b.id) - cardRate(a.id));
  if (ups[0]) return { type: 'restUpgrade', uid: ups[0].uid };
  const tide = run.character === 'keel' ? 6 : run.character === 'moth' ? 1 : 4;
  return { type: 'restAttune', tide };
}

function shopAction(state: GameState): Action {
  const run = state.run!;
  const shop = state.shop!;
  const curse = run.deck.find((c) => CARDS[c.id]?.rarity === 'curse');
  if (curse && run.gold >= Math.max(1, Math.round(run.removeCost * (run.relics.includes('merchant_teeth') ? 0.75 : 1)))) return { type: 'shopRemove', uid: curse.uid };
  const relic = shop.relics
    .filter((r) => !r.sold && r.price <= run.gold - 20)
    .sort((a, b) => (RELIC_SCORE[b.id] ?? 0) - (RELIC_SCORE[a.id] ?? 0))[0];
  if (relic && (RELIC_SCORE[relic.id] ?? 0) >= 6) return { type: 'shopBuyRelic', index: shop.relics.indexOf(relic) };
  const card = shop.cards
    .filter((c) => !c.sold && c.price <= run.gold - 28)
    .sort((a, b) => cardRate(b.id) - cardRate(a.id))[0];
  if (card && cardRate(card.id) >= 6) return { type: 'shopBuyCard', index: shop.cards.indexOf(card) };
  if (run.hp < run.maxHp * 0.45) {
    const phial = shop.phials.find((p) => !p.sold && (p.id === 'springwater' || p.id === 'ironkelp') && p.price <= run.gold);
    if (phial && run.phials.some((p) => p === null)) return { type: 'shopBuyPhial', index: shop.phials.indexOf(phial) };
  }
  return { type: 'shopLeave' };
}

function eventAction(state: GameState): Action {
  const run = state.run!;
  const id = state.eventId;
  const hp = run.hp / run.maxHp;
  if (id === 'bottle') return { type: 'eventChoose', index: 0 };
  if (id === 'wreck') return { type: 'eventChoose', index: hp > 0.55 ? 0 : 1 };
  if (id === 'choir') {
    if (upgradeable(run).length) return { type: 'eventChoose', index: 1 };
    if (run.deck.length > 6) return { type: 'eventChoose', index: 0 };
    return { type: 'eventChoose', index: 2 };
  }
  if (id === 'smuggler') {
    if (run.gold >= 35 && run.deck.some((c) => cardRate(c.id) >= 6)) return { type: 'eventChoose', index: 0 };
    return { type: 'eventChoose', index: hp < 0.6 ? 1 : 2 };
  }
  if (id === 'pool') {
    if (hp < 0.7) return { type: 'eventChoose', index: 0 };
    return { type: 'eventChoose', index: run.character === 'moth' ? 1 : 2 };
  }
  if (id === 'shrine') return { type: 'eventChoose', index: hp > 0.5 ? 0 : 1 };
  if (id === 'argument') return { type: 'eventChoose', index: hp > 0.68 ? 0 : 1 };
  if (id === 'cartographer') return { type: 'eventChoose', index: 0 };
  if (id === 'eel') return { type: 'eventChoose', index: run.deck.length > 8 ? 1 : 0 };
  if (id === 'moonwell') return { type: 'eventChoose', index: upgradeable(run).length >= 2 ? 0 : 1 };
  return { type: 'eventChoose', index: 0 };
}

function pickerUid(state: GameState): string | null {
  const run = state.run;
  const picker = state.picker;
  if (!run || !picker) return null;
  if (picker.mode === 'remove') {
    const curse = run.deck.find((c) => CARDS[c.id]?.rarity === 'curse');
    if (curse) return curse.uid;
    const sorted = run.deck
      .filter((c) => CARDS[c.id]?.rarity !== 'status')
      .sort((a, b) => cardRate(a.id) - cardRate(b.id));
    return sorted[0]?.uid ?? null;
  }
  if (picker.mode === 'upgrade') {
    const ups = upgradeable(run).sort((a, b) => cardRate(b.id) - cardRate(a.id));
    return ups[0]?.uid ?? null;
  }
  if (picker.mode === 'duplicate') {
    const cards = run.deck
      .filter((c) => {
        const d = CARDS[c.id];
        return d && d.rarity !== 'curse' && d.rarity !== 'status';
      })
      .sort((a, b) => cardRate(b.id) - cardRate(a.id));
    return cards[0]?.uid ?? null;
  }
  const cards = run.deck
    .filter((c) => CARDS[c.id]?.rarity !== 'status')
    .sort((a, b) => cardRate(a.id) - cardRate(b.id));
  return cards[0]?.uid ?? null;
}

export function policyAction(state: GameState): Action | null {
  if (state.screen === 'story') return { type: 'ackStory' };
  if (state.screen === 'victory' || state.screen === 'defeat' || state.screen === 'menu') return null;
  if (state.pending) return { type: 'tideChoice', dir: bestTideDir(state) };
  if (state.picker) {
    const uid = pickerUid(state);
    return uid ? { type: 'pickerPick', uid } : { type: 'pickerCancel' };
  }
  if (state.screen === 'combat' && state.combat) return combatAction(state);
  if (state.screen === 'reward') return rewardAction(state);
  if (state.screen === 'map' && state.run) return mapAction(state);
  if (state.screen === 'rest' && state.run) return restAction(state);
  if (state.screen === 'shop' && state.shop && state.run) return shopAction(state);
  if (state.screen === 'event' && state.run && state.eventId) return eventAction(state);
  if (state.screen === 'select') return { type: 'startRun', character: 'brine', chart: 0 };
  return null;
}
