# Wild Mustang production status, 13 October 2026

The original browser world is preserved. Unity and English Loop are unchanged. The three-chapter release candidate is implemented and built, with licensed animated characters and a complete reunion. A physical iPad and independent child playthrough remain release gates.

## Foundation, issue #5

- [x] Original scene reproduced and captured at commit 6ba7765.
- [x] Walkable ford, dry-land apples, required action priority, working tutorial/input, pause freeze, checkpoint migration and clean restart.
- [x] Pinned Three.js 128, local runtime, Vite build at /wild-mustang/ and verified dist-only Pages workflow.
- [x] Five persistence unit tests and scripted six-objective chapter-one completion/replay.
- [x] PR #10 merged after GitHub CI 24/24 passed across Chromium desktop, Chromium tablet and WebKit tablet emulation. Run 38397634765 at bf271148.
- [x] Actual Safari manual checklist provided; physical testing is recorded below, not inferred from emulation.

## Characters, issue #6

- [x] Actual source Horse.gltf and source CC0 license verified and saved.
- [x] Local 761,596-byte GLB with 50 joints, peaceful clips, authored Trot, original bay/blaze and distinct foal proportions.
- [x] Five independently rigged family horses and original 18-bone Alex with six animations.
- [x] One skinned draw per horse, graceful playable fallback and seven character unit checks.
- [x] Browser-rendered cast, locomotion transitions and corrected ground contact sampled in-engine.
- [x] License/hash/animation catalogue published in ASSET_LICENSES, CHARACTERS and characters.json. Spend $0.

## Full story, issue #7

- [x] Three playable, replayable chapters with 18 objectives, landmarks, routes, interaction effects and short dialogue.
- [x] Willow ford preparation, shared rest, mountain obstacle, visible ridge and explicit family call.
- [x] Final gallop, foal/parent reunion, Alex wave, 'Мы дома', credits/source attribution register and free-wander epilogue.
- [x] Persistent chapter unlocks, next chapter, saved partial interactions, continue and repeat without losing completed chapters.
- [x] Chromium and WebKit automated start-to-ending progression, epilogue/reload/replay evidence. Tests use deterministic travel/cinematic acceleration; duration and child comprehension are unmeasured.

## Release QA, issue #8

- [x] Build and 15 unit checks pass; three-project GitHub CI matrix runs 14 browser scenarios per project on the integrated candidate.
- [x] Local Chromium final 5/5 focus passes; WebKit 12 unique scenarios plus repeated final integration/last-finale gate pass. See QA.md for exact source snapshots and timing-only retries.
- [x] Local assets, glyph-independent SVG controls, 44px touch targets, portrait hint, safe areas and versioned saves.
- [x] Reduced terrain/grass budget, instanced distant peaks, single-draw contact shadows, bounded family scene and actual load gating.
- [x] Software frame/draw metrics recorded separately from hardware requirements.
- [x] Candidate published and verified: Pages run 38407337306 passed 42/42 browser scenarios and 15 unit checks. Public HTML, release.json, all runtime bundles and GLB exactly match the production build by SHA-256.
- [ ] Actual iPad Safari landscape: all chapters, background/restore, orientation, touch cancellation and replay.
- [ ] Sustained >=30 FPS on recorded representative iPad; no desktop software benchmark can satisfy this.
- [ ] Independent Luka playthrough and observed chapter durations against the 10-15 minute design target.

Current release classification: 1.0.0-rc.1. Do not close #8 or master #9 as a fully certified iPad release until the outstanding physical/child gates are recorded. The public candidate can be tested immediately after deployment.

## Post-release polish, issue #14 — 14 October 2026

The following records describe the 14 October feature branches before PRs #15–#17
were merged. Stage A was implemented on `codex/ipad-polish-01`, based on main `188f152`.

