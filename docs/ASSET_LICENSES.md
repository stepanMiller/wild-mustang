# Game assets, source and license register

No imported third-party gameplay asset is approved by this document alone. Every model, animation, texture, font and audio track included in a distributable build must have an entry here.

| Asset / role | Source & creator | License + proof | Download/version | Modifications | Distributed? |
|---|---|---|---|---|---|
| Procedural horse, Alex, terrain and effects in original `index.html` | This project | Project MIT (see LICENSE); validate provenance before external commercial distribution | Existing source | Procedural geometry | Yes (source code) |
| Vетер, foal and five herd horses | Quaternius Ultimate Animated Animal Pack, [official source](https://quaternius.com/packs/ultimateanimatedanimals.html) | CC0 1.0; source License.txt saved at `public/assets/licenses/quaternius-animals-license.txt` | Horse.gltf, verified 2026-10-13; GLB 761,596 bytes, 2,182 triangles, 50 joints | Bay coats, pale blaze, distinct foal anatomy, original Trot derived from Walk, peaceful clips only | Yes; redistribution permitted, no attribution required, cost $0 |
| Alex and six skeletal animation clips | Original authored `src/characters/alex.js` | Project MIT; no imported model | Authored 2026-10-13; 18 bones, 3 skinned draw calls | Idle, Walk, Run, Wave, OfferApple, Pet | Yes, cost $0 |
| Story trails, landmarks, UI SVGs, synthesized audio and contact shadows | Original project source | Project MIT | `src/story/`, `src/ui-icons.js`, `src/contact-shadows.js`, `src/game.js` | Entirely local geometry, textures and Web Audio | Yes |
| Chapter lighting, layered ridges, river shading, folded ferns and scenery-shadow mask | Original project source | Project MIT; no imported asset or extra attribution | Authored 2026-10-20 in `src/scene-style.js`, `src/game.js`, `src/story/environment.js`, `src/story/scenery-shadows.js` | Local procedural geometry, colours, shader and 64px RGBA mask | Yes, cost $0; no paid generation |
| Three.js runtime and bundled glTF utilities | [mrdoob/three.js](https://github.com/mrdoob/three.js/tree/r128) | MIT, preserved dependency license | 0.128.0 pinned in package-lock.json | Bundled with Vite; core play has no CDN/font requirement | Yes |

## Rules
- Source a rigged quadruped with compatible animation clips; a still image alone is not a playable horse.
- Verify actual pack model and saved license evidence before moving its files into `public/assets/`.
- If a license requires attribution, display it in accessible game credits and here.
- Do not copy characters from films or third-party games.
- Do not include licensed-for-one-account paid binary assets in this **public** GitHub repository unless redistribution rights are explicit.
- For paid AI models, keep a record of generation tool/version, commercial reuse rights, total credit cost and Blender/GLB rig and animation QA. Free placeholder art is not proof of final visual quality.

Machine-readable provenance and SHA256 checksums: `public/assets/licenses/characters.json`. Animation names, durations, import tooling and screenshot evidence: `docs/CHARACTERS.md`. No purchase, paid generation or credit debit occurred.

<!-- Wild Mustang verified audio appendix -->

## Local recorded audio and Russian cues, issue #14 Stage C

The selected 35 local audio files have an individual source/licence/hash register in [AUDIO_LICENSES.md](AUDIO_LICENSES.md) and `public/assets/audio/audio-manifest.json`. Russian cue recordings use the specifically licensed RHVoice Aleksandr-HQ voice and are distributed as CC-BY-SA4.0 audio with full speaker/team attribution. Environmental sound/Foley retains its per-file CC0/BY3.0/BY4.0 rights and modification notices. Accessible local credits: `public/assets/licenses/audio-credits.html`; original voice-model licence snapshot is included. Engine/models are offline authoring tools and do not ship. Cost $0; human listening and physical iPad gates remain open.

<!-- End Wild Mustang verified audio appendix -->
