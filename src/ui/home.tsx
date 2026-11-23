import { useState } from 'react';
import { CARDS, LOCKABLE_CARDS } from '../game/cards';
import { CHARACTERS } from '../game/characters';
import { ENEMY_LIST } from '../game/enemies';
import { RELIC_LIST } from '../game/relics';
import type { CharacterId, Lang } from '../game/types';
import { dispatch, useGame } from '../state';
import { Creature } from './art';
import { tr, tx } from './tx';
import { CardFace } from './widgets';

export function MenuScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const meta = state.meta;
  return (
    <section className="screen menu" data-testid="menu">
      <div className="menu-copy">
        <p className="kicker">{tx(lang, 'Гильдия Колоколов', 'Guild of Bells')}</p>
        <h1>SALTBOUND</h1>
        <p className="sub">{tx(lang, 'Солевязь', 'Knots on the water')}</p>
        <p className="pitch">{tx(lang, 'Прилив — клинок, который вы держите вдвоём.', 'The tide is a blade you both hold.')}</p>
        <div className="menu-actions">
          {state.run && (
            <button type="button" data-testid="continue" onClick={() => dispatch({ type: 'resume' })}>
              {tx(lang, 'Продолжить рейс', 'Continue')}
            </button>
          )}
          {!meta.tutorialDone ? (
            <button type="button" data-testid="start" onClick={() => dispatch({ type: 'startTutorial' })}>
              {tx(lang, 'Выйти в бухту', 'Enter the cove')}
            </button>
          ) : (
            <button type="button" data-testid="start" onClick={() => dispatch({ type: 'beginSelect' })}>
              {tx(lang, 'Новый рейс', 'New voyage')}
            </button>
          )}
          {!meta.tutorialDone && (
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'skipTutorial' })}>
              {tx(lang, 'Я уже вяжу узлы', 'I know the knots')}
            </button>
          )}
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'drydock' })}>
            {tx(lang, 'Верфь', 'Drydock')} · {meta.marks}
          </button>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'codex' })}>
            {tx(lang, 'Бестиарий', 'Codex')}
          </button>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'settings' })}>
            {tx(lang, 'Настройки', 'Settings')}
          </button>
          <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'help' })}>
            {tx(lang, 'Как держится вода', 'How the water works')}
          </button>
          <a className="ghost link" href="./onepager.html">
            {tx(lang, 'О игре', 'About the game')}
          </a>
        </div>
        <p className="fine">
          {tx(lang, 'Рейсов', 'Voyages')} {meta.stats.runs} · {tx(lang, 'побед', 'wins')} {meta.stats.wins} ·{' '}
          {tx(lang, 'глубже всего', 'deepest')} {meta.stats.bestAct ? `${meta.stats.bestAct} / ${meta.stats.bestFloor}` : '—'}
        </p>
      </div>
      <Instrument />
      <button type="button" className="lang" onClick={() => dispatch({ type: 'setLang', lang: lang === 'ru' ? 'en' : 'ru' })}>
        {lang === 'ru' ? 'EN' : 'RU'}
      </button>
    </section>
  );
}