- [x] Reproduce native browser two-finger input: holding the joystick suppressed camera swipe; retain before/after game screenshots.
- [x] Allow independent joystick/camera pointers; preserve gallop ownership and clear canceled/capture-lost/rotated/backgrounded inputs.
- [x] Reset the actual camera position with the hero; constrain the desired and smoothed boom against terrain and movement obstacle envelopes, preserving visible hero distance.
- [x] Add ten camera unit checks and four cross-engine touch/camera regressions; focused Chromium tablet checks pass.
- [x] Fix the confirmed missing favicon request with a local original SVG.
- [x] All 56 relevant Chromium desktop/tablet and WebKit tablet scenarios pass; two desktop timing-only retries use the documented single-process runner.
- [x] Complete three-chapter native touch journey, both fords, save/reload, natural cinematics and epilogue passed in 19.6 minutes of automated software-runner wall time; no teleport or simulation/input mutation.
- [x] Stage A PR #15 ready for review; GitHub run 38540716117 passed all three profiles on 79b037a. Before/after evidence and frozen build hashes included.
- [x] Stage B implemented: chapter palettes, layered ridges, flowers, willows/pines, batched scenery, slope-aligned cast and compact emotional endings. Both final Chromium visual cases pass; 33 unit checks, full WebKit story regression and camera focus pass. PR #16 is ready for review; run 38545491658 passed all three profiles on 9a2395f.
- [x] Stage C implemented on `codex/audio-story-polish-03`: 35 local licensed audio files, 23 Russian cues, voice captions/repeat/mute, bounded caches, actual ford escort, optional friend reactions and coherent family/Alex formation. 63 unit checks pass; the five final audio/companion scenarios pass in Chromium and WebKit. Full three-chapter native touch journey passed in 25.7 minutes of automated wall time, with save/reload, natural cinematics and epilogue; zero injected progress. Stage C PR #17 includes before/after screenshots, frozen build hashes and the full protocol. Its final-head CI must be green before review readiness.

Physical iPad Safari, hardware FPS, independent child comprehension and 10–15-minute chapter durations remain separate unverified gates. Automated route planning around observed colliders is not a child's independent playthrough.

## Graphics polish — 20 October 2026

PRs #15–#17 are merged in main `6bd97a7`. This graphics-only pass is on
`codex/graphics-polish-04`, based on that main, with runtime source `2606207`
and release metadata in `18ae9dc`.

- [x] Fast environment/lighting pass: chapter-specific sun directions, linear light colours, output-space fog for Three r128, restrained sky glow and distinct morning/riverside/evening palettes.
- [x] Hero-scene polish: layered lower mountains, slope-based rocky ground, river-width-aware banks, world-anchored water highlights, low plant/stone/flower groups and terrain-conforming soft scenery shadows.
- [x] Preserve physical terrain, routes, collisions, camera envelopes, characters, chapter objectives, audio, ending and save schema. Existing story-environment instance transforms and camera bounds match the base; distant decorative ridges are intentionally reshaped.
- [x] Keep medium grass count while reducing each tuft from 12 to 8 triangles; batch immutable global scenery in 32m tiles without changing its world surfaces or materials.
- [x] Bound scenery-shadow geometry to each soft oval, without alpha discard or shadow-map passes; re-centre static batches for correct object-depth sorting.
- [x] QA build and 69 unit checks pass, including physical-terrain, clipped-shadow area and world-surface preservation checks.
- [x] Matched before/after frames and measured rendering budget for start, ford, clearing, ascent and herd: at most 137,563 triangles/68 calls versus 149,557/79 before. First three frames passed their guards in a run that later reached its 600s overall cap; a separate unchanged-cap tail run passed the other two.
- [x] Add two guarded water/bank comparisons, including a readable view along the channel; seven paired poses/14 PNG in total. No water-animation or physical FPS claim follows from these frozen frames.
- [x] Run unchanged WebKit regressions and a baseline control: initial 11/18 pass, focused 3/7 pass; 14/18 unique pass at least once. Preserve all failures and movement diagnostics. Baseline also times out at the ford. This is not a clean regression gate or proof of equal performance.
- [x] Production rebuild without QA hooks passes; all 18 release fingerprints match and runtime JS contains no QA hook symbol.
- [x] Production WebKit smoke passes: public touch New Game/HUD/local model, no QA hooks even with the query, matching served asset hashes and no errors.
- [ ] Clean WebKit regression and physical iPad FPS gates remain open; no performance-equality claim is inferred from the software runner.
- [ ] Separate PR with screenshots and explicit software/hardware measurement limits. No merge or deployment in this pass.
