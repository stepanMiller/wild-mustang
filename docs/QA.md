# Wild Mustang QA

## Issue #14 Stage A evidence — 14 October 2026

Base: main `188f152`; feature branch `codex/ipad-polish-01`. Node.js 24.19.0,
npm 11.9.0, Debian 13, installed Chromium 154.0.8037.57, tablet viewport
1194 × 834 / DPR 2. These are desktop software browser measurements.

Native Chromium multi-touch reproduced the held-joystick camera defect: a
100px horizontal / 30px upward second-finger swipe changed yaw by only
0.00005976 rad. After correction the same gesture changed yaw by 0.55 rad and
pitch by 0.12 rad while retaining joystick input `{x:0,y:-0.4}`. Screenshots:
`tests/evidence/ipad-polish-01/{before,after}-camera-two-fingers.png` and
`{before,after}-camera-start.png`.

The new camera helper checks the complete boom and its smoothed endpoint against
terrain and the existing movement collider envelopes. Near an obstruction it
raises the view to keep at least 5.5m from the look point. It does not assert
collision against every decorative leaf or story mesh. Ten camera unit tests
pass; the full unit suite now has 25 passing checks. The four focused Chromium
tablet camera/touch/capture/rotation/background scenarios pass.

The first broader Chromium run correctly failed its console-error assertions on
the pre-existing `/favicon.ico` 404. A local original SVG and an explicit icon
link fix the cause; the error assertions are retained. The subsequent Chromium
run passed 36 scenarios and skipped four; two desktop story scenarios exceeded
their global wall-clock budgets under three concurrent software renderers. Both
passed unchanged assertions/timeouts on an isolated documented single-process
retry (2.5 minutes and 59.4 seconds). All 20 tablet scenarios passed on the full
run. Thus all 38 unique relevant Chromium scenarios passed, with these two
timing-only retries explicitly recorded. WebKit passed 18 scenarios, skipped
four optional/browser-specific diagnostics, and had zero failures/retries.
Together this validates 56 distinct relevant browser scenarios.

`tests/natural-route.spec.js` is deliberately opt-in with
`WILD_MUSTANG_NATURAL_ROUTE=1` on the Chromium touch project. It uses Chrome's
native multi-contact input protocol, real joystick/buttons, public quality
settings, public pause/Continue, and normal cinematic timing. Read-only diagnostic
positions, route definitions, collider geometry and saved partial progress guide
the automated driver; no game state/input/save/cinematic injection is permitted.
It does not measure independent child comprehension. A complete fresh journey
passed 1/1 in 19.6 minutes of automated wall time with the documented single-
process runner and a sole software renderer: all 18 objectives, both fords,
first-goal save/reload/Continue, three normal cinematics, reunion, completion
`[1,2,3]` and real joystick movement in the epilogue. No page/console errors,
teleports, injected inputs/checkpoints, unstuck or cinematic fast-forward occurred.
The public quality menu selected the low preset after the initial normal-quality
menu/start screenshots. See `after-natural-route.json`, driver preflight and
frozen build hashes under `tests/evidence/ipad-polish-01/`.

This wall time includes automated path observation/steering and software GPU
latency; it does not establish 10–15 minutes per chapter on iPad or a child
playthrough. Earlier incomplete harness runs exposed empty-contact cancellation
and a final-action phase predicate; these were corrected in the driver while
shipping gameplay remained unchanged. Baseline visual comparison uses a separately
guarded, explicitly scripted diagnostic capture and is not counted as natural
play.

Playwright WebKit 26.5 is installed in the workspace cache. Its missing Debian
libraries were obtained from signed Release/Packages metadata, SHA256 checked,
and extracted locally with additive links into the unmodified browser bundle.
The system `ldconfig` cache cannot see these local libraries, so this instance
uses the supported host-cache preflight override after all eight subprocesses
passed `ldd` and WebGL launch/readPixels checks. No TLS or package verification
was disabled. Actual Safari hardware remains untested.

## Standard validation

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

## Automated release evidence, 13 October 2026

WebKit 26.5 on Ubuntu 24.04, iPad Pro 11 landscape emulation (1194 x 834,
DPR 2), completed all twelve initial scenarios. Eleven passed in the initial
matrix; the last tutorial transition exceeded its original 12-second wall-clock
wait. A targeted retry with the identical assertion and a longer wait passed.
The production simulation caps frame delta to 0.05 seconds, so a 2.2-second
simulation delay takes longer on software WebGL. No input or quest logic was
changed to make this pass. The committed test harness now accommodates this.

Four additional final checks passed: local render/layout, the rigged cast and
Walk/Trot/Gallop/Jump/Idle transitions, frame metrics, and the complete story.
After the final reunion target/cinematic/rock changes, a fresh full story run
again passed: all three chapters, unlocks, save, reunion, epilogue movement,
reload/Continue, and chapter replay without losing completion.

The last WebKit story run verified `src/game.js` SHA-256
`f276f5ed1dac39c36b42446b9e3ec0b7a2405d8eb91717a608fcc8626548939f`.
Source files stayed unchanged during that run.

Chromium 151 on the same software runner also passed five final checks:
rigged cast/gait transitions, local render/layout, partial foal rescue and
save/reload/completion, frame metrics, and all three chapters with reunion,
epilogue, save/reload and replay. That frozen copy predates the final reunion
staging adjustments verified by the later WebKit run. Normal CI checks the
final source in Chromium desktop, Chromium tablet and WebKit tablet projects.

Committed evidence:

- `tests/evidence/release-rigged-characters.png`
- `tests/evidence/release-chapter-1.png`
- `tests/evidence/release-chapter-2.png`
- `tests/evidence/release-chapter-3.png`
- `tests/evidence/webkit-qa-summary.json`

A short software-render sample recorded 76 draw calls and 126,688 triangles.
Its mean 337 ms frame interval reflects the restricted software driver and
concurrent automated workloads. It is not an iPad GPU measurement and cannot
establish the 30 FPS hardware release gate. Story tests teleport between
objectives and fast-forward cinematics; they use real interaction buttons and
separate real movement/animation checks. They do not establish a child's
independent navigation, actual adventure duration, or physical Safari behavior.
The actual-device checklist above remains open.


## Published candidate verification, 13 October 2026

Final PR [run 38405277258](https://github.com/stepanMiller/wild-mustang/actions/runs/38405277258) and gated Pages [run 38407337306](https://github.com/stepanMiller/wild-mustang/actions/runs/38407337306) each passed 42/42 browser checks across all three projects and 15/15 unit checks, without retries. The Pages run checked main merge `e86aef50bc89701549cc3a590f867b8575460c22` and deployed production successfully.

At 14:00 UTC the canonical public URL https://stepanmiller.github.io/wild-mustang/ returned 200. Public HTML, release.json, three runtime JS bundles and horse GLB matched the production build byte for byte by SHA-256. The manifest names runtime source commit `59528870f2949864fac824ebd09d08789e278d19`; `src/game.js` SHA-256 is `cbe6a458c67e6208d7035e430e75ba8b967c6fbb169dcee5853f51d88cde66b2`.

Public Chromium at 1024 x 768 exercised new game, tutorial skip, pause, menu, save and Continue. The model returned 200, save version was 2, QA hooks were undefined, and there were zero uncaught JavaScript/console errors or failed HTTP responses. This check used the execution environment's network proxy and a desktop tablet viewport. Actual iPad Safari, hardware FPS, independent child navigation and natural chapter durations remain unverified. Issues #8 and #9 track those manual gates.
