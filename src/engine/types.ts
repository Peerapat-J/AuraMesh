export type RendererVersion = 1;
export type ExportFormat = 'png' | 'jpeg';

export interface RenderSize {
  readonly width: number;
  readonly height: number;
}

export interface PaletteState {
  readonly sourcePresetId: string | null;
  readonly colors: readonly string[];
}

export interface AppearanceConfig {
  readonly softness: number;
  readonly spread: number;
  readonly grain: number;
  readonly contrast: number;
}

export interface EditorDocument {
  readonly rendererVersion: RendererVersion;
  readonly seed: number;
  readonly palette: PaletteState;
  readonly appearance: AppearanceConfig;
  readonly output: RenderSize;
  readonly exportFormat: ExportFormat;
}

export interface SceneConfig {
  readonly rendererVersion: RendererVersion;
  readonly seed: number;
  readonly colors: readonly string[];
  readonly spread: number;
}

export interface ColorField {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly color: string;
  readonly opacity: number;
}

export type RenderStyle = Pick<
  AppearanceConfig,
  'softness' | 'grain' | 'contrast'
>;

export interface AuraScene {
  readonly baseColor: string;
  readonly fields: readonly ColorField[];
  readonly grainSeed: number;
}

export interface RenderSpec {
  readonly scene: AuraScene;
  readonly style: RenderStyle;
}
