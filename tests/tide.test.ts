import { describe, expect, it } from 'vitest';
import { affinityOn, bandTags, clampTide, primaryBand, willDrift } from '../src/game/tide';

describe('tide gauge 0–8', () => {
  it('clamps below 0 and above 8', () => {
    expect(clampTide(-5)).toBe(0);
    expect(clampTide(-1)).toBe(0);
    expect(clampTide(0)).toBe(0);
    expect(clampTide(8)).toBe(8);
    expect(clampTide(9)).toBe(8);
    expect(clampTide(42)).toBe(8);
  });
  const table: [number, boolean, boolean, boolean][] = [
    // tide, ebb, slack, flood
    [0, true, false, false],
    [1, true, false, false],
    [2, true, false, false],
    [3, true, true, false],
    [4, false, true, false],
    [5, false, true, true],
    [6, false, false, true],
    [7, false, false, true],
    [8, false, false, true],
  ];
  it.each(table)('affinity bands at tide %i', (t, ebb, slack, flood) => {
    expect(affinityOn('ebb', t)).toBe(ebb);
    expect(affinityOn('slack', t)).toBe(slack);
    expect(affinityOn('flood', t)).toBe(flood);
    expect(affinityOn('wild', t)).toBe(false);
  });
  it.each([
    [0, 'deep'], [1, 'deep'], [2, 'ebb'], [3, 'ebb'], [4, 'slack'], [5, 'flood'], [6, 'flood'], [7, 'storm'], [8, 'storm'],
  ] as const)('primary band at %i is %s', (t, band) => {
    expect(primaryBand(t)).toBe(band);
    expect(bandTags(t)).toContain(band === 'deep' ? 'deep' : band);
  });
  it('anchor skips drift on even turns only', () => {
    expect([1, 2, 3, 4].map((t) => willDrift(t, false))).toEqual([true, true, true, true]);
    expect([1, 2, 3, 4].map((t) => willDrift(t, true))).toEqual([true, false, true, false]);
  });
});
