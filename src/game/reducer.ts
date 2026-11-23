import { CARDS, LOCKABLE_CARDS, poolFor } from './cards';
import { CHARACTERS } from './characters';
import { drinkPhial, endTurn, playCard, startCombat, writeCombatBack } from './combat';
import { ENCOUNTERS } from './enemies';
import { EVENT_LIST } from './events';
import { generateMap, reachableIds } from './map';
import { PHIAL_LIST } from './phials';
import { droppableRelics } from './relics';
import { newUid, Rng } from './rng';
import type {
  Action,
  CardInst,
  CharacterId,
  FightKind,
  Fx,
  GameState,
  MetaState,
  PhialId,
  PickerState,
  Rarity,
  RewardState,
  RunState,
  ShopState,
} from './types';

const SAVE_VERSION = 1 as const;

export function defaultMeta(): MetaState {
  return {
    version: SAVE_VERSION,
    marks: 0,
    unlocks: { keel: false, moth: false, hull: 0, purse: false, canteen: false, cards: [] },
    maxChart: 0,
    stats: { runs: 0, wins: 0, bestFloor: 0, bestAct: 0, combats: 0, bosses: 0, marksEarned: 0 },
    seen: { cards: [], enemies: [], relics: [] },
    settings: { lang: 'ru', volume: 0.7, shake: true, reduced: false },
    tutorialDone: false,
  };
}

export function freshState(seed = 0x5a17b0): GameState {
  return {
    meta: defaultMeta(),
    rngS: seed >>> 0,
    screen: 'menu',
    storyId: null,
    run: null,
    combat: null,
    reward: null,
    shop: null,
    eventId: null,
    pending: null,
    picker: null,
    target: 0,
    tutorialStep: null,
    fx: [],
    combatLog: [],
    outcome: null,
    hold: null,
  };
}

function see(meta: MetaState, kind: 'cards' | 'enemies' | 'relics', id: string): void {
  if (!meta.seen[kind].includes(id)) meta.seen[kind].push(id);
}

export function createRun(meta: MetaState, character: CharacterId, chart: number, rng: Rng, seed: number): RunState {
  const ch = CHARACTERS[character];
  const hp = ch.maxHp + meta.unlocks.hull * 6;
  const deck: CardInst[] = ch.deck.map((id) => ({ uid: newUid(rng), id, up: false }));
  const phials: (PhialId | null)[] = [null, null, null];
  if (meta.unlocks.canteen) phials[0] = 'springwater';
  for (const id of deck) see(meta, 'cards', id.id);
  see(meta, 'relics', ch.relic);
  return {
    seed,
    character,
    chart: Math.max(0, Math.min(chart, meta.maxChart)),
    act: 1,
    hp,
    maxHp: hp,
    gold: 58 + (meta.unlocks.purse ? 20 : 0),
    deck,
    relics: [ch.relic],
    phials,
    map: generateMap(rng, 1),
    floors: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    removeCost: 72,
    seenEvents: [],
    nextTide: null,
    fightKind: 'combat',
    lastEnc: '',
    lastSource: '',
  };
}

function pushFx(state: GameState, fx: Fx[]): void {
  state.fx = fx;
  for (const item of fx) {
    if (item.t === 'log' || item.t === 'tide' || item.t === 'dmg' || item.t === 'heal') state.combatLog.push(item);
  }
  if (state.combatLog.length > 16) state.combatLog.splice(0, state.combatLog.length - 16);
}

function rollRarity(rng: Rng, weights: [number, number, number]): Rarity {
  const total = weights[0] + weights[1] + weights[2];
  const roll = rng.next() * total;
  if (roll > weights[0] + weights[1]) return 'rare';
  if (roll > weights[0]) return 'uncommon';
  return 'common';
}

function rollCardId(state: GameState, rng: Rng, weights: [number, number, number]): string {
  const run = state.run!;
  const rarity = rollRarity(rng, weights);
  let pool = poolFor(rarity, run.character, state.meta.unlocks.cards);
  if (!pool.length) pool = poolFor('common', run.character, state.meta.unlocks.cards);
  if (!pool.length) pool = poolFor('uncommon', run.character, state.meta.unlocks.cards);
  return rng.pick(pool).id;
}

