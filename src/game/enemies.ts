import type { CombatState, EnemyDef, EnemyInst, L, RawIntent } from './types';

const atk = (n: number, extra: Partial<RawIntent> = {}): RawIntent => ({ kind: 'attack', n, ...extra });
const blk = (n: number): RawIntent => ({ kind: 'block', n });
const tide = (n: number): RawIntent => ({ kind: 'tide', n });

function warden(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) {
    const kelps = c.enemies.filter((x) => x.defId === 'kelp_minion' && x.hp > 0).length;
    if (c.tide >= 5 && kelps < 2) return [{ kind: 'summon', id: 'kelp_minion', n: 0 }];
    return [atk(10)];
  }
  if (beat === 1) return [atk(c.tide <= 3 ? 16 : 11)];
  return [tide(-2), blk(10)];
}

function knight(_e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = _e.pi % 2;
  if (beat === 0) return [blk(12), tide(-1)];
  return [atk(c.tide >= 5 ? 20 : 14)];
}

function merchant(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  const played = c.phase === 'player' ? c.cardsPlayed : c.cardsPlayedLast;
  if (beat === 0) return [atk(played >= 3 ? 16 : 7)];
  if (beat === 1) return [blk(8), tide(1)];
  return [atk(6), { kind: 'salt', n: 3 }];
}

function shark(e: EnemyInst): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [atk(10)];
  if (beat === 1) return [tide(1), { kind: 'strength', n: 1 }];
  return [atk(8)];
}

function auctioneer(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [atk(14)];
  if (beat === 1) return c.gold >= 25 ? [blk(14)] : [atk(10)];
  return [tide(1), atk(9)];
}

function madam(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [atk(11)];
  if (beat === 1) {
    const echo = c.echo;
    if (!echo || echo.kind === 'blank') return [atk(4)];
    if (echo.kind === 'damage') return [atk(Math.max(4, echo.n))];
    if (echo.kind === 'block') return [blk(echo.n)];
    if (echo.kind === 'salt') return [{ kind: 'salt', n: echo.n }];
    return [tide(-echo.n)];
  }
  return [atk(7), { kind: 'salt', n: 3 }];
}

function saint(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return c.tide >= 5 ? [atk(18)] : [atk(8), tide(1)];
  if (beat === 1) return [blk(12)];
  return [atk(11)];
}

function lantern(e: EnemyInst): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [atk(14, { hidden: true })];
  if (beat === 1) return [{ kind: 'salt', n: 5, hidden: true }];
  return [atk(8), tide(1)];
}

function whale(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [blk(16)];
  if (beat === 1) return [atk(20)];
  const raw: RawIntent[] = [{ kind: 'tideSet', n: 7 }];
  if (c.tide >= 7) raw.push({ kind: 'heal', n: 12 });
  return raw;
}

function depth(e: EnemyInst): RawIntent[] {
  const beat = e.pi % 3;
  if (beat === 0) return [atk(16, { pierce: 0.5 })];
  if (beat === 1) return [tide(-1), atk(10)];
  return [blk(14)];
}

function moon(e: EnemyInst, c: CombatState): RawIntent[] {
  const beat = e.pi % 4;
  if (beat === 0) return [tide(-2), atk(6, { pierce: 1 })];
  if (beat === 1) return [atk(16)];
  if (beat === 2) return [{ kind: 'salt', n: 4 }, { kind: 'curse', id: 'soaked_chart', n: 0 }];
  const angry = c.tide >= 6 || e.doom >= 3;
  if (angry) return [atk(26), { kind: 'heal', n: 12 }];
  return [atk(12)];
}

function named(
  id: string,
  name: L,
  hp: [number, number],
  art: string,
  tip: L,
  pattern: RawIntent[][],
  extra: Partial<EnemyDef> = {},
): EnemyDef {
  return { id, name, hp, art, tip, pattern, ...extra };
}

