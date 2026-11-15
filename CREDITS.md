# Credits

Every third-party asset shipped with the site, where it came from, and its license.
Raw downloads are optimized by `tools/optimize-assets.mjs` (Meshopt geometry, WebP textures) before they land in `assets/`.

## 3D models

| File (`assets/models/`) | Asset | Author / source | License |
| --- | --- | --- | --- |
| `metal_office_desk.glb` | Metal Office Desk | [Poly Haven](https://polyhaven.com/a/metal_office_desk) | CC0 1.0 |
| `television_02.glb` | Television 02 (the CRT monitor) | [Poly Haven](https://polyhaven.com/a/television_02) | CC0 1.0 |
| `desk_lamp_arm_01.glb` | Desk Lamp Arm 01 | [Poly Haven](https://polyhaven.com/a/desk_lamp_arm_01) | CC0 1.0 |
| `potted_plant_04.glb` | Potted Plant 04 | [Poly Haven](https://polyhaven.com/a/potted_plant_04) | CC0 1.0 |
| `potted_plant_02.glb` | Potted Plant 02 | [Poly Haven](https://polyhaven.com/a/potted_plant_02) | CC0 1.0 |
| `boombox.glb` | Boombox | [Poly Haven](https://polyhaven.com/a/boombox) | CC0 1.0 |
| `wooden_lantern_01.glb` | Wooden Lantern 01 | [Poly Haven](https://polyhaven.com/a/wooden_lantern_01) | CC0 1.0 |
| `painted_wooden_bench.glb` | Painted Wooden Bench | [Poly Haven](https://polyhaven.com/a/painted_wooden_bench) | CC0 1.0 |
| `rock_moss_set_01.glb` | Rock Moss Set 01 | [Poly Haven](https://polyhaven.com/a/rock_moss_set_01) | CC0 1.0 |
| `tree_stump_01.glb` | Tree Stump 01 | [Poly Haven](https://polyhaven.com/a/tree_stump_01) | CC0 1.0 |
| `fern_02.glb` | Fern 02 | [Poly Haven](https://polyhaven.com/a/fern_02) | CC0 1.0 |
| `shrub_sorrel_01.glb` | Shrub Sorrel 01 | [Poly Haven](https://polyhaven.com/a/shrub_sorrel_01) | CC0 1.0 |
| `shiba.glb` | Shiba Inu (rigged, animated) | Quaternius, via [Poly Pizza](https://poly.pizza/m/y4wdQpg767) | CC0 1.0 |
| `husky.glb` | Husky (rigged, animated) | Quaternius, via [Poly Pizza](https://poly.pizza/m/wcWiuEqwzq) | CC0 1.0 |
| `player.glb` | The Sound Guy – Animated (player character; run reuses the walk cycle, wave is procedural) | Tony Flanagan, via [Fab](https://www.fab.com/listings/4eb5363a-3da1-488a-87ea-1f81c1181d41) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution required |
| `cat_longhair.glb` | Cat long haired (rigged, walk and run) | Sean4297, via [Fab](https://www.fab.com/listings/b3513111-6dc1-4345-9706-201c8f37b832) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution required. Changes: one copy tinted warmer. |
| `gaming_chair.glb` | SillaGamerBlack (gaming chair) | MashiMaro, via [Fab](https://www.fab.com/listings/985d2295-ff1e-4c0e-9ea0-015a883ed617) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) — attribution required |

## Textures and sky

| File | Asset | Source | License |
| --- | --- | --- | --- |
| `assets/hdri/sky_1k.hdr`, `assets/hdri/sky.jpg` | Kloofendal 48d Partly Cloudy (Pure Sky) HDRI | [Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | CC0 1.0 |
| `assets/textures/forrest_ground_01_*.webp` | Forrest Ground 01 | [Poly Haven](https://polyhaven.com/a/forrest_ground_01) | CC0 1.0 |
| `assets/textures/dirt_floor_*.webp` | Dirt Floor | [Poly Haven](https://polyhaven.com/a/dirt_floor) | CC0 1.0 |
| `assets/textures/bark_*.webp`, `assets/textures/leaves.webp` | Bark and leaf textures from Jacaranda Tree (the tree geometry itself is generated in `world/flora.js`) | [Poly Haven](https://polyhaven.com/a/jacaranda_tree) | CC0 1.0 |

Grass, flowers, the keyboard, mouse, mug, butterflies, birds and the monitor's screen image are generated in code.

## Fonts (`assets/fonts/`)

| Font | Source | License |
| --- | --- | --- |
| Bricolage Grotesque | [Google Fonts](https://fonts.google.com/specimen/Bricolage+Grotesque) | SIL Open Font License 1.1 |
| Inter | [Google Fonts](https://fonts.google.com/specimen/Inter) | SIL Open Font License 1.1 |
| JetBrains Mono | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) | SIL Open Font License 1.1 |

## Code

| Library | Use | License |
| --- | --- | --- |
| [three.js](https://threejs.org) r187 (`vendor/three.bundle.min.js`, built by `tools/build-vendor.mjs`) | Rendering (WebGPU with WebGL 2 fallback), loaders, post-processing | MIT — see `vendor/THREE-LICENSE` |

Build-time only (not shipped): glTF-Transform, meshoptimizer, sharp, esbuild, Playwright.

## Unchanged from the previous site

`sounds/`, `games/`, `pinball/`, `autoflow/`, `desktop.html` and its scripts/styles, and `mobile.html` were not modified by the world-v2 work and keep whatever terms they already had.
