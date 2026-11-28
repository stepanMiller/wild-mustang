# Herd rescue evidence, 2026-11-28

## Final integrated touch run

`natural-touch-gameplay.mp4` is an actual silent Chromium screen recording of
`tests/herd-rescue-route.spec.js`. The 98.6-second recording preserves elapsed
time and is encoded at 960 x 670 / 8 fps from 387 sampled browser frames. It is not a
physical iPad recording or a hardware FPS benchmark.

`touch-visible-capture.png`, `touch-closed-corral.png`, `touch-open-gate.png`
and `touch-free-herd.png` are frames from that passing run. The final frame catches
the ordinary HUD fade into the completion card. `natural-rescue-route.json`
contains the observations; `natural-touch-verification.json` records the exact
runtime-source hashes and environment.

The test seeds an existing completed three-chapter save solely to unlock the
public bonus button. It then uses actual browser touch events for the joystick
and gate action. It does not teleport Veter or inject bonus progress. All three
horses are caught and freed through the game simulation.

## Appearance and art review

`hero-left-face.png` shows the actual WebGL-rendered animated hero model with
an unspotted coat, the forelock below the anatomical left eye, the muzzle line
and the dorsal stripe.

`capture-view.png`, `camp-view.png` and `refuge-view.png` were captured earlier
during integrated art review, with a real bonus checkpoint and a QA camera pose.
They show lassos, mounted riders, the camp and the shared foliage style. They
precede the final small contact-shadow, near-beacon and resume-text refinements;
use the touch-run files for final integrated gameplay evidence. The corresponding
inspection JSON files retain their original observations.

## Verification scope

- Full unit suite: 75/75 passed.
- Focused Chromium desktop and iPad emulation: 2/2 scenarios each.
- Natural Chromium iPad touch route: 1/1 passed in 1.8 minutes.
- Chromium executable: 158.0.8127.0, desktop software renderer.
- Physical iPad Safari, sustained hardware performance and independent child
  comprehension remain manual checks. Full PR and Pages CI results are recorded
  by GitHub Actions for their respective commits.
