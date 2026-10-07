# AuraMesh renderer v1: deterministic model

Implemented by [#3](https://github.com/Peerapat-J/AuraMesh/issues/3). This module produces data only; Canvas rendering starts in #4. The current application page remains the bootstrap shell.

## Public API

| File                     | Responsibility                                         |
| ------------------------ | ------------------------------------------------------ |
| `src/engine/types.ts`    | Readonly document, scene, render style, and size types |
| `src/engine/defaults.ts` | Shared frozen defaults and validation limits           |
| `src/engine/config.ts`   | Runtime normalization and output-size validation       |
| `src/engine/random.ts`   | Seeded random source and independent stream derivation |
| `src/engine/scene.ts`    | Pure `createScene()` and `buildRenderSpec()`           |

```ts
import { normalizeDocument } from '../engine/config';
import { buildRenderSpec } from '../engine/scene';

const document = normalizeDocument(untrustedInput);
const spec = buildRenderSpec(document);
// #4 will render spec.scene with spec.style onto a canvas of a validated size.
```

Normalization accepts unknown input and creates fresh nested records/color arrays. It does not modify inputs or expose mutable aliases of shared defaults. Model/scene modules have no React, DOM, storage, or Canvas dependency.

## Normalization rules

- Seed: integer uint32, 0–4294967295. Invalid values, including overflow, fractions, strings, NaN and infinity, fall back to 1234; negative zero becomes zero. No silent uint32 wrap of user input.
- Softness/spread/grain: finite values clamp to 0–1; defaults 0.65/0.65/0.04. Contrast clamps to 0–2; default 1 is identity. Missing/non-finite/non-number values use defaults.
- Palette: 3–6 opaque `#RRGGBB` strings, normalized uppercase. Invalid color lists replace the entire palette with Ocean. Valid colors retain a syntactically valid lowercase preset ID or use null; preset existence/reset behavior belongs to #7/#8.
- Initial Ocean: `#0B1F3A`, `#155E75`, `#0891B2`, `#67E8F9`. These colors await visual calibration in #4/#7.
- Output: finite integer sides 64–4096, total <=16,777,216 pixels. Invalid size replaces the pair with 1920×1080. Editors/exporters must call `isValidRenderSize()` to reject invalid drafts rather than silently exporting a fallback size.
- Format: `png` or `jpeg`; otherwise PNG.
- Missing renderer version uses 1. An explicitly unsupported renderer version throws RangeError so storage can reject the document; it is never silently relabeled as v1. Persistence schema checks/catching this error belong to #11.

App release `0.1.0`, document `rendererVersion: 1` and future storage `schemaVersion: 1` serve different purposes.

## Seeded random source

`createRandom(seed)` uses SplitMix32: a uint32 Weyl counter stepped by `0x9E3779B9`, mixed with `0x21F0AAAD` and `0x735A2D97`. State wraps on every step, preventing double-precision drift during large pixel loops.

Algorithm references: [JavaScript SplitMix32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md#splitmix32) and [Tommy Ettinger's corrected 32-bit counter/mixer discussion](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c).

- `next()`: fraction in `[0, 1)`.
- `range(min, max)`: finite ordered float bounds; constant bounds do not consume a sample. Floating-point rounding may reach the upper bound.
- `int(min, max)`: inclusive safe-integer bounds spanning at most 2^32 values; constant bounds do not consume a sample. This simple scaling helper is intended for procedural scene choices.
- Invalid range bounds throw RangeError.
- `deriveSeed(root, 'geometry' | 'grain')`: mix the normalized root XOR the fixed stream tag (`0x47454F4D` or `0x47524149`). Grain never consumes the geometry stream.
- There is no ambient Math.random, crypto, clock or browser state in these modules. UI Randomize will acquire a new root seed separately in #7.

Known sequences are pinned as uint32 fixtures generated independently with unsigned Python arithmetic from the published algorithm. Tests include seed zero/max and the 4,000,000th sample.

## Scene rules

- Six fields, independent of palette size.
- The first palette color is the opaque base; field i uses color `(i + 1) % palette.length`.
- Each field consumes geometry samples in fixed order: x, y, radiusX, radiusY, opacity.
- Centers range from -0.2 to 1.2, allowing fields to extend beyond the frame.
- Base radii range 0.18–0.48; multiply by `0.6 + 0.9 × spread`, resulting in 0.108–0.72 across allowed spread values.
- Opacity ranges 0.45–0.85. Values are normalized data, independent of pixels/aspect ratio.
- Grain seed is derived directly from the root seed, independent of field count, palette size and geometry sampling.

Spread scales coverage without resampling centers or opacity. Changing palette colors/count changes color assignment but preserves geometry and grain seed. Softness/contrast/grain are render style; output size/format/source preset metadata do not influence scene generation.

`buildRenderSpec(document)` normalizes the document, creates the scene from version/seed/actual colors/spread, and passes softness/grain/contrast separately as style. The shared rendering order gradient → contrast → grain will be implemented in #4–#6.

Same normalized scene inputs reproduce equal scene data. This does not promise pixel-identical images across browsers, different output sizes, or encoded JPEG/PNG bytes. Before a future algorithm/default change ships, decide renderer-version compatibility and update fixtures/docs together.

## Verification

Run `pnpm verify`. Engine tests use the Node environment and cover known sequences, long-run state, range errors, normalizers/boundaries, frozen defaults/input nonmutation, seed A→B→A, geometry invariants, palette/spread changes and render-style separation. Visual/browser renderer QA begins in #4; no new image behavior is claimed by this issue.
