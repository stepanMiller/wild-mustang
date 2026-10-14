# Stage C natural journey — 14 October 2026

The complete adventure passed **1/1 in 25.7 minutes**, from 10:11:11.141 to 10:36:51.118 UTC. The run used Chromium 154.0.8037.57, the iPad Pro 11 landscape emulation profile (1194 × 834 CSS pixels, DPR 2), and public low quality for software-rendering throughput. Menu/start captures preceded the quality change. Physical iPad Safari performance and independent child navigation remain manual checks.

The source stayed frozen on port 4184 throughout the journey: core `acd008e`, game bundle `game-Cf9JkzMZ.js`, SHA-256 `76c3a1566358be18b1f6c67c1bbdc48319ba7650f0fdf219c6778086fba79605`. [frozen-stage-c-build.json](frozen-stage-c-build.json) verifies HTTP bytes for the HTML, all three runtime JavaScript bundles, horse GLB, all 35 local audio files and their manifest. It also records hashes of the 15 modules extracted from this exact build's source map.

The driver skipped tutorial through its public button, physically approached Alex, built trust normally, and used genuine browser touch movement and interaction buttons through all three chapters. It completed the first objective, used public Pause/save, reloaded, and pressed Continue. Quest, position, inventory, trust and chapter survived. All cinematics ran at their production timing. The final card opened, then the driver moved with the public joystick in epilogue. The result has zero teleports, injected input, injected checkpoints or cinematic acceleration, 33 route checkpoints, 47 story events and no page/console errors.

The route planner observes terrain and obstacles to choose walking detours around visible geometry. Its 34 authored segments passed preflight. This demonstrates a traversable route with normal physics; it does not represent a seven-year-old finding the route independently.

| Observed event | Actual result |
| --- | --- |
| Public hero pet | Alex animation `Pet`, hero `Idle_Headlow` after 3.4 simulation seconds |
| Foal rescue | Three real branch interactions; foal `Idle_Headlow` after its ordinary reaction |
| Shallow-ford escort | Foal / Alex cleared the east bank by 8.335 / 8.143 m; dry ground heights 10.712 / 10.462 m |
| Public apple sharing | Hero and foal `Eating`, Alex `Pet` after 4.75 simulation seconds |
| Mountain obstacle | Both branches removed; foal reacted during the ordinary scene |
| Family reunion | Foal and parent 1.783 m apart, both `Idle_Headlow`; Alex and all herd positions recorded |
| Epilogue | Real touch movement, completed chapters `[1,2,3]`, audio context still `running` |

The audio engine restarted normally on reload. Before/after reload it started 5 + 17 voice cues and 102 + 897 effects; unavailable audio lists stayed empty. These counters demonstrate decoded playback through the browser audio graph, rather than a human listening test. The original opening dialogue survived in all three chapters, with voice captions recorded separately.

Read-only snapshots are retained in [after-natural-route.json](after-natural-route.json). [after-story-summary.json](after-story-summary.json) indexes the audio sessions, reactions, bank measurements and formation without changing the raw protocol. In the captured action events, `action` is the currently available interaction after a press; `questId` and `effect` identify the tested public action. The future recorder retains `performedAction` separately.

Observed low-quality frame counts peaked at 146,220 triangles and 181 calls. They are renderer counts, not a hardware frame-rate claim. Medium-quality scene/gait budgets are documented separately in Stage B.

Reproduce the opt-in journey with [natural-route.spec.js](../../natural-route.spec.js), Chromium tablet project, and:

```sh
WILD_MUSTANG_NATURAL_ROUTE=1 \
WILD_MUSTANG_STORY_TRACE=1 \
WILD_MUSTANG_EVIDENCE_DIR=tests/evidence/audio-story-polish-03 \
npx playwright test tests/natural-route.spec.js --grep 'Natural route:' --project=chromium-ipad
```

The captured cloud run used an isolated config with `webServer` disabled and the frozen port 4184, system Chromium, and single-process software rendering. The evidence directory override preserves the prior Stage A protocol.

The separate scripted story regression initially failed its 90-second crossing
poll after jumping the hero roughly 150 m ahead of the companions.
[CI annotations](ci-shortcut-fixture-diagnosis.json) record that failure. The
scripted helper now restores its existing west-bank checkpoint through public
Pause/Menu/Continue and checks preserved progress before moving only the hero
ahead. Companions still cross through ordinary game code; no shipping logic or
timeout changed. CFT151 full story/replay then passed 1/1 in 4.4 minutes. This
fixture repair does not alter the natural protocol above.
