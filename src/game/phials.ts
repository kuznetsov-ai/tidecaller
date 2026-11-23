import type { PhialDef, PhialId } from './types';

export const PHIAL_LIST: PhialDef[] = [
  {
    id: 'springwater',
    name: { ru: 'Родник', en: 'Springwater' },
    text: { ru: 'Восстановить 14 корпуса.', en: 'Heal 14 hull.' },
  },
  {
    id: 'stormglass',
    name: { ru: 'Штормовое стекло', en: 'Stormglass' },
    text: { ru: 'Поставить прилив на 7.', en: 'Set the tide to 7.' },
  },
  {
    id: 'ebb_ash',
    name: { ru: 'Пепел отлива', en: 'Ebb Ash' },
    text: { ru: 'Поставить прилив на 1.', en: 'Set the tide to 1.' },
  },
  {
    id: 'saltspike',
    name: { ru: 'Соляной шип', en: 'Salt Spike' },
    text: { ru: 'Наложить 7 соли на цель.', en: 'Apply 7 salt to the target.' },
  },
  {
    id: 'ironkelp',
    name: { ru: 'Железная ламинария', en: 'Ironkelp' },
    text: { ru: 'Получить 16 защиты.', en: 'Gain 16 block.' },
  },
];

export const PHIALS: Record<PhialId, PhialDef> = Object.fromEntries(PHIAL_LIST.map((p) => [p.id, p])) as Record<
  PhialId,
  PhialDef
>;