function distinct(n: number, next: () => string): string[] {
  const ids: string[] = [];
  let guard = 0;
  while (ids.length < n && guard++ < 40) {
    const id = next();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function grantRelic(state: GameState, id: string): void {
  const run = state.run!;
  if (!id || run.relics.includes(id)) return;
  run.relics.push(id);
  see(state.meta, 'relics', id);
  if (id === 'kelp_heart') {
    run.maxHp += 8;
    run.hp += 8;
  }
}

function addCard(run: RunState, id: string, rng: Rng): void {
  run.deck.push({ uid: newUid(rng), id, up: false });
}

function priceOf(run: RunState, base: number): number {
  const mult = run.relics.includes('merchant_teeth') ? 0.75 : 1;
  return Math.max(1, Math.round(base * mult));
}

function makeShop(state: GameState, rng: Rng): ShopState {
  const run = state.run!;
  const act = run.act;
  const cards = distinct(5, () => rollCardId(state, rng, [50, 38, 12])).map((id) => {
    const rarity = CARDS[id].rarity;
    const base = (rarity === 'rare' ? 122 : rarity === 'uncommon' ? 76 : 50) + (act - 1) * 12;
    see(state.meta, 'cards', id);
    return { id, price: priceOf(run, base), sold: false };
  });
  const relicPool = droppableRelics(run.relics);
  const relics = (relicPool.length ? distinct(Math.min(2, relicPool.length), () => rng.pick(relicPool).id) : []).map(
    (id) => {
      see(state.meta, 'relics', id);
      return { id, price: priceOf(run, 168 + (act - 1) * 16), sold: false };
    },
  );
  const phials = rng.shuffle(PHIAL_LIST).slice(0, 2).map((p) => ({
    id: p.id,
    price: priceOf(run, 48 + (act - 1) * 6),
    sold: false,
  }));
  return { cards, relics, phials };
}

function makeReward(state: GameState, rng: Rng, kind: FightKind): RewardState {
  const run = state.run!;
  const gold = (kind === 'boss' ? 74 : kind === 'elite' ? 48 : 20) + (run.act - 1) * 8 + rng.int(0, 6);
  run.gold += gold;
  let heal = 0;
  if (kind === 'boss') {
    heal = Math.round(run.maxHp * 0.3);
    run.hp = Math.min(run.maxHp, run.hp + heal);
  }
  const weights: [number, number, number] =
    kind === 'boss' ? [0, 40, 60] : kind === 'elite' ? [18, 55, 27] : [60, 34, 6];
  const cards = distinct(3, () => rollCardId(state, rng, weights));
  for (const id of cards) see(state.meta, 'cards', id);
  let eliteRelic: string | null = null;
  let bossRelics: string[] | null = null;
  const pool = () => droppableRelics(run.relics);
  if (kind === 'elite' && pool().length) {
    eliteRelic = rng.pick(pool()).id;
    grantRelic(state, eliteRelic);
  }
  if (kind === 'boss' && pool().length) {
    bossRelics = distinct(Math.min(3, pool().length), () => rng.pick(pool()).id);
    for (const id of bossRelics) see(state.meta, 'relics', id);
  }
  return {
    kind,
    gold,
    heal,
    cards,
    eliteRelic,
    bossRelics,
    cardTaken: false,
    relicTaken: !bossRelics,
  };
}

function beginFight(state: GameState, rng: Rng, ids: string[], kind: FightKind, row: number, tutorial = false): void {
  const run = state.run!;
  const ch = CHARACTERS[run.character];
  run.fightKind = kind;
  state.combat = startCombat(run, ids, rng, {
    fightKind: kind,
    row,
    startTide: ch.startTide,
    tutorial,
  });
  state.screen = 'combat';
  state.target = 0;
  state.pending = null;
  state.combatLog = [];
  state.fx = [];
  for (const id of ids) see(state.meta, 'enemies', id);
  if (state.combat) {
    for (const c of [...state.combat.hand, ...state.combat.draw]) see(state.meta, 'cards', c.id);
  }
}

function rollEncounter(run: RunState, rng: Rng, kind: 'combat' | 'elite' | 'boss', row = 9): string[] {
  if (kind === 'combat' && run.act === 1 && row <= 1) {
    const easy = [['gullthief'], ['gullthief'], ['kelppup', 'kelppup']];
    const pick = rng.pick(easy);
    run.lastEnc = pick.join('+');
    return pick.slice();
  }
  const table = ENCOUNTERS[run.act][kind];
  const options = table.filter((e) => e.join('+') !== run.lastEnc);
  const pick = rng.pick(options.length ? options : table);
  run.lastEnc = pick.join('+');
  return pick.slice();
}

function deathCopy(source: string, bossHint: string): { ru: string; en: string } {
  if (source === 'storm' || bossHint === 'storm') {
    return {
      ru: 'Шторм бьёт всех и не смотрит на защиту. Кончайте ход на 5 или ниже — сама вода прибавит единицу.',
      en: 'Storm hits everyone and ignores block. End the turn at 5 or lower — the water adds one on its own.',
    };
  }
  if (source.includes('kelp_warden')) {
    return {
      ru: 'Страж бьёт сильнее на отливе. Перед его тяжёлым тактом толкните воду вверх.',
      en: 'The warden hits harder on the ebb. Push the water up before his heavy beat.',
    };
  }
  if (source.includes('madam')) {
    return {
      ru: 'Мадам повторяет последний узел. Перед звоном сыграйте слабую карту — и она повторит слабость.',
      en: 'Madam repeats your last knot. Play a small card before the chime.',
    };
  }
  if (source.includes('moon')) {
    return {
      ru: 'Не входите в шторм трижды. На четвёртом такте держите прилив ниже 6.',
      en: 'Do not enter storm three times. On the fourth beat keep the tide under 6.',
    };
  }
  if (source === 'salt') {
    return {
      ru: 'Соль обходит защиту и тает сама. Её не блокируют — её пережимают темпом.',
      en: 'Salt ignores block and fades on its own. You outpace it; you do not block it.',
    };
  }
  if (source === 'curse') {
    return {
      ru: 'Проклятие в руке кусает в конце хода. Вырежьте его в лавке или на событии.',
      en: 'A curse in hand bites at end of turn. Cut it at a shop or an event.',
    };
  }
  return {
    ru: 'Один ход защиты дешевле нового рейса. Смотрите число на намерении до того, как откроете карты.',
    en: 'One turn of block is cheaper than a new run. Read the intent number before you open with attacks.',
  };
}

function finishRun(state: GameState, victory: boolean, source: string): void {
  const run = state.run;
  if (!run) return;
  const before = state.meta.maxChart;
  const marks = run.floors * 2 + run.elitesKilled * 7 + run.bossesKilled * 14 + (victory ? 46 : 0) + run.chart * 6;
  state.meta.marks += marks;
  state.meta.stats.marksEarned += marks;
  state.meta.stats.runs += 1;
  if (victory) {
    state.meta.stats.wins += 1;
    state.meta.maxChart = Math.max(state.meta.maxChart, 2);
  }
  if (run.floors >= state.meta.stats.bestFloor) {
    state.meta.stats.bestFloor = run.floors;
    state.meta.stats.bestAct = run.act;
  }
  const tip = victory
    ? {
        ru: 'Луна закрыла книгу. На этот рейс долг списан — море откроет следующий.',
        en: 'The moon closed the book. This voyage’s debt is paid — the sea will open the next one.',
      }
    : deathCopy(source, source);
  const unlocked: string[] = [];
  if (state.meta.maxChart > before) unlocked.push(state.meta.maxChart >= 2 ? 'chart2' : 'chart1');
  state.outcome = {
    victory,
    marks,
    act: run.act,
    floors: run.floors,
    character: run.character,
    tipRu: tip.ru,
    tipEn: tip.en,
    newUnlocks: unlocked,
  };
  state.run = null;
  state.combat = null;
  state.reward = null;
  state.shop = null;
  state.eventId = null;
  state.pending = null;
  state.picker = null;
  state.screen = victory ? 'victory' : 'defeat';
}

function realCount(run: RunState): number {
  return run.deck.filter((c) => {
    const d = CARDS[c.id];
    return d && d.rarity !== 'curse' && d.rarity !== 'status';
  }).length;
}

export function canRemove(run: RunState, uid: string): boolean {
  const card = run.deck.find((c) => c.uid === uid);
  if (!card) return false;
  const def = CARDS[card.id];
  if (!def) return false;
  if (def.rarity === 'curse') return true;
  return realCount(run) > 5;
}

/** Cards a picker of this mode would accept (the UI shows exactly these). */
export function pickerCards(run: RunState, mode: PickerState['mode']): CardInst[] {
  return run.deck.filter((card) => {
    const def = CARDS[card.id];
    if (!def) return false;
    if (mode === 'remove') return canRemove(run, card.uid);
    if (mode === 'upgrade') return !!def.up && !card.up && def.rarity !== 'curse' && def.rarity !== 'status';
    if (mode === 'duplicate') return def.rarity !== 'curse' && def.rarity !== 'status';
    return def.rarity !== 'status';
  });
}

/** Why an event option cannot be taken right now (null = it can). */
export function eventChoiceBlock(state: GameState, index: number): { ru: string; en: string } | null {
  const run = state.run;
  const id = state.eventId;
  if (!run || !id) return null;
  const hull = (n: number) => (run.hp <= n ? { ru: `Нужно больше ${n} корпуса.`, en: `Needs more than ${n} hull.` } : null);
  const none = (mode: PickerState['mode']) =>
    pickerCards(run, mode).length ? null : { ru: 'Нет подходящих карт.', en: 'No card qualifies.' };
  if (id === 'wreck' && index === 0) return hull(10);
  if (id === 'shrine' && index === 0) return hull(14);
  if (id === 'smuggler' && index === 0) return run.gold < 35 ? { ru: 'Нужно 35 монет.', en: 'Needs 35 coins.' } : none('duplicate');
  if (id === 'smuggler' && index === 2) return hull(8);
  if ((id === 'choir' && index === 0) || (id === 'eel' && index === 1)) return none('remove');
  if ((id === 'choir' && index === 1) || (id === 'moonwell' && index === 0)) return none('upgrade');
  if (id === 'moonwell' && index === 1) return none('transform');
  return null;
}

function applyPicker(state: GameState, uid: string, rng: Rng): void {
  const run = state.run;
  const picker = state.picker;
  if (!run || !picker) return;
  const card = run.deck.find((c) => c.uid === uid);
  if (!card) return;
  const def = CARDS[card.id];
  if (!def) return;
  if (picker.pay && run.gold < picker.pay) return;
  if (picker.mode === 'remove') {
    if (!canRemove(run, uid)) return;
    if (picker.pay) run.gold -= picker.pay;
    run.deck = run.deck.filter((c) => c.uid !== uid);
  } else if (picker.mode === 'upgrade') {
    if (def.rarity === 'curse' || def.rarity === 'status' || card.up || !def.up) return;
    card.up = true;
  } else if (picker.mode === 'duplicate') {
    if (def.rarity === 'curse' || def.rarity === 'status') return;
    if (picker.pay) run.gold -= picker.pay;
    run.deck.push({ uid: newUid(rng), id: card.id, up: card.up });
  } else if (picker.mode === 'transform') {
    const pool = poolFor('rare', run.character, state.meta.unlocks.cards).filter((c) => c.id !== card.id);
    if (!pool.length) return;
    card.id = rng.pick(pool).id;
    card.up = false;
    see(state.meta, 'cards', card.id);
  }
  picker.left -= 1;
  picker.pay = undefined;
  picker.committed = true;
  if (picker.left > 0 && pickerCards(run, picker.mode).length > 0) return;
  if (picker.grantGold) run.gold += picker.grantGold;
  state.picker = null;
  if (picker.context === 'event') {
    state.eventId = null;
    state.screen = 'map';
  }
}

function eventChoose(state: GameState, index: number, rng: Rng): void {
  const run = state.run;
  const id = state.eventId;
  if (!run || !id || state.picker) return;
  if (eventChoiceBlock(state, index)) return;
  const done = () => {
    state.eventId = null;
    state.screen = 'map';
  };
  if (id === 'bottle') {
    if (index === 0) {
      const pool = poolFor('rare', run.character, state.meta.unlocks.cards);
      if (pool.length) addCard(run, rng.pick(pool).id, rng);
    } else if (index === 1) run.gold += 35;
    else run.hp = Math.min(run.maxHp, run.hp + 12);
    done();
    return;
  }
  if (id === 'wreck') {
    if (index === 0) {
      if (run.hp <= 10) return;
      run.hp -= 10;
      const pool = droppableRelics(run.relics);
      if (pool.length) grantRelic(state, rng.pick(pool).id);
    } else if (index === 1) run.gold += 28;
    done();
    return;
  }
  if (id === 'choir') {
    if (index === 0) {
      state.picker = { mode: 'remove', context: 'event', left: 1 };
      return;
    }
    if (index === 1) {
      state.picker = { mode: 'upgrade', context: 'event', left: 1 };
      return;
    }
    addCard(run, 'hole', rng);
    run.maxHp += 16;
    run.hp += 16;
    done();
    return;
  }
  if (id === 'smuggler') {
    if (index === 0) {
      if (run.gold < 35) return;
      state.picker = { mode: 'duplicate', context: 'event', left: 1, pay: 35 };
      return;
    }
    if (index === 1) {
      const slot = run.phials.findIndex((p) => p === null);
      if (slot >= 0) run.phials[slot] = rng.pick(PHIAL_LIST).id;
      else run.gold += 15;
    } else {
      if (run.hp <= 8) return;
      run.hp -= 8;
      const pool = poolFor('uncommon', run.character, state.meta.unlocks.cards);
      if (pool.length) addCard(run, rng.pick(pool).id, rng);
    }
    done();
    return;
  }
  if (id === 'pool') {
    if (index === 0) run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.25));
    if (index === 1) run.nextTide = 1;
    if (index === 2) run.nextTide = 6;
    done();
    return;
  }
  if (id === 'shrine') {
    if (index === 0) {
      if (run.hp <= 14) return;
      run.hp -= 14;
      const pool = droppableRelics(run.relics);
      if (pool.length) grantRelic(state, rng.pick(pool).id);
    } else {
      const curse = run.deck.find((c) => CARDS[c.id]?.rarity === 'curse');
      if (curse) run.deck = run.deck.filter((c) => c.uid !== curse.uid);
      else run.gold += 20;
    }
    done();
    return;
  }
  if (id === 'argument') {
    if (index === 0) {
      state.eventId = null;
      beginFight(state, rng, rollEncounter(run, rng, 'elite'), 'elite', 6);
      return;
    }
    if (run.gold >= 20) run.gold -= 20;
    else if (run.deck.length > 5) {
      const sacrifice = rng.pick(run.deck.filter((c) => CARDS[c.id]?.rarity !== 'curse'));
      if (sacrifice) run.deck = run.deck.filter((c) => c.uid !== sacrifice.uid);
    }
    done();
    return;
  }
  if (id === 'cartographer') {
    if (index === 0) {
      if (!run.relics.includes('dry_map')) grantRelic(state, 'dry_map');
      else run.gold += 40;
    } else run.hp = Math.min(run.maxHp, run.hp + 10);
    done();
    return;
  }
  if (id === 'eel') {
    if (index === 0) {
      run.gold += 55;
      addCard(run, 'barnacle', rng);
      done();
      return;
    }
    state.picker = { mode: 'remove', context: 'event', left: 1, grantGold: 25 };
    return;
  }
  if (id === 'moonwell') {
    if (index === 0) state.picker = { mode: 'upgrade', context: 'event', left: 2 };
    else state.picker = { mode: 'transform', context: 'event', left: 1 };
  }
}

