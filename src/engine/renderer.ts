import { isValidRenderSize } from './config';
import type { AuraScene, ColorField, RenderSize, RenderSpec } from './types';

export type RenderErrorCode =
  | 'invalid-size'
  | 'invalid-context'
  | 'invalid-scene'
  | 'invalid-style'
  | 'unsupported-effect'
  | 'render-failed';

export class RenderError extends Error {
  readonly code: RenderErrorCode;

  constructor(code: RenderErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'RenderError';
    this.code = code;
  }
}

function validateSize(size: RenderSize): void {
  if (!isValidRenderSize(size)) {
    throw new RenderError('invalid-size', 'Unsupported render dimensions.');
  }
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function fieldToPixels(field: ColorField, size: RenderSize) {
  validateSize(size);
  const pixels = {
    x: field.x * size.width,
    y: field.y * size.height,
    radiusX: field.radiusX * size.width,
    radiusY: field.radiusY * size.height,
  };
  if (
    !Object.values(pixels).every(Number.isFinite) ||
    pixels.radiusX <= 0 ||
    pixels.radiusY <= 0
  ) {
    throw new RenderError(
      'invalid-scene',
      'Field geometry must be finite with positive radii.',
    );
  }
  return pixels;
}

export function createFalloffStops(softness: number, opacity: number) {
  if (!isUnit(softness) || !isUnit(opacity)) {
    throw new RenderError(
      'invalid-style',
      'Softness and opacity must be in 0–1.',
    );
  }
  // Even softness zero retains a smooth outer transition. No hard disk edge.
  const start = 0.8 * (1 - softness);
  return Array.from({ length: 17 }, (_, index) => {
    const t = index / 16;
    const smooth = t * t * (3 - 2 * t);
    return { offset: start + (1 - start) * t, alpha: opacity * (1 - smooth) };
  });
}

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >>> 16}, ${(value >>> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function renderGradient2D(
  ctx: CanvasRenderingContext2D | null,
  scene: AuraScene,
  size: RenderSize,
  { softness }: { readonly softness: number },
): void {
  validateSize(size);
  if (
    !ctx ||
    !ctx.canvas ||
    typeof ctx.save !== 'function' ||
    ctx.isContextLost?.()
  ) {
    throw new RenderError(
      'invalid-context',
      'An available Canvas 2D context is required.',
    );
  }
  if (!isUnit(softness)) {
    throw new RenderError('invalid-style', 'Softness must be in 0–1.');
  }
  const opaqueHex = /^#[0-9a-f]{6}$/i;
  if (
    !scene ||
    !opaqueHex.test(scene.baseColor) ||
    !Array.isArray(scene.fields)
  ) {
    throw new RenderError(
      'invalid-scene',
      'Scene requires opaque hex colors and fields.',
    );
  }
  const fields = Array.from(scene.fields, (field) => {
    if (!field || !opaqueHex.test(field.color) || !isUnit(field.opacity)) {
      throw new RenderError('invalid-scene', 'Invalid field color or opacity.');
    }
    return { field, pixels: fieldToPixels(field, size) };
  });

  try {
    // This renderer owns the target bitmap/context. Reassign even equal sizes:
    // it clears old clips, paths and save stacks as well as pixels/drawing state.
    ctx.canvas.width = size.width;
    ctx.canvas.height = size.height;
    if (ctx.isContextLost?.()) {
      throw new RenderError(
        'invalid-context',
        'Canvas context was lost during resize.',
      );
    }
    ctx.save();
    try {
      ctx.resetTransform();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = scene.baseColor;
      ctx.fillRect(0, 0, size.width, size.height);

      for (const { field, pixels } of fields) {
        ctx.setTransform(
          pixels.radiusX,
          0,
          0,
          pixels.radiusY,
          pixels.x,
          pixels.y,
        );
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        gradient.addColorStop(0, rgba(field.color, field.opacity));
        for (const stop of createFalloffStops(softness, field.opacity)) {
          gradient.addColorStop(stop.offset, rgba(field.color, stop.alpha));
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(-1, -1, 2, 2);
      }
    } finally {
      ctx.restore();
    }
  } catch (cause) {
    if (cause instanceof RenderError) throw cause;
    throw new RenderError(
      'render-failed',
      'Canvas gradient rendering failed.',
      { cause },
    );
  }
}

export function renderImage(
  ctx: CanvasRenderingContext2D | null,
  spec: RenderSpec,
  size: RenderSize,
): void {
  const { softness, contrast, grain } = spec.style;
  if (
    !isUnit(grain) ||
    !Number.isFinite(contrast) ||
    contrast < 0 ||
    contrast > 2
  ) {
    throw new RenderError('invalid-style', 'Invalid contrast or grain.');
  }
  // Pipeline order is gradient → contrast (#6) → grain (#5). Until those passes
  // exist, reject requested effects instead of silently claiming to apply them.
  if (contrast !== 1 || grain !== 0) {
    throw new RenderError(
      'unsupported-effect',
      'Contrast and grain passes are not implemented yet.',
    );
  }
  renderGradient2D(ctx, spec.scene, size, { softness });
}
