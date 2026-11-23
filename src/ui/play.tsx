import { useMemo, useState } from 'react';
import { CARDS } from '../game/cards';
import { cardCost } from '../game/combat';
import { reachableIds } from '../game/map';
import type { CardInst, Lang } from '../game/types';
import { dispatch, useGame } from '../state';
import { useContext } from 'react';
import { PauseApi } from './shell';
import { ACT_NAME, tr, tx } from './tx';
import { CardFace, EnemyPlate, HudStats, RelicRow, TideGauge, debtNote } from './widgets';

const TUTOR = [
  {
    ru: 'Карта — это узел. Сыграйте «Удар тростником». Цифра в углу — энергия.',
    en: 'A card is a knot. Play Reed Strike. The corner number is energy.',
  },
  {
    ru: '«Ламинария» сейчас в штиле: рамка зажглась, защита больше. Сыграйте её.',
    en: 'Kelp Guard is in slack: the frame is lit and the block is higher. Play it.',
  },
  {
    ru: '«Буй» поднимает воду и даёт карту. «Огонёк» тормозит. Выберите руль.',
    en: 'Buoy raises the water and draws. Wick Tap is the brake. Choose a helm.',
  },
  {
    ru: 'Закройте ход. Защита держится, пока чайка бьёт, и спадёт в начале вашего хода. Вода сама прибавит 1.',
    en: 'End the turn. Block holds while the gull hits, then drops at the start of your next turn. The water adds 1 by itself.',
  },
  {
    ru: 'Дальше сами. Добейте чайку. Края шкалы — мёртвая вода и шторм — бьют по всем.',
    en: 'The rest is yours. Finish the gull. The edges of the gauge — dead water and storm — hit everyone.',
  },
];

function allowed(step: number | null, id: string): boolean {
  if (step === null || step >= 4) return true;
  if (step === 0) return id === 'reed_strike';
  if (step === 1) return id === 'kelp_guard';
  if (step === 2) return id === 'buoy_toss' || id === 'lantern_tap';
  return false;
}

