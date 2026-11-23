import { CARDS, effectsOf, movesTide } from './cards';
import { ENEMIES, rawIntents } from './enemies';
import { newUid, type Rng } from './rng';
import { affinityOn, clampTide, willDrift } from './tide';
import type {
  CardInst,
  CombatState,
  Effect,
  EnemyInst,
  FightKind,
  Fx,
  PhialId,
  ResolvedIntent,
  RunState,
} from './types';

const HAND_MAX = 10;

export function strikeValue(base: number, strength: number, weak: number, chartBonus = 0): number {
  let n = base + strength + chartBonus;
  if (weak > 0) n = Math.floor(n * 0.75);
  return Math.max(0, n);
}

export function debtActive(combat: CombatState): boolean {
  return combat.tide <= 3 && combat.enemies.some((e) => e.hp > 0 && e.defId === 'debt_of_depth');
}

export function cardCost(card: CardInst, combat: Pick<CombatState, 'tide' | 'cheapNext' | 'enemies'>): number {
  const def = CARDS[card.id];
  if (!def || def.unplayable) return 0;
  let c = def.cost;
  if (combat.cheapNext) c -= combat.cheapNext;
  if (debtActive(combat as CombatState)) c += 1;
  return Math.max(0, c);
}

/**
 * Tide the enemies will act on if the player ends the turn now: curse pushes in hand,
 * then the natural drift (+1 unless anchored), then Glass Moon's first-storm reset.
 */
export function projectedTide(combat: CombatState): number {
  let t = combat.tide;
  for (const card of combat.hand) {
    for (const e of CARDS[card.id]?.endTurn ?? []) if (e.op === 'tide') t = clampTide(t + e.d);
  }
  if (willDrift(combat.turn, combat.relics.includes('rusted_anchor'))) t = clampTide(t + 1);
  if (t >= 7 && combat.tide < 7 && combat.relics.includes('glass_moon') && !combat.moonUsed) t = 4;
  return t;
}

export function previewIntents(enemy: EnemyInst, combat: CombatState): ResolvedIntent[] {
  if (enemy.hp <= 0) return [];
  // Summoned this enemy phase: it acts from the next one (its intent appears on your turn).
  if (enemy.summoned) return [];
  // During the player's turn, show what the enemy will do on the tide it will actually see.
  const view = combat.phase === 'player' ? { ...combat, tide: projectedTide(combat) } : combat;
  return rawIntents(enemy, view).map((raw) => {
    if (raw.kind === 'attack') {
      const n = strikeValue(raw.n ?? 0, enemy.strength, enemy.weak, combat.chart);
      return { ...raw, n, hits: raw.hits ?? 1, pierce: raw.pierce ?? 0 };
    }
    return { ...raw, n: raw.n ?? 0, hits: raw.hits ?? 1, pierce: raw.pierce ?? 0 };
  });
}

export function incomingAttack(combat: CombatState): number {
  let total = 0;
  for (const e of combat.enemies) {
    for (const intent of previewIntents(e, combat)) {
      if (intent.kind === 'attack') total += intent.n * (intent.hits ?? 1);
    }
  }
  return total;
}

function enemyMovesTide(combat: CombatState): boolean {
  return combat.enemies.some((e) =>
    rawIntents(e, combat).some((r) => r.kind === 'tide' || r.kind === 'tideSet'),
  );
}

export function reassemble(combat: CombatState): CardInst[] {
  const all = [...combat.draw, ...combat.discard, ...combat.hand, ...combat.exhaustPile];
  return all.filter((c) => !CARDS[c.id]?.token).map((c) => ({ uid: c.uid, id: c.id, up: c.up }));
}

function chartHpMult(chart: number): number {
  return chart === 0 ? 1 : chart === 1 ? 1.16 : 1.32;
}

