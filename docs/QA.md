# Wild Mustang QA

The automated suites load the built game at its real GitHub Pages subpath
`/wild-mustang/`. They exercise public menu/action controls, keyboard movement,
touch PointerEvent handlers, cancellation, pause, quest progression, save/reload,
and restart. A localhost-only `?qa=1` interface provides deterministic travel
between objectives and cinematic fast-forward. Quest progress is produced by the
real gameplay handlers, never written directly by tests.

Run:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm run build
npm run test:unit
npm test
```

The restricted local execution environment requires:

```sh
PLAYWRIGHT_SINGLE_PROCESS=1 npm test -- --project=chromium-desktop
```

CI runs ordinary Chromium and WebKit with desktop and iPad landscape emulation.
The Pages deployment waits for build, unit checks and browser tests, then rebuilds
without test hooks and uploads only `dist/`.

## Baseline evidence, 13 October 2026

Original commit: `6ba7765`.

- Desktop Chromium 151, 1180 x 820, software WebGL.
- Initial external Three.js CDN failed in the execution environment. Serving the
  exact installed Three.js r128 file locally reproduced the original game with
  zero uncaught page errors.
- Screenshots: `tests/evidence/baseline-desktop.png` and
  `tests/evidence/baseline-gameplay.png`.
- Code audit identified masked required actions, persistent keyboard gallop,
  incomplete foal checkpoints, new-game state reuse, paused airborne physics,
  and impossible deep-water guidance. These are regression targets.

## Actual iPad Safari manual release gate

Desktop WebKit and mobile emulation do not verify iPad hardware, Metal/GPU behavior,
Safari interruptions, or a child's independent comprehension. Record the actual
model, iPadOS version, Safari version, and date before marking this gate complete.

1. Open the published HTTPS URL in landscape. Start with a fresh save.
2. Follow the tutorial with the left joystick, right camera swipe, held gallop,
   and jump. Repeat with two fingers and interrupted touches.
3. Complete all three chapters without developer controls or adult instructions.
   Observe whether the landmarks, target cues and actions remain understandable.
4. Reload after meeting Alex, collecting apples and partially freeing the foal.
   Check Continue restores the same world and objective.
5. Switch tabs and background Safari during movement, a jump, a dialogue and the
   final cinematic. Return, resume, and confirm controls are released.
6. Rotate portrait and landscape. Confirm controls respect safe areas and every
   modal can be closed. Test browser zoom/text-size accessibility where relevant.
7. Reach the herd reunion, replay an unlocked chapter and verify overall progress
   survives replay. Verify new-game/restart buttons reset the selected adventure.
8. Measure sustained rendering for one minute in the valley and during reunion:
   accept at least 30 FPS on the representative device. Record quality setting,
   overheating, memory pressure and reload behavior.
9. Check music/SFX start only after a gesture, mute/settings persist, subtitles
   work without sound, and Safari Private Browsing/storage refusal fails gently.

Status: actual iPad Safari testing has not been performed in this environment.
