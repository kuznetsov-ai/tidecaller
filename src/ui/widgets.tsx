import { useRef, useState } from 'react';
import { CARDS } from '../game/cards';
import { cardCost, debtActive, previewIntents } from '../game/combat';
import { cardLines } from '../game/describe';
import { ENEMIES } from '../game/enemies';
import { RELICS } from '../game/relics';
import { affinityOn, bandTags, primaryBand, willDrift } from '../game/tide';
import type { CardInst, CombatState, Lang, ResolvedIntent } from '../game/types';
import { Creature, Knot } from './art';
import { BAND_NAME, tr, tx } from './tx';

export function CardFace({
  id,
  upgraded,
  lang,
  combat,
  onClick,
  disabled,
  hot,
  dim,
  onDragPlay,
}: {
  id: string;
  upgraded?: boolean;
  lang: Lang;
  combat?: CombatState | null;
  onClick?: () => void;
  disabled?: boolean;
  hot?: boolean;
  dim?: boolean;
  /** drag the card upward past a threshold to play it (touch and mouse) */
  onDragPlay?: () => void;
}) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  const swallow = useRef(false);
  const [lift, setLift] = useState(0);
  const def = CARDS[id];
  if (!def) return null;
  const canDrag = !!onDragPlay && !disabled;
  const dragProps = canDrag
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        },
        onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
          if (!drag.current) return;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(e.clientX - drag.current.x) < 40) setLift(Math.max(-90, Math.min(0, dy)));
        },
        onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
          const start = drag.current;
          drag.current = null;
          setLift(0);
          if (start && start.y - e.clientY > 60) {
            swallow.current = true; // the click that follows the drop must not play it twice
            onDragPlay!();
          }
        },
        onPointerCancel: () => {
          drag.current = null;
          setLift(0);
        },
      }
    : {};
  const mods = combat
    ? {
        tide: combat.tide,
        strength: combat.player.strength,
        weak: combat.player.weak,
        choir: combat.relics.includes('choir_shell'),
      }
    : undefined;
  const lines = cardLines(def, !!upgraded, lang, mods);
  const base = def.cost;
  const cost = combat ? cardCost({ uid: '', id, up: !!upgraded }, combat) : base;
  const lit = !!combat && affinityOn(def.affinity, combat.tide);
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card aff-${def.affinity}${lit ? ' lit' : ''}${upgraded ? ' up' : ''}${def.rarity === 'curse' ? ' curse' : ''}${hot ? ' hot' : ''}${dim ? ' dim' : ''}`}
      onClick={
        disabled
          ? undefined
          : () => {
              if (swallow.current) {
                swallow.current = false;
                return;
              }
              onClick?.();
            }
      }
      {...dragProps}
      style={lift ? { transform: `translateY(${lift}px)` } : undefined}
      data-drag={canDrag ? '1' : undefined}
      disabled={onClick ? disabled : undefined}
      data-testid="card"
      data-card={id}
      data-playable={disabled ? '0' : '1'}
    >
      <span className={`cost${cost !== base ? ' shifted' : ''}`}>{def.unplayable ? '—' : cost}</span>
      {upgraded && <span className="up-mark">+</span>}
      <Knot kind={def.affinity} />
      <strong>{tr(def.name, lang)}</strong>
      <span className="rules">
        {lines.map((line) => (
          <em key={line}>{line}</em>
        ))}
      </span>
      <span className="badges">
        {def.exhaust && <i>{tx(lang, 'Изгнание', 'Exhaust')}</i>}
        {def.retain && <i>{tx(lang, 'Остаётся', 'Retain')}</i>}
        {def.ethereal && <i>{tx(lang, 'Эфемер', 'Ethereal')}</i>}
        {def.unplayable && <i>{tx(lang, 'Нельзя сыграть', 'Unplayable')}</i>}
      </span>
    </Tag>
  );
}

export function TideGauge({ combat, lang }: { combat: CombatState; lang: Lang }) {
  const band = primaryBand(combat.tide);
  const tags = bandTags(combat.tide)
    .map((id) => tr(BAND_NAME[id], lang))
    .join(' · ');
  const drift = willDrift(combat.turn, combat.relics.includes('rusted_anchor'));
  return (
    <aside className={`gauge band-${band}`} data-testid="tide" data-tide={combat.tide}>
      <p className="band-name">{tr(BAND_NAME[band], lang)}</p>
      <p className="band-tags">{tags}</p>
      <ol>
        {Array.from({ length: 9 }, (_, i) => 8 - i).map((mark) => (
          <li key={mark} className={mark === combat.tide ? 'now' : mark < combat.tide ? 'full' : ''}>
            <span>{mark}</span>
            {mark === combat.tide && <b />}
          </li>
        ))}
      </ol>
      <p className="drift">
        {drift
          ? tx(lang, 'В конце хода прилив +1', 'Tide +1 at end of turn')
          : tx(lang, 'Якорь держит воду в этот ход', 'The anchor holds this turn')}
      </p>
    </aside>
  );
}

export function IntentChip({ intent, lang }: { intent: ResolvedIntent; lang: Lang }) {
  if (intent.hidden) {
    return (
      <span className="intent hidden" title={tx(lang, 'Намерение скрыто', 'Intent hidden')}>
        ?<small>{tx(lang, 'скрыто', 'hidden')}</small>
      </span>
    );
  }
  const hits = intent.hits && intent.hits > 1 ? `×${intent.hits}` : '';
  const label =
    intent.kind === 'attack'
      ? `${intent.n}${hits}`
      : intent.kind === 'block'
        ? `${intent.n}`
        : intent.kind === 'tide'
          ? `${intent.n > 0 ? '+' : ''}${intent.n}`
          : intent.kind === 'tideSet'
            ? `→${intent.n}`
            : intent.kind === 'salt'
              ? `${intent.n}`
              : intent.kind === 'heal'
                ? `+${intent.n}`
                : intent.kind === 'strength'
                  ? `+${intent.n}`
                  : intent.kind === 'summon'
                    ? tx(lang, 'зов', 'call')
                    : intent.kind === 'curse' || intent.kind === 'snag'
                      ? tx(lang, 'порча', 'hex')
                      : `${intent.n}`;
  const word =
    intent.kind === 'attack'
      ? tx(lang, 'удар', 'hit')
      : intent.kind === 'block'
        ? tx(lang, 'защита', 'block')
        : intent.kind === 'tide' || intent.kind === 'tideSet'
          ? tx(lang, 'прилив', 'tide')
          : intent.kind === 'salt'
            ? tx(lang, 'соль', 'salt')
            : intent.kind === 'heal'
              ? tx(lang, 'лечение', 'heal')
              : intent.kind === 'strength'
                ? tx(lang, 'сила', 'str')
                : intent.kind === 'summon'
                  ? tx(lang, 'призыв', 'summon')
                  : tx(lang, 'эффект', 'effect');
  return (
    <span className={`intent kind-${intent.kind}`} title={intent.pierce ? tx(lang, 'Пробивает часть защиты', 'Pierces part of block') : word}>
      {label}
      <small>{word}</small>
    </span>
  );
}

export function EnemyPlate({
  combat,
  index,
  lang,
  selected,
  onSelect,
}: {
  combat: CombatState;
  index: number;
  lang: Lang;
  selected: boolean;
  onSelect: () => void;
}) {
  const enemy = combat.enemies[index];
  const def = ENEMIES[enemy.defId];
  if (!enemy || !def) return null;
  const intents = previewIntents(enemy, combat);
  return (
    <button
      type="button"
      className={`enemy${selected ? ' selected' : ''}${def.boss ? ' boss' : ''}`}
      onClick={onSelect}
      data-testid="enemy"
    >
      <Creature art={def.art} />
      <div className="enemy-copy">
        <header>
          <strong>{tr(def.name, lang)}</strong>
          {(def.boss || def.elite) && <em>{def.elite ? tx(lang, 'элита', 'elite') : tx(lang, 'босс', 'boss')}</em>}
        </header>
        <div className="hp">
          <i style={{ width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%` }} />
          <span>
            {Math.max(0, enemy.hp)}/{enemy.maxHp}
          </span>
        </div>
        <div className="intents">
          {intents.map((intent, i) => (
            <IntentChip key={i} intent={intent} lang={lang} />
          ))}
        </div>
        <div className="pills">
          {enemy.block > 0 && <span>{tx(lang, 'защита', 'block')} {enemy.block}</span>}
          {enemy.salt > 0 && <span>{tx(lang, 'соль', 'salt')} {enemy.salt}</span>}
          {enemy.strength > 0 && <span>{tx(lang, 'сила', 'str')} {enemy.strength}</span>}
          {enemy.weak > 0 && <span>{tx(lang, 'слабость', 'weak')} {enemy.weak}</span>}
          {enemy.defId === 'moon' && <span>{tx(lang, 'пробуждение', 'doom')} {enemy.doom}/3</span>}
        </div>
        {(def.boss || def.elite) && <p className="tip-line">{tr(def.tip, lang)}</p>}
      </div>
    </button>
  );
}

