import { useState } from 'react';
import { CARDS } from '../game/cards';
import { EVENTS } from '../game/events';
import { PHIALS } from '../game/phials';
import { eventChoiceBlock, pickerCards, removePrice } from '../game/reducer';
import { RELICS } from '../game/relics';
import type { CardInst } from '../game/types';
import { dispatch, useGame } from '../state';
import { tr, tx } from './tx';
import { CoachMarks } from './hints';
import { RunMenuButton } from './shell';
import { CardFace, HudStats, RelicRow } from './widgets';

let lastStoryAck = 0;

export function StoryScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const id = state.storyId;
  const copy = STORIES[id ?? 'act1'] ?? STORIES.act1;
  return (
    <section className="screen story" data-testid="story">
      <RunMenuButton lang={lang} />
      <p className="kicker">{tx(lang, 'Зов прилива', 'TIDECALLER')}</p>
      <h1>{tr(copy.title, lang)}</h1>
      <p className="prose">{tr(copy.body, lang)}</p>
      <button type="button" data-testid="ack-story" onClick={() => {
          // A double click must not skip the next story page.
          if (Date.now() - lastStoryAck < 450) return;
          lastStoryAck = Date.now();
          dispatch({ type: 'ackStory' });
        }}>
        {tr(copy.button, lang)}
      </button>
    </section>
  );
}

const STORIES: Record<string, { title: { ru: string; en: string }; body: { ru: string; en: string }; button: { ru: string; en: string } }> = {
  afterTutorial: {
    title: { ru: 'Бухта позади', en: 'The cove is behind you' },
    body: {
      ru: 'Дальше мелководье. Карта ведёт только вперёд. В конце каждого вашего хода прилив сам поднимается на 1, если якорь не держит. Края шкалы — мёртвая вода и шторм — бьют по всем и не смотрят на защиту.',
      en: 'The shallows are next. The map only goes forward. At the end of each of your turns the tide rises by 1, unless an anchor holds it. The edges — dead water and storm — hit everyone and ignore block.',
    },
    button: { ru: 'В рейс', en: 'Cast off' },
  },
  act1: {
    title: { ru: 'Мелководье', en: 'The Shallows' },
    body: {
      ru: 'Гильдия Колоколов проверяет, держат ли ваши узлы воду. В конце пути Страж ламинарии. Он бьёт тем сильнее, чем ниже прилив, а на паводке зовёт плети.',
      en: 'The Guild of Bells is checking whether your knots hold water. At the end of the route is the Kelp Warden. He hits harder the lower the tide, and calls lashes in the flood.',
    },
    button: { ru: 'На карту', en: 'To the chart' },
  },
  act2: {
    title: { ru: 'Ночной рынок', en: 'Night Market' },
    body: {
      ru: 'Здесь всё имеет цену, включая ваш последний узел. Мадам Колокол повторяет его на своём звоне. Слабая карта перед звоном — честный ответ.',
      en: 'Everything here has a price, including your last knot. Madam Bell repeats it on her chime. A small card before the bell is an honest answer.',
    },
    button: { ru: 'К причалу', en: 'To the dock' },
  },
  act3: {
    title: { ru: 'Желоб', en: 'The Trench' },
    body: {
      ru: 'Луна лежит на дне и дышит штормом. Трижды впустите шторм — и её четвёртый такт станет глотком. Держите воду ниже 6, когда она смотрит.',
      en: 'The moon lies on the bottom and breathes storm. Let the storm in three times and her fourth beat becomes a swallow. Keep the water under 6 when she looks.',
    },
    button: { ru: 'Вниз', en: 'Down' },
  },
};

