# Ветер прерий, 1.0.0-rc.2

## 2026-11-28 update candidate: new hero and "Спасти табун"

Status: implementation and focused local QA are complete. The final source
commit, full cross-engine CI, merge and publication of this update are pending.
The previous dated publication record is preserved below.

The hero now has a coat without white markings, a dark forelock beside and below
his left eye, a black muzzle line and a dorsal stripe. The existing rig,
locomotion and playable fallback are retained.

The new repeatable adventure "Спасти табун" becomes available after the three
main chapters, including for existing saves that have already reached the ending.
A captain commands two mounted cavalrymen, who independently catch three wild
horses with animated lassos and bring them into a corral. Their artwork includes
holstered cowboy revolvers. Ветер opens the gate, leads the horses to a quiet
meadow and can then roam with the rescued herd or replay the adventure.

Save version 3 preserves the original main-story checkpoint and completed
chapters while storing the bonus episode separately. Legacy and version 2 saves
migrate. Invalid optional-adventure data is discarded without losing valid
main-story progress.

Local validation recorded 75/75 unit checks on the final integrated source,
including 15/15 adventure and persistence checks, and 2/2 focused
browser scenarios in each of Chromium desktop and Chromium iPad emulation.
Those browser scenarios cover autonomous capture, pause, save/reload during
capture and escape, release, completion, replay and return to the original story.
Those focused scenarios use a QA-only hero waypoint helper. A separate natural
touch route also passed, using actual browser touch input from the camp to the
completed rescue without hero teleports. Its silent screen recording and
screenshots are retained with source hashes. See `docs/QA.md` for exact scope.

Release record to complete after the remaining checks:

- Final commit and full CI, including WebKit: pending.
- Natural bonus touch route: passed, 1/1 in 1.8 minutes on Chromium iPad emulation.
- Merged commit, successful Pages run and public game verification: pending.
- Physical iPad Safari, sustained hardware FPS and independent Luka playthrough:
  not verified for this update.

The game remains a release candidate until the existing physical-device and
independent-play gates are documented.

## Published candidate, 13 October 2026

Release candidate published and verified 13 October 2026. All three story chapters are implemented, with animated in-engine characters, a family reunion, free-wander epilogue, chapter replay and versioned local saves. Play at https://stepanmiller.github.io/wild-mustang/.

## Implemented behavior

Chapter 1 preserves the original storm/meet/tracks/apples/creek/foal/hill story. The creek has a shallow ford, the submerged apple is moved to dry land, essential actions beat optional petting, tutorial keyboard/touch input works, partial rescue survives saves, and restart clears the world.

Chapter 2 adds willow landmarks, preparation of three ford stones, a safe crossing with both companions, sharing food and discovery of the mountain trail. Chapter 3 adds a winding pine route, a two-branch obstacle for the foal, the ridge, an explicit call to the herd and a short gallop into the family. Alex waves; the foal reaches the recognizable parent. The ending opens free wandering and all chapters remain replayable.

Horse, foal and five family horses use independently animated CC0 rigs. Alex has original skinned geometry and six skeletal clips. All game libraries, models, UI artwork and synthesized audio are local. No paid generation, asset purchase, account, backend or tracking was added. Unity and English Loop are untouched.

## Evidence and limits

- Final PR and gated Pages matrices each passed all 42 browser checks without retries. Production deployment and public byte-for-byte SHA-256 verification passed; see the final evidence in `docs/QA.md`.
- Production build succeeds. Fifteen unit checks validate real glTF skeletons/clips, character behavior/fallback and save migration.
- Chromium and Linux WebKit exercised real keyboard/pointer handlers, pause, checkpoints, repeat play, all three chapter transitions, reunion, epilogue and reload/replay. Deterministic progression tests teleport between objectives and fast-forward cinematics. They do not prove natural walking-route duration or a seven-year-old's independent comprehension.
- Actual rendered cast: `public/assets/characters/cast-preview.png`. Integrated family scene: `tests/evidence/reunion-gameplay.png` (visual sampling with a QA save/pose). WebKit story completion: `tests/evidence/webkit-story-ending.png`.
- The software browser benchmark is a desktop CPU renderer, not an iPad performance measurement. Final scene uses roughly 76-83 draws and 127k triangles in the recorded emulated view. No claim of 30 or 60 FPS on physical hardware is made.
- The final source was also sampled for terrain contact: all tested horse rigs had no sampled geometry more than .25 units below ground after the reunion meadow and slope corrections.

**Pending release gate:** real iPad Safari in landscape, sustained >=30 FPS, background/restore under iPadOS, and an independent child playthrough. Chapter lengths of 10-15 minutes remain a design target, not a measured claim. Follow `docs/QA.md` and record model/iPadOS/date. Until that gate is passed, this is a published release candidate rather than a certified final iPad release.

The deployment must rebuild with test mode disabled. `public/release.json` records the runtime source commit and SHA256 hashes for comparison with the published artifact.
