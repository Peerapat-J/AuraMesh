import {
  DEFAULT_APPEARANCE,
  DEFAULT_DOCUMENT,
  DEFAULT_OUTPUT,
  DEFAULT_PALETTE,
  DEFAULT_SEED,
  MAX_OUTPUT_PIXELS,
  MAX_OUTPUT_SIDE,
  MAX_PALETTE_COLORS,
  MAX_SEED,
  MIN_OUTPUT_SIDE,
  MIN_PALETTE_COLORS,
  RENDERER_VERSION,
} from './defaults';
import type {
  AppearanceConfig,
  EditorDocument,
  PaletteState,
  RendererVersion,
  RenderSize,
  SceneConfig,
} from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeNumber(
  value: unknown,
  max: number,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(0, value))
    : fallback;
}

function normalizeRendererVersion(value: unknown): RendererVersion {
  if (value !== undefined && value !== RENDERER_VERSION) {
    throw new RangeError('Unsupported AuraMesh renderer version.');
  }

  return RENDERER_VERSION;
}

export function normalizeSeed(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_SEED
  ) {
    return DEFAULT_SEED;
  }

  return value === 0 ? 0 : value;
}

export function normalizeAppearance(value: unknown): AppearanceConfig {
  const appearance = asRecord(value);

  return {
    softness: normalizeNumber(
      appearance.softness,
      1,
      DEFAULT_APPEARANCE.softness,
    ),
    spread: normalizeNumber(appearance.spread, 1, DEFAULT_APPEARANCE.spread),
    grain: normalizeNumber(appearance.grain, 1, DEFAULT_APPEARANCE.grain),
    contrast: normalizeNumber(
      appearance.contrast,
      2,
      DEFAULT_APPEARANCE.contrast,
    ),
  };
}

function normalizeColors(value: unknown): readonly string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < MIN_PALETTE_COLORS ||
    value.length > MAX_PALETTE_COLORS ||
    !Array.from(value).every(
      (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color),
    )
  ) {
    return null;
  }

  return value.map((color: string) => color.toUpperCase());
}

export function normalizePalette(value: unknown): PaletteState {
  const palette = asRecord(value);
  const colors = normalizeColors(palette.colors);
  // Invalid colors also discard the source reference, keeping fallback coherent.
  if (colors === null) {
    return {
      sourcePresetId: DEFAULT_PALETTE.sourcePresetId,
      colors: [...DEFAULT_PALETTE.colors],
    };
  }

  return {
    sourcePresetId:
      typeof palette.sourcePresetId === 'string' &&
      /^[a-z][a-z0-9-]*$/.test(palette.sourcePresetId)
        ? palette.sourcePresetId
        : null,
    colors,
  };
}

export function isValidRenderSize(value: unknown): value is RenderSize {
  const { width, height } = asRecord(value);

  return (
    typeof width === 'number' &&
    typeof height === 'number' &&
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= MIN_OUTPUT_SIDE &&
    height >= MIN_OUTPUT_SIDE &&
    width <= MAX_OUTPUT_SIDE &&
    height <= MAX_OUTPUT_SIDE &&
    width * height <= MAX_OUTPUT_PIXELS
  );
}

export function normalizeOutputSize(value: unknown): RenderSize {
  return isValidRenderSize(value)
    ? { width: value.width, height: value.height }
    : { ...DEFAULT_OUTPUT };
}

export function normalizeDocument(value: unknown): EditorDocument {
  const document = asRecord(value);

  return {
    rendererVersion: normalizeRendererVersion(document.rendererVersion),
    seed: normalizeSeed(document.seed),
    palette: normalizePalette(document.palette),
    appearance: normalizeAppearance(document.appearance),
    output: normalizeOutputSize(document.output),
    exportFormat:
      document.exportFormat === 'png' || document.exportFormat === 'jpeg'
        ? document.exportFormat
        : DEFAULT_DOCUMENT.exportFormat,
  };
}

export function normalizeSceneConfig(value: unknown): SceneConfig {
  const config = asRecord(value);

  return {
    rendererVersion: normalizeRendererVersion(config.rendererVersion),
    seed: normalizeSeed(config.seed),
    colors: normalizeColors(config.colors) ?? [...DEFAULT_PALETTE.colors],
    spread: normalizeNumber(config.spread, 1, DEFAULT_APPEARANCE.spread),
  };
}
