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

## Issue #14 Stage B evidence — 14 October 2026

Feature branch `codex/prairie-polish-02`, stacked on Stage A. The three existing
terrain height functions, quest routes and saves remain. One prairie tree moves
from (22,34) to (27,39), with its matching movement collider, to clear the initial
wide camera. Other movement obstacles remain at their previous seeded positions.
Camera-only bounds include the actual global and chapter foliage, with finite
lower/upper limits so a view can still pass below a crown.

Production build and 33 unit checks pass. The integrated B WebKit suite passed
18 relevant scenarios (4 explicit skips), including full chapter/reload/replay.
After finite canopy bounds and the medium grass adjustment, all five WebKit
camera/performance focus scenarios passed again; the subsequent tree relocation
is covered by final screenshot capture and CI.

The first visual run found an opaque canopy at spawn and 151,603 triangles in
the first ending. These were fixed; assertions for the 150,000 medium triangle
budget remain. Medium grass is 4,000 blades; low/high presets remain supported.
Provisional draw-call ceiling was calibrated separately from the issue's actual
physical FPS gate; actual counts and matching before/after runtime hashes are
recorded rather than inferred from object counts. Final scene/gait captures use
explicitly scripted pose setup, with public controls for movement and camera.
They do not substitute for the native three-chapter route recorded under Stage A.

Matched before frames: `tests/evidence/prairie-polish-02/before-*`; after frames
and JSON use one verified frozen B runtime. Both final Chromium visual scenarios passed; idle/slope plus Walk/Trot/Gallop were captured from three distinct displayed camera angles with native touch controls. Maximum gait calls: 170; maximum gait triangles: 138655. The final scene peak is 149,559 triangles. The former finish card covers
37.53% of the tablet viewport and uses blur(14px); B covers about 12.02%, no blur,
with statistics collapsed by default. Physical Safari/FPS and child play remain
unverified. Original local geometry uses project MIT; no external art or cost.

## Issue #14 Stage C evidence — 14 October 2026

Feature branch `codex/audio-story-polish-03`, stacked on B. Local audio consists
of 23 original Russian HMM cue recordings and 12 sound/theme files, totaling
1,676,808 bytes. Every shipped file has a source/license/derivation hash in
`public/assets/audio/audio-manifest.json`; accessible game credits link to
`assets/licenses/audio-credits.html`. No speech engine/model/backend ships.
Full provenance: AUDIO_LICENSES.md. Primary source category for the horse call
was not independently accessible; pinned VoxeLibre confirms its per-file BY3
redistribution rights. A separate recorded snort is not claimed. Human listening
and physical iPad remain required. Cost: $0.

The voice cache retains at most three buffers/3 MiB; short effects are bounded
to 1 MiB and eight active voices. Ambience/music are media streams, with browser
internal memory unmeasured. Isolated Chromium/WebKit each decoded all 46 audited
candidates and passed 13 playback checks. In-game guidance now retains original
story dialogue: voice captions temporarily use the tracker description area.
Voice repeat resumes AudioContext synchronously inside its user gesture.

63 unit checks and production build pass. Before the final caption/getter
refinement, full WebKit passed 21 relevant scenarios/6 explicit skips, including
all chapters, save, Continue and replay. The latest frozen build on 4184 passes
all three audio scenarios and both actual companion scenarios in WebKit and Chromium: the child
can stop just inside the crossing zone while friends physically walk onto the
bank; sharing starts eating/offer/pet after the action, and Continue preserves
progress without replaying disposable scenes.

Two initial test-fixture errors were corrected without changing gameplay: x=10 was
exactly outside the strict 7m target radius (the valid edge setup is x=10.2); an
init script re-seeded its checkpoint on every reload, masking the saved progress
(the fixture now seeds once per session). The cinematic shortcut helper allows
90 seconds only for the new actual companion crossing, retaining every other
assertion, poll limit and scenario timeout.

