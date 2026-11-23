import { policyAction } from '../game/policy';
import { freshState, reduce } from '../game/reducer';
import type { CharacterId, GameState } from '../game/types';

function play(seed: number, character: CharacterId, chart = 0): GameState {
  let s = reduce(freshState(seed), { type: 'goto', screen: 'select' });
  s = reduce(s, { type: 'startRun', character, chart, seed });
  let guard = 0;
  let turns = 0;
  let decisions = 0;
  let other = 0;
  while (s.screen !== 'victory' && s.screen !== 'defeat' && guard++ < 4000) {
    const a = policyAction(s);
    if (!a) break;
    if (s.screen === 'combat' && (a.type === 'playCard' || a.type === 'tideChoice')) decisions += 1;
    else if (s.screen === 'combat' && a.type === 'endTurn') turns += 1;
    else if (a.type !== 'setTarget') other += 1;
    s = reduce(s, a);
    if (s.combat && s.combat.turn > 45) break;
  }
  const extra = s as GameState & { _turns?: number; _decisions?: number; _other?: number };
  extra._turns = turns;
  extra._decisions = decisions;
  extra._other = other;
  return s;
}

const N = 40;
let wins = 0;
let act1 = 0;
let act2 = 0;
let floors = 0;
let turns = 0;
let decisions = 0;
let other = 0;
let early = 0;
const deaths: Record<string, number> = {};
for (let i = 1; i <= N; i++) {
  const s = play(i * 17 + 3, 'brine', 0);
  const extra = s as GameState & { _turns?: number; _decisions?: number; _other?: number };
  if (s.outcome?.victory) wins += 1;
  if ((s.outcome?.act ?? 1) >= 2 || s.outcome?.victory) act1 += 1;
  if ((s.outcome?.act ?? 1) >= 3 || s.outcome?.victory) act2 += 1;
  if ((s.outcome?.floors ?? 0) <= 2 && !s.outcome?.victory) early += 1;
  floors += s.outcome?.floors ?? 0;
  turns += extra._turns ?? 0;
  decisions += extra._decisions ?? 0;
  other += extra._other ?? 0;
  const key = s.outcome?.victory ? 'win' : `a${s.outcome?.act ?? '?'}`;
  deaths[key] = (deaths[key] ?? 0) + 1;
}
const minutes = (decisions * 8 + turns * 5 + other * 16) / 60;
console.log(
  JSON.stringify(
    {
      n: N,
      wins,
      reachedAct2: act1,
      reachedAct3: act2,
      avgFloors: +(floors / N).toFixed(1),
      avgTurns: +(turns / N).toFixed(1),
      avgCardPlays: +(decisions / N).toFixed(1),
      avgThoughtfulMinutes: +(minutes / N).toFixed(1),
      diedByFloor2: early,
      deaths,
    },
    null,
    2,
  ),
);
