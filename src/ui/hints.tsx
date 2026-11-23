/**
 * First-visit coach marks. Each screen has a short tour; a tour is shown once and
 * remembered in localStorage (separate from the game save, so "Erase save" keeps
 * it and "Show tips again" in Settings resets it).
 *
 * The bubble is placed in document coordinates at the nearest spot that does not
 * cover the highlighted element or any other control; if the page has no such
 * gap it goes below the content, so it never sits on top of a button.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../game/types';
import { tx } from './tx';

const KEY = 'tidecaller-hints-v1';
type Store = { off: boolean; seen: string[] };

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw.off === 'boolean' && Array.isArray(raw.seen)) return raw;
  } catch {
    /* ignore */
  }
  return { off: false, seen: [] };
}
let store: Store = read();
const listeners = new Set<() => void>();
function write(next: Store) {
  store = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}
export const hints = {
  get: () => store,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  markSeen: (tour: string) => write({ ...store, seen: [...new Set([...store.seen, tour])] }),
  skipAll: () => write({ off: true, seen: store.seen }),
  reset: () => write({ off: false, seen: [] }),
};
export function useHints(): Store {
  return useSyncExternalStore(hints.subscribe, hints.get, hints.get);
}

export type TourId = 'select' | 'map' | 'combat' | 'reward' | 'shop' | 'rest';
interface Step {
  target: string;
  ru: string;
  en: string;
}

export const TOURS: Record<TourId, Step[]> = {
  select: [
    {
      target: '.cast',
      ru: 'Выберите мастера — нажмите на карточку. У каждого своя колода, корпус и стартовый прилив.',
      en: 'Pick a wright — tap a card. Each has its own deck, hull and starting tide.',
    },
    {
      target: '.charts',
      ru: 'Журнал — сложность. 0 — обычная вода, выше — враги крепче.',
      en: 'The chart is the difficulty. 0 is ordinary water; higher means tougher enemies.',
    },
    {
      target: '[data-testid=cast-off]',
      ru: '«Отчалить» начинает рейс: три акта, в конце каждого — босс.',
      en: '“Cast off” starts the voyage: three acts, each ends with a boss.',
    },
  ],
  map: [
    {
      target: '.node.can',
      ru: 'Узлы с золотой рамкой — куда можно плыть сейчас. Нажмите один. Путь идёт только вниз.',
      en: 'Nodes with a gold ring are where you can sail now. Tap one. The route only goes down.',
    },
    {
      target: '[data-testid=map-legend]',
      ru: 'Цвет точки — тип узла: бой, элита (сильнее, даёт реликвию), случай, лавка, отдых и босс в конце акта.',
      en: 'The dot colour is the node type: fight, elite (tougher, drops a relic), event, shop, rest, and the boss at the end.',
    },
    {
      target: '[data-testid=deck-btn]',
      ru: 'Здесь можно посмотреть всю колоду рейса.',
      en: 'Open your whole voyage deck here.',
    },
  ],
  combat: [
    {
      target: '.hand',
      ru: 'Ваша рука. Нажмите на карту (или потяните её вверх), чтобы сыграть. Число в углу — цена в энергии.',
      en: 'Your hand. Tap a card (or drag it up) to play it. The corner number is its energy cost.',
    },
    {
      target: '.energy',
      ru: 'Энергия: 3 за ход, восстанавливается в начале каждого хода.',
      en: 'Energy: 3 per turn, refilled at the start of each turn.',
    },
    {
      target: '.enemy .intents',
      ru: 'Намерение врага — что он сделает, когда вы закончите ход. Красное число — удар, бирюзовое — защита.',
      en: 'The enemy’s intent — what it does when you end the turn. Red is a hit, teal is block.',
    },
    {
      target: '[data-testid=hull]',
      ru: 'Корпус — ваше здоровье. Защита (+N) гасит удары и сгорает в начале вашего следующего хода.',
      en: 'Hull is your health. Block (+N) soaks hits and fades at the start of your next turn.',
    },
    {
      target: '[data-testid=tide]',
      ru: 'Прилив 0–8 общий для вас и врагов. 0–3 отлив, 3–5 штиль, 5–8 паводок: карта своей воды сильнее. 0–1 мёртвая вода: враги −2, вы берёте на карту меньше. 7–8 шторм: всем −3 сквозь защиту. В конце хода вода сама +1.',
      en: 'The tide 0–8 is shared by you and the enemies. 0–3 ebb, 3–5 slack, 5–8 flood: a card is stronger in its own water. 0–1 dead water: enemies −2, you draw one less. 7–8 storm: everyone −3 through block. The water rises +1 at end of turn.',
    },
    {
      target: '[data-testid=end-turn]',
      ru: 'Сыграли что хотели — «Конец хода» (или клавиша E). Затем ходят враги.',
      en: 'Done playing? Press “End turn” (or E). Then the enemies act.',
    },
  ],
  reward: [
    {
      target: '.reward .card-grid',
      ru: 'Добыча: выберите одну карту в колоду — или «Ничего не брать», если колода и так хороша.',
      en: 'Spoils: pick one card for your deck — or “Take nothing” if the deck is already good.',
    },
    {
      target: '[data-testid=leave-reward]',
      ru: 'Потом «Дальше» — обратно на карту.',
      en: 'Then “Onward” — back to the chart.',
    },
  ],
  shop: [
    {
      target: '.shop .card-grid',
      ru: 'Карты на продажу, цена — на кнопке под картой. Тусклые — не хватает монет.',
      en: 'Cards for sale; the price is on the button below. Dimmed ones cost more than you have.',
    },
    {
      target: '[data-testid=shop-remove]',
      ru: '«Вырезать карту» убирает слабую карту из колоды. Каждый раз дороже.',
      en: '“Cut a card” removes a weak card from the deck. It costs more each time.',
    },
    {
      target: '[data-testid=shop-leave]',
      ru: '«Уйти» — вернуться на карту.',
      en: '“Leave” returns to the chart.',
    },
  ],
  rest: [
    {
      target: '.rest .choices',
      ru: 'Стоянка: можно сделать одно — починить корпус, улучшить карту или задать прилив, с которого начнётся следующий бой.',
      en: 'A berth: do one thing — repair the hull, upgrade a card, or set the tide the next fight starts at.',
    },
  ],
};

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 8;

function docRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}
function hit(a: Rect, b: Rect, m = 6): boolean {
  return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
}
function isShown(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/** Nearest free spot for a w×h bubble that touches neither the target nor any control. */
export function placeBubble(target: Rect, w: number, h: number, obstacles: Rect[]): { x: number; y: number } {
  const docW = document.documentElement.clientWidth;
  const clampX = (x: number) => Math.max(PAD, Math.min(docW - w - PAD, x));
  const blocks = [target, ...obstacles];
  // Content height from the controls themselves (not the document), so the bubble's own spot does not feed back.
  const docH = Math.max(window.innerHeight, ...blocks.map((b) => b.y + b.h));
  const free = (p: { x: number; y: number }) => {
    const r = { x: p.x, y: p.y, w, h };
    return p.y >= PAD && !blocks.some((b) => hit(r, b));
  };
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const cands: { x: number; y: number }[] = [
    { x: clampX(cx - w / 2), y: target.y + target.h + 14 },
    { x: clampX(cx - w / 2), y: target.y - h - 14 },
    { x: target.x + target.w + 14, y: Math.max(PAD, cy - h / 2) },
    { x: target.x - w - 14, y: Math.max(PAD, cy - h / 2) },
  ].filter((p) => p.x >= PAD && p.x + w <= docW - PAD);
  const xs = [...new Set([clampX(cx - w / 2), PAD, clampX((docW - w) / 2), docW - w - PAD, clampX(target.x), clampX(target.x + target.w - w)])];
  for (let dy = 0; dy < docH + h; dy += 12) {
    for (const y of [cy + dy - h / 2, cy - dy - h / 2]) for (const x of xs) cands.push({ x, y: Math.round(y) });
  }
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x + w / 2 - cx, p.y + h / 2 - cy);
  const best = cands.filter(free).sort((a, b) => dist(a) - dist(b))[0];
  if (best) return best;
  // Below everything: always free.
  const bottom = docH + 14;
  return { x: clampX(cx - w / 2), y: bottom };
}