The final native touch journey, matching runtime/asset hashes and new mini-scene
frames are recorded under `tests/evidence/audio-story-polish-03`. Initial aborted
diagnostic-getter attempt is parked separately in cache; it is not a successful
three-chapter result. Chromium final focus passed 5/5; WebKit final focus passed
five unique scenarios (three audio, two companion).

The final native journey passed 1/1 in 25.7 minutes of automated software-runner
wall time (10:11:11.141–10:36:51.118 UTC). It completed all 18 objectives, public
save/Pause/reload/Continue, both fords, ordinary cinematics, the family reunion
and touch movement in epilogue. The frozen runtime is core `acd008e`, game bundle
SHA-256 `76c3a1566358be18b1f6c67c1bbdc48319ba7650f0fdf219c6778086fba79605`;
HTTP hashes match all 41 recorded files, including every audio file. There are
33 checkpoints, 47 story events, no browser errors and no teleport, injected
input/checkpoint or cinematic acceleration.

Actual reaction observations include Alex `Pet`, hero/foal `Eating` after public
sharing, both companions on dry ground beyond the ford, and foal/parent 1.783 m
apart at reunion. Before/after reload the engine started 5 + 17 voice cues and
102 + 897 effects; unavailable audio stayed empty. Low-quality observed renderer
counts peaked at 146,220 triangles/181 calls. The protocol and its derived index
are linked from `tests/evidence/audio-story-polish-03/README.md`.

Pinned Playwright Chromium 151.0.7922.34 also passed the five new audio/companion
scenarios, 5/5 in 3.2 minutes, with the ordinary browser fixture. The initial CI
failed the full scripted story at `willow-crossing`: its hero jumped about 150 m
from chapter spawn while companions still walked behind. The unchanged 90-second
poll elapsed on software rendering. Local CFT151 reproduced this exact failure;
GitHub reporter annotations confirmed it in CI. The driver now uses public
Pause → Menu → Continue at the existing west-bank checkpoint, asserts unchanged
chapter/phase/quest/completion/trust/inventory/rescue/heading/position, then moves
only the hero to the next target. Both companions still cross through ordinary
game code. No shipping behavior, NPC speed, poll or scenario limit was changed. The corrected CFT151 full-story scenario passed 1/1 in 4.4
minutes (4.5-minute runner total), including all chapters and replay. Natural
touch evidence remains independent and unchanged.

On the corrected fixture, run 38555068059 passed all 23 Chromium desktop and
23 WebKit scenarios without retries. Chromium tablet was canceled by the
workflow's 20-minute overall cap, with no reported assertion failure. The suite
now discovers 29 scenarios per profile (opt-in/engine-specific skips apply), so
the job cap is 30 minutes to include install/build and the larger software-
rendered browser run. Per-scenario and assertion limits remain unchanged. The
whole matrix is rerun on this configuration before review readiness.

With the 30-minute job budget, run 38557587397 passed 23 desktop and 23 WebKit
scenarios without retries. Chromium tablet passed its other 24 scenarios; the
full-story case hit its global 300-second limit while replaying chapter two,
after completing the initial three chapters, epilogue and reload. The annotation
identifies `story.spec.js`'s replay call, not an exhausted 90-second crossing
poll. Both attempts reached that same scope; the raw annotations are retained in
`tests/evidence/audio-story-polish-03/ci-replay-timeout-diagnosis.json`.

Only this long 24-objective story/replay case now selects the public low graphics
preset through the settings menu and asserts the applied setting. Progress,
save/Continue, companions, every assertion and all scenario/poll limits remain
unchanged. Fresh per-test contexts leave UI/camera/characters/performance and the
new companion scenarios on default medium quality. The corrected CFT151 full
story/replay passed 1/1 in 3.0 minutes. These story screenshots are low quality;
medium visual budgets/captures remain separate evidence. No physical FPS claim
follows from the software-runner timing.

PR #17 remains subject to the GitHub checks on its final head before it is marked
ready. No physical Safari, hardware FPS, independent child navigation, human
listening or measured 10–15 minute chapter claim is inferred from these checks.