function tutorialPlayOk(step: number | null, cardId: string): boolean {
  if (step === null || step >= 4) return true;
  if (step === 0) return cardId === 'reed_strike';
  if (step === 1) return cardId === 'kelp_guard';
  if (step === 2) return cardId === 'buoy_toss' || cardId === 'lantern_tap';
  return false;
}

function advanceTutorial(state: GameState, played: boolean): void {
  const step = state.tutorialStep;
  if (step === null) return;
  if (played && step === 0) state.tutorialStep = 1;
  else if (played && step === 1) state.tutorialStep = 2;
  else if (played && step === 2) state.tutorialStep = 3;
  else if (!played && step === 3) state.tutorialStep = 4;
}

export function reduce(state: GameState, action: Action): GameState {
  const next = structuredClone(state) as GameState;
  const rng = new Rng(next.rngS >>> 0);
  const targetUid = state.combat?.enemies[state.target]?.uid;
  apply(next, action, rng);
  next.rngS = rng.s;
  // Enemies are removed from the array when they die: keep the same enemy targeted, or fall back to the first.
  if (next.combat) {
    const keep = targetUid ? next.combat.enemies.findIndex((e) => e.uid === targetUid) : -1;
    if (action.type !== 'setTarget') next.target = keep >= 0 ? keep : next.target < next.combat.enemies.length ? next.target : 0;
  }
  return next;
}

