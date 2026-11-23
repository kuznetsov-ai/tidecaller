import { startCombat } from '../src/game/combat';
import { createRun, defaultMeta, freshState, reduce } from '../src/game/reducer';
import { Rng } from '../src/game/rng';
import type { CardInst, CharacterId, CombatState, GameState, RunState } from '../src/game/types';

export function mkRun(character: CharacterId = 'brine', seed = 1): RunState {
  return createRun(defaultMeta(), character, 0, new Rng(seed), seed);
}

export function mkCombat(enemies: string[] = ['gullthief'], o: { tide?: number; relics?: string[]; seed?: number; character?: CharacterId } = {}): CombatState {
  const run = mkRun(o.character ?? 'brine', o.seed ?? 1);
  if (o.relics) run.relics.push(...o.relics);
  const c = startCombat(run, enemies, new Rng(o.seed ?? 7), { startTide: 4, fightKind: 'combat', row: 0 });
  if (o.tide != null) c.tide = o.tide;
  return c;
}

let n = 0;
export function card(id: string, up = false): CardInst {
  return { uid: `t${++n}`, id, up };
}

export function give(c: CombatState, ...cards: CardInst[]): CardInst[] {
  c.hand.push(...cards);
  return cards;
}

export function inRun(character: CharacterId = 'brine', seed = 5): GameState {
  let s = freshState(seed);
  s.meta.tutorialDone = true;
  s.meta.unlocks.keel = true;
  s.meta.unlocks.moth = true;
  s = reduce(s, { type: 'beginSelect' });
  s = reduce(s, { type: 'startRun', character, chart: 0, seed });
  return reduce(s, { type: 'ackStory' });
}

export function atEvent(id: string, mut?: (s: GameState) => void): GameState {
  const s = inRun();
  s.screen = 'event';
  s.eventId = id;
  mut?.(s);
  return s;
}

export const rng = (seed = 3) => new Rng(seed);