function Instrument() {
  return (
    <div className="instrument" aria-hidden>
      <div className="moon" />
      <ol>
        {Array.from({ length: 9 }, (_, i) => (
          <li key={i} className={i > 4 ? 'full' : ''} />
        ))}
      </ol>
      <div className="sea">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export function SelectScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const [chart, setChart] = useState(0);
  const [who, setWho] = useState<CharacterId>('brine');
  const locked = (id: CharacterId) => (id === 'keel' && !state.meta.unlocks.keel) || (id === 'moth' && !state.meta.unlocks.moth);
  return (
    <section className="screen select" data-testid="select">
      <p className="kicker">{tx(lang, 'Кто вяжет', 'Who ties')}</p>
      <h1>{tx(lang, 'Выберите мастера', 'Choose a wright')}</h1>
      <div className="cast">
        {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
          const ch = CHARACTERS[id];
          const off = locked(id);
          return (
            <button key={id} type="button" className={who === id && !off ? 'on' : ''} disabled={off} onClick={() => setWho(id)}>
              <strong>{tr(ch.name, lang)}</strong>
              <em>{tr(ch.title, lang)}</em>
              <p>{tr(ch.blurb, lang)}</p>
              <small>
                {tx(lang, 'Корпус', 'Hull')} {ch.maxHp + state.meta.unlocks.hull * 6} · {tx(lang, 'старт', 'start')} {ch.startTide}
              </small>
              {off && <small>{tx(lang, 'Откроется на верфи', 'Unlock it at the drydock')}</small>}
            </button>
          );
        })}
      </div>
      {state.meta.maxChart > 0 && (
        <div className="charts">
          {Array.from({ length: state.meta.maxChart + 1 }, (_, i) => (
            <button key={i} type="button" className={chart === i ? 'on' : ''} onClick={() => setChart(i)}>
              {tx(lang, `Журнал ${i}`, `Chart ${i}`)}
              <small>
                {i === 0
                  ? tx(lang, 'Обычная вода', 'Ordinary water')
                  : i === 1
                    ? tx(lang, 'Враги крепче, удары +1', 'Tougher enemies, hits +1')
                    : tx(lang, 'Ещё крепче, удары +2', 'Tougher still, hits +2')}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="row-actions">
        <button
          type="button"
          data-testid="cast-off"
          onClick={() => dispatch({ type: 'startRun', character: who, chart })}
        >
          {tx(lang, 'Отчалить', 'Cast off')}
        </button>
        <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
          {tx(lang, 'Назад', 'Back')}
        </button>
      </div>
    </section>
  );
}

const OFFERS: { id: string; cost: number; ru: string; en: string; detail: { ru: string; en: string } }[] = [
  { id: 'keel', cost: 30, ru: 'Киль', en: 'Keel', detail: { ru: 'Второй мастер. Едет на паводке.', en: 'Second wright. Rides the flood.' } },
  { id: 'moth', cost: 55, ru: 'Мотылёк', en: 'Moth', detail: { ru: 'Третий мастер. Тянет воду вниз.', en: 'Third wright. Pulls the water down.' } },
  { id: 'hull', cost: 40, ru: 'Доски корпуса', en: 'Hull planks', detail: { ru: '+6 к максимуму корпуса. Дважды.', en: '+6 max hull. Twice.' } },
  { id: 'purse', cost: 25, ru: 'Кошель гильдии', en: 'Guild purse', detail: { ru: 'Старт рейса +20 монет.', en: 'Start a voyage with +20 coins.' } },
  { id: 'canteen', cost: 30, ru: 'Фляга', en: 'Canteen', detail: { ru: 'В начале рейса есть «Родник».', en: 'Begin the voyage with Springwater.' } },
];

export function DrydockScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const meta = state.meta;
  const owned = (id: string) => {
    if (id === 'keel') return meta.unlocks.keel;
    if (id === 'moth') return meta.unlocks.moth;
    if (id === 'hull') return meta.unlocks.hull >= 2;
    if (id === 'purse') return meta.unlocks.purse;
    if (id === 'canteen') return meta.unlocks.canteen;
    if (id.startsWith('card:')) return meta.unlocks.cards.includes(id.slice(5));
    return false;
  };
  return (
    <section className="screen drydock" data-testid="drydock">
      <p className="kicker">{tx(lang, 'Между рейсами', 'Between voyages')}</p>
      <h1>
        {tx(lang, 'Верфь', 'Drydock')} · {meta.marks}
      </h1>
      <p className="prose">
        {tx(
          lang,
          'Соль рейса остаётся здесь. Поражение тоже приносит соль — чем дальше ушли, тем больше.',
          'Voyage salt stays here. A loss still pays — the farther you got, the more.',
        )}
      </p>
      <div className="choices">
        {OFFERS.map((offer) => (
          <button key={offer.id} type="button" disabled={owned(offer.id) || meta.marks < offer.cost} onClick={() => dispatch({ type: 'buyUnlock', id: offer.id })}>
            <strong>
              {lang === 'ru' ? offer.ru : offer.en} · {offer.cost}
              {offer.id === 'hull' ? ` (${meta.unlocks.hull}/2)` : ''}
            </strong>
            <small>{owned(offer.id) ? tx(lang, 'Уже ваше', 'Already yours') : tr(offer.detail, lang)}</small>
          </button>
        ))}
        {LOCKABLE_CARDS.map((id) => (
          <button key={id} type="button" disabled={owned(`card:${id}`) || meta.marks < 20} onClick={() => dispatch({ type: 'buyUnlock', id: `card:${id}` })}>
            <strong>
              {tr(CARDS[id].name, lang)} · 20
            </strong>
            <small>{owned(`card:${id}`) ? tx(lang, 'В колоде наград', 'In the reward deck') : tx(lang, 'Редкая карта входит в награды', 'A rare card joins rewards')}</small>
          </button>
        ))}
      </div>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
        {tx(lang, 'На палубу', 'Back on deck')}
      </button>
    </section>
  );
}

export function CodexScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const [tab, setTab] = useState<'cards' | 'enemies' | 'relics'>('enemies');
  const seen = state.meta.seen;
  return (
    <section className="screen codex">
      <p className="kicker">{tx(lang, 'Что уже встречали', 'What you have met')}</p>
      <h1>{tx(lang, 'Бестиарий', 'Codex')}</h1>
      <div className="row-actions">
        {(['enemies', 'cards', 'relics'] as const).map((id) => (
          <button key={id} type="button" className={tab === id ? 'on' : 'ghost'} onClick={() => setTab(id)}>
            {id === 'enemies' ? tx(lang, 'Существа', 'Creatures') : id === 'cards' ? tx(lang, 'Узлы', 'Knots') : tx(lang, 'Реликвии', 'Relics')}
          </button>
        ))}
      </div>
      {tab === 'enemies' && (
        <div className="codex-grid">
          {ENEMY_LIST.filter((e) => !e.hidden && !e.token).map((enemy) => {
            const known = seen.enemies.includes(enemy.id);
            return (
              <article key={enemy.id} className={known ? '' : 'unknown'}>
                <Creature art={enemy.art} />
                <strong>{known ? tr(enemy.name, lang) : '—'}</strong>
                <p>{known ? tr(enemy.tip, lang) : tx(lang, 'Ещё не встречали.', 'Not met yet.')}</p>
              </article>
            );
          })}
        </div>
      )}
      {tab === 'cards' && (
        <div className="card-grid">
          {seen.cards.length === 0 && <p>{tx(lang, 'Колода помнит только сыгранное.', 'The deck remembers only what you have held.')}</p>}
          {seen.cards.map((id) => CARDS[id] && <CardFace key={id} id={id} lang={lang} />)}
        </div>
      )}
      {tab === 'relics' && (
        <div className="choices">
          {RELIC_LIST.map((relic) => {
            const known = seen.relics.includes(relic.id);
            return (
              <article key={relic.id}>
                <strong>{known ? tr(relic.name, lang) : tx(lang, 'Незнакомая вещь', 'Unknown thing')}</strong>
                <small>{known ? tr(relic.text, lang) : tx(lang, 'Найдёте в рейсе.', 'Find it on a voyage.')}</small>
              </article>
            );
          })}
        </div>
      )}
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
        {tx(lang, 'Назад', 'Back')}
      </button>
    </section>
  );
}

export function HelpScreen() {
  const lang = useGame().meta.settings.lang;
  return (
    <section className="screen help">
      <p className="kicker">{tx(lang, 'Коротко, без тумана', 'Short, and not foggy')}</p>
      <h1>{tx(lang, 'Как держится вода', 'How the water works')}</h1>
      <div className="help-grid">
        <article>
          <h2>{tx(lang, 'Ход', 'A turn')}</h2>
          <p>{tx(lang, 'Три энергии, пять карт. Сыграйте узлы, закройте ход. Потом бьёт враг — по числу на намерении. Защита держится только до начала вашего следующего хода.', 'Three energy, five cards. Play knots, end the turn. Then the enemy hits for the number on their intent. Block lasts only until your next turn starts.')}</p>
        </article>
        <article>
          <h2>{tx(lang, 'Прилив 0–8', 'Tide 0–8')}</h2>
          <p>{tx(lang, 'Отлив 0–3, штиль 3–5, паводок 5–8. На общей отметке горят обе стихии. В конце хода вода сама +1. На 7–8 шторм бьёт всех на 3 сквозь защиту. На 0–1 мёртвая вода бьёт врагов на 2, а вы берёте на карту меньше.', 'Ebb is 0–3, slack 3–5, flood 5–8. On a shared mark both elements light up. The water adds 1 at end of turn. At 7–8 a storm hits everyone for 3 through block. At 0–1 dead water hits enemies for 2 and you draw one less.')}</p>
        </article>
        <article>
          <h2>{tx(lang, 'Соль и сила', 'Salt and strength')}</h2>
          <p>{tx(lang, 'Соль снимает корпус в конце хода цели и тает на 1. Её не блокируют. Сила прибавляется к ударам до конца боя. Слабость режет удары на четверть.', 'Salt removes hull at the end of the target’s turn and fades by 1. Block does not stop it. Strength adds to attacks for the combat. Weak cuts attacks by a quarter.')}</p>
        </article>
        <article>
          <h2>{tx(lang, 'Рейс', 'A voyage')}</h2>
          <p>{tx(lang, 'Три акта: мелководье, ночной рынок, желоб. На каждом пути есть случай, лавка, отдых и босс. Победа — убить Луну внизу. Соль рейса копится на верфи даже после поражения.', 'Three acts: shallows, night market, trench. Every route has an event, a shop, a rest, and a boss. You win by killing the Moon Below. Voyage salt stays at the drydock even after a loss.')}</p>
        </article>
      </div>
      <p className="fine">{tx(lang, 'Клавиши: 1–9 карта, E или пробел — конец хода, Esc — меню.', 'Keys: 1–9 play a card, E or Space ends the turn, Esc opens the menu.')}</p>
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
        {tx(lang, 'Назад', 'Back')}
      </button>
    </section>
  );
}

export function SettingsScreen() {
  const lang = useGame().meta.settings.lang;
  return (
    <section className="screen settings-screen">
      <p className="kicker">SALTBOUND</p>
      <h1>{tx(lang, 'Настройки', 'Settings')}</h1>
      <SettingsBits />
      <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
        {tx(lang, 'Назад', 'Back')}
      </button>
    </section>
  );
}

export function SettingsBits() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const [armed, setArmed] = useState(false);
  return (
    <div className="settings">
      <label>
        {tx(lang, 'Громкость', 'Volume')}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(state.meta.settings.volume * 100)}
          onChange={(e) => dispatch({ type: 'setVolume', volume: Number(e.target.value) / 100 })}
        />
      </label>
      <label>
        <input type="checkbox" checked={state.meta.settings.shake} onChange={(e) => dispatch({ type: 'setShake', shake: e.target.checked })} />
        {tx(lang, 'Тряска удара', 'Hit shake')}
      </label>
      <label>
        <input type="checkbox" checked={state.meta.settings.reduced} onChange={(e) => dispatch({ type: 'setReduced', reduced: e.target.checked })} />
        {tx(lang, 'Меньше движения', 'Reduced motion')}
      </label>
      <button type="button" className="ghost" onClick={() => (armed ? dispatch({ type: 'wipe' }) : setArmed(true))}>
        {armed ? tx(lang, 'Точно стереть верфь и рейс', 'Yes, erase drydock and voyage') : tx(lang, 'Стереть сохранение', 'Erase save')}
      </button>
    </div>
  );
}

