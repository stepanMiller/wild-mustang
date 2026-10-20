# Graphics polish 04: финальный визуальный протокол

7 сопоставимых scripted-пар сохранены и прошли проверки позы, камеры, public medium quality, browser и candidate render budget **≤150 000 triangles / ≤240 draw calls**. Это проверка графики; прохождение бюджета не доказывает выигрыш FPS.

**Общий final core запуск завершился timeout 600 s при загрузке 04-ascent.** Его raw [after-final-report](after-final-report.json) честно сохраняет `result: failed`, три полностью проверенные строки и `errors: []`. Кадры 04/05 досняты отдельным [tail-запуском](after-final-rest-report.json), без изменения cap или обычных тестов. Итого используемые baseline/final протоколы: **6 passed, 1 timeout**; таблицы агрегируют только строки с сохранённым `comparison`, выполненным бюджетом и без console/page errors. Не утверждается, что полный исходный core-запуск прошёл.

[Derived summary](comparison-summary-final.json) содержит SHA-256 raw reports/PNG, камеры, полные resource/timing arrays и проверки согласованности. Промежуточные ca93299 данные сохранены отдельно: [README](README-ca93299.md), [summary](comparison-summary-ca93299.json); они не выданы за финальные.

## Что проверено

- Chromium **151.0.7922.34**, обычный multiprocess; flags `--no-sandbox --enable-unsafe-swiftshader`.
- iPad landscape emulation **1194×834 CSS px**, device DPR **2**; public medium preset **1**, renderer pixel ratio **1.35**, drawing buffer **1611×1125**.
- GPU: `ANGLE / Vulkan / SwiftShader Device (Subzero)`. Это software GPU облачного runner, не физический iPad Safari.
- Одинаковые V2 Continue fixtures, seed `0x47524134`, heading, camera yaw/pitch/distance/position/look и 6 кадров с delta `1/30` (0,2 simulation seconds). Проверки камеры допускали менее 0,001 world units для position/look.
- После загрузки моделей игровой clock управляется только opt-in harness. Native timers/RAF сохраняются; при timing sampling game delta равна нулю. Никакого изменения shipping source для этой диагностики.
- Seed воспроизводит картину внутри сборки; изменение числа Three UUID allocations может сдвигать последующие случайные растения. Идентичность каждой травинки не утверждается.
- Семейный кадр — валидный completed epilogue save. Это не доказательство естественного reunion, прохождения маршрута или самостоятельной игры ребёнка.

## Кадры

| Сцена | Fixture x,z | Before | Final after |
|---|---:|---|---|
| Старт | 20, 24 | [PNG](before-01-start.png) | [PNG](after-final-01-start.png) |
| Брод главы 2 | -14, 60 | [PNG](before-02-ford.png) | [PNG](after-final-02-ford.png) |
| Поляна | 27, 75 | [PNG](before-03-clearing.png) | [PNG](after-final-03-clearing.png) |
| Подъём | 75, 26 | [PNG](before-04-ascent.png) | [PNG](after-final-rest-04-ascent.png) |
| Семья / эпилог | 97, -94 | [PNG](before-05-family.png) | [PNG](after-final-rest-05-family.png) |
| Кромка воды | -8, 48 | [PNG](before-water-06-water-bank.png) | [PNG](after-final-water-06-water-bank.png) |
| Взгляд вдоль ручья | -3, 48 | [PNG](before-river-07-river-look.png) | [PNG](after-final-river-07-river-look.png) |

Пара 06 показывает узкую полосу воды внизу кадра: подтверждает наличие и цвет кромки, ограниченно характеризует поверхность и не доказывает анимацию волн. Пять финальных основных пар независимо просмотрены без блокирующих графических регрессий.

Пара 07 — дополнительный фиксированный взгляд вдоль ручья в главе 1; поверхность видна в статичном кадре. Она также scripted и не является доказательством анимации воды или natural navigation.

## Ресурсы рендера

Read-only Chromium CDP `Runtime.queryObjects` читает единственный уже существующий `Three.WebGLRenderer`, связанный с `#scene`; новый renderer не создаётся. Источник — `renderer.info.render`, `info.programs.length`, `info.memory`. P/T/G — allocated counts программ, текстур и геометрий, не байты GPU RAM.

