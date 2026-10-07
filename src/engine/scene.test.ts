// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { normalizeDocument, normalizeSceneConfig } from './config';
import { DEFAULT_DOCUMENT, DEFAULT_PALETTE, MAX_SEED } from './defaults';
import { deriveSeed } from './random';
import { buildRenderSpec, createScene, SCENE_FIELD_COUNT } from './scene';
import type { AuraScene, ColorField, SceneConfig } from './types';

const config: SceneConfig = Object.freeze({
  rendererVersion: 1,
  seed: 1234,
  colors: DEFAULT_PALETTE.colors,
  spread: 0.65,
});

const geometry = (scene: AuraScene) =>
  scene.fields.map(({ x, y, radiusX, radiusY, opacity }) => ({
    x,
    y,
    radiusX,
    radiusY,
    opacity,
  }));
const centers = (fields: readonly ColorField[]) =>
  fields.map(({ x, y }) => ({ x, y }));

describe('scene generation', () => {
  it('pins the renderer v1 draw order and initial field rules', () => {
    // Independently calculated from the documented ranges and Python uint32 PRNG.
    const scene = createScene(config);
    const first = scene.fields[0];
    expect(first.x).toBeCloseTo(-0.12268816116265954, 14);
    expect(first.y).toBeCloseTo(0.3952021994162351, 14);
    expect(first.radiusX).toBeCloseTo(0.45269269564265846, 14);
    expect(first.radiusY).toBeCloseTo(0.5434400942156324, 14);
    expect(first.opacity).toBeCloseTo(0.6564994954504073, 14);
    expect(first.color).toBe('#155E75');
    expect(scene.baseColor).toBe('#0B1F3A');
    expect(scene.grainSeed).toBe(3607801279);
  });

  it('runs without DOM globals or browser randomness', () => {
    expect(typeof window).toBe('undefined');
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Scene generation must use seeded randomness.');
    });
    try {
      expect(createScene(config).fields).toHaveLength(SCENE_FIELD_COUNT);
      expect(buildRenderSpec(DEFAULT_DOCUMENT).scene).toEqual(
        createScene(config),
      );
    } finally {
      random.mockRestore();
    }
  });

  it('reproduces a scene from equal inputs and restores A after B', () => {
    const first = createScene(config);
    const second = createScene({ ...config, colors: [...config.colors] });
    expect(second).toEqual(first);
    expect(createScene({ ...config, seed: 1235 })).not.toEqual(first);
    expect(createScene(config)).toEqual(first);
    expect(second.fields).not.toBe(first.fields);
  });

  it('does not mutate frozen inputs or shared defaults', () => {
    const before = structuredClone(config);
    createScene(config);
    buildRenderSpec(DEFAULT_DOCUMENT);
    expect(config).toEqual(before);
    expect(DEFAULT_DOCUMENT.seed).toBe(1234);
  });

  it('keeps field bounds and colors valid across seeds and spread extremes', () => {
    for (const seed of [0, 1, 1234, 982451653, MAX_SEED]) {
      for (const spread of [0, 0.65, 1]) {
        const scene = createScene({ ...config, seed, spread });
        expect(scene.fields).toHaveLength(6);
        expect(scene.baseColor).toBe(config.colors[0]);
        expect(scene.grainSeed).toBe(deriveSeed(seed, 'grain'));
        for (const field of scene.fields) {
          expect(field.x).toBeGreaterThanOrEqual(-0.2);
          expect(field.x).toBeLessThanOrEqual(1.2);
          expect(field.y).toBeGreaterThanOrEqual(-0.2);
          expect(field.y).toBeLessThanOrEqual(1.2);
          expect(field.radiusX).toBeGreaterThanOrEqual(0.108);
          expect(field.radiusX).toBeLessThanOrEqual(0.72);
          expect(field.radiusY).toBeGreaterThanOrEqual(0.108);
          expect(field.radiusY).toBeLessThanOrEqual(0.72);
          expect(field.opacity).toBeGreaterThanOrEqual(0.45);
          expect(field.opacity).toBeLessThanOrEqual(0.85);
          expect(config.colors).toContain(field.color);
        }
      }
    }
  });

  it('changes coverage without resampling centers, opacity or grain', () => {
    const small = createScene({ ...config, spread: 0 });
    const large = createScene({ ...config, spread: 1 });
    expect(centers(small.fields)).toEqual(centers(large.fields));
    expect(small.grainSeed).toBe(large.grainSeed);
    for (let index = 0; index < small.fields.length; index += 1) {
      expect(
        large.fields[index].radiusX / small.fields[index].radiusX,
      ).toBeCloseTo(2.5);
      expect(
        large.fields[index].radiusY / small.fields[index].radiusY,
      ).toBeCloseTo(2.5);
      expect(large.fields[index].opacity).toBe(small.fields[index].opacity);
    }
  });

  it('keeps geometry/grain stable when changing palette colors or size', () => {
    const three = createScene({
      ...config,
      colors: ['#FF0000', '#00FF00', '#0000FF'],
    });
    const six = createScene({
      ...config,
      colors: [
        '#FF0000',
        '#00FF00',
        '#0000FF',
        '#FFFF00',
        '#00FFFF',
        '#FF00FF',
      ],
    });
    expect(geometry(three)).toEqual(geometry(six));
    expect(three.grainSeed).toBe(six.grainSeed);
    expect(new Set(six.fields.map((field) => field.color)).size).toBe(6);
    expect(six).not.toEqual(three);
  });

  it('uses deterministic fallback for invalid scene inputs', () => {
    const normalized = normalizeSceneConfig({
      seed: NaN,
      colors: [],
      spread: NaN,
    });
    expect(createScene(normalized)).toEqual(createScene(config));
  });
});

describe('render spec', () => {
  it('keeps appearance and output edits separate from geometry', () => {
    const base = buildRenderSpec(DEFAULT_DOCUMENT);
    const changed = buildRenderSpec(
      normalizeDocument({
        ...DEFAULT_DOCUMENT,
        appearance: {
          ...DEFAULT_DOCUMENT.appearance,
          softness: 0,
          grain: 1,
          contrast: 2,
        },
        output: { width: 1080, height: 1920 },
        exportFormat: 'jpeg',
      }),
    );
    expect(changed.scene).toEqual(base.scene);
    expect(changed.style).toEqual({ softness: 0, grain: 1, contrast: 2 });
    expect(base.style).toEqual({ softness: 0.65, grain: 0.04, contrast: 1 });
  });
});
