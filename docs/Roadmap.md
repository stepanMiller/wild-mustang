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
