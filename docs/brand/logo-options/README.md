# Scam Shield logo options

Three colourways of one original, manually drawn mark: an open shield, an S ribbon, and an overlapping inspection lens. The geometry is identical across A, B and C. Preview: [board.png](board.png), or open [board.html](board.html) at its native 2400 × 1600 size.

| Option | Frame / wordmark | Ribbon | Accent | Ribbon highlight | Reasoning |
| --- | --- | --- | --- | --- | --- |
| A · Blue / Cyan | `#102B50` | `#1764E8` | `#34C9E8` | `#A8ECF8` | The closest connection to the owner's reference, pairing navy authority with a clear electric-blue inspection cue. |
| B · Teal / Emerald | `#103E40` | `#0F766E` | `#23B99D` | `#A1EDDA` | Builds directly on the app's existing teal, with emerald giving the ribbon definition and a calm, premium character. |
| C · Indigo / Violet | `#272C59` | `#5555CE` | `#9A7CEF` | `#DDD3FF` | A distinctive technology-oriented alternative, grounded by deep indigo rather than relying on bright purple alone. |

All dark lockups and app mockups use navy `#081B32`; the dark wordmark is `#F6FAFF`. Dark frame/lens colours are A `#79DDF2`, B `#72DCC6`, C `#C2B2FF`. The flat small-mark colours are A `#2374DC`, B `#148C80`, C `#7770DE`.

**Recommendation: B.** It carries the owner's shield/ribbon/lens concept into the existing product identity without introducing a competing primary colour. A is the strongest choice if fidelity to the blue reference is the deciding factor.

## Assets

Each of `option-a/`, `option-b/` and `option-c/` contains:

- `mark.svg` — transparent, `viewBox="0 0 256 256"`; two restrained ribbon planes, linear gradients only.
- `mark-small.svg` — transparent, same viewBox; flat colour, thicker frame, larger lens, simplified ribbon, for 16–32 px use. Also shown at 64 px for comparison.
- `lockup-horizontal.svg` — outlined wordmark to the right, transparent, `viewBox="0 0 720 200"`.
- `lockup-on-dark.svg` — adjusted colours on a rounded navy panel, same lockup viewBox.
- `mark-mono.svg` — one visible ink using `currentColor`, with transparent separation around the lens. Intended for larger print and stamp applications; use the small mark for tiny digital placements.
- `mark-512.png` — 512 × 512 RGBA export with transparent background.

The wordmark is Avenir Next Demi Bold, outlined locally through CoreText. Every letter is a filled SVG path; no font, external asset, or live text is required to display any delivered logo. The original mark was drawn with deliberate cubic Béziers, not raster tracing.

## Refinements from the reference

The shield body follows a symmetric 256-unit grid. Its exposed ends are round; the right frame pauses beside the ribbon to keep the S dominant. The ribbon uses two clean surfaces instead of glossy white reflections. The lens is centred near the bottom, with a transparent clearance around its ring and handle so overlaps remain legible on different backgrounds. Its interior is also transparent. The small version drops the dimensional surfaces and enlarges the inspection lens.

## Review and reproduction

The supplied reference was viewed. Four successive board renders were visually inspected, with changes to small-mark contrast, frame thickness, dark ribbon colours, and exposed shield ends. The board includes native-size icons plus integer nearest-neighbour enlargements of the 16, 24, 32 and 64 px rasterisations; the bottom navy panel also shows the 16 px raster enlarged. Rounded-square phone icons and monochrome marks appear along the bottom.

The small colours have white/navy contrast ratios of A 4.56/3.79, B 4.12/4.20, and C 4.07/4.25, measured for the solid inks. Antialiasing reduces apparent contrast at the edges. At 16 px the shield and lens survive, but the S reads as a compact ribbon gesture; 24–32 px is more comfortable. That is the main remaining design compromise.

Run from the repository root, using the already installed Playwright and Chromium:

```sh
node docs/brand/logo-options/build-logos.mjs
node docs/brand/logo-options/render-board.mjs
```

`wordmark-path.json` preserves the outlined letter paths. The optional `outline-wordmark.swift` helper regenerates that JSON on macOS from the locally installed Avenir Next font; it is unnecessary for rebuilding the delivered SVGs or preview board.
