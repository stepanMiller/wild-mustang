# Hot performance diagnostic (ca93299)

Single ordinary multiprocess Chromium151.0.7922.34 context, iPad1194×834/DPR2, medium1, stationary public Play start, simulation delta0. Warmup8 frames (12 for alpha/clip), then8 native intervals per variant. SwiftShader only; no iPad FPS claim.

| Variant | Conventional median ms | Actual GL draws | Actual triangles |
|---|---:|---:|---:|
| control | 1462.20 | 68 | 111342 |
| no-shadows | 1721.20 | 67 | 111114 |
| shadow-alpha-test | 4873.30 | 68 | 111342 |
| shadow-clipped-alpha | 2240.25 | 68 | 111478 |
| sky-120 | 1670.40 | 68 | 111342 |
| control-restored | 1039.90 | 68 | 111342 |

Restored-control drift: −28.88%; restored control also contains a21.87s interval. Timing is inconclusive: neither alphaTest nor clipping has an established FPS benefit in this run. Raw report preserves the original upper-middle median for8 samples; this summary uses the average of the two central values.

Every sampled actual GL draw/triangle count equals renderer.info, including wrapped instanced GL methods. hiddenDrawDelta=0 throughout, renderer.shadowMap.enabled=false. No hidden shadow rendering pass exists.

Geometry clipping adds136 visible triangles in chapter1 with unchanged68 draws; independent surface/area proof establishes ~87% less unused shadow raster area. This diagnostic tested clipping plus alphaTest.002, not the final geometry-only candidate. The final source should retain its original shader; no sky120 result warrants a source change.

The frozen4187 build never changed. No shipping code/test edits were made for this probe. Only the owned runner/browser tree was stopped after restored control; remaining OS zombie children have RSS0 and consume no CPU. Browser slot handed to audio_runtime.

Artifacts: performance-triage.mjs, performance-triage-completed-controls.json (raw intervals/GL records), performance-triage-summary.json (conventional medians), performance-triage-run.log. An earlier environment-interrupted run is recorded separately and is not a game failure.
