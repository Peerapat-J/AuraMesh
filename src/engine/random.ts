import { normalizeSeed } from './config';
import { MAX_SEED } from './defaults';

const UINT32_RANGE = MAX_SEED + 1;
const WEYL_INCREMENT = 0x9e3779b9;
const STREAM_TAGS = { geometry: 0x47454f4d, grain: 0x47524149 } as const;

export interface RandomSource {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
}

// SplitMix32 mixer: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32
function mix32(value: number): number {
  let mixed = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
  return (mixed ^ (mixed >>> 15)) >>> 0;
}

export function deriveSeed(
  seed: number,
  stream: keyof typeof STREAM_TAGS,
): number {
  return mix32(normalizeSeed(seed) ^ STREAM_TAGS[stream]);
}

export function createRandom(seed: number): RandomSource {
  let state = normalizeSeed(seed);

  function next(): number {
    // Bound state on every step; 4K grain can exceed double-precision safety
    // for an unbounded counter after only a few million samples.
    state = (state + WEYL_INCREMENT) >>> 0;
    return mix32(state) / UINT32_RANGE;
  }

  return {
    next,
    range(min, max) {
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min > max ||
        !Number.isFinite(max - min)
      ) {
        throw new RangeError('Random range requires finite ordered bounds.');
      }

      return min === max ? min : min + (max - min) * next();
    },
    int(min, max) {
      const count = max - min + 1;
      if (
        !Number.isSafeInteger(min) ||
        !Number.isSafeInteger(max) ||
        count < 1 ||
        count > UINT32_RANGE
      ) {
        throw new RangeError(
          'Random integer bounds must span 1 to 2^32 values.',
        );
      }

      return min === max ? min : min + Math.floor(next() * count);
    },
  };
}
