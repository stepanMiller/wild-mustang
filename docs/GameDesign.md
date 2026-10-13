# Game Design Document — «Ветер прерий» / Wild Mustang
Version: production brief, 13 October 2026. Status: implementation target; based on existing playable code in `index.html`.

## Identity
A **finished original 3D adventure** for Luka (7), primarily iPad Safari in landscape mode. Think warmly cinematic, windswept mountains, freedom, discovery, kindness and reunion. It should look like a carefully art-directed children's adventure, **not** a preschool app or generic procedural demo. Three self-contained chapters, ~10–15 minutes each, with optional wandering and a satisfying ending. A smaller beautiful world is preferred to a giant empty world.

The repository's working browser title is **«Ветер прерий»**; its working project name remains **Wild Mustang / «Легенда Дикого Мустанга»**. Preserve the existing story world and UI identity unless there is a clear UX reason to adjust.

## Existing game: preserve what works
`index.html` currently includes a procedural Three.js world with hills, river, grass, trees and light; horse Ветер, boy Алекс, foal and distant herd; joystick, jump, gallop, contextual interaction, stamina/trust HUD, map, journal, settings, pause, checkpoint save, tutorial, a six-step first-chapter quest, scripted finale and title screen. Chapter-selection UI displays chapters 2 and 3 but they are not implemented. Art is mostly spheres/boxes/cylinders. Important: inspect actual behavior; presence of code does not prove defect-free play or a good iPad experience.

## Playable cast and production art
1. **Ветер (playable)**: young bay mustang, original pale facial blaze, dark flowing mane and tail, alert ears and expressive eyes. Strong, likeable, clearly horse anatomy; never a copy of a known animated franchise character. Core animations: idle, walk, trot, gallop, stop/turn, jump, sniff/head-down, neigh, emotional reaction. Transitions and contact with terrain matter more than polygon count.
2. **Алекс**: friendly companion and gentle story guide, already in code. Stylized but consistent with Vетер. Greeting, giving apple, walking/following, petting and goodbye gestures; not constantly interrupting gameplay.
3. **Жеребёнок**: visibly younger/smaller than Ветер, frightened at first, rescued, then follows or reunites. Its animation cannot be just an unmodified scale-down of the hero if this looks wrong.
4. **Табун**: 3–5 related-looking horses, including a recognizable parent/lead horse; ambient grazing/walking and final gallop/group greeting. LOD/instancing or other mobile-friendly rendering.
5. **Ambient fauna**: birds and one optional deer family/forest animal for variety if it adds a story moment, not collectible noise.

Character art direction: stylized realism with readable silhouette, warm golden light, painterly materials and slightly exaggerated expression; consistent scale/palette. Actual skinned glTF/glb rigs and animation clips preferred. Keep procedural models as fallback if assets fail to load. Only legally redistributable licensed assets in the public repo. See `docs/ASSET_LICENSES.md`.

## Player journey and story
### Chapter 1: «Следы после грозы»
Storm fades. Vетер wakes alone. Learn walking and camera gently; look for hoofprints, encounter Alex, gain trust, collect three nearby apples, cross the creek **via a safe ford** (jumping is optional), help the stranded foal under branches, look out across the valley toward the herd. Finish on a meaningful cliffhanger. Preserve the existing chapter's best moments, but fix any impossible quest order, confusing navigation, interactions, or conflicting narrative. No fail states.

### Chapter 2: «Брод у белых камней»
Vетер, Алекс and the rescued foal follow tracks among white stones and willow trees. Find a navigable path, restore or guide a simple creek crossing, share apples/rest at a quiet meadow, and spot a clue that the herd went toward the mountains. New look/lighting/music variation, 2–3 distinct interactive challenges, a short emotional character beat, and a clear exit.

### Chapter 3: «Дорога к дальним горам»
Travel up a winding, visible trail, follow calls/hoofprints, help foal pass a small obstacle, crest the ridge, and **reunite with the herd**. Cinematic but brief ending: Vетер gallops home, foal and herd respond, Alex waves, «Мы дома». A replayable epilogue/free-wander area and unlocked chapters complete the game.

Each chapter must have a clear start, 3–6 meaningful goals, checkpoints, completion state, ending and chapter selection. A child should understand their next destination without reading walls of text. Never force repetitive item grinding.

## Core loop
Discover visible landmark → traverse with satisfying horse motion → observe/interact → positive world/character reaction → new landmark. Wayfinding uses light, footprints, audio cues, world landmarks and a subtle optional hint/compass/map. If lost, offer a gentle «К тропе» reset; never punish or softlock. Save at stable checkpoints and on chapter completion.

## Touch, camera and accessibility
- Safe-area aware large left thumb joystick; 1–2 large meaningful buttons on right (context/action and gallop/jump depending on context); avoid clutter. Do not block the field of view. Desktop keyboard/mouse fallback.
- Smooth follow camera, auto-centering and terrain collision, no sudden jumps. Optional touch look is secondary.
- Landscape iPad as primary; iPhone landscape should fit. Orientation hint when portrait. Visible hit area larger than graphic, 44pt+ controls, contrast against the scene, no tiny textual controls.
- Russian UI and pictograms; voice/narration optional with accessible captions; no reliance on audio alone. Music and SFX toggles. Sound begins only after user interaction because of browser policies.
- No combat, death, scary jump scares, timers, paywalls, adverts, online accounts, surveillance or in-app purchases.

## Progression and saving
Versioned localStorage: completed chapters, selected chapter, checkpoint, dialogue/quest progress and settings. Migrate `veter-save` if compatible; otherwise make a graceful reset choice without crash. Restart chapter and continue both work. Never show locked chapters as available or buttons that do nothing. A final «Играть ещё» returns to a safe chapter selection or free wander.

## Visual/environment/audio
One believable valley and connected distinct zones instead of a giant empty generated terrain. Grassy foothills, a shallow stream, white boulders, pines, sunset ridgeline; subtle breeze, dust, ripples and soft weather *without costly mobile shaders*. Rich soundscape: four-beat hoof sounds responsive to gait, water, birds, wind, greeting neighs, soft music. All assets local after build.

## Build technology and quality gates
Existing Three.js browser build is primary. Maintain current playable build until a tested TypeScript/Vite modular migration (if chosen) is deployable through GitHub Pages at `/wild-mustang/`. No Unity rewrite now. Browser/WebGL errors must surface in a friendly overlay; pause/visibility/background and orientation handling. Target 60 FPS; accept >=30 FPS on the test iPad. Optimize geometry, instancing, texture sizes, render pixel ratio and asset loading. Prefer cached GLB. Tests: new game, controls, all quest triggers, all chapter transitions, saves, restart, ending, Safari touch. Test with Playwright mobile emulation plus an actual iPad Safari; label evidence accordingly.

## Definition of finished
All 3 chapters can be played end-to-end with real in-engine characters and responsive controls. A cohesive cinematic reunion exists. A working public preview link, build/test logs, asset license register, short playthrough evidence and clear manual Safari checklist are provided. Placeholder text like «Откроется позже» does not count as finished.
