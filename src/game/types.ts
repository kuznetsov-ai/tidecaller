export type Lang = 'ru' | 'en';
export type L = { ru: string; en: string };
export type Affinity = 'ebb' | 'flood' | 'slack' | 'wild';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'curse' | 'status';
export type CardClass = 'any' | 'brine' | 'keel' | 'moth' | 'curse';
export type CharacterId = 'brine' | 'keel' | 'moth';
export type FightKind = 'combat' | 'elite' | 'boss';
export type NodeKind = 'combat' | 'elite' | 'event' | 'shop' | 'rest' | 'boss';
export type ScreenId =
  | 'menu'
  | 'select'
  | 'combat'
  | 'map'
  | 'event'
  | 'shop'
  | 'rest'
  | 'reward'
  | 'story'
  | 'drydock'
  | 'codex'
  | 'help'
  | 'settings'
  | 'defeat'
  | 'victory';

export type Effect =
  | { op: 'damage'; n: number; affN?: number; all?: boolean; timesTide?: number }
  | { op: 'block'; n: number; affN?: number }
  | { op: 'tide'; d: number }
  | { op: 'tideSet'; v: number }
  | { op: 'tideChoose'; d: number }
  | { op: 'draw'; n: number; affN?: number }
  | { op: 'salt'; n: number; affN?: number }
  | { op: 'heal'; n: number; affN?: number }
  | { op: 'strength'; n: number }
  | { op: 'weak'; n: number }
  | { op: 'loseHp'; n: number }
  | { op: 'loseBlock' }
  | { op: 'retainBlock'; n: number }
  | { op: 'cheapNext'; n: number }
  | { op: 'power'; id: 'lighthouse'; n: number }
  | {
      op: 'conditional';
      when: 'tideMoved' | 'deepEbb' | 'storm' | 'lowHp' | 'enemyMovesTide';
      effects: Effect[];
      else?: Effect[];
    };

export interface CardDef {
  id: string;
  name: L;
  affinity: Affinity;
  cost: number;
  rarity: Rarity;
  class: CardClass;
  effects: Effect[];
  up?: Effect[];
  endTurn?: Effect[];
  exhaust?: boolean;
  ethereal?: boolean;
  unplayable?: boolean;
  retain?: boolean;
  token?: boolean;
  locked?: boolean;
  rate?: number;
  flavor?: L;
}

export interface CardInst {
  uid: string;
  id: string;
  up: boolean;
}

export interface RelicDef {
  id: string;
  name: L;
  text: L;
  starter?: boolean;
}

export interface CharacterDef {
  id: CharacterId;
  name: L;
  title: L;
  blurb: L;
  maxHp: number;
  startTide: number;
  relic: string;
  deck: string[];
}

export type PhialId = 'springwater' | 'stormglass' | 'ebb_ash' | 'saltspike' | 'ironkelp';

export interface PhialDef {
  id: PhialId;
  name: L;
  text: L;
}

export type RawKind =
  | 'attack'
  | 'block'
  | 'tide'
  | 'tideSet'
  | 'salt'
  | 'weak'
  | 'strength'
  | 'summon'
  | 'heal'
  | 'curse'
  | 'snag';

export interface RawIntent {
  kind: RawKind;
  n?: number;
  id?: string;
  hidden?: boolean;
  pierce?: number;
  hits?: number;
  gold?: number;
}

export interface ResolvedIntent {
  kind: RawKind;
  n: number;
  id?: string;
  hidden?: boolean;
  pierce?: number;
  hits?: number;
  gold?: number;
}

export interface EnemyInst {
  uid: string;
  defId: string;
  hp: number;
  maxHp: number;
  block: number;
  salt: number;
  weak: number;
  strength: number;
  pi: number;
  doom: number;
  summoned: boolean;
}

export interface EnemyDef {
  id: string;
  name: L;
  hp: [number, number];
  art: string;
  tip: L;
  elite?: boolean;
  boss?: boolean;
  token?: boolean;
  hidden?: boolean;
  pattern?: RawIntent[][];
  script?: (enemy: EnemyInst, combat: CombatState) => RawIntent[];
}

export interface Echo {
  kind: 'damage' | 'block' | 'tide' | 'salt' | 'blank';
  n: number;
}

export interface Actor {
  hp: number;
  maxHp: number;
  block: number;
  salt: number;
  weak: number;
  strength: number;
}

export interface CombatState {
  enemies: EnemyInst[];
  hand: CardInst[];
  draw: CardInst[];
  discard: CardInst[];
  exhaustPile: CardInst[];
  tide: number;
  energy: number;
  maxEnergy: number;
  turn: number;
  player: Actor;
  relics: string[];
  powers: { lighthouse: number };
  retainCap: number;
  cheapNext: number;
  drawPenalty: number;
  cardsPlayed: number;
  cardsPlayedLast: number;
  tideMoved: boolean;
  phase: 'player' | 'enemy' | 'win' | 'lose';
  buoyUsed: boolean;
  nailUsed: boolean;
  wickUsed: boolean;
  moonUsed: boolean;
  compassUsed: boolean;
  firstAttack: boolean;
  echo: Echo | null;
  chart: number;
  tutorial: boolean;
  lastSource: string;
  phials: (PhialId | null)[];
  gold: number;
  fightKind: FightKind;
}