| Сцена | Calls before → final | Triangles before → final | Programs | Textures | Geometries |
|---|---:|---:|---:|---:|---:|
| Старт | 77 → 68 | 125158 → 111478 | 16 → 18 | 5 → 6 | 248 → 200 |
| Брод главы 2 | 79 → 67 | 144690 → 132538 | 17 → 19 | 5 → 6 | 280 → 227 |
| Поляна | 39 → 41 | 137172 → 125020 | 17 → 19 | 5 → 6 | 244 → 205 |
| Подъём | 57 → 50 | 149557 → 137563 | 17 → 19 | 10 → 11 | 265 → 216 |
| Семья / эпилог | 27 → 30 | 145207 → 133213 | 16 → 18 | 10 → 11 | 243 → 204 |
| Кромка воды | 63 → 54 | 142740 → 130588 | 16 → 18 | 5 → 6 | 267 → 219 |
| Взгляд вдоль ручья | 46 → 43 | 123976 → 109864 | 16 → 18 | 5 → 6 | 253 → 208 |

Максимумы только среди этих 7 поз: before **149557 triangles / 79 calls**, final **137563 triangles / 68 calls**. Все final строки использовали `WILD_MUSTANG_GRAPHICS_CHECK_BUDGET=1`; before не ограничивался candidate budget.

Дополнительные CPU-проверки: [environment geometry](environment-geometry-report.json) считает subtree окружения до frustum culling; [final shadow area](final-shadow-raster-18ae9dc.json) измеряет проекцию площади геометрии на XZ, а не screen fragments или FPS. [Global batching estimate](global-batching-estimate.json) — ранний CPU preflight статической части сцены с другой семейной позой `(86, -78)` вместо финальной `(97, -94)`; это **не actual final resource data** из таблицы выше.

## Native timing: малая software-выборка

В каждой позе 2 warmup + **8 native RAF/callback intervals**. Ниже обычная медиана monotonic callback intervals: среднее двух центральных элементов при N=8. Историческое `medianMs` baseline/intermediate JSON было верхним центральным элементом; raw bytes не исправлялись. Final helper и derived summary считают обычную медиану из raw arrays.

Это frozen-scene raster/runner сравнение при game delta=0: active animation/physics CPU исключены. Значения нельзя выдавать за FPS игры или физического iPad.

| Сцена | Before median, ms | Final median, ms | Изменение |
|---|---:|---:|---:|
| Старт | 1184.50 | 1842.05 | +55.5% |
| Брод главы 2 | 1035.90 | 3065.50 | +195.9% |
| Поляна | 1338.90 | 1614.00 | +20.5% |
| Подъём | 1289.45 | 2567.65 | +99.1% |
| Семья / эпилог | 1818.60 | 2313.95 | +27.2% |
| Кромка воды | 4933.30 | 895.05 | -81.9% |
| Взгляд вдоль ручья | 830.95 | 924.30 | +11.2% |

Эти cold/low-N данные содержат большие замедления и ускорения, поэтому отсутствие performance regression или улучшение FPS ими **не подтверждено**. Отдельная [hot A/B диагностика ca93299](performance-triage-summary.md) дала −28,88% дрейф повторного контроля и выброс 21,87 s; причинный вывод о shadow/sky FPS недопустим. [Raw diagnostic](performance-triage-completed-controls.json) сохранён. Actual GL draw/triangle counts совпали с `renderer.info`, hiddenDrawDelta=0, `shadowMap.enabled=false`. Диагностика clipping+alphaTest относится к промежуточной сборке; финальная geometry-only clipping без alphaTest отдельно представлена здесь. Уменьшение неиспользуемой площади shadow geometry примерно на 87% — геометрический факт, **не измеренный FPS gain**.

## Исходники и hashes

- Baseline archive `e0e0fd36e9b78c2b6fe2c0536697b7e968dfd21a` побайтно равен main `6bd97a716ab638f94b1624d2ea5a806b3f8318ee`; общий Git tree `d1a01e357e338f66abd379ef4acada4ef3d1bc8d`.

