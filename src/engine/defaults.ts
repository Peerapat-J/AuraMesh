import type {
  AppearanceConfig,
  EditorDocument,
  PaletteState,
  RenderSize,
  RendererVersion,
} from './types';

export const RENDERER_VERSION: RendererVersion = 1;
export const DEFAULT_SEED = 1234;
export const MAX_SEED = 0xffffffff;
export const MIN_PALETTE_COLORS = 3;
export const MAX_PALETTE_COLORS = 6;
export const MIN_OUTPUT_SIDE = 64;
export const MAX_OUTPUT_SIDE = 4096;
export const MAX_OUTPUT_PIXELS = 16_777_216;

// Initial Ocean colors; visual calibration belongs to the renderer/palette work.
export const DEFAULT_PALETTE: PaletteState = Object.freeze({
  sourcePresetId: 'ocean',
  colors: Object.freeze(['#0B1F3A', '#155E75', '#0891B2', '#67E8F9']),
});

export const DEFAULT_APPEARANCE: AppearanceConfig = Object.freeze({
  softness: 0.65,
  spread: 0.65,
  grain: 0.04,
  contrast: 1,
});

export const DEFAULT_OUTPUT: RenderSize = Object.freeze({
  width: 1920,
  height: 1080,
});

export const DEFAULT_DOCUMENT: EditorDocument = Object.freeze({
  rendererVersion: RENDERER_VERSION,
  seed: DEFAULT_SEED,
  palette: DEFAULT_PALETTE,
  appearance: DEFAULT_APPEARANCE,
  output: DEFAULT_OUTPUT,
  exportFormat: 'png',
});
