import type { RelicDef } from './types';

export const RELIC_LIST: RelicDef[] = [
  {
    id: 'copper_buoy',
    starter: true,
    name: { ru: 'Медный буй', en: 'Copper Buoy' },
    text: {
      ru: 'Первая карта за бой, сыгранная в своей стихии, даёт взять 1 карту.',
      en: 'The first card each combat played in its own element draws 1.',
    },
  },
  {
    id: 'storm_nail',
    starter: true,
    name: { ru: 'Штормовой гвоздь', en: 'Storm Nail' },
    text: {
      ru: 'Первый раз за бой, когда ваша карта поднимает прилив в паводок (5+), получите 1 силы.',
      en: 'The first time each combat your card pushes the tide into flood (5+), gain 1 strength.',
    },
  },
  {
    id: 'lantern_wick',
    starter: true,
    name: { ru: 'Фитиль фонаря', en: 'Lantern Wick' },
    text: {
      ru: 'Первый раз за бой, когда прилив входит в мёртвую воду (0–1), восстановите 3 корпуса.',
      en: 'The first time each combat the tide enters dead water (0–1), heal 3.',
    },
  },
  {
    id: 'salt_compass',
    name: { ru: 'Соляной компас', en: 'Salt Compass' },
    text: {
      ru: 'Когда прилив за ваш ход сдвигается сразу на 2 или больше, возьмите 1 карту. Раз за ход.',
      en: 'When the tide moves by 2 or more during your turn, draw 1. Once a turn.',
    },
  },
  {
    id: 'pearl_ear',
    name: { ru: 'Жемчужное ухо', en: 'Pearl Ear' },
    text: {
      ru: 'Карта штиля, сыгранная в штиле, даёт 3 защиты.',
      en: 'A slack card played while the tide is slack grants 3 block.',
    },
  },
  {
    id: 'rusted_anchor',
    name: { ru: 'Ржавый якорь', en: 'Rusted Anchor' },
    text: {
      ru: 'В чётные ходы прилив сам не поднимается.',
      en: 'On even turns the tide does not rise by itself.',
    },
  },
  {
    id: 'merchant_teeth',
    name: { ru: 'Зубы скупщика', en: 'Merchant’s Teeth' },
    text: {
      ru: 'Цены в лавке ниже на 25%.',
      en: 'Shop prices are 25% lower.',
    },
  },
  {
    id: 'kelp_heart',
    name: { ru: 'Сердце ламинарии', en: 'Kelp Heart' },
    text: {
      ru: 'Максимум корпуса +8.',
      en: 'Max hull +8.',
    },
  },
  {
    id: 'glass_moon',
    name: { ru: 'Стеклянная луна', en: 'Glass Moon' },
    text: {
      ru: 'Первый раз за бой, когда прилив вошёл бы в шторм, он становится 4, а все враги получают 8 урона.',
      en: 'The first time each combat the tide would enter storm, set it to 4 and deal 8 to all enemies.',
    },
  },
  {
    id: 'bloodwake',
    name: { ru: 'Кровавый кильватер', en: 'Bloodwake' },
    text: {
      ru: 'Когда удар врага снимает корпус, наложите на этого врага 2 соли.',
      en: 'When an enemy hit removes hull, apply 2 salt to that enemy.',
    },
  },
  {
    id: 'choir_shell',
    name: { ru: 'Раковина хора', en: 'Choir Shell' },
    text: {
      ru: 'Вы накладываете на 1 соль больше.',
      en: 'Salt you apply is increased by 1.',
    },
  },
  {
    id: 'dry_map',
    name: { ru: 'Сухая карта', en: 'Dry Map' },
    text: {
      ru: 'Отдых лечит на 10 корпуса больше.',
      en: 'Rest sites heal 10 more hull.',
    },
  },
  {
    id: 'twin_hooks',
    name: { ru: 'Парные крюки', en: 'Twin Hooks' },
    text: {
      ru: 'Первый удар за ход наносит на 4 урона больше.',
      en: 'Your first attack each turn deals 4 more damage.',
    },
  },
  {
    id: 'wreck_candle',
    name: { ru: 'Свеча с остова', en: 'Wreck Candle' },
    text: {
      ru: 'В первый ход боя возьмите на 1 карту больше.',
      en: 'Draw 1 extra card on turn 1 of each combat.',
    },
  },
  {
    id: 'brine_flask',
    name: { ru: 'Фляга рассола', en: 'Brine Flask' },
    text: {
      ru: 'В начале боя получите склянку «Родник», если есть пустой слот.',
      en: 'At the start of combat, gain a Springwater phial if a slot is empty.',
    },
  },
  {
    id: 'counterweight',
    name: { ru: 'Противовес', en: 'Counterweight' },
    text: {
      ru: 'Карта, которая двигает прилив, даёт 3 защиты.',
      en: 'A card that moves the tide also grants 3 block.',
    },
  },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(RELIC_LIST.map((r) => [r.id, r]));

export function droppableRelics(owned: string[]): RelicDef[] {
  return RELIC_LIST.filter((r) => !r.starter && !owned.includes(r.id));
}
