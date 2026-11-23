import type { ReactElement } from 'react';

const stroke = {
  fill: 'none',
  stroke: '#f3eadc',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function Knot({ kind }: { kind: string }) {
  const color = kind === 'ebb' ? '#1d6e78' : kind === 'flood' ? '#a67c2d' : kind === 'slack' ? '#6d5cb5' : '#5c5348';
  return (
    <svg className="knot" viewBox="0 0 64 40" aria-hidden>
      <path d="M6 20c8-10 14-10 18 0s8 10 16 0 12-8 18 0" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="32" cy="20" r="4" fill={color} />
      <path d="M26 20c2 6 8 6 12 0" fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

export function Creature({ art }: { art: string }) {
  const body = shapes[art] ?? shapes.gull;
  return (
    <svg className="creature" viewBox="0 0 160 140" aria-hidden>
      <circle cx="80" cy="72" r="58" fill="#07161a" stroke="rgba(226,177,90,.45)" strokeWidth="1.2" />
      <circle cx="80" cy="72" r="50" fill="#10262c" />
      {body}
    </svg>
  );
}

const shapes: Record<string, ReactElement> = {
  gull: (
    <g {...stroke}>
      <path d="M30 78c18-28 40-32 62-8 10 12 22 10 36-6" />
      <path d="M78 70l18 6-16 8z" fill="#e2b15a" stroke="none" />
      <circle cx="96" cy="64" r="2.2" fill="#e07a5f" stroke="none" />
    </g>
  ),
  crab: (
    <g {...stroke}>
      <ellipse cx="80" cy="78" rx="26" ry="16" />
      <path d="M54 74l-16-14M54 82l-18 8M106 74l16-14M106 82l18 8" />
      <path d="M68 66c6-10 18-10 24 0" />
      <circle cx="72" cy="76" r="2" fill="#e2b15a" stroke="none" />
      <circle cx="88" cy="76" r="2" fill="#e2b15a" stroke="none" />
    </g>
  ),
  kelp: (
    <g {...stroke}>
      <path d="M70 108c2-30 8-40 4-62M84 108c0-28 10-36 6-64M96 108c-2-24 6-34 2-52" />
      <circle cx="74" cy="42" r="3" fill="#8fd0c8" stroke="none" />
    </g>
  ),
  wraith: (
    <g {...stroke}>
      <path d="M50 96c4-40 16-52 30-52s26 12 30 52" />
      <path d="M58 96c4 8 8 8 12 0s8-8 12 0 8 8 12 0 8-8 12 0" />
      <path d="M68 62h24M80 62v16" />
      <circle cx="80" cy="54" r="3" fill="#b7a6f5" stroke="none" />
    </g>
  ),
  knight: (
    <g {...stroke}>
      <path d="M58 100V62l22-16 22 16v38" />
      <path d="M80 46v-12M70 78h20" />
      <path d="M80 70l8 18h-16z" fill="#e2b15a" stroke="none" />
    </g>
  ),
  warden: (
    <g {...stroke}>
      <path d="M80 28c18 10 28 24 28 42 0 22-12 40-28 48-16-8-28-26-28-48 0-18 10-32 28-42z" />
      <path d="M80 48v46M64 70c10 8 22 8 32 0" />
      <circle cx="80" cy="62" r="4" fill="#8fd0c8" stroke="none" />
    </g>
  ),
  eel: (
    <g {...stroke}>
      <path d="M28 90c16-28 28-8 40-24s22-6 36 8 20 10 28-12" />
      <circle cx="108" cy="62" r="2.4" fill="#e2b15a" stroke="none" />
    </g>
  ),
  merchant: (
    <g {...stroke}>
      <path d="M52 96V70l28-18 28 18v26" />
      <path d="M68 78h24v18H68z" />
      <circle cx="80" cy="58" r="3" fill="#e2b15a" stroke="none" />
      <path d="M48 70h64" />
    </g>
  ),
  choir: (
    <g {...stroke}>
      <circle cx="58" cy="70" r="12" />
      <circle cx="80" cy="62" r="14" />
      <circle cx="102" cy="70" r="12" />
      <path d="M52 96c8-10 14-10 18 0M74 96c6-12 12-12 16 0M96 96c8-10 14-10 16 0" />
    </g>
  ),
  shark: (
    <g {...stroke}>
      <path d="M26 78c22-8 40-22 62-18 10 2 18 8 28 4-8 10-8 16-28 18-22 4-40 2-62-4z" />
      <path d="M78 60l8-16 4 16" />
      <circle cx="108" cy="74" r="2" fill="#e07a5f" stroke="none" />
    </g>
  ),
  auction: (
    <g {...stroke}>
      <path d="M48 100h64M80 100V58" />
      <path d="M80 58l24-8-6 20z" fill="#e2b15a" stroke="#f3eadc" />
      <circle cx="80" cy="48" r="8" />
    </g>
  ),
  madam: (
    <g {...stroke}>
      <path d="M80 36c16 0 24 12 20 24-6 18-34 18-40 0-4-12 4-24 20-24z" />
      <path d="M48 96c8-24 18-28 32-28s24 4 32 28" />
      <path d="M70 58h20" />
      <circle cx="80" cy="30" r="4" fill="#e2b15a" stroke="none" />
    </g>
  ),
  saint: (
    <g {...stroke}>
      <circle cx="80" cy="58" r="16" />
      <path d="M80 74v30M60 96h40" />
      <path d="M80 42V30M66 46l-8-8M94 46l8-8" />
    </g>
  ),
  lantern: (
    <g {...stroke}>
      <path d="M68 46h24l6 14v24l-6 10H68l-6-10V60z" />
      <path d="M80 46V32M72 32h16" />
      <circle cx="80" cy="70" r="6" fill="#e2b15a" stroke="none" />
    </g>
  ),
  notary: (
    <g {...stroke}>
      <path d="M56 40h48v62H56z" />
      <path d="M64 54h32M64 66h32M64 78h20" />
      <path d="M92 84l10 10" />
    </g>
  ),
  whale: (
    <g {...stroke}>
      <path d="M28 80c16-24 46-30 78-16 8 4 16 4 26-2-6 16-14 22-36 24-28 4-50 2-68-6z" />
      <path d="M70 58l6-16" />
      <circle cx="96" cy="74" r="2.2" fill="#8fd0c8" stroke="none" />
    </g>
  ),
  depth: (
    <g {...stroke}>
      <path d="M80 28v78" />
      <circle cx="80" cy="48" r="16" />
      <path d="M52 96c8-16 16-20 28-20s20 4 28 20" />
      <circle cx="80" cy="48" r="4" fill="#6d5cb5" stroke="none" />
    </g>
  ),
  moon: (
    <g {...stroke}>
      <circle cx="80" cy="70" r="28" />
      <path d="M92 54a20 20 0 1 0 0 32" fill="#e2b15a" stroke="none" />
      <path d="M40 108h80" />
    </g>
  ),
};