- Final HEAD `18ae9dcd104d3f2cd4fa92fbb96ee25d673818d5` содержит metadata; runtime source commit `2606207e02f8dd9bb8d24a1c9d14ffb9a3a73fa2`.

- Frozen **QA** builds; не утверждение о deployed production build. Каждый запуск сравнил HTTP bytes всех 57 non-map файлов со своей immutable dist (JS, GLB, audio/licenses, release.json). Явный expected game SHA защищает labels.

- [Source-map verification final](source-map-verification-final.json): 15 baseline и 17 final src modules byte-match архивам. Все final модули также сверены с runtime source commit.

- Final release.json SHA-256 `de41959437673fd9029c27df4407bd57951fba9a8eeb4a805ccd805bddbb100a`, sourceCommit=2606207. Baseline release.json сохраняет прежнюю metadata базы, SHA `b4feff4769d6b975fcbd693123a73b38f0110f2b084b73e301450109fe1f9f2a`.

| Artifact | Before SHA-256 | Final SHA-256 |
|---|---|---|
| index.js | `202f79d4ef067ba5a3921aa807fb3f110f4e4c72eb1b5bad1f8bbe364a88a154` | `efb223ee5128cc190f8d589c9268766d7a9076d14c8e2cc3f8dbbe1c21562dd1` |
| game.js | `76c3a1566358be18b1f6c67c1bbdc48319ba7650f0fdf219c6778086fba79605` | `99f4812272b22ea93136ddaa937647d719285c667a0dba1e9fd182bb8915fb72` |
| three.js | `5e3507a10f824375a1f65e00dd8a4d20c236826e1701798dc65637137f077c12` | `e7ecd029d31654659cf05187f72d4d39f17974667c0ab6b73f0534e953b075c0` |

Frozen cache under `/workspace/.cache/graphics-polish-04`: `before-source`, `before-dist`, `before-source-provenance.json`; `after-final-source`, `after-final-dist`, `after-final-source-provenance.json`. Intermediate ca copies and interrupted setup runs remain separate; setup/aborted runs are not passing proof.

## Запуск без пересборки served dist

[Opt-in harness](../../graphics-polish.spec.js) по умолчанию skipped. [Capture config](capture.config.mjs) не содержит webServer/build, не меняет обычные tests/timeouts. Capture browser ordinary Chromium151 multiprocess, flags `--no-sandbox --enable-unsafe-swiftshader`. Для повторения нужна новая output folder/prefix: guard откажется перезаписывать существующие PNG/report. Исходные URLs before 4186 / final 4187 должны раздавать frozen copies; смена bytes провалит hash guard.

```bash
export XDG_CACHE_HOME=/workspace/.cache
export XDG_CONFIG_HOME=/workspace/.cache/config
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
export PLAYWRIGHT_SINGLE_PROCESS=0
export WILD_MUSTANG_GRAPHICS_VISUAL=1
export WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR=/tmp/graphics-polish-04-recapture

capture() {
  side="$1"
  poses="$2"
  label="$3"
  comparison="${4:-}"
  cache=/workspace/.cache/graphics-polish-04
  if [ "$side" = before ]; then
    url=http://127.0.0.1:4186/wild-mustang/
    game=76c3a1566358be18b1f6c67c1bbdc48319ba7650f0fdf219c6778086fba79605
    commit=e0e0fd36e9b78c2b6fe2c0536697b7e968dfd21a
    manifest="$cache/before-source-provenance.json"
    dist="$cache/before-dist"
    budget=0
  else
    url=http://127.0.0.1:4187/wild-mustang/
    game=99f4812272b22ea93136ddaa937647d719285c667a0dba1e9fd182bb8915fb72
    commit=18ae9dcd104d3f2cd4fa92fbb96ee25d673818d5
    manifest="$cache/after-final-source-provenance.json"
    dist="$cache/after-final-dist"
    budget=1
  fi
  env WILD_MUSTANG_GRAPHICS_URL="$url" WILD_MUSTANG_GRAPHICS_GAME_SHA256="$game" \
    WILD_MUSTANG_GRAPHICS_SOURCE_COMMIT="$commit" WILD_MUSTANG_GRAPHICS_SOURCE_MANIFEST="$manifest" \
    WILD_MUSTANG_GRAPHICS_DIST="$dist" WILD_MUSTANG_GRAPHICS_PREFIX="$label" \
    WILD_MUSTANG_GRAPHICS_POSES="$poses" WILD_MUSTANG_GRAPHICS_CHECK_BUDGET="$budget" \
    WILD_MUSTANG_GRAPHICS_COMPARE="$comparison" \
    npx playwright test --config tests/evidence/graphics-polish-04/capture.config.mjs
}

capture before core before
# Recorded original final core reached 600s cap after 3 guarded rows; raw result stays failed.
capture after core after-final "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-report.json"
WILD_MUSTANG_GRAPHICS_POSE_IDS=04-ascent,05-family \
  capture after core after-final-rest "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-report.json"
capture before water before-water
capture after water after-final-water "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-water-report.json"
capture before river before-river
capture after river after-final-river "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-river-report.json"
```