export function startCombat(
  run: RunState,
  defIds: string[],
  rng: Rng,
  opt: { tutorial?: boolean; fightKind?: FightKind; row?: number; startTide: number },
): CombatState {
  const chart = opt.tutorial ? 0 : run.chart;
  const rowBonus = opt.tutorial || opt.fightKind === 'boss' ? 0 : (opt.row ?? 0) * 0.04;
  const hpMult = chartHpMult(chart) * (1 + rowBonus);
  const tide = clampTide(opt.tutorial ? 4 : run.nextTide ?? opt.startTide);
  run.nextTide = null;
  const combat: CombatState = {
    enemies: defIds.map((id) => spawn(id, rng, hpMult, chart)),
    hand: [],
    draw: rng.shuffle(run.deck.map((c) => ({ ...c }))),
    discard: [],
    exhaustPile: [],
    tide,
    energy: 3,
    maxEnergy: 3,
    turn: 0,
    player: { hp: run.hp, maxHp: run.maxHp, block: 0, salt: 0, weak: 0, strength: 0 },
    relics: run.relics.slice(),
    powers: { lighthouse: 0 },
    retainCap: 0,
    cheapNext: 0,
    drawPenalty: 0,
    cardsPlayed: 0,
    cardsPlayedLast: 0,
    tideMoved: false,
    phase: 'player',
    buoyUsed: false,
    nailUsed: false,
    wickUsed: false,
    moonUsed: false,
    compassUsed: false,
    firstAttack: false,
    echo: null,
    chart,
    tutorial: !!opt.tutorial,
    lastSource: '',
    phials: run.phials.map((p) => p),
    gold: run.gold,
    fightKind: opt.fightKind ?? 'combat',
  };
  run.deck = [];
  if (combat.relics.includes('brine_flask')) {
    const slot = combat.phials.findIndex((p) => p === null);
    if (slot >= 0) combat.phials[slot] = 'springwater';
  }
  if (opt.tutorial) stackTutorial(combat);
  const fx: Fx[] = [];
  beginPlayerTurn(combat, rng, fx);
  return combat;
}

function spawn(id: string, rng: Rng, hpMult: number, _chart: number): EnemyInst {
  const def = ENEMIES[id];
  const base = def ? rng.int(def.hp[0], def.hp[1]) : 20;
  const max = Math.max(1, Math.round(base * hpMult));
  return {
    uid: newUid(rng),
    defId: id,
    hp: max,
    maxHp: max,
    block: 0,
    salt: 0,
    weak: 0,
    strength: 0,
    pi: 0,
    doom: 0,
    summoned: false,
  };
}

function stackTutorial(combat: CombatState): void {
  const order = ['reed_strike', 'kelp_guard', 'buoy_toss', 'lantern_tap', 'reed_strike'];
  const rest = combat.draw.slice();
  const picked: CardInst[] = [];
  for (const id of order) {
    const i = rest.findIndex((c) => c.id === id);
    if (i >= 0) picked.push(rest.splice(i, 1)[0]);
  }
  combat.draw = [...rest, ...picked.reverse()];
}

function pull(combat: CombatState, rng: Rng): CardInst | null {
  if (combat.draw.length === 0) {
    if (combat.discard.length === 0) return null;
    combat.draw = rng.shuffle(combat.discard);
    combat.discard = [];
  }
  return combat.draw.pop() ?? null;
}

function drawCards(combat: CombatState, n: number, rng: Rng, fx: Fx[]): void {
  for (let i = 0; i < n; i++) {
    const c = pull(combat, rng);
    if (!c) break;
    if (combat.hand.length >= HAND_MAX) {
      combat.discard.push(c);
      fx.push({ t: 'log', code: 'handFull' });
    } else {
      combat.hand.push(c);
    }
  }
}

function beginPlayerTurn(combat: CombatState, rng: Rng, fx: Fx[]): void {
  combat.turn += 1;
  for (const e of combat.enemies) e.summoned = false;
  if (combat.retainCap > 0) combat.player.block = Math.min(combat.player.block, combat.retainCap);
  else combat.player.block = 0;
  combat.retainCap = 0;
  combat.energy = combat.maxEnergy;
  combat.tideMoved = false;
  combat.compassUsed = false;
  combat.firstAttack = false;
  const bonus = combat.turn === 1 && combat.relics.includes('wreck_candle') ? 1 : 0;
  const n = Math.max(1, 5 - combat.drawPenalty + bonus);
  combat.drawPenalty = 0;
  drawCards(combat, n, rng, fx);
  const barn = combat.hand.filter((c) => c.id === 'barnacle').length;
  combat.energy = Math.max(0, combat.energy - barn);
  combat.phase = 'player';
}

