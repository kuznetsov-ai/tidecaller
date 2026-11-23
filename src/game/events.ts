import type { L } from './types';

export interface EventChoice {
  text: L;
  hint: L;
}

export interface EventDef {
  id: string;
  title: L;
  body: L;
  choices: EventChoice[];
}

export const EVENT_LIST: EventDef[] = [
  {
    id: 'bottle',
    title: { ru: 'Письмо в бутылке', en: 'Letter in a Bottle' },
    body: {
      ru: 'Бутылка стучит о борт. Внутри — чужой узел, сложенный так аккуратно, что жалко разворачивать. Можно продать стекло, не читая.',
      en: 'A bottle knocks the hull. Inside is someone else’s knot, folded so neatly it feels rude to open. You could sell the glass unread.',
    },
    choices: [
      {
        text: { ru: 'Забрать редкий узел', en: 'Take the rare knot' },
        hint: { ru: 'Случайная редкая карта в колоду.', en: 'A random rare card joins the deck.' },
      },
      {
        text: { ru: 'Продать стекло', en: 'Sell the glass' },
        hint: { ru: '+35 монет.', en: '+35 coins.' },
      },
      {
        text: { ru: 'Выпить то, что внутри', en: 'Drink whatever is inside' },
        hint: { ru: 'Восстановить 12 корпуса.', en: 'Heal 12 hull.' },
      },
    ],
  },
  {
    id: 'wreck',
    title: { ru: 'Остов «Мэрри»', en: 'Wreck of the Merry' },
    body: {
      ru: 'На мачте ещё висит имя. В трюме что-то блестит, но палуба проваливается под сапогом.',
      en: 'The name is still on the mast. Something glints in the hold, and the deck gives under a boot.',
    },
    choices: [
      {
        text: { ru: 'Спуститься за блеском', en: 'Go down for the glint' },
        hint: { ru: 'Потерять 10 корпуса. Получить реликвию.', en: 'Lose 10 hull. Gain a relic.' },
      },
      {
        text: { ru: 'Снять медные гвозди', en: 'Pull the copper nails' },
        hint: { ru: '+28 монет.', en: '+28 coins.' },
      },
      {
        text: { ru: 'Отдать честь и уйти', en: 'Salute and leave' },
        hint: { ru: 'Ничего.', en: 'Nothing.' },
      },
    ],
  },
  {
    id: 'choir',
    title: { ru: 'Хор на камнях', en: 'Choir on the Rocks' },
    body: {
      ru: 'Три фигуры поют без слов. Они кивают на вашу колоду: один узел лишний, один можно затянуть туже, а можно отдать им голос и получить корпус.',
      en: 'Three figures sing without words. They nod at your deck: one knot is spare, one can be pulled tighter, or you can give them a voice and take hull.',
    },
    choices: [
      {
        text: { ru: 'Отдать лишний узел', en: 'Give up a spare knot' },
        hint: { ru: 'Удалить карту.', en: 'Remove a card.' },
      },
      {
        text: { ru: 'Затянуть узел туже', en: 'Pull a knot tighter' },
        hint: { ru: 'Улучшить карту.', en: 'Upgrade a card.' },
      },
      {
        text: { ru: 'Отдать им пробоину', en: 'Give them a hole' },
        hint: { ru: 'Проклятие «Пробоина». Максимум корпуса +16.', en: 'Gain a Hole. Max hull +16.' },
      },
    ],
  },
  {
    id: 'smuggler',
    title: { ru: 'Фонарь контрабандиста', en: 'Smuggler’s Lamp' },
    body: {
      ru: 'Фонарь горит синим и не отражается в воде. Хозяин не называет цену вслух — она и так написана у вас на кошельке.',
      en: 'The lamp burns blue and does not reflect in the water. The owner does not say the price aloud. It is already written on your purse.',
    },
    choices: [
      {
        text: { ru: 'Заказать копию узла', en: 'Order a copy of a knot' },
        hint: { ru: 'Заплатить 35. Снять копию карты.', en: 'Pay 35. Duplicate a card.' },
      },
      {
        text: { ru: 'Взять склянку', en: 'Take a phial' },
        hint: { ru: 'Случайная склянка, если есть слот. Иначе 15 монет.', en: 'A random phial if a slot is free, otherwise 15 coins.' },
      },
      {
        text: { ru: 'Понюхать фитиль', en: 'Sniff the wick' },
        hint: { ru: 'Потерять 8 корпуса. Необычная карта.', en: 'Lose 8 hull. Gain an uncommon card.' },
      },
    ],
  },
  {
    id: 'pool',
    title: { ru: 'Тихая заводь', en: 'Still Pool' },
    body: {
      ru: 'Вода здесь стоит на отметке, которую вы выберете сами. До следующего боя она запомнит.',
      en: 'The water here will stand at the mark you choose. It will remember until the next fight.',
    },
    choices: [
      {
        text: { ru: 'Просто попить', en: 'Just drink' },
        hint: { ru: 'Восстановить 25% корпуса.', en: 'Heal 25% hull.' },
      },
      {
        text: { ru: 'Оставить заводь низкой', en: 'Leave the pool low' },
        hint: { ru: 'Следующий бой начнётся на приливе 1.', en: 'The next combat starts at tide 1.' },
      },
      {
        text: { ru: 'Оставить заводь высокой', en: 'Leave the pool high' },
        hint: { ru: 'Следующий бой начнётся на приливе 6.', en: 'The next combat starts at tide 6.' },
      },
    ],
  },
  {
    id: 'shrine',
    title: { ru: 'Утонувший алтарь', en: 'Drowned Shrine' },
    body: {
      ru: 'На алтаре нет бога, только чаша. Чаша хочет корпус. Взамен отдаёт вещь, которая помнит луну.',
      en: 'There is no god on the shrine, only a bowl. The bowl wants hull. In return it gives a thing that remembers the moon.',
    },
    choices: [
      {
        text: { ru: 'Наполнить чашу', en: 'Fill the bowl' },
        hint: { ru: 'Потерять 14 корпуса. Получить реликвию.', en: 'Lose 14 hull. Gain a relic.' },
      },
      {
        text: { ru: 'Помолиться шёпотом', en: 'Pray in a whisper' },
        hint: { ru: 'Если есть проклятие — снять его. Иначе +20 монет.', en: 'Remove a curse if you have one. Otherwise +20 coins.' },
      },
    ],
  },
  {
    id: 'argument',
    title: { ru: 'Спор на причале', en: 'Argument on the Dock' },
    body: {
      ru: 'Двое уже достали узлы. Третий смотрит на вас и говорит: либо вы в этом споре, либо вы его оплачиваете.',
      en: 'Two of them have already drawn knots. The third looks at you and says you are either in the argument or paying for it.',
    },
    choices: [
      {
        text: { ru: 'Вмешаться', en: 'Step in' },
        hint: { ru: 'Бой с элитой.', en: 'Fight an elite.' },
      },
      {
        text: { ru: 'Заплатить за тишину', en: 'Pay for quiet' },
        hint: { ru: '−20 монет. Если монет меньше и в колоде больше 5 карт — пропадёт случайная карта (не проклятие).', en: '−20 coins. If you have less and more than 5 cards, a random non-curse card leaves the deck.' },
      },
    ],
  },
  {
    id: 'cartographer',
    title: { ru: 'Призрак картографа', en: 'Cartographer’s Ghost' },
    body: {
      ru: 'Он водит пальцем по воздуху и расстраивается, что берег уехал. Сухая карта у него за пазухой всё ещё сухая.',
      en: 'He traces the air with a finger and is upset that the coast has moved. The map inside his coat is still dry.',
    },
    choices: [
      {
        text: { ru: 'Взять сухую карту', en: 'Take the dry map' },
        hint: { ru: 'Реликвия «Сухая карта» или 40 монет, если она уже есть.', en: 'The Dry Map relic, or 40 coins if you already have it.' },
      },
      {
        text: { ru: 'Попросить тишины', en: 'Ask for quiet' },
        hint: { ru: 'Восстановить 10 корпуса.', en: 'Heal 10 hull.' },
      },
    ],
  },
  {
    id: 'eel',
    title: { ru: 'Щедрый угорь', en: 'The Generous Eel' },
    body: {
      ru: 'Угорь выкладывает монеты кругами. В центре круга сидит балянус и делает вид, что это подарок.',
      en: 'The eel lays coins out in rings. A barnacle sits in the middle and pretends it is a gift.',
    },
    choices: [
      {
        text: { ru: 'Взять круг целиком', en: 'Take the whole ring' },
        hint: { ru: '+55 монет и проклятие «Балянус».', en: '+55 coins and a Barnacle curse.' },
      },
      {
        text: { ru: 'Отдать узел', en: 'Give a knot' },
        hint: { ru: 'Удалить карту. +25 монет.', en: 'Remove a card. +25 coins.' },
      },
    ],
  },
  {
    id: 'moonwell',
    title: { ru: 'Лунный колодец', en: 'Moonwell' },
    body: {
      ru: 'Колодец без дна показывает карты так, как они могли бы быть затянуты. Два узла — или один, переписанный заново.',
      en: 'A well with no bottom shows your cards as they might be tied. Two knots, or one written over.',
    },
    choices: [
      {
        text: { ru: 'Затянуть два узла', en: 'Tighten two knots' },
        hint: { ru: 'Улучшить две карты.', en: 'Upgrade two cards.' },
      },
      {
        text: { ru: 'Переписать один', en: 'Rewrite one' },
        hint: { ru: 'Заменить карту на случайную редкую.', en: 'Transform a card into a random rare.' },
      },
    ],
  },
];

export const EVENTS: Record<string, EventDef> = Object.fromEntries(EVENT_LIST.map((e) => [e.id, e]));
