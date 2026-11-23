import { CARDS } from '../game/cards';
import { cardCost, endTurn, playCard, startCombat } from '../game/combat';
import { allNodesReachable, generateMap, mapReachesBoss } from '../game/map';
import { policyAction } from '../game/policy';
import { createRun, defaultMeta, freshState, reduce } from '../game/reducer';
import { Rng } from '../game/rng';
import { affinityOn } from '../game/tide';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function testAffinity(): void {
  assert(affinityOn('ebb', 0) && affinityOn('ebb', 3) && !affinityOn('ebb', 4), 'ebb band');
  assert(affinityOn('slack', 3) && affinityOn('slack', 5) && !affinityOn('slack', 2) && !affinityOn('slack', 6), 'slack band');
  assert(affinityOn('flood', 5) && affinityOn('flood', 8) && !affinityOn('flood', 4), 'flood band');
  assert(!affinityOn('wild', 4), 'wild has no band');
}

function testStrikeNumbers(): void {
  const meta = defaultMeta();
  const rng = new Rng(42);
  const run = createRun(meta, 'brine', 0, rng, 42);
  const combat = reduce(freshState(42), { type: 'goto', screen: 'menu' });
  void combat;
  const started = reduce(
    { ...freshState(42), meta, screen: 'select' },
    { type: 'startRun', character: 'brine', chart: 0, seed: 42 },
  );
  assert(started.run, 'run exists');
  const fight = reduce(started, { type: 'ackStory' });
  assert(fight.screen === 'map', 'map after story');
  const node = fight.run!.map.nodes.find((n) => n.row === 0)!;
  let s = reduce(fight, { type: 'chooseNode', id: node.id });
  assert(s.screen === 'combat' && s.combat, 'entered combat');
  const c = s.combat!;
  assert(c.hand.length === 5, `hand ${c.hand.length}`);
  assert(c.energy === 3, 'energy');
  assert(c.tide === 4, `start tide ${c.tide}`);
  c.tide = 2;
  const reed = c.hand.find((card) => card.id === 'reed_strike') ?? { uid: 'forced', id: 'reed_strike', up: false };
  if (!c.hand.includes(reed)) c.hand.push(reed);
  c.energy = 3;
  const before = c.enemies[0].hp;
  playCard(c, reed.uid, new Rng(1), { target: 0 });
  assert(before - c.enemies[0].hp === 9, `ebb reed dealt ${before - c.enemies[0].hp}, want 9`);
  c.tide = 4;
  const kelp = { uid: 'kelp', id: 'kelp_guard', up: false };
  c.hand.push(kelp);
  c.energy = 3;
  playCard(c, kelp.uid, new Rng(2), { target: 0 });
  assert(c.player.block === 8, `slack guard block ${c.player.block}, want 8`);
  assert(cardCost({ uid: 'z', id: 'breaker', up: false }, c) === 2, 'breaker cost');
}

function testStorm(): void {
  const meta = defaultMeta();
  const rng = new Rng(3);
  const run = createRun(meta, 'brine', 0, rng, 3);
  const combat = startCombat(run, ['brinecrab'], new Rng(9), { startTide: 4, fightKind: 'combat', row: 0 });
  const hp = combat.player.hp;
  combat.hand = [];
  combat.tide = 6;
  endTurn(combat, new Rng(4));
  assert(combat.tide === 7, `tide after drift ${combat.tide}`);
  assert(hp - combat.player.hp >= 3, `storm hurt ${hp - combat.player.hp}`);
}

function testMap(): void {
  for (let seed = 1; seed <= 40; seed++) {
    const map = generateMap(new Rng(seed), ((seed % 3) + 1) as 1 | 2 | 3);
    assert(mapReachesBoss(map), `seed ${seed} misses boss`);
    assert(allNodesReachable(map), `seed ${seed} has an orphan`);
    assert(map.nodes.some((n) => n.kind === 'shop'), 'shop');
    assert(map.nodes.some((n) => n.kind === 'event'), 'event');
    assert(map.nodes.some((n) => n.kind === 'rest'), 'rest');
    assert(map.nodes.some((n) => n.kind === 'elite'), 'elite');
    assert(map.nodes.some((n) => n.kind === 'boss'), 'boss');
  }
}

function testTutorialAndRun(): void {
  let s = reduce(freshState(11), { type: 'startTutorial' });
  assert(s.screen === 'combat' && s.tutorialStep === 0, 'tutorial begins');
  for (let i = 0; i < 80 && s.tutorialStep !== null; i++) {
    const a = policyAction(s);
    assert(a, `tutorial stuck at step ${s.tutorialStep} screen ${s.screen}`);
    s = reduce(s, a!);
  }
  assert(s.storyId === 'afterTutorial' || s.meta.tutorialDone, 'tutorial finished');
  s = reduce(s, { type: 'ackStory' });
  assert(s.screen === 'story' && s.storyId === 'act1', 'act 1 story');
  s = reduce(s, { type: 'ackStory' });
  assert(s.screen === 'map', 'on the map');
  let guard = 0;
  while (s.screen !== 'victory' && s.screen !== 'defeat' && guard++ < 2500) {
    const a = policyAction(s);
    if (!a) throw new Error(`no action on ${s.screen}`);
    const prev = `${s.screen}:${s.combat?.turn}:${s.combat?.phase}:${s.tutorialStep}`;
    s = reduce(s, a);
    if (s.combat && s.combat.turn > 40) throw new Error('combat ran too long');
    void prev;
  }
  assert(s.screen === 'victory' || s.screen === 'defeat', `ended on ${s.screen}`);
  assert(s.outcome, 'outcome recorded');
  console.log(
    `sample run: ${s.outcome?.victory ? 'win' : 'loss'} act ${s.outcome?.act} floors ${s.outcome?.floors} marks ${s.outcome?.marks}`,
  );
}

function testDeckSurvives(): void {
  let s = reduce(freshState(8), { type: 'goto', screen: 'select' });
  s = reduce(s, { type: 'startRun', character: 'brine', chart: 0, seed: 8 });
  s = reduce(s, { type: 'ackStory' });
  const before = s.run!.deck.length;
  const node = s.run!.map.nodes.find((n) => n.row === 0)!;
  s = reduce(s, { type: 'chooseNode', id: node.id });
  assert(s.run!.deck.length === 0, 'deck moved into combat');
  const combat = s.combat!;
  let safety = 0;
  while (combat.phase === 'player' && safety++ < 12) {
    const playable = combat.hand.find((c) => {
      const def = CARDS[c.id];
      return def && !def.unplayable && cardCost(c, combat) <= combat.energy;
    });
    if (!playable) break;
    playCard(combat, playable.uid, new Rng(safety + 3), { target: 0 });
  }
  // Finish via reducer so the deck is written back if the fight ends.
  let guard = 0;
  while (s.screen === 'combat' && guard++ < 80) {
    const a = policyAction(s);
    if (!a) break;
    s = reduce(s, a);
  }
  if (s.screen === 'reward') {
    assert(s.run && s.run.deck.length >= before - 2, `deck came back ${s.run?.deck.length} from ${before}`);
  }
}

testAffinity();
testStrikeNumbers();
testStorm();
testMap();
testTutorialAndRun();
testDeckSurvives();
console.log('selfcheck ok');