function living(combat: CombatState): EnemyInst[] {
  return combat.enemies.filter((e) => e.hp > 0);
}

function targetOf(combat: CombatState, index: number): EnemyInst | null {
  const direct = combat.enemies[index];
  if (direct && direct.hp > 0) return direct;
  return living(combat)[0] ?? null;
}

function killCheck(combat: CombatState, fx: Fx[]): void {
  let died = false;
  for (const e of combat.enemies) {
    if (e.hp <= 0 && e.hp !== -9999) {
      e.hp = -9999;
      died = true;
      fx.push({ t: 'die', id: e.uid });
    }
  }
  if (died) combat.enemies = combat.enemies.filter((e) => e.hp > 0);
  if (combat.phase !== 'lose' && combat.enemies.length === 0) combat.phase = 'win';
}

function damageEnemy(combat: CombatState, enemy: EnemyInst, amount: number, kind: 'attack' | 'true', fx: Fx[], pierce = 0): number {
  if (enemy.hp <= 0) return 0;
  let hpLoss = amount;
  if (kind === 'attack') {
    const ignored = Math.floor(enemy.block * pierce);
    const usable = enemy.block - ignored;
    const blocked = Math.min(usable, amount);
    enemy.block -= blocked;
    hpLoss = amount - blocked;
    if (blocked > 0) fx.push({ t: 'block', who: enemy.uid, n: blocked });
  }
  if (hpLoss > 0) {
    enemy.hp -= hpLoss;
    fx.push({ t: 'dmg', who: enemy.uid, n: hpLoss });
    if (hpLoss >= 8) fx.push({ t: 'shake' });
  }
  return hpLoss;
}

function damagePlayer(
  combat: CombatState,
  amount: number,
  kind: 'attack' | 'true',
  source: string,
  fx: Fx[],
  pierce = 0,
  from?: EnemyInst,
): number {
  let hpLoss = amount;
  if (kind === 'attack') {
    const ignored = Math.floor(combat.player.block * pierce);
    const usable = combat.player.block - ignored;
    const blocked = Math.min(usable, amount);
    combat.player.block -= blocked;
    hpLoss = amount - blocked;
    if (blocked > 0) fx.push({ t: 'block', who: 'p', n: blocked });
  }
  if (hpLoss > 0) {
    combat.player.hp -= hpLoss;
    combat.lastSource = source;
    fx.push({ t: 'dmg', who: 'p', n: hpLoss });
    if (hpLoss >= 8) fx.push({ t: 'shake' });
    if (from && combat.relics.includes('bloodwake')) {
      from.salt += 2;
      fx.push({ t: 'salt', who: from.uid, n: 2 });
    }
    if (combat.tutorial && combat.player.hp < 1) combat.player.hp = 1;
    if (combat.player.hp <= 0) {
      combat.player.hp = 0;
      combat.phase = 'lose';
    }
  }
  return hpLoss;
}

function gainBlock(combat: CombatState, amount: number, fx: Fx[], who: 'p' | string = 'p'): void {
  if (amount <= 0) return;
  if (who === 'p') combat.player.block += amount;
  else {
    const e = combat.enemies.find((x) => x.uid === who);
    if (e) e.block += amount;
  }
  fx.push({ t: 'block', who, n: amount });
}

function healPlayer(combat: CombatState, amount: number, fx: Fx[]): void {
  const before = combat.player.hp;
  combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + amount);
  const got = combat.player.hp - before;
  if (got > 0) fx.push({ t: 'heal', who: 'p', n: got });
}