export interface MapNode {
  id: string;
  row: number;
  col: number;
  kind: NodeKind;
  next: string[];
  encounter?: string[];
}

export interface GameMap {
  act: 1 | 2 | 3;
  nodes: MapNode[];
  current: string | null;
  path: string[];
}

export interface RunState {
  seed: number;
  character: CharacterId;
  chart: number;
  act: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInst[];
  relics: string[];
  phials: (PhialId | null)[];
  map: GameMap;
  floors: number;
  elitesKilled: number;
  bossesKilled: number;
  removeCost: number;
  seenEvents: string[];
  nextTide: number | null;
  fightKind: FightKind;
  lastEnc: string;
  lastSource: string;
}

export interface RewardState {
  kind: FightKind;
  gold: number;
  heal: number;
  cards: string[];
  eliteRelic: string | null;
  bossRelics: string[] | null;
  cardTaken: boolean;
  relicTaken: boolean;
}

export interface ShopOffer<T extends string = string> {
  id: T;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopOffer[];
  relics: ShopOffer[];
  phials: ShopOffer<PhialId>[];
}

export interface PickerState {
  mode: 'remove' | 'upgrade' | 'duplicate' | 'transform';
  context: 'shop' | 'rest' | 'event';
  left: number;
  grantGold?: number;
  pay?: number;
  /** at least one pick already applied: cancelling now ends the event instead of reopening it */
  committed?: boolean;
}

export interface MetaState {
  version: 1;
  marks: number;
  unlocks: {
    keel: boolean;
    moth: boolean;
    hull: number;
    purse: boolean;
    canteen: boolean;
    cards: string[];
  };
  maxChart: number;
  stats: {
    runs: number;
    wins: number;
    bestFloor: number;
    bestAct: number;
    combats: number;
    bosses: number;
    marksEarned: number;
  };
  seen: { cards: string[]; enemies: string[]; relics: string[] };
  settings: { lang: Lang; volume: number; shake: boolean; reduced: boolean };
  tutorialDone: boolean;
}

export interface Outcome {
  victory: boolean;
  marks: number;
  act: number;
  floors: number;
  character: CharacterId;
  tipRu: string;
  tipEn: string;
  newUnlocks: string[];
}

export type Fx =
  | { t: 'dmg'; who: 'p' | string; n: number }
  | { t: 'block'; who: 'p' | string; n: number }
  | { t: 'heal'; who: 'p' | string; n: number }
  | { t: 'salt'; who: 'p' | string; n: number }
  | { t: 'tide'; from: number; to: number }
  | { t: 'log'; code: string; n?: number; id?: string }
  | { t: 'shake' }
  | { t: 'die'; id: string };

export interface GameState {
  meta: MetaState;
  rngS: number;
  screen: ScreenId;
  storyId: string | null;
  run: RunState | null;
  combat: CombatState | null;
  reward: RewardState | null;
  shop: ShopState | null;
  eventId: string | null;
  pending: null | { type: 'tide'; uid: string; mag: number };
  picker: PickerState | null;
  target: number;
  tutorialStep: number | null;
  fx: Fx[];
  combatLog: Fx[];
  outcome: Outcome | null;
  hold: ScreenId | null;
}

export type Action =
  | { type: 'setLang'; lang: Lang }
  | { type: 'setVolume'; volume: number }
  | { type: 'setShake'; shake: boolean }
  | { type: 'setReduced'; reduced: boolean }
  | { type: 'goto'; screen: ScreenId }
  | { type: 'resume' }
  | { type: 'park' }
  | { type: 'wipe' }
  | { type: 'startTutorial' }
  | { type: 'skipTutorial' }
  | { type: 'ackStory' }
  | { type: 'beginSelect' }
  | { type: 'startRun'; character: CharacterId; chart: number; seed?: number }
  | { type: 'chooseNode'; id: string }
  | { type: 'playCard'; uid: string }
  | { type: 'tideChoice'; dir: 1 | -1 }
  | { type: 'cancelPending' }
  | { type: 'setTarget'; index: number }
  | { type: 'endTurn' }
  | { type: 'drink'; index: number }
  | { type: 'ackWin' }
  | { type: 'ackLose' }
  | { type: 'pickCard'; id: string | null }
  | { type: 'pickRelic'; id: string }
  | { type: 'leaveReward' }
  | { type: 'restHeal' }
  | { type: 'restUpgrade'; uid: string }
  | { type: 'restAttune'; tide: number }
  | { type: 'shopBuyCard'; index: number }
  | { type: 'shopBuyRelic'; index: number }
  | { type: 'shopBuyPhial'; index: number }
  | { type: 'shopRemove'; uid: string }
  | { type: 'shopLeave' }
  | { type: 'eventChoose'; index: number }
  | { type: 'pickerPick'; uid: string }
  | { type: 'pickerCancel' }
  | { type: 'buyUnlock'; id: string }
  | { type: 'abandon' };