export function CombatScreen() {
  const state = useGame();
  const pause = useContext(PauseApi);
  const combat = state.combat;
  const lang = state.meta.settings.lang;
  const [pile, setPile] = useState<null | 'draw' | 'discard' | 'exhaust' | 'deck'>(null);
  if (!combat) return null;
  const note = debtNote(combat, lang);
  const echo = combat.echo;
  const madam = combat.enemies.some((e) => e.defId === 'madam_bell' && e.hp > 0);
  return (
    <section className={`screen combat band-${combat.tide >= 7 ? 'storm' : combat.tide <= 1 ? 'deep' : 'mid'}`} data-testid="combat" data-phase={combat.phase}>
      <header className="topbar">
        <div>
          <p className="kicker">{tx(lang, 'Зов прилива', 'TIDECALLER')}</p>
          <h1>{state.tutorialStep !== null ? tx(lang, 'Учебная бухта', 'Practice cove') : tr(ACT_NAME[state.run?.act ?? 1], lang)}</h1>
        </div>
        <RelicRow ids={combat.relics} lang={lang} />
        <HudStats
          hp={combat.player.hp}
          maxHp={combat.player.maxHp}
          block={combat.player.block}
          gold={combat.gold}
          energy={combat.energy}
          maxEnergy={combat.maxEnergy}
          lang={lang}
        />
        <button type="button" className="ghost" onClick={() => pause.toggle()}>
          {tx(lang, 'Меню', 'Menu')}
        </button>
      </header>
      <div className="combat-grid">
        <TideGauge combat={combat} lang={lang} />
        <div className="arena">
          {state.tutorialStep !== null && state.tutorialStep <= 4 && (
            <p className="coach" data-testid="coach">
              {lang === 'ru' ? TUTOR[Math.min(state.tutorialStep, 4)].ru : TUTOR[Math.min(state.tutorialStep, 4)].en}
            </p>
          )}
          {note && <p className="coach warn">{note}</p>}
          {madam && (
            <p className="coach">
              {tx(lang, 'Последний узел для звона: ', 'Last knot for the chime: ')}
              {!echo || echo.kind === 'blank'
                ? tx(lang, 'пустой, звон будет слабым.', 'blank, so the chime stays weak.')
                : echo.kind === 'damage'
                  ? tx(lang, `${echo.n} урона`, `${echo.n} damage`)
                  : echo.kind === 'block'
                    ? tx(lang, `${echo.n} защиты`, `${echo.n} block`)
                    : echo.kind === 'salt'
                      ? tx(lang, `${echo.n} соли`, `${echo.n} salt`)
                      : tx(lang, `прилив ${echo.n > 0 ? '+' : ''}${echo.n}`, `tide ${echo.n > 0 ? '+' : ''}${echo.n}`)}
            </p>
          )}
          <div className={`enemies count-${Math.min(combat.enemies.length, 3)}`}>
            {combat.enemies.map((enemy, index) => (
              <EnemyPlate
                key={enemy.uid}
                combat={combat}
                index={index}
                lang={lang}
                selected={state.target === index || combat.enemies.length === 1}
                onSelect={() => dispatch({ type: 'setTarget', index })}
              />
            ))}
          </div>
          <div className="pills player-pills">
            {combat.player.strength > 0 && <span>{tx(lang, 'Сила', 'Strength')} {combat.player.strength}</span>}
            {combat.player.salt > 0 && <span>{tx(lang, 'Соль', 'Salt')} {combat.player.salt}</span>}
            {combat.player.weak > 0 && <span>{tx(lang, 'Слабость', 'Weak')} {combat.player.weak}</span>}
            {combat.powers.lighthouse > 0 && <span>{tx(lang, 'Маяк', 'Lighthouse')} {combat.powers.lighthouse}</span>}
            {combat.cheapNext > 0 && <span>{tx(lang, 'Следующая −', 'Next −')}{combat.cheapNext}</span>}
          </div>
        </div>
        <aside className="log" data-testid="log">
          <h2>{tx(lang, 'Журнал', 'Log')}</h2>
          <ul>
            {state.combatLog
              .slice(-8)
              .map((fx) => formatFx(fx, lang))
              .filter(Boolean)
              .map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
          </ul>
        </aside>
      </div>
      <footer className="dock">
        <div className="phials">
          {combat.phials.map((id, index) => (
            <button
              key={index}
              type="button"
              className="phial"
              disabled={!id || combat.phase !== 'player' || (state.tutorialStep !== null && state.tutorialStep < 4)}
              onClick={() => dispatch({ type: 'drink', index })}
            >
              {id ? tr(phialName(id), lang) : tx(lang, 'Пусто', 'Empty')}
            </button>
          ))}
        </div>
        <div className="hand">
          {combat.hand.map((card) => {
            const def = CARDS[card.id];
            const playable =
              combat.phase === 'player' &&
              !!def &&
              !def.unplayable &&
              cardCost(card, combat) <= combat.energy &&
              allowed(state.tutorialStep, card.id);
            return (
              <CardFace
                key={card.uid}
                id={card.id}
                upgraded={card.up}
                lang={lang}
                combat={combat}
                disabled={!playable}
                hot={playable && state.tutorialStep !== null && state.tutorialStep < 4}
                dim={!playable}
                onClick={() => dispatch({ type: 'playCard', uid: card.uid })}
              />
            );
          })}
        </div>
        <div className="piles">
          <button type="button" className="pile" onClick={() => setPile('draw')}>
            {tx(lang, 'Колода', 'Draw')} {combat.draw.length}
          </button>
          <button type="button" className="pile" onClick={() => setPile('discard')}>
            {tx(lang, 'Сброс', 'Discard')} {combat.discard.length}
          </button>
          <button type="button" className="pile" onClick={() => setPile('exhaust')}>
            {tx(lang, 'Изгнание', 'Exhaust')} {combat.exhaustPile.length}
          </button>
          <button
            type="button"
            className="end"
            data-testid="end-turn"
            disabled={combat.phase !== 'player' || !!state.pending || (state.tutorialStep !== null && state.tutorialStep < 3)}
            onClick={() => dispatch({ type: 'endTurn' })}
          >
            {tx(lang, 'Конец хода', 'End turn')}
          </button>
        </div>
      </footer>
      {state.pending && (
        <div className="modal" data-testid="tide-choice">
          <div className="sheet">
            <h2>{tx(lang, 'Куда сдвинуть воду?', 'Which way does the water go?')}</h2>
            <div className="choices">
              <button type="button" onClick={() => dispatch({ type: 'tideChoice', dir: 1 })}>
                {tx(lang, `Прилив +${state.pending.mag}`, `Tide +${state.pending.mag}`)}
              </button>
              <button type="button" onClick={() => dispatch({ type: 'tideChoice', dir: -1 })}>
                {tx(lang, `Прилив −${state.pending.mag}`, `Tide −${state.pending.mag}`)}
              </button>
              <button type="button" className="ghost" onClick={() => dispatch({ type: 'cancelPending' })}>
                {tx(lang, 'Отмена', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {combat.phase === 'win' && (
        <div className="modal">
          <div className="sheet">
            <h2>{tx(lang, 'Вода приняла узел', 'The water took the knot')}</h2>
            <button type="button" data-testid="ack-win" onClick={() => dispatch({ type: 'ackWin' })}>
              {state.tutorialStep !== null ? tx(lang, 'Выйти из бухты', 'Leave the cove') : tx(lang, 'К добыче', 'To the spoils')}
            </button>
          </div>
        </div>
      )}
      {combat.phase === 'lose' && (
        <div className="modal">
          <div className="sheet">
            <h2>{tx(lang, 'Корпус не выдержал', 'The hull gave out')}</h2>
            <button type="button" data-testid="ack-lose" onClick={() => dispatch({ type: 'ackLose' })}>
              {tx(lang, 'Смотреть итог', 'See the tally')}
            </button>
          </div>
        </div>
      )}
      {pile && (
        <PileModal
          title={pile === 'draw' ? tx(lang, 'Колода', 'Draw') : pile === 'discard' ? tx(lang, 'Сброс', 'Discard') : tx(lang, 'Изгнание', 'Exhaust')}
          cards={pile === 'draw' ? combat.draw : pile === 'discard' ? combat.discard : combat.exhaustPile}
          lang={lang}
          onClose={() => setPile(null)}
        />
      )}
    </section>
  );
}

function phialName(id: string): { ru: string; en: string } {
  const names: Record<string, { ru: string; en: string }> = {
    springwater: { ru: 'Родник', en: 'Spring' },
    stormglass: { ru: 'Шторм', en: 'Storm' },
    ebb_ash: { ru: 'Пепел', en: 'Ash' },
    saltspike: { ru: 'Шип', en: 'Spike' },
    ironkelp: { ru: 'Железо', en: 'Iron' },
  };
  return names[id] ?? { ru: id, en: id };
}

function formatFx(fx: import('../game/types').Fx, lang: Lang): string {
  if (fx.t === 'tide') return tx(lang, `Прилив ${fx.from} → ${fx.to}`, `Tide ${fx.from} → ${fx.to}`);
  if (fx.t === 'dmg' && fx.who === 'p') return tx(lang, `Корпус −${fx.n}`, `Hull −${fx.n}`);
  if (fx.t === 'dmg') return tx(lang, `Урон ${fx.n}`, `Damage ${fx.n}`);
  if (fx.t === 'heal' && fx.who === 'p') return tx(lang, `Лечение ${fx.n}`, `Heal ${fx.n}`);
  if (fx.t === 'log' && fx.code === 'play' && fx.id) return CARDS[fx.id] ? tr(CARDS[fx.id].name, lang) : fx.id;
  if (fx.t === 'log' && fx.code === 'storm') return tx(lang, 'Шторм бьёт всех на 3', 'Storm hits everyone for 3');
  if (fx.t === 'log' && fx.code === 'strand') return tx(lang, 'Мёртвая вода сажает врагов', 'Dead water strands the enemy');
  if (fx.t === 'log' && fx.code === 'drift') return tx(lang, 'Вода поднимается сама', 'The water rises by itself');
  if (fx.t === 'log' && fx.code === 'anchor') return tx(lang, 'Якорь удержал ход', 'The anchor held the turn');
  if (fx.t === 'log' && fx.code === 'doom') return tx(lang, `Луна считает шторм: ${fx.n}`, `The moon counts a storm: ${fx.n}`);
  if (fx.t === 'log' && fx.code === 'glassMoon') return tx(lang, 'Стеклянная луна гасит шторм', 'Glass Moon snuffs the storm');
  if (fx.t === 'log' && fx.code === 'gold') return tx(lang, `Угорь забрал ${fx.n} монет`, `The eel took ${fx.n} coins`);
  return '';
}

function PileModal({ title, cards, lang, onClose }: { title: string; cards: CardInst[]; lang: Lang; onClose: () => void }) {
  const shown = useMemo(() => [...cards].sort((a, b) => a.id.localeCompare(b.id)), [cards]);
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet wide" onClick={(e) => e.stopPropagation()}>
        <h2>
          {title} · {cards.length}
        </h2>
        <div className="card-grid">
          {shown.map((card) => (
            <CardFace key={card.uid} id={card.id} upgraded={card.up} lang={lang} />
          ))}
        </div>
        <button type="button" onClick={onClose}>
          {tx(lang, 'Закрыть', 'Close')}
        </button>
      </div>
    </div>
  );
}

const NODE: Record<string, { ru: string; en: string }> = {
  combat: { ru: 'Бой', en: 'Fight' },
  elite: { ru: 'Элита', en: 'Elite' },
  event: { ru: 'Случай', en: 'Event' },
  shop: { ru: 'Лавка', en: 'Shop' },
  rest: { ru: 'Отдых', en: 'Rest' },
  boss: { ru: 'Босс', en: 'Boss' },
};

export function MapScreen() {
  const state = useGame();
  const pause = useContext(PauseApi);
  const run = state.run;
  const lang = state.meta.settings.lang;
  const [deckOpen, setDeckOpen] = useState(false);
  if (!run) return null;
  const open = new Set(reachableIds(run.map));
  const height = 9 * 92 + 40;
  return (
    <section className="screen map-screen" data-testid="map">
      <header className="topbar">
        <div>
          <p className="kicker">
            {tx(lang, 'Акт', 'Act')} {run.act} · {tx(lang, 'узел', 'node')} {run.floors}
          </p>
          <h1>{tr(ACT_NAME[run.act], lang)}</h1>
        </div>
        <RelicRow ids={run.relics} lang={lang} />
        <HudStats hp={run.hp} maxHp={run.maxHp} gold={run.gold} lang={lang} />
        <button type="button" className="ghost" onClick={() => setDeckOpen(true)}>
          {tx(lang, 'Колода', 'Deck')} {run.deck.length}
        </button>
        <button type="button" className="ghost" onClick={() => pause.toggle()}>
          {tx(lang, 'Меню', 'Menu')}
        </button>
      </header>
      <div className="map-wrap">
        <div className="map-box" style={{ height }}>
        <svg className="map" viewBox={`0 0 680 ${height}`} preserveAspectRatio="none" role="img">
          {run.map.nodes.flatMap((node) =>
            node.next.map((id) => {
              const to = run.map.nodes.find((n) => n.id === id);
              if (!to) return null;
              return (
                <line
                  key={`${node.id}-${id}`}
                  x1={48 + node.col * 92}
                  y1={36 + node.row * 92}
                  x2={48 + to.col * 92}
                  y2={36 + to.row * 92}
                  className={run.map.path.includes(node.id) ? 'walked' : ''}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }),
          )}
        </svg>
        <div className="nodes">
          {run.map.nodes.map((node) => {
            const here = run.map.current === node.id;
            const can = open.has(node.id);
            return (
              <button
                key={node.id}
                type="button"
                className={`node kind-${node.kind}${here ? ' here' : ''}${can ? ' can' : ''}${run.map.path.includes(node.id) ? ' was' : ''}`}
                style={{ left: `${((48 + node.col * 92) / 680) * 100}%`, top: 36 + node.row * 92 }}
                disabled={!can}
                data-testid="map-node"
                data-kind={node.kind}
                data-open={can ? '1' : '0'}
                onClick={() => dispatch({ type: 'chooseNode', id: node.id })}
              >
                <i />
                <span>{tr(NODE[node.kind], lang)}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>
      <footer className="map-foot">
        <span>
          {tx(lang, 'Сид', 'Seed')} {run.seed.toString(36)}
        </span>
        <ul className="map-legend" data-testid="map-legend">
          {(['combat', 'elite', 'event', 'shop', 'rest', 'boss'] as const).map((kind) => (
            <li key={kind} className={`kind-${kind}`}>
              <i />
              {tr(NODE[kind], lang)}
            </li>
          ))}
        </ul>
        <span>{tx(lang, 'Только вперёд. Край карты — босс.', 'Forward only. The bottom of the route is the boss.')}</span>
      </footer>
      {deckOpen && (
        <PileModal title={tx(lang, 'Колода рейса', 'Voyage deck')} cards={run.deck} lang={lang} onClose={() => setDeckOpen(false)} />
      )}
    </section>
  );
}
