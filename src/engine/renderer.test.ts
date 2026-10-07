// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT } from './defaults';
import {
  createFalloffStops,
  fieldToPixels,
  renderGradient2D,
  renderImage,
  RenderError,
} from './renderer';
import { buildRenderSpec } from './scene';

const scene = buildRenderSpec(DEFAULT_DOCUMENT).scene;

describe('normalized Canvas geometry', () => {
  it('maps each axis to the corresponding output dimension without cropping', () => {
    const field = {
      x: -0.1,
      y: 1.1,
      radiusX: 0.25,
      radiusY: 0.5,
      color: '#FFFFFF',
      opacity: 0.5,
    };
    const frozen = Object.freeze(field);
    expect(fieldToPixels(frozen, { width: 1920, height: 1080 })).toEqual({
      x: -192,
      y: 1188,
      radiusX: 480,
      radiusY: 540,
    });
    expect(fieldToPixels(frozen, { width: 1080, height: 1920 })).toEqual({
      x: -108,
      y: 2112,
      radiusX: 270,
      radiusY: 960,
    });
    expect(frozen).toEqual(field);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid radii %s', (radiusX) => {
    expect(() =>
      fieldToPixels(
        { ...scene.fields[0], radiusX },
        { width: 256, height: 256 },
      ),
    ).toThrow(RenderError);
  });

  it('rejects overflowing coordinates', () => {
    expect(() =>
      fieldToPixels(
        { ...scene.fields[0], x: Number.MAX_VALUE },
        { width: 256, height: 256 },
      ),
    ).toThrow(RenderError);
  });

  it.each([
    { width: 0, height: 64 },
    { width: 4097, height: 64 },
    { width: 256.5, height: 256 },
  ])('rejects invalid size before touching a context: %j', (size) => {
    expect(() =>
      renderGradient2D(null, scene, size, { softness: 0.65 }),
    ).toThrow('Unsupported render dimensions.');
  });
});

describe('softness falloff', () => {
  it.each([0, 0.65, 1])(
    'fades continuously to zero at softness %s',
    (softness) => {
      const stops = createFalloffStops(softness, 0.8);
      expect(stops[0].alpha).toBe(0.8);
      expect(stops.at(-1)).toEqual({ offset: 1, alpha: 0 });
      for (let index = 1; index < stops.length; index += 1) {
        expect(stops[index].offset).toBeGreaterThan(stops[index - 1].offset);
        expect(stops[index].alpha).toBeLessThan(stops[index - 1].alpha);
      }
    },
  );

  it('widens the transition for softer fields', () => {
    expect(createFalloffStops(0, 1)[0].offset).toBeCloseTo(0.8);
    expect(createFalloffStops(1, 1)[0].offset).toBe(0);
  });

  it.each([-1, 2, NaN, Infinity])('rejects invalid softness %s', (softness) => {
    expect(() => createFalloffStops(softness, 0.5)).toThrow(RenderError);
  });
});

describe('renderer errors and pipeline scope', () => {
  it('reports a missing context without mocking Canvas', () => {
    expect(() =>
      renderGradient2D(
        null,
        scene,
        { width: 256, height: 256 },
        { softness: 0.65 },
      ),
    ).toThrow('An available Canvas 2D context is required.');
  });

  it('does not silently drop effects pending in #5/#6', () => {
    expect(() =>
      renderImage(
        null,
        buildRenderSpec(DEFAULT_DOCUMENT),
        DEFAULT_DOCUMENT.output,
      ),
    ).toThrow('Contrast and grain passes are not implemented yet.');
    const spec = buildRenderSpec({
      ...DEFAULT_DOCUMENT,
      appearance: { ...DEFAULT_DOCUMENT.appearance, contrast: 0, grain: 0 },
    });
    expect(() => renderImage(null, spec, DEFAULT_DOCUMENT.output)).toThrow(
      RenderError,
    );
  });
});
