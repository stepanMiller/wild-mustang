# Graphics polish 04: промежуточный кандидат ca93299

Шесть сопоставимых scripted-пар: **4/4 opt-in запуска прошли**, 12 PNG сохранены. Все after-кадры прошли проверки одинаковых позы, камеры, качества и браузера, а также лимиты **≤150 000 треугольников / ≤240 draw calls**. Это промежуточный кандидат: ухудшившиеся software-замеры потребовали отдельной горячей диагностики; прохождение render budget не означает принятие производительности.

Исходные JSON сохранены без исправления результатов: [before](before-report.json), [after](after-report.json), [before water](before-water-report.json), [after water](after-water-report.json). [Derived summary](comparison-summary-ca93299.json) содержит ссылки, SHA-256, полные resource/timing-пары и повторную проверку согласованности. Во всех четырёх отчётах `errors: []`.

## Что проверено

- Chromium **151.0.7922.34**, обычный multiprocess; flags `--no-sandbox --enable-unsafe-swiftshader`.
- iPad landscape emulation **1194×834 CSS px**, device DPR **2**; public medium preset **1**, renderer pixel ratio **1.35**, drawing buffer **1611×1125**.
- GPU: `ANGLE / Vulkan / SwiftShader Device (Subzero)`. Это software GPU облачного runner, не физический iPad Safari.
- Одинаковые V2 Continue fixtures, seed `0x47524134`, heading, camera yaw/pitch/distance/position/look и 6 кадров с delta `1/30` (0,2 simulation seconds). Проверки камеры допускали менее 0,001 world units для position/look.
- После загрузки моделей игровой clock управляется только opt-in harness. Native timers/RAF сохраняются; при timing sampling game delta равна нулю. Никакого изменения shipping source для этой диагностики.
- Seed воспроизводит картину внутри сборки; изменение числа Three UUID allocations может сдвигать последующие случайные растения. Идентичность каждой травинки не утверждается.
- Семейный кадр — валидный completed epilogue save. Это не доказательство естественного reunion, прохождения маршрута или самостоятельной игры ребёнка.

## Кадры

| Сцена | Fixture x,z | Before | After ca93299 |
|---|---:|---|---|
| Старт | 20, 24 | [PNG](before-01-start.png) | [PNG](after-01-start.png) |
| Брод главы 2 | -14, 60 | [PNG](before-02-ford.png) | [PNG](after-02-ford.png) |
| Поляна | 27, 75 | [PNG](before-03-clearing.png) | [PNG](after-03-clearing.png) |
| Подъём | 75, 26 | [PNG](before-04-ascent.png) | [PNG](after-04-ascent.png) |
| Семья / эпилог | 97, -94 | [PNG](before-05-family.png) | [PNG](after-05-family.png) |
| Кромка воды | -8, 48 | [PNG](before-water-06-water-bank.png) | [PNG](after-water-06-water-bank.png) |

Пара 06 показывает **узкую полосу воды внизу кадра**: подтверждает наличие и цвет кромки, но ограниченно характеризует поверхность и не доказывает анимацию волн. Все пять основных пар визуально просмотрены без блокирующих графических регрессий.

## Ресурсы рендера

Значения сняты read-only через Chromium CDP `Runtime.queryObjects` у единственного уже существующего `Three.WebGLRenderer`, связанного с `#scene`; новый renderer не создавался. Источник — `renderer.info.render`, `info.programs.length`, `info.memory`. P/T/G — counts программ, текстур и геометрий, не байты GPU RAM.

| Сцена | Calls before → after | Triangles before → after | Programs | Textures | Geometries |
|---|---:|---:|---:|---:|---:|
| Старт | 77 → 68 | 125158 → 111342 | 16 → 18 | 5 → 6 | 248 → 200 |
| Брод главы 2 | 79 → 67 | 144690 → 132298 | 17 → 19 | 5 → 6 | 280 → 227 |
| Поляна | 39 → 41 | 137172 → 124780 | 17 → 19 | 5 → 6 | 244 → 205 |
| Подъём | 57 → 50 | 149557 → 137361 | 17 → 19 | 10 → 11 | 265 → 216 |
| Семья / эпилог | 27 → 30 | 145207 → 133011 | 16 → 18 | 10 → 11 | 243 → 204 |
| Кромка воды | 63 → 54 | 142740 → 130348 | 16 → 18 | 5 → 6 | 267 → 219 |

Максимум **среди этих шести кадров**: before 149557 triangles / 79 calls; after **137361 triangles / 68 calls**. Before не ограничивался candidate budget; оба after-запуска использовали `WILD_MUSTANG_GRAPHICS_CHECK_BUDGET=1`.

## Native timing: малая software-выборка

В каждой позе 2 warmup + **8 измеряемых native RAF кадров**. Ниже обычная медиана реальных monotonic callback intervals в ms: среднее двух центральных элементов для N=8. Историческое поле `medianMs` исходных JSON было **верхним** центральным элементом; raw-файлы не исправлялись. Таблица и `conventionalNativeMedian` derived summary пересчитаны из полных raw-массивов. Новый helper также считает обычную медиану, включая сравнение со старыми baseline arrays.

