The prairie previously read as one flat, dusty palette, with oversized mountain silhouettes and little separation between the three chapters. This graphics-only pass adds honey-coloured morning light, a cool green riverside and an amber mountain evening, with layered distant ridges, clearer banks and restrained water highlights. Small plant/stone/flower groups frame the start, ford, clearing, ascent and herd meadow.

The existing three chapters, objectives, characters, ending, collisions, camera, touch input and saves are preserved. All new artwork is local procedural geometry; no paid generation or new third-party assets/dependencies were used. Refs #14.

Static scenery is batched in 32m tiles. Medium keeps 4,000 grass tufts and pixel ratio 1.35 while reducing each tuft from 12 to 8 triangles. Terrain-conforming scenery shadows share one 64px texture and one draw per chapter. Their geometry is clipped to the soft oval; alpha discard, shadow maps, reflections and postprocessing remain disabled.

Validation and matched screenshots: [full evidence](https://github.com/stepanMiller/wild-mustang/blob/codex/graphics-polish-04/tests/evidence/graphics-polish-04/README.md), [QA limitations](https://github.com/stepanMiller/wild-mustang/blob/codex/graphics-polish-04/docs/QA.md).

All 69 unit checks and the QA build pass. Across the five matched medium hero views, peak observed triangles fall from 149,557 to 137,563 and calls from 79 to 68. The first final capture run saved three guarded pairs before its 600s total cap; the remaining two passed in a separate tail run with the same cap. The incomplete run remains recorded as failed, with no browser errors.

| View | Draw calls before → after | Triangles before → after |
|---|---:|---:|
| Start | 77 → 68 | 125158 → 111478 |
| Ford | 79 → 67 | 144690 → 132538 |
| Clearing | 39 → 41 | 137172 → 125020 |
| Ascent | 57 → 50 | 149557 → 137563 |
| Herd meadow | 27 → 30 | 145207 → 133213 |

The initial unchanged WebKit 26.5 run is **11/18 passed, 7 failed**, with no retries: five startup 20s timeouts, a 90s companion-ford timeout and a 100s restart timeout during trust growth. The frozen main baseline passes newgame but also reaches the same 90s ford timeout. Both friends keep moving in both builds; candidate movement covered less distance in that sample, so performance equality is **unproven**. Exact outcomes and provenance are preserved in the linked evidence. This remains a draft with iPad/FPS and clean regression gates open.

The one focused run of the seven failures is **3/7 passed, 4 failed**, still with the original limits and no retries. Fourteen of 18 unique scenarios passed at least once; there is no complete clean run. Remaining scopes are loading, tutorial acceleration within 12s and the total 300s story cap at the moving-companion ford. All outcomes and baseline diagnostics remain in the evidence.

The **production build and production WebKit smoke pass**: public touch New Game opens HUD, local model returns 200, hooks stay undefined even with `?qa=1`, no page/console/HTTP errors, and index/3 JS/GLB bytes match dist. All 18 release fingerprints match. Production runtime game SHA-256: `27feb88708aa07eaa9b7868caccfcb692d7e9a5597b7c5d2ef5be1f64a34b02f`.

| Scene | Before | After |
|---|---|---|
| Start | ![Before start](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-01-start.png) | ![After start](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-01-start.png) |
| Ford | ![Before ford](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-02-ford.png) | ![After ford](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-02-ford.png) |
| Clearing | ![Before clearing](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-03-clearing.png) | ![After clearing](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-03-clearing.png) |
| Ascent | ![Before ascent](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-04-ascent.png) | ![After ascent](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-rest-04-ascent.png) |
| Herd meadow | ![Before herd](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-05-family.png) | ![After herd](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-rest-05-family.png) |
| River surface | ![Before river](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/before-river-07-river-look.png) | ![After river](https://raw.githubusercontent.com/stepanMiller/wild-mustang/codex/graphics-polish-04/tests/evidence/graphics-polish-04/after-final-river-07-river-look.png) |

The screenshots use matched scripted Continue fixtures, not a new natural-route playthrough. Cloud Chromium/SwiftShader frame timing is variable and inconclusive; lower geometry/draw counts do not establish physical iPad performance. Actual iPad Safari, sustained 30 FPS and independent child navigation remain manual gates. This PR does not deploy or merge main and does not close #8, #9 or #14.