export function EndScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const outcome = state.outcome;
  if (!outcome) return null;
  return (
    <section className="screen end" data-testid="end">
      <p className="kicker">{outcome.victory ? tx(lang, 'Книга закрыта', 'The book is closed') : tx(lang, 'Рейс оборвался', 'The voyage stopped')}</p>
      <h1>{outcome.victory ? tx(lang, 'Луна замолчала', 'The moon went quiet') : tx(lang, 'Вода забрала своё', 'The water took its due')}</h1>
      <p className="prose">{lang === 'ru' ? outcome.tipRu : outcome.tipEn}</p>
      <p className="fine">
        {tx(lang, 'Акт', 'Act')} {outcome.act} · {tx(lang, 'узлов', 'nodes')} {outcome.floors} · {tx(lang, 'соль', 'salt')} +{outcome.marks}
      </p>
      {outcome.newUnlocks.length > 0 && (
        <p>{tx(lang, 'Открыт новый журнал прилива. Он ждёт на выборе рейса.', 'A new tide chart is open. It waits on the voyage select.')}</p>
      )}
      <div className="row-actions">
        <button type="button" onClick={() => dispatch({ type: 'beginSelect' })}>
          {tx(lang, 'Ещё раз', 'Again')}
        </button>
        <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'drydock' })}>
          {tx(lang, 'На верфь', 'Drydock')}
        </button>
        <button type="button" className="ghost" onClick={() => dispatch({ type: 'goto', screen: 'menu' })}>
          {tx(lang, 'В меню', 'Menu')}
        </button>
      </div>
    </section>
  );
}