export function RelicRow({ ids, lang }: { ids: string[]; lang: Lang }) {
  return (
    <div className="relics">
      {ids.map((id) => {
        const relic = RELICS[id];
        if (!relic) return null;
        return (
          <span key={id} className="relic" tabIndex={0}>
            {tr(relic.name, lang)}
            <span className="tip-bubble">{tr(relic.text, lang)}</span>
          </span>
        );
      })}
    </div>
  );
}

export function HudStats({
  hp,
  maxHp,
  block,
  gold,
  energy,
  maxEnergy,
  lang,
}: {
  hp: number;
  maxHp: number;
  block?: number;
  gold: number;
  energy?: number;
  maxEnergy?: number;
  lang: Lang;
}) {
  return (
    <div className="stats">
      <span className="hull" data-testid="hull">
        {tx(lang, 'Корпус', 'Hull')} {hp}/{maxHp}
        {block ? <b>+{block}</b> : null}
      </span>
      {energy != null && (
        <span className="energy">
          {tx(lang, 'Энергия', 'Energy')} {energy}/{maxEnergy}
        </span>
      )}
      <span className="gold">{gold}</span>
    </div>
  );
}

export function debtNote(combat: CombatState, lang: Lang): string | null {
  if (!combat.enemies.some((e) => e.hp > 0 && e.defId === 'debt_of_depth')) return null;
  if (!debtActive(combat)) return tx(lang, 'Долг глубины спит: прилив выше 3.', 'Debt of Depth sleeps above tide 3.');
  return tx(lang, 'Долг глубины: на отливе карты стоят на 1 больше.', 'Debt of Depth: cards cost +1 while the tide is 3 or lower.');
}