function setTide(combat: CombatState, to: number, fx: Fx[], rng: Rng, cause: 'card' | 'drift' | 'enemy' | 'phial' | 'curse'): void {
  const from = combat.tide;
  let v = clampTide(to);
  if (v >= 7 && from < 7 && combat.relics.includes('glass_moon') && !combat.moonUsed) {
    combat.moonUsed = true;
    v = 4;
    for (const e of combat.enemies) {
      if (e.hp > 0) damageEnemy(combat, e, 8, 'true', fx);
    }
    fx.push({ t: 'log', code: 'glassMoon' });
    killCheck(combat, fx);
  }
  if (v === from) {
    combat.tide = v;
    return;
  }
  combat.tide = v;
  if (combat.phase === 'player' && (cause === 'card' || cause === 'phial' || cause === 'curse')) combat.tideMoved = true;
  fx.push({ t: 'tide', from, to: v });
  if (combat.powers.lighthouse > 0) gainBlock(combat, combat.powers.lighthouse, fx);
  if (v >= 5 && from < 5 && cause === 'card' && combat.relics.includes('storm_nail') && !combat.nailUsed) {
    combat.nailUsed = true;
    combat.player.strength += 1;
    fx.push({ t: 'log', code: 'nail' });
  }
  if (v <= 1 && from > 1 && combat.relics.includes('lantern_wick') && !combat.wickUsed) {
    combat.wickUsed = true;
    healPlayer(combat, 3, fx);
    fx.push({ t: 'log', code: 'wick' });
  }
  if (
    combat.phase === 'player' &&
    Math.abs(v - from) >= 2 &&
    combat.relics.includes('salt_compass') &&
    !combat.compassUsed
  ) {
    combat.compassUsed = true;
    drawCards(combat, 1, rng, fx);
    fx.push({ t: 'log', code: 'compass' });
  }
  if (v >= 7 && from < 7) {
    for (const e of combat.enemies) {
      if (e.defId === 'moon' && e.hp > 0) {
        e.doom += 1;
        fx.push({ t: 'log', code: 'doom', n: e.doom });
      }
    }
  }
}

interface Rctx {
  affinity: import('./types').Affinity;
  target: number;
  echo: { dmg: number; block: number; salt: number; tide: number };
  twinArmed: boolean;
}

function amountOf(effect: Extract<Effect, { n: number }>, combat: CombatState, affinity: Rctx['affinity']): number {
  if (effect.op === 'damage' && effect.timesTide) return effect.timesTide * combat.tide + effect.n;
  if ('affN' in effect && effect.affN != null && affinityOn(affinity, combat.tide)) return effect.affN;
  return effect.n;
}

function whenMet(when: string, combat: CombatState): boolean {
  if (when === 'tideMoved') return combat.tideMoved;
  if (when === 'deepEbb') return combat.tide <= 1;
  if (when === 'storm') return combat.tide >= 7;
  if (when === 'lowHp') return combat.player.hp * 2 <= combat.player.maxHp;
  if (when === 'enemyMovesTide') return enemyMovesTide(combat);
  return false;
}

