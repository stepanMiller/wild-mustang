# AGENTS.md — Wild Mustang / «Ветер прерий»

## Mission
Build a **finished, polished, playable 3D story adventure for Luka (age 7)** that runs in Safari on iPad (landscape, touch-first). The user wants a working game, not a mockup, a concept image, a framework scaffold, or only a plan.

Source of truth: the existing browser game in `src/game.js`, `src/story/`, `src/characters/`, `src/persistence.js` and the UI shell `index.html`, this document, `docs/GameDesign.md`, `docs/QA.md`, `docs/RELEASE.md` and `docs/Roadmap.md`. Preserve and improve the existing published game; don't silently replace its characters, quest flow, look, repository or live site. The repository also contains a mostly scaffold-only Unity project and an unrelated `english-loop` directory. **Do not delete or modify either; prioritize the browser Three.js build**.

## Product boundaries
- Genre: peaceful third-person exploration and storytelling, not a shooter, RPG combat game or preschool mini-game.
- Character Vетер (young bay mustang), Alex (friendly boy from existing game), foal, family herd. Use original art/voices/music; never copy Spirit or other copyrighted characters.
- Complete playable narrative: three chapters (about 10–15 minutes each), coherent emotional ending and replayable chapters. Existing chapter 1 and UI are the baseline.
- No fights, health/death, fail states, punitive timers, ads, purchases, accounts, trackers or online dependencies for game state.
- Russian UI, minimal text, obvious pictograms, child-friendly voice/audio cues where practical; large touch targets; soft guidance if player gets lost.
- Support iPad Safari in landscape and iPhone Safari where usable; mouse/keyboard only secondary. Touch input, devicePixelRatio, safe areas, orientation, resume, reload and local persistence must be robust.
- Baseline performance target 60 FPS, acceptable mobile minimum 30 FPS on a representative actual iPad. Record device/browser tested; don't claim iPad/Safari verification based solely on desktop emulation.

## Technical approach
- Browser game stays primary: Three.js, no required auth, no backend, deployable to GitHub Pages at repository subpath `/wild-mustang/`.
- As of 14 October 2026 the browser version is already a three-chapter release candidate built by Vite 6 with pinned Three.js r128 installed locally. `index.html` is the UI shell, `src/game.js` is still the large main runtime module; story/environment, characters, persistence and navigation live under `src/`. Keep the existing build and 3 chapters; avoid starting a new engine or redoing the already completed migration. Refactor only incrementally with proven regression tests.
- Use clean separation: rendering/world, hero movement/animation, input/camera, quest & chapter state, dialogue/audio, UI, persistence. Favor existing libraries over inventing a game engine. Never strand a build mid-migration.
- Version localStorage save schema and preserve or gracefully migrate existing save `veter-save`. Make chapters repeatable without corrupting progress.
- Main branch must remain deployable. Work on feature branches; PRs with tests/screenshots and explicit limitations. Do not push experimental breakage to `main`.
- Implement deterministic automated checks: build, lint/typecheck if applicable, smoke tests for start/tutorial/quest completion/continue/chapters/finale, basic mobile viewports, errors. QA on actual iPad Safari is an explicit manual gate.
- Keep all shipping assets local to the static build (external font/CDN dependencies cannot be required for core gameplay).

## Characters and assets
- Existing procedural `makeHorse()` and `makeAlex()` should become fallback/dev art once better rigged models are integrated.
- Evaluate Quaternius Ultimate Animated Animal Pack (https://quaternius.com/packs/ultimateanimatedanimals.html) as an initial horse/foal/herd animation baseline: the original pack page lists CC0 and glTF. **Verify current source license, exact included models, animation clips and import quality**; do not assert licensing beyond verified pack files.
- For the final hero, priority is silhouette, coat, dark mane, original light blaze, expressions, believable idle/walk/trot/gallop/turn/jump and transitions; avoid poorly rigged AI static meshes and stiff bobbing.
- Prefer appropriately licensed CC0/CC-BY or original assets. Keep source URL, creator, license, date, modifications and attribution needs in `docs/ASSET_LICENSES.md`. Never commit paid non-redistributable models into this public repository.
- Paid generation is permitted *in principle* for essential improvements only. First compare with existing/free assets; document quoted cost, deliverable format (glb/glTF + rig + animations where required), commercial rights and estimated benefit. Never charge credits or make purchases without knowing/confirming the concrete amount.
- No random GitHub agent frameworks or unreviewed installation scripts. Add external repositories only if a measured benefit, security review and pinned revision justify them. gstack is optional and not a required dependency.

## Suggested concurrent agent roles (only if actual delegation tools exist)
1. **Gameplay/Story agent**: quest state, chapters 2–3, save schema, reunion and gentle wayfinding.
2. **Character/Animation agent**: source and evaluate glTF/rigged assets, horse/foal/herd, animation transitions and low-memory asset loading; document license; edit only `src/characters/` and `public/assets/` after refactor.
3. **QA/Performance agent**: build, automated smoke tests, mobile touch edge cases, accessibility and measured render performance; edit tests/config, not gameplay in parallel.
Lead agent owns architecture/integration, merges after review; agents must not edit shared monolithic `index.html` concurrently.

## Definition of done
A new player can open the static URL on iPad Safari, start and complete **all three** chapters without a developer, meet characters in coherent 3D, save/continue, reach the family herd and a genuine ending, then replay a chapter. No dead buttons/placeholders, errors, broken assets, punitive failures or undisclosed asset-license issues. Include screenshots or screen capture, working game URL, tested build and any outstanding manual Safari caveats.

## Work order
Read the actual code first and record its working behavior. **Current phase is Codex post-release polish, not first implementation**: follow GitHub issue #14 for verified iPad camera/touch UX, scene art, natural localized sound and natural-route playtesting; #8 and #9 remain manual release gates. PRs #10–#13 are already merged. Update a live implementation checklist in `docs/Roadmap.md`. Implement scoped feature branches with verified deliverables. Do not stop at docs or architecture; ship a playable build.