export const ENEMY_LIST: EnemyDef[] = [
  named(
    'tutor_gull',
    { ru: 'Учебная чайка', en: 'Practice Gull' },
    [24, 24],
    'gull',
    { ru: 'Бьёт слабо и ровно. На ней учатся узлы.', en: 'Hits lightly and evenly. A knot lesson.' },
    [[atk(4)]],
    { hidden: true },
  ),
  named(
    'gullthief',
    { ru: 'Чайка-воровка', en: 'Gullthief' },
    [26, 32],
    'gull',
    { ru: 'Короткий клюв, длинный интерес к вашим картам. Сама вода её мало занимает.', en: 'A short beak and a long interest in your cards.' },
    [[atk(6)], [atk(4), tide(1)], [blk(6)]],
  ),
  named(
    'brinecrab',
    { ru: 'Рассольный краб', en: 'Brinecrab' },
    [34, 40],
    'crab',
    { ru: 'Сначала прячется, потом щиплет солью.', en: 'Hides first, then pinches with salt.' },
    [[blk(8)], [atk(10)], [atk(6), { kind: 'salt', n: 2 }]],
  ),
  named(
    'kelppup',
    { ru: 'Поросток ламинарии', en: 'Kelp Pup' },
    [13, 16],
    'kelp',
    { ru: 'Маленький. Вдвоём уже разговор.', en: 'Small. Two of them is a conversation.' },
    [[atk(4)], [atk(5)], [blk(4)]],
  ),
  named(
    'kelp_minion',
    { ru: 'Плеть ламинарии', en: 'Kelp Lash' },
    [13, 13],
    'kelp',
    { ru: 'Страж поднимает её только на высокой воде.', en: 'The warden raises it only on high water.' },
    [[atk(5)], [atk(5)]],
    { token: true },
  ),
  named(
    'netwraith',
    { ru: 'Сетевой призрак', en: 'Netwraith' },
    [30, 36],
    'wraith',
    { ru: 'Бросает петлю в руку. Петля живёт один ход.', en: 'Throws a snag into your hand. It lasts one turn.' },
    [[{ kind: 'snag', n: 0 }], [atk(10)], [atk(6), tide(-1)]],
  ),
  {
    id: 'salt_knight',
    name: { ru: 'Соляной рыцарь', en: 'Salt Knight' },
    hp: [64, 70],
    art: 'knight',
    elite: true,
    tip: {
      ru: 'Закрывается и тянет воду вниз, потом бьёт. На паводке удар тяжелее.',
      en: 'He closes and pulls the water down, then strikes. The hit is heavier in flood.',
    },
    script: knight,
  },
  {
    id: 'kelp_warden',
    name: { ru: 'Страж ламинарии', en: 'Kelp Warden' },
    hp: [102, 102],
    art: 'warden',
    boss: true,
    tip: {
      ru: 'На паводке зовёт плети. Удар сильнее на отливе. Третий такт тянет воду вниз.',
      en: 'Summons lashes in flood. The slam is harder on the ebb. The third beat pulls the water down.',
    },
    script: warden,
  },
  named(
    'ledger_eel',
    { ru: 'Угорь-бухгалтер', en: 'Ledger Eel' },
    [48, 56],
    'eel',
    { ru: 'Один из ударов списывает соль-монеты, если пробил корпус.', en: 'One of its hits docks coins if it breaks hull.' },
    [[atk(11)], [atk(8, { gold: 6 })], [blk(10)]],
  ),
  {
    id: 'bell_merchant',
    name: { ru: 'Колокольный скупщик', en: 'Bell Merchant' },
    hp: [46, 52],
    art: 'merchant',
    tip: {
      ru: 'Если в прошлый ход вы сыграли 3 карты и больше, его удар тяжелеет.',
      en: 'If you played 3 or more cards last turn, his strike gets heavy.',
    },
    script: merchant,
  },
  named(
    'chorister',
    { ru: 'Утонувший хорист', en: 'Drowned Chorister' },
    [48, 54],
    'choir',
    { ru: 'Соль капает почти каждый такт. Защита её не держит.', en: 'Salt drips almost every beat. Block does not hold it.' },
    [[{ kind: 'salt', n: 2 }], [atk(9)], [atk(6), { kind: 'salt', n: 1 }], [blk(8)]],
  ),
  {
    id: 'contract_shark',
    name: { ru: 'Контрактная акула', en: 'Contract Shark' },
    hp: [54, 62],
    art: 'shark',
    tip: {
      ru: 'Каждый её толчок воды прибавляет силу. Не помогайте ей поднимать прилив.',
      en: 'Each push of the water adds strength. Do not help it raise the tide.',
    },
    script: shark,
  },
  named(
    'reef_gull',
    { ru: 'Рифовая чайка', en: 'Reef Gull' },
    [28, 32],
    'gull',
    { ru: 'Два коротких клюва вместо одного длинного.', en: 'Two short pecks instead of one long one.' },
    [[atk(5, { hits: 2 })], [atk(8)], [blk(5)]],
  ),
  {
    id: 'auctioneer',
    name: { ru: 'Аукционист', en: 'The Auctioneer' },
    hp: [82, 90],
    art: 'auction',
    elite: true,
    tip: {
      ru: 'Пока у вас много монет, он закрывается щитом. Пустой кошель делает его злее и проще.',
      en: 'While you are rich he hides behind a shield. An empty purse makes him meaner and simpler.',
    },
    script: auctioneer,
  },
  {
    id: 'madam_bell',
    name: { ru: 'Мадам Колокол', en: 'Madam Bell' },
    hp: [148, 148],
    art: 'madam',
    boss: true,
    tip: {
      ru: 'На втором такте повторяет ваш последний узел. Слабая карта перед звоном — это ответ.',
      en: 'On the second beat she repeats your last knot. A small card before the chime is the answer.',
    },
    script: madam,
  },
  {
    id: 'pressure_saint',
    name: { ru: 'Святой давления', en: 'Pressure Saint' },
    hp: [60, 68],
    art: 'saint',
    tip: {
      ru: 'На паводке бьёт в полную силу. Ниже — бьёт слабее и сам толкает воду вверх.',
      en: 'In flood he hits at full weight. Below that he hits lighter and pushes the water up.',
    },
    script: saint,
  },
  {
    id: 'blind_lantern',
    name: { ru: 'Слепой фонарь', en: 'Blind Lantern' },
    hp: [56, 64],
    art: 'lantern',
    tip: {
      ru: 'Два такта прячет намерение: сначала удар, потом соль, потом честный удар и толчок воды.',
      en: 'Two beats hide the intent: a hit, then salt, then an honest hit and a push.',
    },
    script: lantern,
  },
  named(
    'abyss_notary',
    { ru: 'Нотариус бездны', en: 'Abyss Notary' },
    [58, 66],
    'notary',
    { ru: 'Подшивает в колоду пробоину. Её лучше вырезать в лавке.', en: 'Files a hole into your deck. Cut it out at a shop.' },
    [[{ kind: 'curse', id: 'hole', n: 0 }, atk(6)], [atk(13)], [blk(10)]],
  ),
  {
    id: 'glass_whale',
    name: { ru: 'Стеклянный кит', en: 'Glass Whale' },
    hp: [76, 84],
    art: 'whale',
    tip: {
      ru: 'Медленный. На третьем такте ставит шторм. Если шторм уже был — лечится.',
      en: 'Slow. On the third beat it sets a storm. If a storm is already up, it heals.',
    },
    script: whale,
  },
  {
    id: 'debt_of_depth',
    name: { ru: 'Долг глубины', en: 'Debt of Depth' },
    hp: [100, 108],
    art: 'depth',
    elite: true,
    tip: {
      ru: 'Пока прилив 3 и ниже, ваши карты стоят на 1 больше. Удар пробивает половину защиты.',
      en: 'While the tide is 3 or lower, your cards cost 1 more. The strike ignores half your block.',
    },
    script: depth,
  },
  {
    id: 'moon',
    name: { ru: 'Луна внизу', en: 'The Moon Below' },
    hp: [188, 188],
    art: 'moon',
    boss: true,
    tip: {
      ru: 'Четыре такта. На четвёртом, если вода 6+ или шторм входил трижды, удар становится глотком.',
      en: 'Four beats. On the fourth, if the water is 6+ or storm has entered three times, the hit becomes a swallow.',
    },
    script: moon,
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(ENEMY_LIST.map((e) => [e.id, e]));

export function rawIntents(enemy: EnemyInst, combat: CombatState): RawIntent[] {
  const def = ENEMIES[enemy.defId];
  if (!def) return [];
  if (def.script) return def.script(enemy, combat);
  const pattern = def.pattern ?? [[{ kind: 'attack', n: 4 }]];
  return pattern[enemy.pi % pattern.length];
}

export const ENCOUNTERS: Record<1 | 2 | 3, Record<'combat' | 'elite' | 'boss', string[][]>> = {
  1: {
    combat: [
      ['gullthief'],
      ['brinecrab'],
      ['gullthief', 'kelppup'],
      ['netwraith'],
      ['kelppup', 'kelppup'],
      ['brinecrab', 'kelppup'],
    ],
    elite: [['salt_knight']],
    boss: [['kelp_warden']],
  },
  2: {
    combat: [
      ['ledger_eel'],
      ['bell_merchant'],
      ['chorister'],
      ['contract_shark'],
      ['reef_gull', 'reef_gull'],
      ['ledger_eel', 'reef_gull'],
    ],
    elite: [['auctioneer']],
    boss: [['madam_bell']],
  },
  3: {
    combat: [
      ['pressure_saint'],
      ['blind_lantern'],
      ['abyss_notary'],
      ['glass_whale'],
      ['pressure_saint', 'blind_lantern'],
      ['abyss_notary', 'pressure_saint'],
    ],
    elite: [['debt_of_depth']],
    boss: [['moon']],
  },
};