function resolveEffects(combat: CombatState, effects: Effect[], ctx: Rctx, rng: Rng, fx: Fx[]): void {
  for (const effect of effects) {
    if (isLost(combat) || isWon(combat)) return;
    if (effect.op === 'conditional') {
      const list = whenMet(effect.when, combat) ? effect.effects : (effect.else ?? []);
      resolveEffects(combat, list, ctx, rng, fx);
      continue;
    }
    if (effect.op === 'damage') {
      let base = amountOf(effect, combat, ctx.affinity);
      base = strikeValue(base, combat.player.strength, combat.player.weak, 0);
      if (ctx.twinArmed && combat.relics.includes('twin_hooks')) {
        base += 4;
        ctx.twinArmed = false;
        combat.firstAttack = true;
      }
      const targets = effect.all ? living(combat) : [targetOf(combat, ctx.target)].filter((e): e is EnemyInst => !!e);
      for (const enemy of targets) {
        damageEnemy(combat, enemy, base, 'attack', fx);
        ctx.echo.dmg = Math.max(ctx.echo.dmg, base);
      }
      killCheck(combat, fx);
      continue;
    }
    if (effect.op === 'block') {
      const n = amountOf(effect, combat, ctx.affinity);
      gainBlock(combat, n, fx);
      ctx.echo.block += n;
      continue;
    }
    if (effect.op === 'tide') {
      const before = combat.tide;
      setTide(combat, combat.tide + effect.d, fx, rng, 'card');
      ctx.echo.tide += combat.tide - before;
      continue;
    }
    if (effect.op === 'tideSet') {
      const before = combat.tide;
      setTide(combat, effect.v, fx, rng, 'card');
      ctx.echo.tide += combat.tide - before;
      continue;
    }
    if (effect.op === 'tideChoose') continue;
    if (effect.op === 'draw') {
      drawCards(combat, amountOf(effect, combat, ctx.affinity), rng, fx);
      continue;
    }
    if (effect.op === 'salt') {
      let n = amountOf(effect, combat, ctx.affinity);
      if (combat.relics.includes('choir_shell')) n += 1;
      const enemy = targetOf(combat, ctx.target);
      if (enemy) {
        enemy.salt += n;
        fx.push({ t: 'salt', who: enemy.uid, n });
        ctx.echo.salt += n;
      }
      continue;
    }
    if (effect.op === 'heal') {
      healPlayer(combat, amountOf(effect, combat, ctx.affinity), fx);
      continue;
    }
    if (effect.op === 'strength') {
      combat.player.strength += effect.n;
      fx.push({ t: 'log', code: 'strength', n: effect.n });
      continue;
    }
    if (effect.op === 'weak') {
      const enemy = targetOf(combat, ctx.target);
      if (enemy) enemy.weak += effect.n;
      continue;
    }
    if (effect.op === 'loseHp') {
      damagePlayer(combat, effect.n, 'true', 'self', fx);
      continue;
    }
    if (effect.op === 'loseBlock') {
      combat.player.block = 0;
      continue;
    }
    if (effect.op === 'retainBlock') {
      combat.retainCap = Math.max(combat.retainCap, effect.n);
      continue;
    }
    if (effect.op === 'cheapNext') {
      combat.cheapNext += effect.n;
      continue;
    }
    if (effect.op === 'power') {
      combat.powers.lighthouse += effect.n;
      fx.push({ t: 'log', code: 'lighthouse', n: effect.n });
    }
  }
}

export function playCard(
  combat: CombatState,
  uid: string,
  rng: Rng,
  opt: { target: number; tideDir?: 1 | -1 },
): { fx: Fx[]; needsTide?: number } {
  const fx: Fx[] = [];
  if (combat.phase !== 'player') return { fx };
  const idx = combat.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) return { fx };
  const card = combat.hand[idx];
  const def = CARDS[card.id];
  if (!def || def.unplayable) return { fx };
  const effects = effectsOf(def, card.up);
  const cost = cardCost(card, combat);
  if (combat.energy < cost) return { fx };
  const choose = effects.find((e) => e.op === 'tideChoose');
  if (choose && choose.op === 'tideChoose' && opt.tideDir == null) return { fx, needsTide: choose.d };
  combat.energy -= cost;
  if (combat.cheapNext) combat.cheapNext = 0;
  combat.hand.splice(idx, 1);
  combat.cardsPlayed += 1;
  const tideNow = combat.tide;
  if (!combat.buoyUsed && combat.relics.includes('copper_buoy') && affinityOn(def.affinity, tideNow)) {
    combat.buoyUsed = true;
    drawCards(combat, 1, rng, fx);
    fx.push({ t: 'log', code: 'buoy' });
  }
  if (combat.relics.includes('pearl_ear') && def.affinity === 'slack' && affinityOn('slack', tideNow)) {
    gainBlock(combat, 3, fx);
  }
  const ctx: Rctx = {
    affinity: def.affinity,
    target: opt.target,
    echo: { dmg: 0, block: 0, salt: 0, tide: 0 },
    twinArmed: !combat.firstAttack,
  };
  const patched = effects.map((e) => (e.op === 'tideChoose' && opt.tideDir ? { op: 'tide' as const, d: opt.tideDir * e.d } : e));
  resolveEffects(combat, patched, ctx, rng, fx);
  if (movesTide(effects) && combat.relics.includes('counterweight')) gainBlock(combat, 3, fx);
  if (ctx.echo.dmg > 0) combat.echo = { kind: 'damage', n: ctx.echo.dmg };
  else if (ctx.echo.block > 0) combat.echo = { kind: 'block', n: ctx.echo.block };
  else if (ctx.echo.salt > 0) combat.echo = { kind: 'salt', n: ctx.echo.salt };
  else if (ctx.echo.tide !== 0) combat.echo = { kind: 'tide', n: ctx.echo.tide };
  else combat.echo = { kind: 'blank', n: 0 };
  fx.push({ t: 'log', code: 'play', id: card.id });
  if (def.exhaust || def.token) combat.exhaustPile.push(card);
  else combat.discard.push(card);
  killCheck(combat, fx);
  return { fx };
}

