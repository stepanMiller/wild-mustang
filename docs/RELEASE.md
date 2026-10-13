# Ветер прерий, 1.0.0-rc.1

Release candidate prepared 13 October 2026. All three story chapters are implemented, with animated in-engine characters, a family reunion, free-wander epilogue, chapter replay and versioned local saves. The production URL is https://stepanmiller.github.io/wild-mustang/ after the verified Pages deployment.

## Implemented behavior

Chapter 1 preserves the original storm/meet/tracks/apples/creek/foal/hill story. The creek has a shallow ford, the submerged apple is moved to dry land, essential actions beat optional petting, tutorial keyboard/touch input works, partial rescue survives saves, and restart clears the world.

Chapter 2 adds willow landmarks, preparation of three ford stones, a safe crossing with both companions, sharing food and discovery of the mountain trail. Chapter 3 adds a winding pine route, a two-branch obstacle for the foal, the ridge, an explicit call to the herd and a short gallop into the family. Alex waves; the foal reaches the recognizable parent. The ending opens free wandering and all chapters remain replayable.

Horse, foal and five family horses use independently animated CC0 rigs. Alex has original skinned geometry and six skeletal clips. All game libraries, models, UI artwork and synthesized audio are local. No paid generation, asset purchase, account, backend or tracking was added. Unity and English Loop are untouched.

## Evidence and limits

- Production build succeeds. Twelve unit checks validate real glTF skeletons/clips, character behavior/fallback and save migration.
- Chromium and Linux WebKit exercised real keyboard/pointer handlers, pause, checkpoints, repeat play, all three chapter transitions, reunion, epilogue and reload/replay. Deterministic progression tests teleport between objectives and fast-forward cinematics. They do not prove natural walking-route duration or a seven-year-old's independent comprehension.
- Actual rendered cast: `public/assets/characters/cast-preview.png`. Integrated family scene: `tests/evidence/reunion-gameplay.png` (visual sampling with a QA save/pose). WebKit story completion: `tests/evidence/webkit-story-ending.png`.
- The software browser benchmark is a desktop CPU renderer, not an iPad performance measurement. Final scene uses roughly 76-83 draws and 127k triangles in the recorded emulated view. No claim of 30 or 60 FPS on physical hardware is made.
- The final source was also sampled for terrain contact: all tested horse rigs had no sampled geometry more than .25 units below ground after the reunion meadow and slope corrections.

**Pending release gate:** real iPad Safari in landscape, sustained >=30 FPS, background/restore under iPadOS, and an independent child playthrough. Chapter lengths of 10-15 minutes remain a design target, not a measured claim. Follow `docs/QA.md` and record model/iPadOS/date. Until that gate is passed, this is a published release candidate rather than a certified final iPad release.

The deployment must rebuild with test mode disabled. `public/release.json` records the runtime source commit and SHA256 hashes for comparison with the published artifact.