export function CoachMarks({ tour, lang, enabled = true }: { tour: TourId; lang: Lang; enabled?: boolean }) {
  const s = useHints();
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number; ring: Rect } | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const active = enabled && !s.off && !s.seen.includes(tour);
  const steps = TOURS[tour];

  const bump = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', bump);
    document.fonts?.ready.then(bump);
    const t = window.setInterval(bump, 400); // follow layout shifts (cards played, plates removed)
    return () => {
      window.removeEventListener('resize', bump);
      window.clearInterval(t);
    };
  }, [active, bump]);

  // Skip steps whose target is not on screen (e.g. no chart choice yet).
  let i = index;
  let target: Element | null = null;
  if (active && typeof document !== 'undefined') {
    while (i < steps.length) {
      const el = document.querySelector(steps[i].target);
      if (el && isShown(el)) {
        target = el;
        break;
      }
      i++;
    }
  }
  const modalOpen = typeof document !== 'undefined' && !!document.querySelector('.modal');
  const done = active && i >= steps.length && tick > 0;

  useEffect(() => {
    if (done) hints.markSeen(tour);
  }, [done, tour]);

  useLayoutEffect(() => {
    if (!active || !target || modalOpen || !bubble.current) return;
    const ring = docRect(target);
    const b = bubble.current.getBoundingClientRect();
    const mine = bubble.current;
    const obstacles = [...document.querySelectorAll('button, a[href], input, select, [role=button], .card, .relic, .node')]
      .filter((el) => !mine.contains(el) && !target!.contains(el) && isShown(el))
      .map(docRect);
    const p = placeBubble(ring, b.width, b.height, obstacles);
    if (!pos || pos.x !== p.x || pos.y !== p.y || pos.ring.x !== ring.x || pos.ring.y !== ring.y || pos.ring.w !== ring.w || pos.ring.h !== ring.h) {
      setPos({ ...p, ring });
    }
  });

  // Bring the highlighted element (and the bubble if it fits) into view once per step.
  const scrolled = useRef(-1);
  useEffect(() => {
    if (!pos || scrolled.current === i) return;
    scrolled.current = i;
    const top = Math.min(pos.ring.y, pos.y);
    const bottom = Math.max(pos.ring.y + pos.ring.h, pos.y + (bubble.current?.offsetHeight ?? 0));
    const vh = window.innerHeight;
    const y = bottom - top < vh - 24 ? top - (vh - (bottom - top)) / 2 : pos.ring.y - 24;
    if (top < window.scrollY || bottom > window.scrollY + vh) window.scrollTo({ top: Math.max(0, y), behavior: 'instant' as ScrollBehavior });
  }, [pos, i]);

  if (!active || !target || modalOpen) return null;
  const step = steps[i];
  const last = steps.slice(i + 1).every((st) => !document.querySelector(st.target));
  return createPortal(
    <>
      {pos && (
        <div
          className="coach-ring"
          aria-hidden
          style={{ left: pos.ring.x - 4, top: pos.ring.y - 4, width: pos.ring.w + 8, height: pos.ring.h + 8 }}
        />
      )}
      <div
        ref={bubble}
        className="coach-bubble"
        role="dialog"
        aria-label={tx(lang, 'Подсказка', 'Tip')}
        data-testid="coach-bubble"
        data-tour={tour}
        data-step={i}
        style={pos ? { left: pos.x, top: pos.y } : { left: -9999, top: 0 }}
      >
        <p className="coach-count">
          {tx(lang, 'Подсказка', 'Tip')} {i + 1}/{steps.length}
        </p>
        <p>{lang === 'ru' ? step.ru : step.en}</p>
        <div className="coach-actions">
          <button
            type="button"
            className="coach-next"
            data-testid="coach-next"
            onClick={() => {
              if (last) hints.markSeen(tour);
              setIndex(i + 1);
              setPos(null);
            }}
          >
            {last ? tx(lang, 'Понятно', 'Got it') : tx(lang, 'Дальше', 'Next')}
          </button>
          <button type="button" className="ghost coach-skip" data-testid="coach-skip" onClick={() => hints.skipAll()}>
            {tx(lang, 'Без подсказок', 'No more tips')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