Физический iPad Safari FPS, самостоятельная детская навигация и новое полное natural-route прохождение этим набором не проверялись. Ручной device gate и отдельная regression suite записываются в [docs/QA.md](../../../docs/QA.md).

## WebKit regression gate

Исходный прогон 18 неизменённых сценариев WebKit 26.5 завершился **11 PASS / 7 FAIL**, retries 0: [summary](webkit-regression-summary.json), [source/HTTP proof](webkit-source-proof.json). Пять failures относятся к исходному 20s ожиданию loading; full story достиг 90s лимита переправы, restart — 100s лимита сценария при растущем доверии Алекса. [Снимки переправы](webkit-ford-diagnostic.json) показывают движение обоих друзей; poll count не равен frame count.

[Baseline control](webkit-baseline-control-summary.json) на неизменённом main: newgame PASS, full story также достиг того же 90s лимита переправы. См. [baseline source proof](webkit-baseline-source-proof.json) и [movement diagnostic](webkit-baseline-ford-diagnostic.json). Baseline прошёл большее расстояние за это окно; равенство performance не доказано.

Единственный [focused run](webkit-focused-failures-summary.json) исходных семи failures завершился **3 PASS / 4 FAIL**, retries 0 и неизменённые условия. См. [source proof](webkit-focused-source-proof.json), [tutorial diagnostic](webkit-focused-tutorial-diagnostic.json) и [ford diagnostic](webkit-focused-ford-diagnostic.json). Итого **14/18 уникальных сценариев** прошли хотя бы однажды; полного чистого прогона нет. После focused run остались два loading timeout, tutorial speed threshold за 12s и общий story cap 300s у переправы. Это открытый regression gate.

[Production build proof](production-build-proof.json): Safari 15 target, все 18 release fingerprints совпали, три runtime JS без QA hook symbol. [Production WebKit smoke](production-webkit-smoke.json) PASS с первого запуска: public touch New Game, HUD, local horse 200, hooks undefined даже с `?qa=1`, page/console/HTTP errors пусты. Все пять проверенных HTTP файлов совпали с production dist.

Production game SHA-256 `27feb88708aa07eaa9b7868caccfcb692d7e9a5597b7c5d2ef5be1f64a34b02f` отличается от frozen QA game `99f481…`. После финальной пересборки порт 4187 раздаёт production; для повторения capture-команд выше необходимо снова раздать immutable `after-final-dist`, сохранив expected QA hashes. Опубликованная Pages-версия этим feature branch не изменяется.

## Публикация

Ветка `codex/graphics-polish-04` опубликована. Before/after start PNG дополнительно проверены через публичный raw GitHub: HTTP 200 и SHA-256 совпадают с локальными файлами. [Описание draft PR](PR.md) готово с inline before/after.

Создание PR командой `gh pr create` заблокировано: `Post https://api.github.com/graphql: Forbidden`. Runtime policy в 15:04 UTC сообщает `domain is not in allowlist` для `api.github.com`; сохранённая конфигурация с этим доменом ещё не применяется активной средой. Реальный PR этим запуском не создан, GitHub CI не подтверждён. [Форма создания отдельного PR](https://github.com/stepanMiller/wild-mustang/pull/new/codex/graphics-polish-04); подготовленное название: **Polish chapter lighting and hero scenes within the medium render budget**. Regression и ручной iPad gates выше остаются открыты.
