// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, MAX_SEED } from './defaults';
import { createRandom, deriveSeed } from './random';

const UINT32_RANGE = 2 ** 32;

describe('SplitMix32', () => {
  // Fixed uint32 vectors computed independently with unsigned Python arithmetic
  // from the published algorithm; a changed mixer/step must change the version.
  it.each([
    [0, [1684164658, 3653269916, 2939563536, 2141751570]],
    [1234, [3112186583, 2648076444, 428646200, 675931623]],
    [MAX_SEED, [3950124170, 4293442868, 1302505678, 2762329221]],
  ] as const)('matches the known sequence for seed %s', (seed, expected) => {
    const random = createRandom(seed);
    expect(expected.map(() => random.next() * UINT32_RANGE)).toEqual(expected);
  });

  it('repeats a seed and distinguishes representative different seeds', () => {
    const sample = (seed: number) => {
      const random = createRandom(seed);
      return Array.from({ length: 20 }, () => random.next());
    };
    expect(sample(1234)).toEqual(sample(1234));
    expect(sample(1234)).not.toEqual(sample(1235));
  });

  it('falls back for invalid numeric seeds rather than wrapping them', () => {
    for (const seed of [-1, 1.5, MAX_SEED + 1, Infinity, NaN]) {
      expect(createRandom(seed).next()).toBe(createRandom(DEFAULT_SEED).next());
    }
  });

  it('keeps the counter bounded during a large pixel-sized sequence', () => {
    const random = createRandom(1234);
    let value = 0;
    for (let index = 0; index < 4_000_000; index += 1) value = random.next();
    expect(value * UINT32_RANGE).toBe(1844941314);
  });

  it('returns finite fractions in [0, 1) across counter wraps', () => {
    const random = createRandom(MAX_SEED);
    for (let index = 0; index < 1000; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('supports bounded float and inclusive integer ranges', () => {
    const random = createRandom(42);
    for (let index = 0; index < 100; index += 1) {
      const float = random.range(-0.2, 1.2);
      const integer = random.int(-3, 3);
      expect(float).toBeGreaterThanOrEqual(-0.2);
      expect(float).toBeLessThanOrEqual(1.2);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(-3);
      expect(integer).toBeLessThanOrEqual(3);
    }
    expect(createRandom(1234).int(0, MAX_SEED)).toBe(3112186583);
  });

  it('does not consume the stream for a constant range', () => {
    const random = createRandom(1234);
    expect(random.range(2, 2)).toBe(2);
    expect(random.int(-5, -5)).toBe(-5);
    expect(random.next()).toBe(createRandom(1234).next());
  });

  it.each([
    [2, 1],
    [NaN, 1],
    [0, Infinity],
    [-Number.MAX_VALUE, Number.MAX_VALUE],
  ])('rejects invalid float bounds %s, %s', (min, max) => {
    expect(() => createRandom(0).range(min, max)).toThrow(RangeError);
  });

  it.each([
    [2, 1],
    [0.5, 2],
    [0, Infinity],
    [0, Number.MAX_SAFE_INTEGER],
    [0, MAX_SEED + 1],
  ])('rejects invalid integer bounds %s, %s', (min, max) => {
    expect(() => createRandom(0).int(min, max)).toThrow(RangeError);
  });
});

describe('seed streams', () => {
  it('pins independent geometry/grain derivation', () => {
    expect(deriveSeed(1234, 'geometry')).toBe(1416873340);
    expect(deriveSeed(1234, 'grain')).toBe(3607801279);
    const geometry = createRandom(deriveSeed(1234, 'geometry'));
    for (let index = 0; index < 100; index += 1) geometry.next();
    expect(deriveSeed(1234, 'grain')).toBe(3607801279);
    expect(deriveSeed(1235, 'grain')).not.toBe(deriveSeed(1234, 'grain'));
  });
});
