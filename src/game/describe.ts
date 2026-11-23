import { CARDS, effectsOf } from './cards';
import { affinityOn, clampTide } from './tide';
import type { Affinity, CardDef, Effect, Lang } from './types';

export interface Mods {
  tide?: number;
  strength?: number;
  weak?: number;
  choir?: boolean;
  /** Twin Hooks still armed: the first attack line gets +4. */
  twin?: boolean;
}

function nOf(
  effect: Effect & { n: number; affN?: number; timesTide?: number },
  affinity: Affinity,
  mods?: Mods,
): { shown: number; printed: number; boosted: boolean } {
  const printed =
    effect.op === 'damage' && effect.timesTide ? effect.timesTide * (mods?.tide ?? 0) + effect.n : effect.n;
  let shown = printed;
  let boosted = false;
  if (effect.op === 'damage' && effect.timesTide && mods?.tide != null) {
    shown = effect.timesTide * mods.tide + effect.n;
  } else if (mods?.tide != null && effect.affN != null && affinityOn(affinity, mods.tide)) {
    shown = effect.affN;
    boosted = true;
  }
  if (effect.op === 'damage') {
    shown += mods?.strength ?? 0;
    if ((mods?.weak ?? 0) > 0) shown = Math.floor(shown * 0.75);
    if (mods?.twin) shown += 4;
  }
  if (effect.op === 'salt' && mods?.choir) shown += 1;
  return { shown: Math.max(0, shown), printed, boosted };
}

function clause(lang: Lang, affinity: Affinity, alt?: number): string {
  if (alt == null) return '';
  if (lang === 'ru') {
    const w = affinity === 'ebb' ? 'отливе' : affinity === 'slack' ? 'штиле' : 'паводке';
    return ` (на ${w} — ${alt})`;
  }
  const w = affinity === 'ebb' ? 'ebb' : affinity === 'slack' ? 'slack' : 'flood';
  return ` (on ${w} — ${alt})`;
}

function line(effect: Effect, lang: Lang, affinity: Affinity, mods?: Mods): string {
  const ru = lang === 'ru';
  if (effect.op === 'conditional') {
    const head =
      effect.when === 'tideMoved'
        ? ru
          ? 'Если прилив уже сдвигался в этот ход'
          : 'If the tide already moved this turn'
        : effect.when === 'deepEbb'
          ? ru
            ? 'Если мёртвая вода'
            : 'If dead water'
          : effect.when === 'storm'
            ? ru
              ? 'Если шторм'
              : 'If storm'
            : effect.when === 'lowHp'
              ? ru
                ? 'Если корпус — половина или меньше'
                : 'If hull is at half or less'
              : ru
                ? 'Если враг собирается двигать прилив'
                : 'If an enemy intends to move the tide';
    const inner = effect.effects.map((e) => line(e, lang, affinity, mods)).join(' ');
    const other = effect.else?.length
      ? (ru ? ' Иначе: ' : ' Otherwise: ') + effect.else.map((e) => line(e, lang, affinity, mods)).join(' ')
      : '';
    return `${head}: ${inner}${other}`;
  }
  if (effect.op === 'tideChoose') {
    return ru ? `Сдвинуть прилив на +${effect.d} или −${effect.d}.` : `Move the tide by +${effect.d} or −${effect.d}.`;
  }
  if (effect.op === 'tide') {
    const sign = effect.d > 0 ? `+${effect.d}` : `${effect.d}`;
    return ru ? `Сдвинуть прилив на ${sign}.` : `Move the tide by ${sign}.`;
  }
  if (effect.op === 'tideSet') return ru ? `Поставить прилив на ${effect.v}.` : `Set the tide to ${effect.v}.`;
  if (effect.op === 'loseBlock') return ru ? 'Потерять всю защиту.' : 'Lose all block.';
  if (effect.op === 'retainBlock') {
    return ru ? `Сохранить до ${effect.n} защиты на следующий ход.` : `Keep up to ${effect.n} block into the next turn.`;
  }
  if (effect.op === 'cheapNext') {
    return ru ? 'Следующая карта стоит на 1 меньше.' : 'The next card costs 1 less.';
  }
  if (effect.op === 'power') {
    return ru
      ? `До конца боя: каждый сдвиг прилива даёт ${effect.n} защиты.`
      : `For the rest of combat, each tide shift grants ${effect.n} block.`;
  }
  if (effect.op === 'loseHp') return ru ? `Потерять ${effect.n} корпуса.` : `Lose ${effect.n} hull.`;
  if (effect.op === 'strength') return ru ? `Получить ${effect.n} силы.` : `Gain ${effect.n} strength.`;
  if (effect.op === 'weak') return ru ? `Наложить ${effect.n} слабости.` : `Apply ${effect.n} weak.`;

  if (effect.op === 'damage' && effect.timesTide) {
    const shown = mods?.tide != null ? nOf(effect, affinity, mods).shown : null;
    const extra = (mods?.strength ?? 0) !== 0 || (mods?.weak ?? 0) > 0 || !!mods?.twin;
    if (shown != null && extra) return ru ? `Нанести ${shown} урона.` : `Deal ${shown} damage.`;
    return ru ? `Нанести урон, равный приливу × ${effect.timesTide}.` : `Deal damage equal to tide × ${effect.timesTide}.`;
  }

  if (
    effect.op === 'damage' ||
    effect.op === 'block' ||
    effect.op === 'salt' ||
    effect.op === 'heal' ||
    effect.op === 'draw'
  ) {
    const { shown, boosted } = nOf(effect, affinity, mods);
    const alt = effect.affN;
    const usePreview = mods?.tide != null;
    const num = usePreview ? shown : effect.n;
    const aff = !usePreview ? clause(lang, affinity, alt) : boosted ? '' : clause(lang, affinity, alt);
    if (effect.op === 'damage') {
      return ru
        ? effect.all
          ? `Нанести ${num} урона всем врагам${aff}.`
          : `Нанести ${num} урона${aff}.`
        : effect.all
          ? `Deal ${num} damage to all enemies${aff}.`
          : `Deal ${num} damage${aff}.`;
    }
    if (effect.op === 'block') return ru ? `Получить ${num} ${ruBlock(num)}${aff}.` : `Gain ${num} block${aff}.`;
    if (effect.op === 'salt') return ru ? `Наложить ${num} ${num === 1 ? 'соль' : 'соли'}${aff}.` : `Apply ${num} salt${aff}.`;
    if (effect.op === 'heal') return ru ? `Восстановить ${num} ${ruHull(num)}${aff}.` : `Heal ${num} hull${aff}.`;
    return ru ? `Взять ${ruCards(num)}${aff}.` : `Draw ${num}${aff}.`;
  }
  return '';
}

