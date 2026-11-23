import type { L, Lang } from '../game/types';

export function tx(lang: Lang, ru: string, en: string): string {
  return lang === 'ru' ? ru : en;
}

export function tr(value: L, lang: Lang): string {
  return value[lang];
}

export const ACT_NAME: Record<1 | 2 | 3, L> = {
  1: { ru: 'Мелководье', en: 'The Shallows' },
  2: { ru: 'Ночной рынок', en: 'Night Market' },
  3: { ru: 'Желоб', en: 'The Trench' },
};

export const BAND_NAME: Record<string, L> = {
  deep: { ru: 'Мёртвая вода', en: 'Dead water' },
  ebb: { ru: 'Отлив', en: 'Ebb' },
  slack: { ru: 'Штиль', en: 'Slack' },
  flood: { ru: 'Паводок', en: 'Flood' },
  storm: { ru: 'Шторм', en: 'Storm' },
};