function apply(state: GameState, action: Action, rng: Rng): void {
  state.fx = [];
  switch (action.type) {
    case 'setLang':
      state.meta.settings.lang = action.lang;
      return;
    case 'setVolume':
      state.meta.settings.volume = Math.max(0, Math.min(1, action.volume));
      return;
    case 'setShake':
      state.meta.settings.shake = action.shake;
      return;
    case 'setReduced':
      state.meta.settings.reduced = action.reduced;
      return;
    case 'goto':
      if (['menu', 'drydock', 'codex', 'help', 'settings', 'select'].includes(action.screen)) state.screen = action.screen;
      return;
    case 'park':
      if (state.screen !== 'menu') state.hold = state.screen;
      state.screen = 'menu';
      return;
    case 'resume':
      if (state.hold && state.hold !== 'menu' && state.hold !== 'select') {
        state.screen = state.hold;
        state.hold = null;
        return;
      }
      if (state.combat) state.screen = 'combat';
      else if (state.reward) state.screen = 'reward';
      else if (state.eventId) state.screen = 'event';
      else if (state.shop) state.screen = 'shop';
      else if (state.storyId && state.run) state.screen = 'story';
      else if (state.run) state.screen = 'map';
      else state.screen = 'menu';
      return;
    case 'wipe':
      state.meta = defaultMeta();
      state.run = null;
      state.combat = null;
      state.reward = null;
      state.shop = null;
      state.eventId = null;
      state.outcome = null;
      state.screen = 'menu';
      state.tutorialStep = null;
      return;
    case 'beginSelect':
      state.screen = 'select';
      return;
    case 'startTutorial': {
      const seed = rng.int(1, 2_000_000_000);
      const seeded = new Rng(seed);
      const run = createRun(state.meta, 'brine', 0, seeded, seed);
      state.run = run;
      state.tutorialStep = 0;
      state.outcome = null;
      beginFight(state, seeded, ['tutor_gull'], 'combat', 0, true);
      rng.s = seeded.s;
      return;
    }
    case 'skipTutorial':
      state.meta.tutorialDone = true;
      state.tutorialStep = null;
      state.run = null;
      state.combat = null;
      state.screen = 'select';
      return;
    case 'startRun': {
      if (state.screen !== 'select' && state.storyId !== 'afterTutorial') return;
      if (action.character === 'keel' && !state.meta.unlocks.keel) return;
      if (action.character === 'moth' && !state.meta.unlocks.moth) return;
      if (action.chart > state.meta.maxChart) return;
      const seed = action.seed ?? rng.int(1, 2_000_000_000);
      const seeded = new Rng(seed);
      state.run = createRun(state.meta, action.character, action.chart, seeded, seed);
      state.combat = null;
      state.reward = null;
      state.shop = null;
      state.eventId = null;
      state.outcome = null;
      state.tutorialStep = null;
      state.screen = 'story';
      state.storyId = 'act1';
      rng.s = seeded.s;
      return;
    }
    case 'ackStory': {
      if (state.storyId === 'afterTutorial') {
        apply(state, { type: 'startRun', character: 'brine', chart: 0 }, rng);
        return;
      }
      if (state.run && state.storyId?.startsWith('act')) state.screen = 'map';
      return;
    }
    case 'chooseNode': {
      const run = state.run;
      if (!run || state.screen !== 'map') return;
      if (!reachableIds(run.map).includes(action.id)) return;
      const node = run.map.nodes.find((n) => n.id === action.id);
      if (!node) return;
      run.map.current = node.id;
      run.map.path.push(node.id);
      run.floors += 1;
      if (node.kind === 'combat' || node.kind === 'elite' || node.kind === 'boss') {
        const kind = node.kind === 'boss' ? 'boss' : node.kind === 'elite' ? 'elite' : 'combat';
        const ids = rollEncounter(run, rng, kind, node.row);
        node.encounter = ids;
        beginFight(state, rng, ids, kind, node.row);
      } else if (node.kind === 'event') {
        const pool = EVENT_LIST.filter((e) => !run.seenEvents.includes(e.id));
        const ev = rng.pick(pool.length ? pool : EVENT_LIST);
        run.seenEvents.push(ev.id);
        state.eventId = ev.id;
        state.screen = 'event';
      } else if (node.kind === 'shop') {
        state.shop = makeShop(state, rng);
        state.screen = 'shop';
      } else if (node.kind === 'rest') state.screen = 'rest';
      return;
    }
    case 'playCard': {
      if (!state.combat || state.combat.phase !== 'player') return;
      const card = state.combat.hand.find((c) => c.uid === action.uid);
      if (!card || !tutorialPlayOk(state.tutorialStep, card.id)) return;
      const result = playCard(state.combat, action.uid, rng, { target: state.target });
      if (result.needsTide) {
        state.pending = { type: 'tide', uid: action.uid, mag: result.needsTide };
        return;
      }
      pushFx(state, result.fx);
      advanceTutorial(state, true);
      return;
    }
    case 'tideChoice': {
      if (!state.combat || !state.pending) return;
      const uid = state.pending.uid;
      const result = playCard(state.combat, uid, rng, { target: state.target, tideDir: action.dir });
      state.pending = null;
      pushFx(state, result.fx);
      if (!state.combat.hand.some((c) => c.uid === uid)) advanceTutorial(state, true);
      return;
    }
    case 'cancelPending':
      state.pending = null;
      return;
    case 'setTarget':
      state.target = action.index;
      return;
    case 'endTurn': {
      if (!state.combat || state.combat.phase !== 'player' || state.pending) return;
      if (state.tutorialStep !== null && state.tutorialStep < 3) return;
      if (state.tutorialStep !== null && state.tutorialStep > 3 && state.tutorialStep < 4) return;
      const fx = endTurn(state.combat, rng);
      pushFx(state, fx);
      advanceTutorial(state, false);
      return;
    }
    case 'drink': {
      if (!state.combat || state.tutorialStep !== null && state.tutorialStep < 4) return;
      if (!state.combat) return;
      pushFx(state, drinkPhial(state.combat, action.index, rng, state.target));
      return;
    }
    case 'ackWin': {
      if (!state.combat || state.combat.phase !== 'win') return;
      if (state.tutorialStep !== null) {
        state.meta.tutorialDone = true;
        state.tutorialStep = null;
        state.combat = null;
        state.run = null;
        state.screen = 'story';
        state.storyId = 'afterTutorial';
        return;
      }
      const run = state.run;
      if (!run) return;
      writeCombatBack(run, state.combat);
      const kind = run.fightKind;
      if (kind === 'elite') run.elitesKilled += 1;
      if (kind === 'boss') {
        run.bossesKilled += 1;
        state.meta.stats.bosses += 1;
        if (run.act === 1) state.meta.maxChart = Math.max(state.meta.maxChart, 1);
      }
      state.meta.stats.combats += 1;
      state.reward = makeReward(state, rng, kind);
      state.combat = null;
      state.screen = 'reward';
      return;
    }
    case 'ackLose': {
      if (!state.combat || state.combat.phase !== 'lose' || !state.run) return;
      const source = state.combat.lastSource || 'attack';
      state.run.lastSource = source;
      finishRun(state, false, source);
      return;
    }
    case 'pickCard': {
      if (!state.reward || !state.run || state.reward.cardTaken) return;
      if (action.id) addCard(state.run, action.id, rng);
      state.reward.cardTaken = true;
      return;
    }
    case 'pickRelic': {
      if (!state.reward || !state.run || state.reward.relicTaken) return;
      if (!state.reward.bossRelics?.includes(action.id)) return;
      grantRelic(state, action.id);
      state.reward.relicTaken = true;
      return;
    }
    case 'leaveReward': {
      if (!state.reward || !state.run) return;
      if (!state.reward.cardTaken || !state.reward.relicTaken) return;
      const kind = state.reward.kind;
      state.reward = null;
      if (kind === 'boss') {
        if (state.run.act < 3) {
          state.run.act = (state.run.act + 1) as 1 | 2 | 3;
          state.run.map = generateMap(rng, state.run.act);
          state.screen = 'story';
          state.storyId = `act${state.run.act}`;
        } else finishRun(state, true, 'victory');
      } else state.screen = 'map';
      return;
    }
    case 'restHeal': {
      const run = state.run;
      if (!run || state.screen !== 'rest') return;
      let n = Math.max(12, Math.round(run.maxHp * 0.3));
      if (run.relics.includes('dry_map')) n += 10;
      run.hp = Math.min(run.maxHp, run.hp + n);
      state.screen = 'map';
      return;
    }
    case 'restUpgrade': {
      const run = state.run;
      if (!run || state.screen !== 'rest') return;
      const card = run.deck.find((c) => c.uid === action.uid);
      const def = card && CARDS[card.id];
      if (!card || !def || card.up || !def.up || def.rarity === 'curse') return;
      card.up = true;
      state.screen = 'map';
      return;
    }
    case 'restAttune': {
      const run = state.run;
      if (!run || state.screen !== 'rest') return;
      if (![1, 4, 6].includes(action.tide)) return;
      run.nextTide = action.tide;
      state.screen = 'map';
      return;
    }
    case 'shopBuyCard': {
      const shop = state.shop;
      const run = state.run;
      if (!shop || !run) return;
      const offer = shop.cards[action.index];
      if (!offer || offer.sold || run.gold < offer.price) return;
      run.gold -= offer.price;
      offer.sold = true;
      addCard(run, offer.id, rng);
      see(state.meta, 'cards', offer.id);
      return;
    }
    case 'shopBuyRelic': {
      const shop = state.shop;
      const run = state.run;
      if (!shop || !run) return;
      const offer = shop.relics[action.index];
      if (!offer || offer.sold || run.gold < offer.price || run.relics.includes(offer.id)) return;
      run.gold -= offer.price;
      offer.sold = true;
      grantRelic(state, offer.id);
      return;
    }
    case 'shopBuyPhial': {
      const shop = state.shop;
      const run = state.run;
      if (!shop || !run) return;
      const offer = shop.phials[action.index];
      if (!offer || offer.sold || run.gold < offer.price) return;
      const slot = run.phials.findIndex((p) => p === null);
      if (slot < 0) return;
      run.gold -= offer.price;
      offer.sold = true;
      run.phials[slot] = offer.id;
      return;
    }
    case 'shopRemove': {
      const run = state.run;
      if (!run || !state.shop || run.gold < run.removeCost || !canRemove(run, action.uid)) return;
      run.gold -= run.removeCost;
      run.removeCost += 25;
      run.deck = run.deck.filter((c) => c.uid !== action.uid);
      return;
    }
    case 'shopLeave':
      state.shop = null;
      state.screen = 'map';
      return;
    case 'eventChoose':
      eventChoose(state, action.index, rng);
      return;
    case 'pickerPick':
      applyPicker(state, action.uid, rng);
      return;
    case 'pickerCancel': {
      const picker = state.picker;
      state.picker = null;
      // Once a pick has been applied the event is spent: leave instead of re-offering it.
      if (picker?.context === 'event' && picker.committed) {
        state.eventId = null;
        state.screen = 'map';
      }
      return;
    }
    case 'buyUnlock': {
      const meta = state.meta;
      const spend = (cost: number, applyUnlock: () => void, owned: boolean) => {
        if (owned || meta.marks < cost) return;
        meta.marks -= cost;
        applyUnlock();
      };
      if (action.id === 'keel') spend(30, () => (meta.unlocks.keel = true), meta.unlocks.keel);
      else if (action.id === 'moth') spend(55, () => (meta.unlocks.moth = true), meta.unlocks.moth);
      else if (action.id === 'hull') spend(40, () => (meta.unlocks.hull += 1), meta.unlocks.hull >= 2);
      else if (action.id === 'purse') spend(25, () => (meta.unlocks.purse = true), meta.unlocks.purse);
      else if (action.id === 'canteen') spend(30, () => (meta.unlocks.canteen = true), meta.unlocks.canteen);
      else if (action.id.startsWith('card:')) {
        const id = action.id.slice(5);
        if (!LOCKABLE_CARDS.includes(id)) return;
        spend(20, () => meta.unlocks.cards.push(id), meta.unlocks.cards.includes(id));
      }
      return;
    }
    case 'abandon': {
      if (state.tutorialStep !== null) {
        state.tutorialStep = null;
        state.run = null;
        state.combat = null;
        state.screen = 'menu';
        return;
      }
      if (!state.run) {
        state.screen = 'menu';
        return;
      }
      const source = state.combat?.lastSource || state.run.lastSource || 'abandon';
      finishRun(state, false, source === 'abandon' ? 'attack' : source);
      return;
    }
    default:
      return;
  }
}

export function sanitize(state: GameState): GameState {
  const next = structuredClone(state) as GameState;
  if (!next.meta || next.meta.version !== 1) return freshState();
  next.fx = [];
  const needsRun = ['map', 'event', 'shop', 'rest', 'reward', 'story', 'combat'].includes(next.screen);
  if (needsRun && !next.run && next.screen !== 'combat') next.screen = 'menu';
  if (next.screen === 'combat' && !next.combat) next.screen = next.run ? 'map' : 'menu';
  if (!next.combatLog) next.combatLog = [];
  if (next.hold === undefined) next.hold = null;
  return next;
}
