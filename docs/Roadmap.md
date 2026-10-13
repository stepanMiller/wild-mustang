# Wild Mustang — production roadmap (updated 13 October 2026)

**Goal:** finished 3D iPad Safari game «Ветер прерий»: three replayable chapters and a complete ending, not merely a first-chapter demo.

**Source of truth:** `index.html`, `AGENTS.md`, `docs/GameDesign.md`. Keep `main` deployable. All major tasks use a separate branch and PR. Record date, test evidence and blockers per stage below. Do not mark boxes complete just because code was written: run and verify.

## P0 — protect and audit existing build
- [ ] Reproduce current 3D game and get screenshots on desktop/mobile viewport.
- [ ] Confirm current page deployment; identify Safari-only risks, JS errors and quest softlocks.
- [ ] Set up reproducible local build/test command and smoke tests; preserve working release.
- [ ] Track live flow: start → tutorial → Alex → tracks → apples → creek → foal → finale.

## P1 — make chapter 1 enjoyable and technically reliable
- [ ] Remove possible softlocks and confusing quest order, allow safe creek crossing.
- [ ] Confirm control buttons, camera follow, landscape UI and checkpoints/resume.
- [ ] Smooth horse locomotion and terrain contact, interactions and hints.
- [ ] Desktop browser smoke test, mobile emulation; document on-device Safari test status.

## P2 — real art pipeline and character animation
- [ ] Compare Quaternius horse with desired stylized-realistic art; verify exact license and clips.
- [ ] Integrate a rigged/animated glTF horse with idle/walk/trot/gallop/jump; support fallback.
- [ ] Ship coherent foal, Alex, and herd representations plus environment props.
- [ ] Record every asset's attribution/license/size and measured load/performance.
- [ ] Consider paid production only for clearly missing final-quality hero assets and after quote.

## P3 — full story
- [ ] Deliver chapter 2 «Брод у белых камней», with its own goals, dialogue and ending.
- [ ] Deliver chapter 3 «Дорога к дальним горам», with herd reunion, credits/epilogue.
- [ ] Connect chapter select, autosave, replay, progression and completion tracking.
- [ ] Both mobile and desktop playthrough reach end, no inaccessible chapters or dead buttons.

## P4 — release QA
- [ ] Automated CI checks: build, console errors, game progression smoke, narrow/large viewports.
- [ ] Real iPad Safari (landscape) complete playthrough + resume after tab/app switch.
- [ ] Compare render FPS/heap and asset loading on target iPad; optimize if <30 FPS.
- [ ] Verify all licensed shipping assets, no paid-asset redistribution in public repository.
- [ ] Confirm GitHub Pages HTTPS URL and provide gameplay capture/screenshots, release notes and remaining known limitations.

**Agent ownership:** gameplay and asset pipeline may work in parallel on disjoint modules only *after* P0 separation, QA sets up tests independently; producer integrates PRs and owns end-to-end release. gstack/Astra are optional review aids, not build blockers.