Это frozen-scene raster/runner сравнение: animation/physics CPU исключены, поэтому значения нельзя выдавать за FPS активной игры или физического iPad.

| Сцена | Before median, ms | After median, ms | Изменение |
|---|---:|---:|---:|
| Старт | 1184.50 | 2346.30 | +98.1% |
| Брод главы 2 | 1035.90 | 1966.50 | +89.8% |
| Поляна | 1338.90 | 1340.35 | +0.1% |
| Подъём | 1289.45 | 988.65 | -23.3% |
| Семья / эпилог | 1818.60 | 3207.15 | +76.4% |
| Кромка воды | 4933.30 | 1428.10 | -71.1% |

В трёх позах рост выше 25%; одновременно есть значительно более быстрые after-выборки. Эти результаты не скрыты и не приняты как доказательство отсутствия регрессии. Отдельная hot A/B диагностика проверяет одинаковую сцену внутри одного прогретого контекста; её выводы нужно рассматривать отдельно от этих исходных холодных/low-N таблиц.

## Исходники и hashes

- Baseline archive: `e0e0fd36e9b78c2b6fe2c0536697b7e968dfd21a`. Содержимое полностью совпадает с main `6bd97a716ab638f94b1624d2ea5a806b3f8318ee`: общий Git tree `d1a01e357e338f66abd379ef4acada4ef3d1bc8d`.
- Candidate source: `ca93299f1a2bf94b54d63ab2c456ad9add261654`. Frozen **QA** build, не утверждение о deployed production build.
- Каждый запуск сверил HTTP bytes всех **57 non-map файлов** со своей immutable dist-копией, включая три JS bundle, GLB, локальные audio/licenses и `release.json`. Явный expected game SHA защищает before/after labels.
- [Source-map verification](source-map-verification.json): 15 baseline и 17 candidate `src/` modules побайтно совпали с соответствующим Git archive.
- Frozen `release.json` ещё содержит прежнюю metadata базы и одинаков в обеих сборках; его SHA-256 `b4feff4769d6b975fcbd693123a73b38f0110f2b084b73e301450109fe1f9f2a`. Идентичность исполняемого candidate устанавливают bundle hash + source-map/archive, не старый release label.

| Artifact | Before SHA-256 | Candidate ca93299 SHA-256 |
|---|---|---|
| index.js | `202f79d4ef067ba5a3921aa807fb3f110f4e4c72eb1b5bad1f8bbe364a88a154` | `dd3ee849b7eb7904b63b9a38ff1c395750e6d3b5a839ee052dbb8ab2463f7335` |
| game.js | `76c3a1566358be18b1f6c67c1bbdc48319ba7650f0fdf219c6778086fba79605` | `277900024d5ce71050e46b985be84c12cf35eedbe2a96d0107baffdc124d87cd` |
| three.js | `5e3507a10f824375a1f65e00dd8a4d20c236826e1701798dc65637137f077c12` | `e7ecd029d31654659cf05187f72d4d39f17974667c0ab6b73f0534e953b075c0` |

Frozen cache: `/workspace/.cache/graphics-polish-04/before-source`, `before-dist`, `before-source-provenance.json`; candidate `after-source-ca93299`, `after-dist-ca93299`, `after-source-ca93299-provenance.json`. Старый source25a и прерванные harness/setup попытки сохранены отдельно в cache; они не являются passing proof и не входят в таблицы.

## Запуск без пересборки served dist

Основной [opt-in harness](../../graphics-polish.spec.js) по умолчанию skipped. [Capture config](capture.config.mjs) не содержит webServer/build и не меняет обычные тесты. Записанные запуски использовали эквивалентный cache config `/workspace/.cache/graphics-polish-04/capture.config.mjs` с теми же browser flags.

Исходные URLs: before `http://127.0.0.1:4186/wild-mustang/`, after `http://127.0.0.1:4187/wild-mustang/`. Серверы должны раздавать именно указанные frozen copies; hash guard отклонит новую сборку под прежним URL. Для повторения выбирайте новую output folder: существующие PNG/report harness перезаписывать откажется.

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
    game=277900024d5ce71050e46b985be84c12cf35eedbe2a96d0107baffdc124d87cd
    commit=ca93299f1a2bf94b54d63ab2c456ad9add261654
    manifest="$cache/after-source-ca93299-provenance.json"
    dist="$cache/after-dist-ca93299"
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
capture after core after "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-report.json"
capture before water before-water
capture after water after-water "$WILD_MUSTANG_GRAPHICS_EVIDENCE_DIR/before-water-report.json"
```

До публикации или принятия performance gate остаются отдельные hot diagnostic/regression результаты и ручной iPad Safari gate из [docs/QA.md](../../../docs/QA.md). Физический FPS, независимая детская навигация и новое полное natural-route прохождение этим набором не проверялись.
