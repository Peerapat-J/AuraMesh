import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { DemoConfig } from '../src/dev/renderer-demo';

async function render(page: Page, config: DemoConfig = {}) {
  return page.evaluate(
    (settings) => window.__aurameshDemo.render(settings),
    config,
  );
}

async function pixels(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector('canvas')!;
    const data = canvas
      .getContext('2d')!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest('SHA-256', data);
    let opaque = true;
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < data.length; index += 4) {
      opaque &&= data[index + 3] === 255;
      const rgb = data[index] + data[index + 1] + data[index + 2];
      min = Math.min(min, rgb);
      max = Math.max(max, rgb);
    }
    return {
      checksum: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      opaque,
      min,
      max,
      width: canvas.width,
      height: canvas.height,
    };
  });
}

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/__renderer-demo');
  await expect(page.getByRole('status')).toContainText('256 × 256');
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test('production bundles omit the development fixture', () => {
  for (const file of readdirSync('dist/assets').filter((file) =>
    file.endsWith('.js'),
  )) {
    const bundle = readFileSync(`dist/assets/${file}`, 'utf8');
    expect(bundle).not.toContain('__aurameshDemo');
    expect(bundle).not.toContain('renderer lab');
  }
});

test('opaque nonuniform images at all required output sizes', async ({
  page,
}) => {
  for (const [width, height] of [
    [256, 256],
    [1024, 1024],
    [1920, 1080],
    [1080, 1920],
    [3840, 2160],
  ]) {
    const result = await render(page, { width, height });
    const image = await pixels(page);
    expect(image.opaque).toBe(true);
    expect(image.max - image.min).toBeGreaterThan(20);
    expect([image.width, image.height]).toEqual([width, height]);
    expect(result.inputUnchanged).toBe(true);
  }
});

test('A → B → A reproduces pixels despite old context state and resize', async ({
  page,
}) => {
  await render(page, { seed: 1234 });
  const original = await pixels(page);
  await render(page, { seed: 4321, width: 512, height: 320 });
  expect((await pixels(page)).checksum).not.toBe(original.checksum);
  const restored = await render(page, { seed: 1234, dirtyContext: true });
  expect(await pixels(page)).toEqual(original);
  expect(restored.context.alpha).toBe(1);
  expect(restored.context.composite).toBe('source-over');
  expect(restored.context.filter).toBe('none');
  expect(restored.context.transform).toEqual([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  expect(restored.inputUnchanged).toBe(true);
});

test('softness widens falloff without introducing a circle edge', async ({
  page,
}) => {
  const sample = async (softness: number) =>
    page.evaluate((value) => {
      window.__aurameshDemo.probe(value);
      const ctx = document.querySelector('canvas')!.getContext('2d')!;
      return Array.from(
        { length: 105 },
        (_, offset) => ctx.getImageData(128 + offset, 128, 1, 1).data[0],
      );
    }, softness);
  const crisp = await sample(0);
  const soft = await sample(1);
  expect(crisp[50]).toBeGreaterThan(soft[50]);
  expect(crisp[104]).toBe(0);
  expect(soft[104]).toBe(0);
  for (const values of [crisp, soft]) {
    expect(
      Math.max(
        ...values
          .slice(1)
          .map((value, index) => Math.abs(value - values[index])),
      ),
    ).toBeLessThan(25);
  }
});

test('invalid dimensions fail before destroying the last valid image', async ({
  page,
}) => {
  const original = await pixels(page);
  const failure = await page.evaluate(() => {
    try {
      window.__aurameshDemo.render({ width: 8192, height: 8192 });
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(failure).toBe('Unsupported render dimensions.');
  expect(await pixels(page)).toEqual(original);
});

test('records gradient baseline without imposing a timing gate', async ({
  page,
}, testInfo) => {
  const baseline = [];
  for (const [width, height] of [
    [1024, 1024],
    [3840, 2160],
  ]) {
    for (const config of [
      { seed: 1234, spread: 0.65 },
      {
        seed: 4294967295,
        spread: 1,
        colors: ['#381B32', '#F07858', '#F2C879'],
      },
    ]) {
      await render(page, { ...config, width, height }); // discarded warm-up
      const samples = [];
      for (let index = 0; index < 7; index += 1) {
        samples.push(
          (await render(page, { ...config, width, height })).elapsedMs,
        );
      }
      const sorted = [...samples].sort((a, b) => a - b);
      baseline.push({
        width,
        height,
        ...config,
        softness: 0.65,
        samples,
        min: sorted[0],
        median: sorted[3],
        max: sorted[6],
      });
    }
  }
  const result = {
    browser: await page.evaluate(() => navigator.userAgent),
    method:
      'renderImage bitmap reset + gradient + 1-pixel readback; scene construction excluded; 1 warm-up + 7 samples',
    baseline,
  };
  const baselinePath = testInfo.outputPath('gradient-baseline.json');
  writeFileSync(baselinePath, JSON.stringify(result, null, 2));
  await testInfo.attach('gradient-baseline.json', {
    path: baselinePath,
    contentType: 'application/json',
  });
  console.log(JSON.stringify(result));
});