function ruBlock(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'защиту';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'защиты';
  return 'защит';
}
function ruHull(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'корпус';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'корпуса';
  return 'корпусов';
}
function ruCards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} карту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} карты`;
  return `${n} карт`;
}

export function cardLines(def: CardDef, upgraded: boolean, lang: Lang, mods?: Mods): string[] {
  if (def.id === 'barnacle') {
    return [
      lang === 'ru'
        ? 'Нельзя сыграть. Пока карта в руке, в начале хода энергия −1.'
        : 'Unplayable. While this is in hand, you start the turn with −1 energy.',
    ];
  }
  if (def.id === 'snag') {
    return [
      lang === 'ru'
        ? 'Нельзя сыграть. В конце хода изгоняется.'
        : 'Unplayable. Exhausts at the end of the turn.',
    ];
  }
  // Effects resolve in order, so a card that moves the tide first is previewed on the tide it moves to.
  let m = mods ? { ...mods } : undefined;
  const lines: string[] = [];
  for (const e of effectsOf(def, upgraded)) {
    const text = line(e, lang, def.affinity, m);
    if (text) lines.push(text);
    if (m && m.tide != null) {
      if (e.op === 'tide') m = { ...m, tide: clampTide(m.tide + e.d) };
      else if (e.op === 'tideSet') m = { ...m, tide: e.v };
    }
    if (m?.twin && (e.op === 'damage' || (e.op === 'conditional' && [...e.effects, ...(e.else ?? [])].some((x) => x.op === 'damage')))) {
      m = { ...m, twin: false };
    }
  }
  if (def.endTurn?.length) {
    const end = def.endTurn.map((e) => line(e, lang, def.affinity, mods)).join(' ');
    lines.push(lang === 'ru' ? `В конце хода, если в руке: ${end}` : `At end of turn, if in hand: ${end}`);
  }
  return lines;
}

/** Tide the card's own leading tide moves leave behind (what its later numbers resolve on). */
export function tideAfterOwnMoves(def: CardDef, upgraded: boolean, tide: number): number {
  let t = tide;
  for (const e of effectsOf(def, upgraded)) {
    if (e.op === 'tide') t = clampTide(t + e.d);
    else if (e.op === 'tideSet') t = e.v;
  }
  return t;
}

