// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isValidRenderSize,
  normalizeAppearance,
  normalizeDocument,
  normalizeOutputSize,
  normalizePalette,
  normalizeSceneConfig,
  normalizeSeed,
} from './config';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_DOCUMENT,
  DEFAULT_OUTPUT,
  DEFAULT_PALETTE,
  DEFAULT_SEED,
  MAX_SEED,
} from './defaults';

describe('seed normalization', () => {
  it.each([0, 1234, MAX_SEED])('preserves valid seed %s', (seed) => {
    expect(normalizeSeed(seed)).toBe(seed);
  });

  it.each([
    -1,
    0.5,
    MAX_SEED + 1,
    NaN,
    Infinity,
    -Infinity,
    '1234',
    null,
    undefined,
  ])('falls back for invalid seed %s', (seed) =>
    expect(normalizeSeed(seed)).toBe(DEFAULT_SEED),
  );

  it('canonicalizes negative zero', () => {
    expect(Object.is(normalizeSeed(-0), 0)).toBe(true);
  });
});

describe('appearance normalization', () => {
  it('clamps finite values but falls back for missing/non-finite values', () => {
    expect(
      normalizeAppearance({
        softness: -1,
        spread: 4,
        grain: NaN,
        contrast: 10,
      }),
    ).toEqual({ softness: 0, spread: 1, grain: 0.04, contrast: 2 });
    expect(normalizeAppearance({ grain: Infinity, contrast: '1' })).toEqual(
      DEFAULT_APPEARANCE,
    );
    expect(normalizeAppearance(undefined)).toEqual(DEFAULT_APPEARANCE);
  });

  it('preserves zero values and the full contrast range', () => {
    expect(
      normalizeAppearance({ softness: 0, spread: 0, grain: 0, contrast: 0 }),
    ).toEqual({ softness: 0, spread: 0, grain: 0, contrast: 0 });
    expect(normalizeAppearance({ contrast: 1 }).contrast).toBe(1);
    expect(normalizeAppearance({ contrast: 2 }).contrast).toBe(2);
  });
});

describe('palette normalization', () => {
  it('normalizes hex case without retaining or mutating source colors', () => {
    const colors = Object.freeze(['#abcdef', '#123456', '#Ff0000']);
    const input = Object.freeze({ sourcePresetId: 'ocean', colors });
    const output = normalizePalette(input);
    expect(output).toEqual({
      sourcePresetId: 'ocean',
      colors: ['#ABCDEF', '#123456', '#FF0000'],
    });
    expect(output.colors).not.toBe(colors);
    expect(colors[0]).toBe('#abcdef');
  });

  it.each(
    [
      [],
      ['#000000', '#FFFFFF'],
      Array(7).fill('#000000'),
      ['#fff', '#123456', '#654321'],
      ['red', '#123456', '#654321'],
      ['#00000000', '#123456', '#654321'],
      [42, '#123456', '#654321'],
      new Array(4),
      null,
    ].map((colors) => [colors]),
  )('falls back for invalid colors (%j)', (colors) => {
    expect(
      normalizePalette({ sourcePresetId: 'invalid-source', colors }),
    ).toEqual(DEFAULT_PALETTE);
  });

  it('keeps valid custom colors and discards malformed source IDs', () => {
    expect(
      normalizePalette({ sourcePresetId: null, colors: DEFAULT_PALETTE.colors })
        .sourcePresetId,
    ).toBeNull();
    expect(
      normalizePalette({
        sourcePresetId: 'Bad ID',
        colors: DEFAULT_PALETTE.colors,
      }).sourcePresetId,
    ).toBeNull();
    expect(
      normalizePalette({ colors: Array(6).fill('#ABCDEF') }).colors,
    ).toHaveLength(6);
  });
});

describe('output validation', () => {
  it.each([
    { width: 64, height: 64 },
    { width: 4096, height: 4096 },
    { width: 3840, height: 2160 },
    { width: 2480, height: 3508 },
    { width: 1080, height: 1920 },
  ])('accepts supported size %j', (size) => {
    expect(isValidRenderSize(size)).toBe(true);
    expect(normalizeOutputSize(size)).toEqual(size);
    expect(normalizeOutputSize(size)).not.toBe(size);
  });

  it.each([
    { width: 63, height: 64 },
    { width: 4097, height: 64 },
    { width: 8192, height: 8192 },
    { width: 64.5, height: 100 },
    { width: 64, height: -1 },
    { width: NaN, height: 100 },
    { width: 100, height: Infinity },
    { width: '1920', height: 1080 },
    null,
    undefined,
  ])('rejects size %j and replaces the pair with defaults', (size) => {
    expect(isValidRenderSize(size)).toBe(false);
    expect(normalizeOutputSize(size)).toEqual(DEFAULT_OUTPUT);
  });
});

describe('document and scene config', () => {
  it('produces fresh defaults from missing or malformed documents', () => {
    for (const input of [undefined, null, [], 'bad', {}]) {
      const document = normalizeDocument(input);
      expect(document).toEqual(DEFAULT_DOCUMENT);
      expect(document.palette.colors).not.toBe(DEFAULT_PALETTE.colors);
      expect(document.appearance).not.toBe(DEFAULT_APPEARANCE);
      expect(document.output).not.toBe(DEFAULT_OUTPUT);
    }
  });

  it('preserves a valid frozen document without mutating it', () => {
    const input = Object.freeze({
      ...DEFAULT_DOCUMENT,
      seed: 0,
      exportFormat: 'jpeg',
    });
    const before = structuredClone(input);
    expect(normalizeDocument(input)).toEqual(input);
    expect(input).toEqual(before);
    expect(normalizeDocument({ exportFormat: 'svg' }).exportFormat).toBe('png');
  });

  it('keeps shared defaults deeply frozen', () => {
    expect(Object.isFrozen(DEFAULT_DOCUMENT)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PALETTE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_PALETTE.colors)).toBe(true);
    expect(Object.isFrozen(DEFAULT_APPEARANCE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_OUTPUT)).toBe(true);
  });

  it.each([2, 0, '1', null])(
    'rejects unsupported renderer version %s',
    (version) => {
      expect(() => normalizeDocument({ rendererVersion: version })).toThrow(
        RangeError,
      );
      expect(() => normalizeSceneConfig({ rendererVersion: version })).toThrow(
        RangeError,
      );
    },
  );

  it('normalizes only scene inputs and never silently wraps invalid seeds', () => {
    expect(
      normalizeSceneConfig({
        seed: MAX_SEED + 1,
        colors: [],
        spread: Infinity,
      }),
    ).toEqual({
      rendererVersion: 1,
      seed: DEFAULT_SEED,
      colors: DEFAULT_PALETTE.colors,
      spread: DEFAULT_APPEARANCE.spread,
    });
  });
});
