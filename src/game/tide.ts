import type { Affinity } from './types';

export function clampTide(n: number): number {
  return Math.max(0, Math.min(8, n));
}

/** Affinity bands overlap on purpose: 3 is ebb and slack, 5 is slack and flood. */
export function affinityOn(aff: Affinity, tide: number): boolean {
  if (aff === 'ebb') return tide <= 3;
  if (aff === 'slack') return tide >= 3 && tide <= 5;
  if (aff === 'flood') return tide >= 5;
  return false;
}

export type BandId = 'deep' | 'ebb' | 'slack' | 'flood' | 'storm';

export function bandTags(tide: number): BandId[] {
  const tags: BandId[] = [];
  if (tide <= 1) tags.push('deep');
  if (tide <= 3) tags.push('ebb');
  if (tide >= 3 && tide <= 5) tags.push('slack');
  if (tide >= 5) tags.push('flood');
  if (tide >= 7) tags.push('storm');
  return tags;
}

export function primaryBand(tide: number): BandId {
  if (tide <= 1) return 'deep';
  if (tide <= 3) return 'ebb';
  if (tide === 4) return 'slack';
  if (tide <= 6) return 'flood';
  return 'storm';
}

/** Anchor skips the natural +1 on even turns. */
export function willDrift(turn: number, hasAnchor: boolean): boolean {
  if (!hasAnchor) return true;
  return turn % 2 !== 0;
}
