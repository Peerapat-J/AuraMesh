import { normalizeDocument, normalizeSceneConfig } from './config';
import { createRandom, deriveSeed } from './random';
import type {
  AuraScene,
  ColorField,
  EditorDocument,
  RenderSpec,
  SceneConfig,
} from './types';

export const SCENE_FIELD_COUNT = 6;

export function createScene(input: SceneConfig): AuraScene {
  const { seed, colors, spread } = normalizeSceneConfig(input);
  const random = createRandom(deriveSeed(seed, 'geometry'));
  const radiusScale = 0.6 + 0.9 * spread;
  const fields: ColorField[] = [];

  // A fixed field count/draw order keeps geometry independent of palette size.
  for (let index = 0; index < SCENE_FIELD_COUNT; index += 1) {
    fields.push({
      x: random.range(-0.2, 1.2),
      y: random.range(-0.2, 1.2),
      radiusX: random.range(0.18, 0.48) * radiusScale,
      radiusY: random.range(0.18, 0.48) * radiusScale,
      color: colors[(index + 1) % colors.length],
      opacity: random.range(0.45, 0.85),
    });
  }

  return {
    baseColor: colors[0],
    fields,
    grainSeed: deriveSeed(seed, 'grain'),
  };
}

export function buildRenderSpec(input: EditorDocument): RenderSpec {
  const document = normalizeDocument(input);
  const { softness, spread, grain, contrast } = document.appearance;

  return {
    scene: createScene({
      rendererVersion: document.rendererVersion,
      seed: document.seed,
      colors: document.palette.colors,
      spread,
    }),
    style: { softness, grain, contrast },
  };
}
