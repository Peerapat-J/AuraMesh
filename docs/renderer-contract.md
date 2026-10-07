# Canvas gradient renderer v1

Implemented in #4, using the deterministic model from #3. No React dependency. Model generation is separate from Canvas drawing.

```ts
import { renderGradient2D, renderImage, RenderError } from '../engine/renderer';

renderGradient2D(ctx, scene, { width: 1920, height: 1080 }, { softness: 0.65 });
renderImage(ctx, spec, size);
```

## Pipeline and errors

`renderImage()` is the shared entry point for future preview/export. The order is gradient → contrast (#6) → grain (#5). This revision implements only gradient: contrast must be 1 and grain must be 0. Other valid effect values throw `RenderError` with code `unsupported-effect`; they are never silently ignored. The default document's grain 0.04 is intentionally overridden to 0 by the development fixture until #5 lands. Other application defaults remain unchanged.

`RenderError.code` distinguishes `invalid-size`, `invalid-context`, `invalid-scene`, `invalid-style`, `unsupported-effect`, and `render-failed`. Canvas failures retain the original `cause`. Missing/lost context and invalid output sizes are rejected. No silent size fallback or allocation outside the shared 64–4096 side/16,777,216 pixel limits. Size, style and field data are checked before the bitmap is reset, preserving the previous image on invalid input.

The caller owns error display and may retry. Canvas/device allocation failures can still occur within valid limits; those limits do not guarantee every device has enough resources. Rendering is synchronous.

## Context ownership

The renderer owns the target bitmap and drawing state. It assigns canvas width/height on every valid render, even when dimensions match. This clears old pixels, clips, paths and save stacks, so a reused or resized target starts consistently. Caller transforms, alpha, compositing, filter and shadows are discarded. Do not share the context with another drawing routine that expects state to survive.

Drawing uses save/finally-restore around the reset baseline; afterward transform is identity, alpha is 1, compositing is source-over and filter is none. Scene/spec/size inputs are never mutated. Request an sRGB 2D context when creating the target; the fixture does so explicitly.

## Coordinates and falloff

- Opaque base fills the entire bitmap before fields are drawn with source-over compositing.
- Center x and radiusX multiply by width; y and radiusY multiply by height. Each unit radial gradient is transformed to that pixel ellipse. Aspect-ratio changes intentionally stretch the same relative composition; there is no crop or hidden DPR multiplier.
- Field RGB is retained even at alpha zero to avoid interpolation toward transparent black. Drawing is clipped naturally at the target edge.
- Softness chooses the plateau end `0.8 × (1 − softness)`. A 16-segment smoothstep falloff fades field opacity to zero at the radius. Softness 0 still has a smooth outer transition; softness 1 starts fading at the center.
- No Canvas filter, CSS blur, ImageData contrast or grain pass is used here. Softness changes falloff; spread changes radii in scene generation.

API references: [radial gradient coordinates](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient), [canvas width resets drawing state even when unchanged](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/width).

## Development fixture and verification

`pnpm dev` → `/__renderer-demo` provides seed/softness/spread/size inputs for checking fixed scenes. The fixture is loaded only behind `import.meta.env.DEV`; the production bundle contains neither the lab nor its test API. It is not the product editor and provides no download UI.

After `pnpm install --frozen-lockfile`, install the pinned Chromium once:

```sh
pnpm exec playwright install chromium
pnpm verify
# Or production build + Chromium smoke only:
pnpm test:e2e
```

`test:e2e` builds production first, checks fixture exclusion, then uses a temporary Vite server on 127.0.0.1:4174. Tests verify all-pixel alpha/nonuniform output, exact sizes, A→B→A checksums, dirty clips/context cleanup, frozen input nonmutation, softness falloff, invalid-size recovery and uncaught browser errors. Unit tests check geometry conversion, invalid dimensions/radii and falloff without mocking the Canvas API. Verify includes both suites; CI installs Chromium with Linux dependencies before running it.

Performance samples are recorded without a timing assertion. Traces/screenshots on failure and baseline attachments are in ignored `test-results/`. Manual visual evidence, device/browser details and initial measurements are in [renderer-v1 QA](qa/renderer-v1.md). Defaults/visual polish will be revisited with grain in #5 and palette work in #7.