function isLost(combat: CombatState): boolean {
  const phase: CombatState['phase'] = combat.phase;
  return phase === 'lose';
}
function isWon(combat: CombatState): boolean {
  const phase: CombatState['phase'] = combat.phase;
  return phase === 'win';
}

function applyIntent(combat: CombatState, enemy: EnemyInst, intent: ResolvedIntent, rng: Rng, fx: Fx[]): void {
  if (enemy.hp <= 0 || isLost(combat)) return;
  if (intent.kind === 'attack') {
    const hits = intent.hits ?? 1;
    for (let i = 0; i < hits; i++) {
      const lost = damagePlayer(combat, intent.n, 'attack', `enemy:${enemy.defId}`, fx, intent.pierce ?? 0, enemy);
      if (intent.gold && lost > 0) {
        const pay = Math.min(combat.gold, intent.gold);
        combat.gold -= pay;
        fx.push({ t: 'log', code: 'gold', n: pay });
      }
      if (isLost(combat)) return;
    }
    return;
  }
  if (intent.kind === 'block') {
    enemy.block += intent.n;
    fx.push({ t: 'block', who: enemy.uid, n: intent.n });
    return;
  }
  if (intent.kind === 'tide') {
    setTide(combat, combat.tide + intent.n, fx, rng, 'enemy');
    return;
  }
  if (intent.kind === 'tideSet') {
    setTide(combat, intent.n, fx, rng, 'enemy');
    return;
  }
  if (intent.kind === 'salt') {
    combat.player.salt += intent.n;
    fx.push({ t: 'salt', who: 'p', n: intent.n });
    return;
  }
  if (intent.kind === 'weak') {
    combat.player.weak += intent.n;
    return;
  }
  if (intent.kind === 'strength') {
    enemy.strength += intent.n;
    return;
  }
  if (intent.kind === 'heal') {
    const before = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + intent.n);
    const got = enemy.hp - before;
    if (got > 0) fx.push({ t: 'heal', who: enemy.uid, n: got });
    return;
  }
  if (intent.kind === 'summon' && intent.id) {
    const spawned = spawn(intent.id, rng, chartHpMult(combat.chart), combat.chart);
    spawned.summoned = true;
    combat.enemies.push(spawned);
    fx.push({ t: 'log', code: 'summon', id: intent.id });
    return;
  }
  if (intent.kind === 'snag') {
    const inst = { uid: newUid(rng), id: 'snag', up: false };
    if (combat.hand.length < HAND_MAX) combat.hand.push(inst);
    else combat.discard.push(inst);
    fx.push({ t: 'log', code: 'snag' });
    return;
  }
  if (intent.kind === 'curse' && intent.id) {
    combat.discard.push({ uid: newUid(rng), id: intent.id, up: false });
    fx.push({ t: 'log', code: 'curse', id: intent.id });
  }
}

