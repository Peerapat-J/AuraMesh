import { DEFAULT_DOCUMENT } from '../engine/defaults';
import { renderImage } from '../engine/renderer';
import { buildRenderSpec } from '../engine/scene';

export interface DemoConfig {
  seed?: number;
  softness?: number;
  spread?: number;
  colors?: readonly string[];
  width?: number;
  height?: number;
  dirtyContext?: boolean;
}

export interface DemoResult {
  elapsedMs: number;
  inputUnchanged: boolean;
  context: {
    transform: number[];
    alpha: number;
    composite: string;
    filter: string;
  };
}

declare global {
  interface Window {
    __aurameshDemo: {
      render(config?: DemoConfig): DemoResult;
      probe(softness: number): void;
    };
  }
}

export function mountRendererDemo(root: HTMLElement): void {
  document.title = 'AuraMesh renderer lab (development only)';
  root.innerHTML = `
    <main class="renderer-lab">
      <h1>AuraMesh renderer lab</h1>
      <p>Development fixture for #4. Gradient only; contrast and grain are pending.</p>
      <form>
        <label>Seed <input name="seed" type="number" value="1234" min="0" max="4294967295" required></label>
        <label>Softness <input name="softness" type="number" value="0.65" min="0" max="1" step="0.05" required></label>
        <label>Spread <input name="spread" type="number" value="0.65" min="0" max="1" step="0.05" required></label>
        <label>Width <input name="width" type="number" value="256" min="64" max="4096" required></label>
        <label>Height <input name="height" type="number" value="256" min="64" max="4096" required></label>
        <button type="submit">Render</button>
      </form>
      <p role="status"></p>
      <canvas aria-label="Gradient fixture"></canvas>
    </main>`;
  const style = document.createElement('style');
  style.textContent = `
    .renderer-lab { width: min(1100px, 100%); padding: 24px; margin: auto; }
    .renderer-lab h1 { font-size: 24px; }
    .renderer-lab form { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
    .renderer-lab label { display: grid; gap: 4px; }
    .renderer-lab input { width: 130px; padding: 6px; }
    .renderer-lab button { align-self: end; padding: 8px 16px; }
    .renderer-lab canvas { display: block; max-width: 100%; height: auto; border: 1px solid #d7dce4; }
  `;
  root.append(style);
  const canvas = root.querySelector('canvas')!;
  const form = root.querySelector('form')!;
  const status = root.querySelector('[role="status"]')!;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Canvas 2D is unavailable.');

  function render(config: DemoConfig = {}): DemoResult {
    const spec = buildRenderSpec({
      ...DEFAULT_DOCUMENT,
      seed: config.seed ?? 1234,
      palette: {
        sourcePresetId: null,
        colors: config.colors ?? DEFAULT_DOCUMENT.palette.colors,
      },
      appearance: {
        softness: config.softness ?? 0.65,
        spread: config.spread ?? 0.65,
        contrast: 1,
        grain: 0,
      },
    });
    const size = Object.freeze({
      width: config.width ?? 256,
      height: config.height ?? 256,
    });
    // Real frozen model data checks mutation without mocking Canvas calls.
    spec.scene.fields.forEach(Object.freeze);
    Object.freeze(spec.scene.fields);
    Object.freeze(spec.scene);
    Object.freeze(spec.style);
    Object.freeze(spec);
    const before = JSON.stringify(spec);
    if (config.dirtyContext) {
      ctx!.translate(17, 23);
      ctx!.globalAlpha = 0.1;
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.filter = 'blur(12px)';
      ctx!.shadowColor = '#FF0000';
      ctx!.shadowBlur = 10;
      ctx!.beginPath();
      ctx!.rect(0, 0, 1, 1);
      ctx!.clip();
      ctx!.save();
    }
    const start = performance.now();
    renderImage(ctx, spec, size);
    // Force Canvas command completion. Baseline includes this one-pixel readback.
    ctx!.getImageData(0, 0, 1, 1);
    const elapsedMs = performance.now() - start;
    const result = {
      elapsedMs,
      inputUnchanged: before === JSON.stringify(spec),
      context: {
        transform: Array.from(ctx!.getTransform().toFloat64Array()),
        alpha: ctx!.globalAlpha,
        composite: ctx!.globalCompositeOperation,
        filter: ctx!.filter,
      },
    };
    status.textContent = `${size.width} × ${size.height} · seed ${config.seed ?? 1234} · gradient ${elapsedMs.toFixed(2)} ms (includes readback)`;
    return result;
  }

  window.__aurameshDemo = {
    render,
    probe(softness) {
      renderImage(
        ctx,
        {
          scene: {
            baseColor: '#000000',
            grainSeed: 0,
            fields: [
              {
                x: 0.5,
                y: 0.5,
                radiusX: 0.4,
                radiusY: 0.4,
                opacity: 1,
                color: '#FFFFFF',
              },
            ],
          },
          style: { softness, contrast: 1, grain: 0 },
        },
        { width: 256, height: 256 },
      );
    },
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    try {
      render(
        Object.fromEntries(
          ['seed', 'softness', 'spread', 'width', 'height'].map((key) => [
            key,
            Number(values.get(key)),
          ]),
        ),
      );
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Render failed.';
    }
  });
  render();
}