export function RewardScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const reward = state.reward;
  const run = state.run;
  if (!reward || !run) return null;
  return (
    <section className="screen reward" data-testid="reward">
      <RunMenuButton lang={lang} />
      <p className="kicker">{tx(lang, 'После боя', 'After the fight')}</p>
      <h1 className="reward-title">
        +{reward.gold} {tx(lang, 'монет', 'coins')}
        {reward.heal > 0 ? ` · ${tx(lang, 'лечение', 'heal')} ${reward.heal}` : ''}
      </h1>
      {reward.eliteRelic && RELICS[reward.eliteRelic] && (
        <p className="prose">
          {tx(lang, 'Реликвия', 'Relic')}: {tr(RELICS[reward.eliteRelic].name, lang)} — {tr(RELICS[reward.eliteRelic].text, lang)}
        </p>
      )}
      <div className="card-grid">
        {reward.cards.map((id) => (
          <CardFace
            key={id}
            id={id}
            lang={lang}
            dim={reward.cardTaken}
            disabled={reward.cardTaken}
            onClick={() => dispatch({ type: 'pickCard', id })}
          />
        ))}
      </div>
      {reward.cardTaken && <p className="fine">{tx(lang, 'Узел уже в колоде.', 'The knot is in the deck.')}</p>}
      {!reward.cardTaken && (
        <button type="button" className="ghost" onClick={() => dispatch({ type: 'pickCard', id: null })}>
          {tx(lang, 'Ничего не брать', 'Take nothing')}
        </button>
      )}
      {reward.bossRelics && !reward.relicTaken && (
        <>
          <h2>{tx(lang, 'Выберите реликвию', 'Choose a relic')}</h2>
          <div className="choices">
            {reward.bossRelics.map((id) => (
              <button key={id} type="button" onClick={() => dispatch({ type: 'pickRelic', id })}>
                <strong>{RELICS[id] ? tr(RELICS[id].name, lang) : id}</strong>
                <small>{RELICS[id] ? tr(RELICS[id].text, lang) : ''}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" data-testid="leave-reward" disabled={!reward.cardTaken || !reward.relicTaken} onClick={() => dispatch({ type: 'leaveReward' })}>
        {tx(lang, 'Дальше', 'Onward')}
      </button>
      <CoachMarks tour="reward" lang={lang} />
    </section>
  );
}

export function RestScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const run = state.run;
  const [mode, setMode] = useState<null | 'upgrade' | 'attune'>(null);
  if (!run) return null;
  const heal = Math.max(12, Math.round(run.maxHp * 0.3)) + (run.relics.includes('dry_map') ? 10 : 0);
  const ups = run.deck.filter((c) => CARDS[c.id]?.up && !c.up && CARDS[c.id].rarity !== 'curse');
  return (
    <section className="screen rest" data-testid="rest">
      <RunMenuButton lang={lang} />
      <p className="kicker">{tx(lang, 'Тихая стоянка', 'A quiet berth')}</p>
      <h1>{tx(lang, 'Можно сделать одно', 'You can do one thing')}</h1>
      {!mode && (
        <div className="choices">
          <button type="button" onClick={() => dispatch({ type: 'restHeal' })}>
            <strong>{tx(lang, 'Чинить корпус', 'Repair the hull')}</strong>
            <small>
              +{heal} {tx(lang, 'корпуса', 'hull')}
            </small>
          </button>
          <button type="button" onClick={() => setMode('upgrade')} disabled={!ups.length}>
            <strong>{tx(lang, 'Затянуть узел', 'Tighten a knot')}</strong>
            <small>{tx(lang, 'Улучшить карту', 'Upgrade a card')}</small>
          </button>
          <button type="button" onClick={() => setMode('attune')}>
            <strong>{tx(lang, 'Настроить воду', 'Set the water')}</strong>
            <small>{tx(lang, 'Следующий бой начнётся на выбранной отметке', 'The next fight starts at a chosen mark')}</small>
          </button>
        </div>
      )}
      {mode === 'upgrade' && (
        <Picker cards={ups} lang={lang} onPick={(uid) => dispatch({ type: 'restUpgrade', uid })} onCancel={() => setMode(null)} />
      )}
      {mode === 'attune' && (
        <div className="choices">
          {[1, 4, 6].map((tide) => (
            <button key={tide} type="button" onClick={() => dispatch({ type: 'restAttune', tide })}>
              {tx(lang, `Прилив ${tide}`, `Tide ${tide}`)}
            </button>
          ))}
          <button type="button" className="ghost" onClick={() => setMode(null)}>
            {tx(lang, 'Назад', 'Back')}
          </button>
        </div>
      )}
      <CoachMarks tour="rest" lang={lang} enabled={!mode} />
    </section>
  );
}

export function ShopScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const run = state.run;
  const shop = state.shop;
  const [removing, setRemoving] = useState(false);
  if (!run || !shop) return null;
  return (
    <section className="screen shop" data-testid="shop">
      <RunMenuButton lang={lang} />
      <header className="topbar">
        <div>
          <p className="kicker">{tx(lang, 'Лавка', 'Shop')}</p>
          <h1>{tx(lang, 'Берите, пока прилив не ушёл', 'Buy before the tide leaves')}</h1>
        </div>
        <HudStats hp={run.hp} maxHp={run.maxHp} gold={run.gold} lang={lang} />
      </header>
      {!removing && (
        <>
          <div className="card-grid">
            {shop.cards.map((offer, index) => (
              <div key={offer.id + index} className={offer.sold ? 'sold' : ''}>
                <CardFace id={offer.id} lang={lang} dim={offer.sold || run.gold < offer.price} disabled={offer.sold || run.gold < offer.price} onClick={() => dispatch({ type: 'shopBuyCard', index })} />
                <button type="button" disabled={offer.sold || run.gold < offer.price} onClick={() => dispatch({ type: 'shopBuyCard', index })}>
                  {offer.sold ? tx(lang, 'Продано', 'Sold') : offer.price}
                </button>
              </div>
            ))}
          </div>
          <div className="choices">
            {shop.relics.map((offer, index) => (
              <button key={offer.id} type="button" disabled={offer.sold || run.gold < offer.price} onClick={() => dispatch({ type: 'shopBuyRelic', index })}>
                <strong>
                  {RELICS[offer.id] ? tr(RELICS[offer.id].name, lang) : offer.id} · {offer.price}
                </strong>
                <small>{RELICS[offer.id] ? tr(RELICS[offer.id].text, lang) : ''}</small>
              </button>
            ))}
            {shop.phials.map((offer, index) => (
              <button key={offer.id + index} type="button" disabled={offer.sold || run.gold < offer.price || !run.phials.some((p) => !p)} onClick={() => dispatch({ type: 'shopBuyPhial', index })}>
                <strong>
                  {tr(PHIALS[offer.id].name, lang)} · {offer.price}
                </strong>
                <small>{tr(PHIALS[offer.id].text, lang)}</small>
              </button>
            ))}
          </div>
          <div className="row-actions">
            <button type="button" data-testid="shop-remove" onClick={() => setRemoving(true)} disabled={run.gold < removePrice(run)}>
              {tx(lang, 'Вырезать карту', 'Cut a card')} · {removePrice(run)}
            </button>
            <button type="button" className="ghost" data-testid="shop-leave" onClick={() => dispatch({ type: 'shopLeave' })}>
              {tx(lang, 'Уйти', 'Leave')}
            </button>
          </div>
        </>
      )}
      {removing && (
        <Picker
          cards={pickerCards(run, 'remove')}
          lang={lang}
          onPick={(uid) => {
            dispatch({ type: 'shopRemove', uid });
            setRemoving(false);
          }}
          onCancel={() => setRemoving(false)}
        />
      )}
      <CoachMarks tour="shop" lang={lang} enabled={!removing} />
    </section>
  );
}

export function EventScreen() {
  const state = useGame();
  const lang = state.meta.settings.lang;
  const event = state.eventId ? EVENTS[state.eventId] : null;
  const run = state.run;
  if (!event || !run) return null;
  return (
    <section className="screen event" data-testid="event">
      <RunMenuButton lang={lang} />
      <p className="kicker">{tx(lang, 'На воде', 'On the water')}</p>
      <h1>{tr(event.title, lang)}</h1>
      <p className="prose">{tr(event.body, lang)}</p>
      {!state.picker && (
        <div className="choices">
          {event.choices.map((choice, index) => (
            <button
              key={choice.text.ru}
              type="button"
              data-testid="event-choice"
              disabled={!!eventChoiceBlock(state, index)}
              onClick={() => dispatch({ type: 'eventChoose', index })}
            >
              <strong>{tr(choice.text, lang)}</strong>
              <small>{tr(choice.hint, lang)}</small>
              {eventChoiceBlock(state, index) && <small className="why">{tr(eventChoiceBlock(state, index)!, lang)}</small>}
            </button>
          ))}
        </div>
      )}
      {state.picker && (
        <>
        <h2>
          {state.picker.mode === 'remove'
            ? tx(lang, 'Какой узел отдать', 'Which knot to give up')
            : state.picker.mode === 'upgrade'
              ? tx(lang, 'Какой узел затянуть', 'Which knot to tighten')
              : state.picker.mode === 'duplicate'
                ? tx(lang, 'С чего снять копию', 'Which knot to copy')
                : tx(lang, 'Какой узел переписать', 'Which knot to rewrite')}
        </h2>
        <Picker
          cards={pickerCards(run, state.picker.mode)}
          lang={lang}
          onPick={(uid) => dispatch({ type: 'pickerPick', uid })}
          onCancel={() => dispatch({ type: 'pickerCancel' })}
        />
        </>
      )}
      <RelicRow ids={run.relics} lang={lang} />
    </section>
  );
}

function Picker({
  cards,
  lang,
  onPick,
  onCancel,
}: {
  cards: CardInst[];
  lang: import('../game/types').Lang;
  onPick: (uid: string) => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="card-grid">
        {cards.map((card) => (
          <CardFace key={card.uid} id={card.id} upgraded={card.up} lang={lang} onClick={() => onPick(card.uid)} />
        ))}
      </div>
      <button type="button" className="ghost" onClick={onCancel}>
        {tx(lang, 'Назад', 'Back')}
      </button>
    </div>
  );
}