export function endTurn(combat: CombatState, rng: Rng): Fx[] {
  const fx: Fx[] = [];
  if (combat.phase !== 'player') return fx;
  if (combat.player.salt > 0 && combat.phase === 'player') {
    damagePlayer(combat, combat.player.salt, 'true', 'salt', fx);
    combat.player.salt = Math.max(0, combat.player.salt - 1);
  }
  if (combat.player.weak > 0) combat.player.weak -= 1;
  if (isLost(combat)) return fx;
  for (const card of combat.hand) {
    const def = CARDS[card.id];
    if (!def?.endTurn) continue;
    for (const effect of def.endTurn) {
      if (effect.op === 'loseHp') damagePlayer(combat, effect.n, 'true', 'curse', fx);
      if (effect.op === 'tide') setTide(combat, combat.tide + effect.d, fx, rng, 'curse');
    }
    if (isLost(combat)) return fx;
  }
  const stay: CardInst[] = [];
  for (const card of combat.hand) {
    const def = CARDS[card.id];
    if (def?.retain) stay.push(card);
    else if (def?.ethereal || def?.token) combat.exhaustPile.push(card);
    else combat.discard.push(card);
  }
  combat.hand = stay;
  if (willDrift(combat.turn, combat.relics.includes('rusted_anchor'))) {
    setTide(combat, combat.tide + 1, fx, rng, 'drift');
    fx.push({ t: 'log', code: 'drift' });
  } else {
    fx.push({ t: 'log', code: 'anchor' });
  }
  if (isWon(combat)) return fx;
  if (combat.tide >= 7) {
    damagePlayer(combat, 3, 'true', 'storm', fx);
    for (const e of combat.enemies) if (e.hp > 0) damageEnemy(combat, e, 3, 'true', fx);
    fx.push({ t: 'log', code: 'storm' });
    killCheck(combat, fx);
  } else if (combat.tide <= 1) {
    combat.drawPenalty = 1;
    for (const e of combat.enemies) if (e.hp > 0) damageEnemy(combat, e, 2, 'true', fx);
    fx.push({ t: 'log', code: 'strand' });
    killCheck(combat, fx);
  }
  if (isLost(combat) || isWon(combat)) return fx;
  combat.cardsPlayedLast = combat.cardsPlayed;
  combat.cardsPlayed = 0;
  combat.phase = 'enemy';
  const order = combat.enemies.map((e) => e.uid);
  for (const uid of order) {
    const enemy = combat.enemies.find((e) => e.uid === uid);
    if (!enemy || enemy.hp <= 0) continue;
    // Like the player's, an enemy's block only lasts until its own next action.
    enemy.block = 0;
    const intents = previewIntents(enemy, combat);
    for (const intent of intents) {
      applyIntent(combat, enemy, intent, rng, fx);
      if (isLost(combat)) return fx;
    }
    if (enemy.hp > 0 && enemy.salt > 0) {
      damageEnemy(combat, enemy, enemy.salt, 'true', fx);
      enemy.salt = Math.max(0, enemy.salt - 1);
    }
    if (enemy.weak > 0) enemy.weak -= 1;
    enemy.pi += 1;
    killCheck(combat, fx);
    if (isWon(combat)) return fx;
  }
  if (isLost(combat) || isWon(combat)) return fx;
  beginPlayerTurn(combat, rng, fx);
  return fx;
}

export function drinkPhial(combat: CombatState, index: number, rng: Rng, target: number): Fx[] {
  const fx: Fx[] = [];
  if (combat.phase !== 'player') return fx;
  const id = combat.phials[index];
  if (!id) return fx;
  combat.phials[index] = null;
  if (id === 'springwater') healPlayer(combat, 14, fx);
  if (id === 'ironkelp') gainBlock(combat, 16, fx);
  if (id === 'stormglass') setTide(combat, 7, fx, rng, 'phial');
  if (id === 'ebb_ash') setTide(combat, 1, fx, rng, 'phial');
  if (id === 'saltspike') {
    const enemy = targetOf(combat, target);
    if (enemy) {
      const n = combat.relics.includes('choir_shell') ? 8 : 7;
      enemy.salt += n;
      fx.push({ t: 'salt', who: enemy.uid, n });
    }
  }
  fx.push({ t: 'log', code: 'phial', id });
  killCheck(combat, fx);
  return fx;
}

export function writeCombatBack(run: RunState, combat: CombatState): void {
  run.hp = Math.max(0, combat.player.hp);
  run.maxHp = combat.player.maxHp;
  run.gold = combat.gold;
  run.phials = combat.phials.map((p) => p);
  run.deck = reassemble(combat);
}
