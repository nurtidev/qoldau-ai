# Промпты для генерации медиа (Gemini/Imagen — стиллы, Gemini image-to-video — видео-лупы)

Как пользоваться: генерируешь стилл по промпту → сохраняешь и сжимаешь по требованиям ниже →
на его основе (image-to-video) генерируешь короткий луп → кладёшь оба файла под нужным именем в
указанную папку → коммит-пуш → после раскладки скажи Claude «подключи медиа» — код с фолбэками
уже готов, картинки/видео подхватятся автоматически, ничего не сломается, пока файла нет.

## Общий стилевой стандарт (применяй ко всем промптам ниже)

Единый визуальный язык для всего сета — если сцены будут «в одном фильме», портал не развалится
на разномастные стоковые фото.

- **Время суток / свет.** Тёплый «золотой час» (рассвет или закат) для всех сцен — мягкие длинные
  тени, тёплый низкий свет, лёгкая дымка/пыль в воздухе. Никаких дневных плоских кадров и никакой
  студийной подсветки.
- **Палитра.** Естественные тона казахстанской степи и промышленных объектов (охра, пшеничное
  золото, сталь, бетон, небо) + **точечные** акценты цветов Байтерека — глубокий зелёный `#007A40`
  и золото `#B4975A`. Это НЕ заливка кадра зелёным/золотым, а случайные детали внутри сцены:
  зелёный кузов спецтехники, золотистый отблеск на металле в закатном свете, зелёная спецодежда,
  жёлто-зелёный сигнальный жилет вдалеке. Акцент должен выглядеть органично, а не как брендинг.
- **Люди — без крупных планов лиц.** Прав на генерацию узнаваемых лиц нет. Если в кадре нужен
  человек — он снят со спины, силуэтом, издалека или не в фокусе; лицо не читается крупным планом.
  По умолчанию предпочитай сцены вообще без людей — акцент на технике, инфраструктуре, ландшафте и
  продукте труда.
- **Казахстан узнаваем.** Степной ландшафт (плоский горизонт, редкие холмы, широкое небо),
  современная инфраструктура (элеваторы, ЖД-магистрали, порт, теплицы, цеха, деловые центры в
  стиле Астаны) — без клюквы, без юрт-декораций для несельских сцен.
- **Доменное правдоподобие (анти-ляп).** Не смешивай несвязанную инфраструктуру в одном кадре:
  элеваторы стоят у ж/д и зерновых полей, а не рядом с теплицами; ветряки — отдельный сюжет, а не
  фон к станции/элеватору; никакого «всё в одном кадре». Соответствие сезону и агрономии: спелая
  золотая пшеница = комбайн/уборка (август-сентябрь), голая пашня/всходы + сеялка = посевная
  (апрель-май) — эти два состояния НЕ совмещаются; зелёная пшеница с комбайном — грубая ошибка.
  Скот — мясные породы на пастбище (не молочные голштины в степи), зимой скот не на зелёной траве.
  Масштаб реалистичный для Казахстана: порт Актау и логистические узлы скромнее мировых хабов —
  без «мега-»объектов и гор контейнеров. Где уместно — дублируй это негативными уточнениями в
  конце промпта (`no greenhouses`, `no mixed unrelated infrastructure`, `no wind turbines` и т.п.).
- **Реализм.** Фотореалистичная фотография, не иллюстрация и не 3D-рендер. Конкретная сцена с
  деталями (материал, техника, погода, время суток), а не общее описание вроде «красивое поле».
- **Строго без.** Без текста и надписей (в т.ч. кириллицы/латиницы на технике и вывесках), без
  логотипов, без гербов и госсимволики, без водяных знаков.
- **Композиция.** Горизонталь 16:9. Для `hero-main` — с «воздухом» слева (левая треть кадра —
  спокойный, малодетальный фон под заголовок сайта), главный объект и смысловой центр — в правых
  двух третях. Остальные (карточки услуг) — смысловой центр может быть по центру кадра.

### Технические требования — стиллы

- Формат JPG, ~1600×900 (16:9), после сжатия **≤300 КБ**.
- Сжимать: `sips -Z 1600 in.png --out out.jpg` (macOS, встроенный) или Squoosh (squoosh.app,
  кодек MozJPEG, качество ~75–80).
- Если результат «стоковый», мутный, с артефактами на технике/руках — перегенерировать, а не
  ставить как есть.

### Технические требования — видео-лупы

- 1280×720, **H.264 (mp4), без звука, 6–10 секунд, бесшовный луп** (первый кадр ≈ последний).
- **≤2.5 МБ**.
- Камера статична или с едва заметным дрейфом (очень лёгкий наезд/панорама). Без резких склеек,
  без смены плана. Движение — только внутри сцены: трава/колосья на ветру, флаги, пар, дым, блики
  на воде или металле, облака, медленно движущаяся вдалеке техника.
- Источник — image-to-video Gemini на основе готового одноимённого `.jpg` (тот же кадр, оживляем).
- Сжать, если модель отдала тяжелее лимита:
  `ffmpeg -i in.mp4 -vf scale=1280:720 -c:v libx264 -crf 28 -movflags +faststart -an out.mp4`

## Конвенция файлов (согласована с кодом)

```
frontend/public/media/hero/hero-main.jpg
frontend/public/media/hero/hero-main.mp4
frontend/public/media/services/<key>.jpg
frontend/public/media/services/<key>.mp4
```

Ключи ниже — канон, один в один с `frontend/src/lib/serviceMedia.ts`: 10 точечных ключей по
title (TITLE_RULES), 9 категорийных фолбэков (CATEGORY_RULES) и hero. Менять имена нельзя — на
них завязан резолвер путей.

| Ключ | Услуга / сюжет | Категория (`categoryColor.ts`) | Оператор |
| --- | --- | --- | --- |
| `hero-main` | Обобщающий сюжет портала — предпринимательство Казахстана | — | — |
| `wagons` | Приобретение авиатранспорта и вагонов в лизинг | Лизинг | Фонд развития промышленности |
| `agro-livestock` | Агробизнес: развитие животноводства | Агросектор | Аграрная кредитная корпорация |
| `ken-dala` | Кең дала 2 — весенне-полевые и уборочные работы | Кредит | Аграрная кредитная корпорация |
| `orleu` | Өрлеу — льготное кредитование МСБ | Кредит | Даму |
| `isker` | Іскер аймақ — субсидирование ставки для малого бизнеса | Субсидии | Даму |
| `leasing-agro` | Льготный лизинг сельхозтехники | Лизинг | КазАгроФинанс |
| `damu-guarantee` | Гарантирование кредитов МСБ / гарантия для начинающих | Гарантии | Даму |
| `microcredit` | Микрокредитование для начинающих предпринимателей | Кредит | Даму |
| `export` | Страхование экспортных контрактов / пред-постэкспортное финансирование | Экспорт | ЭКА KazakhExport |
| `greenhouse` | Теплицы / садоводство (задел на будущее — услуги в каталоге пока нет) | Агросектор | Аграрная кредитная корпорация |
| `agro-generic` | Обобщённая карточка категории «Агросектор» | Агросектор | — |
| `leasing-generic` | Обобщённая карточка категории «Лизинг» | Лизинг | — |
| `finance-generic` | Обобщённая карточка категории «Финансирование» | Финансирование | — |
| `credit-generic` | Обобщённая карточка категории «Кредит» | Кредит | — |
| `subsidy-generic` | Обобщённая карточка категории «Субсидии» (вкл. возмещение НИОКР) | Субсидии | — |
| `grant-generic` | Обобщённая карточка категории «Гранты» (стартапы/технологии) | Гранты | — |
| `invest-generic` | Обобщённая карточка категории «Инвестиции» (сопровождение ПИИ) | Инвестиции | — |
| `guarantee-generic` | Обобщённая карточка категории «Гарантии» | Гарантии | — |
| `export-generic` | Обобщённая карточка категории «Экспорт» | Экспорт | — |

Итого 20 сюжетов (19 сервисных ключей + hero) × 2 файла (jpg + mp4) = 40 медиафайлов.

---

## `hero-main` — обобщающий сюжет портала

**RU:** Главный экран портала — весь спектр господдержки бизнеса Байтерека одним кадром: от поля
до порта.

**Стилл (EN):**
> Wide 16:9 photorealistic shot at golden hour on the edge of a modern Kazakh industrial rail yard
> bordering open steppe. In the right two-thirds of the frame: a loaded freight train with dark tank
> cars and grey hopper wagons stands on parallel tracks; beyond it a concrete grain elevator complex
> catches the low sun. A small dusty pickup truck with a faded
> deep-green door panel is parked near the tracks, cab empty, no driver visible. The left third of
> the frame is calm, softly out-of-focus flat steppe and warm amber sky with no hard details —
> reserved negative space for a headline overlay. Warm long shadows, fine dust haze in the air,
> scattered clouds lit gold and rose. Photoreal, high resolution, no people in sharp focus, no text,
> no logos, no wind turbines, no greenhouses, no unrelated mixed infrastructure.

**Видео (EN):**
> Animate this exact frame into a seamless 6–10 second loop, camera locked with only the faintest
> drift toward the train. Motion sources: dust and heat haze drift along the rail yard and shimmer
> above the rails, clouds creep almost imperceptibly across the sky, a loose
> tarp strap near the truck bed flutters lightly. No camera pan beyond a hair of parallax, no cuts,
> no people entering the frame, no text or logos appearing anywhere. 1280×720, H.264, no audio,
> first and last frame matching for a perfect loop.

---

## `wagons` — лизинг вагонов и авиатранспорта

**RU:** Лизинг подвижного состава и авиатранспорта от Фонда развития промышленности — обновление
парка для транспортных и индустриальных компаний, сумма до 20 млрд ₸.

**Стилл (EN):**
> Photorealistic golden-hour shot on a straight double-track rail line crossing open Kazakh steppe.
> A long freight train of dark tank cars and grey hopper wagons recedes toward a low sun on the
> horizon; foreground steel rails and gravel ballast catch sharp warm reflections. A trackside
> signal post with a weathered deep-green maintenance panel stands in the mid-ground — the only
> saturated color accent against the ochre steppe. Faint dust rises where the rails meet the
> horizon, long shadows stretch across the ballast. No people, no text, no logos, high resolution,
> 16:9.

**Видео (EN):**
> Animate this exact rail-yard frame into a seamless 6–10 second loop, camera locked. Motion: the
> freight train inches forward almost imperceptibly along the track, heat haze shimmers above the
> rails, dust drifts low across the ballast, the signal light on the post blinks once softly. Clouds
> drift very slowly. No hard cuts, no new elements entering frame, no text or logos. 1280×720,
> H.264, no audio, seamless loop.

---

## `agro-livestock` — животноводство (Агробизнес: развитие животноводства)

**RU:** Финансирование животноводческих хозяйств — приобретение поголовья КРС/МРС/птицы, корма и
оборудование, ставка от 6% годовых.

**Стилл (EN):**
> Photorealistic golden-hour shot of a well-kept cattle herd — sturdy beef cattle with dark reddish
> coats — grazing on a wide open Kazakh pasture, low rolling hills on the horizon under a huge warm
> sky. In the mid-ground a modern metal livestock shelter with a low sloped roof stands beside a
> row of feed troughs; one panel of the shelter is painted a muted deep green, catching the low sun.
> A herding dog sits at a distance, back to camera. Dust motes and pollen drift in the slanted
> light. No human faces, no text, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact pasture frame into a seamless 6–10 second loop, camera locked with a barely
> perceptible drift across the herd. Motion: cattle shift weight, swish tails, a few take slow
> grazing steps; tall grass at the fence line sways in the wind; clouds crawl slowly across the sky;
> warm dust drifts low over the pasture. No new animals entering frame, no cuts, no text or logos.
> 1280×720, H.264, no audio, seamless loop.

---

## `ken-dala` — весенне-полевые и уборочные работы (Кең дала 2)

**RU:** Льготное кредитование весенне-полевых и уборочных работ (семена, ГСМ, удобрения) —
ставка 5% годовых, срок до 18 месяцев.

**Стилл (EN):**
> Photorealistic golden-hour shot of an endless ripe wheat field in Kazakhstan just before harvest,
> heavy golden heads filling the foreground in sharp focus. In the mid-distance a modern combine
> harvester with a deep-green cab roof works the field, kicking up a thin trail of chaff and dust
> lit gold by the low sun. Flat horizon, a wide pale sky streaked with warm clouds. No people in
> sharp focus, no text, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact wheat-field frame into a seamless 6–10 second loop, camera locked. Motion:
> golden wheat heads ripple in slow waves across the field as wind passes through, the combine
> harvester creeps forward at the edge of the frame with a light trail of dust and chaff drifting
> behind it, clouds move slowly overhead. No hard cuts, no camera pan beyond a faint drift, no text
> or logos. 1280×720, H.264, no audio, seamless loop.

---

## `orleu` — Өрлеу, льготное кредитование МСБ (переработка/производство)

**RU:** Флагманская программа льготного кредитования МСБ фонда «Даму» — ставка 12,6%, лимит до
7 млрд ₸ на инвестиционные цели.

**Стилл (EN):**
> Photorealistic golden-hour shot inside a modern small-scale food-processing or light-manufacturing
> workshop with large factory windows; warm low sun streams through the glass onto stainless-steel
> production lines and stacked pallets of finished goods wrapped in plastic. A small forklift with
> a faded deep-green chassis is parked mid-frame, no driver visible. Steam or light dust hangs in
> the sunbeams. Clean, orderly, modern industrial space — a growing business, not a huge factory.
> No people in sharp focus, no text, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact workshop frame into a seamless 6–10 second loop, camera locked with a faint
> drift along the production line. Motion: steam or light dust drifts slowly through the sunbeams,
> a conveyor belt in the background inches forward, light flares gently shift as dust particles
> pass through the window beams. No people entering frame, no cuts, no text or logos. 1280×720,
> H.264, no audio, seamless loop.

---

## `isker` — Іскер аймақ, малый бизнес в регионах

**RU:** Субсидирование ставки для малого бизнеса «Іскер аймақ» — конечная ставка 12,6%, сумма до
200 млн ₸.

**Стилл (EN):**
> Photorealistic golden-hour shot of a small regional business street in a Kazakh provincial town:
> a row of modest single-story shopfronts and a small auto-repair garage with its roller door half
> open, warm evening light raking across the facades. A compact delivery van with a muted deep-green
> livery panel (no text, no logo) is parked at the curb. Sparse pedestrians are visible only as
> distant, out-of-focus silhouettes. Overhead power lines, a few parked cars, ordinary provincial
> Kazakhstan streetscape — modest but active, post-Soviet regional look. No text, no logos, no
> readable signage, no American or Western-European architecture, 16:9, high resolution.

**Видео (EN):**
> Animate this exact street frame into a seamless 6–10 second loop, camera locked. Motion: the
> garage roller door vibrates faintly, a loose banner or awning corner flutters in the breeze,
> distant silhouetted pedestrians walk slowly and exit frame naturally, warm light flickers subtly
> as if a cloud passes. No new named signage appears, no cuts, no text or logos. 1280×720, H.264,
> no audio, seamless loop.

---

## `leasing-agro` — льготный лизинг сельхозтехники

**RU:** Лизинг тракторов, комбайнов и посевных комплексов от «КазАгроФинанс» — ставка 6%, срок до
10 лет.

**Стилл (EN):**
> Photorealistic golden-hour shot of a neat row of brand-new agricultural machinery — tractors and
> seeders — parked in formation on a gravel lot at the edge of a farm, like a dealership showcase.
> Low sun rakes across the clean painted bodywork, one tractor's fender catching a warm golden
> highlight. Flat steppe and a grain silo stand in the soft-focus background. Long shadows stretch
> across the gravel. No people, no text, no logos, no visible brand emblems, no greenhouses, 16:9,
> high resolution.

**Видео (EN):**
> Animate this exact machinery-lot frame into a seamless 6–10 second loop, camera locked with a
> very slow lateral drift along the row. Motion: light glints travel slowly across the polished
> tractor bodywork as if clouds pass overhead, dust drifts low across the gravel lot, a wind sock
> or loose tarp corner in the background flutters gently. No cuts, no new vehicles entering frame,
> no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `damu-guarantee` — гарантии Даму для малого бизнеса (цех/мастерская)

**RU:** Гарантирование кредитов МСБ и гарантия для начинающих предпринимателей — покрытие до 85%
суммы кредита, снижает требования банка к залогу.

**Стилл (EN):**
> Photorealistic golden-hour shot inside a small independent workshop — a metalworking or
> carpentry shop — with warm low sun streaming through a large open roller door onto workbenches,
> hand tools hung on a pegboard, and a half-finished metal frame or wooden structure on a workbench.
> A few bright orange sparks or wood shavings catch the light mid-air near a tool in use, operator's
> hands visible at the edge of frame but no face. A worn deep-green tool cabinet stands against the
> wall. Modest, real, hardworking small-business atmosphere. No readable text, no logos, 16:9, high
> resolution.

**Видео (EN):**
> Animate this exact workshop frame into a seamless 6–10 second loop, camera locked. Motion: sparks
> or wood shavings drift and fall gently, dust motes float through the sunbeam from the open door,
> a hanging tool on the pegboard sways very slightly, warm light flickers subtly. Hands at the edge
> of frame move only minimally and naturally, no face ever comes into focus. No cuts, no text or
> logos. 1280×720, H.264, no audio, seamless loop.

---

## `microcredit` — микрокредитование для начинающих предпринимателей

**RU:** Микрокредиты до 20 млн ₸ для начинающих предпринимателей через МФО-партнёров фонда
«Даму» — старт малого дела, требуется сертификат «Бастау Бизнес».

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a tiny artisan bakery-café just opening in a
> Kazakh city street: warm light glows from inside through a large front window onto the sidewalk,
> fresh round loaves and pastries stacked on wooden shelves visible through the glass, a blank
> freshly-painted sign board above the door (no letters, no logo — just a clean deep-green painted
> panel). Two café chairs and a small table stand outside, steam rises from a cup left on the
> windowsill. The street is still quiet, low sun raking down the facade, long shadows. A figure in
> an apron is visible only as a soft out-of-focus silhouette deep inside the shop. First-day-of-
> business optimism. No readable text, no logos, no faces, no American or Western-European
> architecture, 16:9, high resolution.

**Видео (EN):**
> Animate this exact bakery-front frame into a seamless 6–10 second loop, camera locked. Motion:
> steam curls slowly from the cup on the windowsill, warm interior light flickers very subtly, the
> out-of-focus silhouette inside moves minimally and naturally without ever coming into focus, a
> paper napkin corner on the outdoor table lifts gently in the breeze. No cuts, no people entering
> the street, no text or signage appearing. 1280×720, H.264, no audio, seamless loop.

---

## `export` — экспортное финансирование и страхование (KazakhExport)

**RU:** Страхование экспортных контрактов и пред-/постэкспортное финансирование от ЭКА
KazakhExport — покрытие до 80% убытков при неоплате, для несырьевого экспорта.

**Стилл (EN):**
> Photorealistic golden-hour shot of the modest container quay at the Port of Aktau on the Caspian
> Sea: two or three gantry cranes silhouetted against a warm sunset sky, low tidy stacks of shipping
> containers in muted industrial colors with one stack corner catching a warm golden highlight, a
> single mid-size cargo ship moored at the quay, calm sea reflecting the sky. A realistic small
> Caspian port — modest in scale, not a global mega-terminal. Faint haze over the water. No people,
> no text, no logos, no readable container markings, no giant container mountains, 16:9, high
> resolution.

**Видео (EN):**
> Animate this exact port frame into a seamless 6–10 second loop, camera locked with a barely
> perceptible drift toward the cranes. Motion: one gantry crane's cable and spreader sway gently,
> calm water ripples and glints in the low sun, a thin plume of smoke or steam rises slowly from
> the docked ship's funnel, gulls optionally drift far in the background. No cuts, no new ships
> entering frame, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `greenhouse` — теплицы и садоводство (задел на будущее)

**RU:** Задел под будущие услуги АКК по защищённому грунту и интенсивному садоводству —
современные теплицы, ряды зелени, капельный полив. В каталоге такой услуги пока нет, но резолвер
уже матчит title по «теплиц»/«садов».

**Стилл (EN):**
> Photorealistic golden-hour shot inside a modern industrial glass greenhouse in Kazakhstan: long
> straight rows of vivid green vegetable plants (tomatoes or cucumbers on vertical strings)
> receding into the distance, thin black drip-irrigation lines running along each row with tiny
> water droplets catching the low sun. Warm light floods through the glass roof panels at a raking
> angle, structural steel columns painted a muted deep green. Light mist hangs in the air between
> the rows. Clean, high-tech horticulture. No people, no text, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact greenhouse frame into a seamless 6–10 second loop, camera locked with a
> barely perceptible push down the row. Motion: fine mist drifts slowly between the plant rows,
> leaves tremble very slightly as ventilation air moves, water droplets on the drip lines glint
> and occasionally fall, sunlight shifts subtly across the glass panels. No cuts, no people, no
> text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `agro-generic` — обобщённая карточка категории «Агросектор»

**RU:** Фолбэк-обложка для любой услуги категории «Агросектор», не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic golden-hour aerial-adjacent shot of a modern Kazakh farmstead: a patchwork of
> cultivated fields in varying shades of green and gold stretching to the horizon, a cluster of
> grain silos and a low equipment barn in the mid-ground, a dirt access road cutting through the
> fields with one small tractor visible far in the distance. Warm low sun, long shadows across the
> furrows, a few scattered clouds. No people in sharp focus, no text, no logos, no greenhouses,
> 16:9, high resolution.

**Видео (EN):**
> Animate this exact farmstead frame into a seamless 6–10 second loop, camera locked with a very
> faint drift. Motion: crop rows sway gently in the wind, the distant tractor creeps almost
> imperceptibly along the access road, clouds drift slowly, light dust rises faintly near the barn.
> No cuts, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `leasing-generic` — обобщённая карточка категории «Лизинг»

**RU:** Фолбэк-обложка для любой услуги категории «Лизинг», не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic golden-hour shot of a large industrial equipment yard: rows of heavy machinery
> (excavators, generators, flatbed trailers) parked in orderly lines under a warm evening sky, one
> piece of equipment's chassis panel catching a muted deep-green highlight in the low sun. A chain-
> link fence and a distant warehouse building frame the background. Long shadows, light dust in the
> air. No people, no text, no logos, no readable brand marks, 16:9, high resolution.

**Видео (EN):**
> Animate this exact equipment-yard frame into a seamless 6–10 second loop, camera locked with a
> slow lateral drift along the rows. Motion: light glints travel across the metal surfaces as if
> clouds pass, dust drifts low across the yard, a loose tarp corner on one trailer flutters gently.
> No cuts, no new machinery entering frame, no text or logos. 1280×720, H.264, no audio, seamless
> loop.

---

## `finance-generic` — обобщённая карточка категории «Финансирование»

**RU:** Фолбэк-обложка для услуг категории «Финансирование» — растущий бизнес и стройка нового
комплекса как образ финансируемого проекта.

**Стилл (EN):**
> Photorealistic golden-hour shot of a construction site for a new industrial or business complex
> on the edge of a Kazakh city: a steel building frame under a tower crane, concrete foundations
> and stacked rebar in the foreground, workers visible only as small distant silhouettes in hard
> hats. Warm low sun catches the crane's cab, one safety barrier panel painted a muted deep-green.
> A modern skyline with glass office towers rises hazily in the background. No readable text, no
> logos, no faces in focus, 16:9, high resolution.

**Видео (EN):**
> Animate this exact construction-site frame into a seamless 6–10 second loop, camera locked. Motion:
> the tower crane's cable sways very slightly, distant silhouetted workers move minimally, light
> dust drifts across the site, warm light flickers subtly as if a cloud passes. No cuts, no new
> elements entering frame, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `credit-generic` — обобщённая карточка категории «Кредит»

**RU:** Фолбэк-обложка для кредитных программ без отдельного сюжета — оборотный капитал в
действии: отгрузка товара со склада малого дистрибьютора.

**Стилл (EN):**
> Photorealistic golden-hour shot of a small distribution warehouse in a Kazakh industrial suburb:
> two white cargo vans backed up to a loading dock, stacked shrink-wrapped pallets of boxed goods
> waiting on the ramp, a pallet jack mid-frame. Warm low sun floods the open dock doors from
> outside, casting long shadows across the concrete; one van's rear door panel carries a plain
> muted deep-green stripe (no lettering). A worker is visible only from behind, far inside the
> warehouse, out of focus. Busy, healthy working-capital atmosphere. No readable text, no logos,
> no faces, 16:9, high resolution.

**Видео (EN):**
> Animate this exact loading-dock frame into a seamless 6–10 second loop, camera locked. Motion:
> dust motes drift through the sunbeams from the dock doors, a strip curtain at the doorway sways
> gently, the distant out-of-focus figure shifts minimally, light flickers subtly as if clouds
> pass. No cuts, no vehicles moving in or out, no text or logos. 1280×720, H.264, no audio,
> seamless loop.

---

## `subsidy-generic` — обобщённая карточка категории «Субсидии»

**RU:** Фолбэк-обложка для субсидийных программ, включая возмещение затрат на НИОКР — современная
инженерная лаборатория, разработка и испытание прототипа.

**Стилл (EN):**
> Photorealistic golden-hour shot inside a modern engineering R&D lab in Kazakhstan: a metal
> prototype device partially disassembled on a clean workbench under a warm shaft of low evening
> sun from tall windows, precision tools laid out in order, an oscilloscope-style instrument with
> dark blank screens beside it, coiled cables and 3D-printed parts on a shelf. One equipment
> cabinet is painted a muted deep green. A gloved hand adjusts a component at the very edge of the
> frame — no face, no person in focus. Precise, high-tech, optimistic. No readable text or screen
> content, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact lab frame into a seamless 6–10 second loop, camera locked. Motion: fine dust
> motes drift through the warm window light, a small status LED on the instrument blinks softly, a
> loose cable end sways almost imperceptibly, the gloved hand at the frame edge moves minimally
> and naturally. No cuts, no faces, no readable screens or text appearing. 1280×720, H.264, no
> audio, seamless loop.

---

## `grant-generic` — обобщённая карточка категории «Гранты»

**RU:** Фолбэк-обложка для грантовых программ — стартапы и технологии: коворкинг технохаба в
Астане вечером, команда за работой (силуэты, без лиц).

**Стилл (EN):**
> Photorealistic golden-hour shot inside a modern tech hub coworking space in Astana: an open loft
> floor with long shared desks, laptops with dark blank screens, a glass-walled meeting pod, and a
> large blank whiteboard on wheels with only faint erased smudges (no readable writing). Low warm
> sun streams horizontally through floor-to-ceiling windows, silhouetting two or three young people
> at a far desk — backlit shapes only, no faces readable. A potted plant and a deep-green fabric
> acoustic panel add the only saturated color. Energetic startup evening atmosphere. No readable
> text, no logos, no faces, 16:9, high resolution.

**Видео (EN):**
> Animate this exact coworking frame into a seamless 6–10 second loop, camera locked. Motion: the
> backlit silhouettes shift naturally in small movements (typing, leaning), dust motes drift in
> the horizontal sunbeams, the plant's leaves tremble faintly near a vent, light flares shift
> subtly on the glass wall. No cuts, no faces coming into focus, no text or screen content
> appearing. 1280×720, H.264, no audio, seamless loop.

---

## `invest-generic` — обобщённая карточка категории «Инвестиции»

**RU:** Фолбэк-обложка для инвестиционных услуг (в т.ч. сопровождение ПИИ Kazakh Invest) —
переговорная с панорамным видом на деловой квартал Астаны.

**Стилл (EN):**
> Photorealistic golden-hour shot of an empty executive meeting room on a high floor overlooking
> the modern business district of Astana: floor-to-ceiling windows with the city's glass towers
> and landmark skyline glowing amber in the low sun, a long dark-wood conference table with neatly
> arranged empty chairs, closed leather folders and a carafe of water on the table, a deep-green
> upholstered chair at the head as the single color accent. Reflections of the skyline slide
> across the polished tabletop. No people, no readable documents, no text, no logos, no flags,
> 16:9, high resolution.

**Видео (EN):**
> Animate this exact meeting-room frame into a seamless 6–10 second loop, camera locked with the
> faintest push toward the window. Motion: sunlight and cloud shadows shift slowly across the
> skyline outside, reflections glide subtly along the polished table, tiny dust motes drift in
> the window light, distant traffic far below moves almost imperceptibly. No cuts, no people
> entering, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `guarantee-generic` — обобщённая карточка категории «Гарантии»

**RU:** Фолбэк-обложка для любой гарантийной программы, не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic golden-hour shot of a modern small manufacturing workshop's storefront-adjacent
> loading bay: a roller shutter half-raised, neatly stacked crates and pallets of goods ready for
> shipment, a hand truck leaning against the wall with a worn deep-green frame. Warm low sun rakes
> across the concrete floor and crate edges. Calm, orderly, small-business atmosphere conveying
> stability and backing. No people in sharp focus, no text, no logos, 16:9, high resolution.

**Видео (EN):**
> Animate this exact loading-bay frame into a seamless 6–10 second loop, camera locked. Motion:
> the roller shutter chain sways almost imperceptibly, dust motes drift through the warm sunbeam,
> a loose strap on one crate flutters gently. No cuts, no people entering frame, no text or logos.
> 1280×720, H.264, no audio, seamless loop.

---

## `export-generic` — обобщённая карточка категории «Экспорт»

**RU:** Фолбэк-обложка для любой экспортной услуги, не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic golden-hour shot of a logistics hub at a Kazakh border crossing or rail transfer
> terminal: a line of flatbed rail cars loaded with covered cargo stretching toward the horizon,
> a small customs checkpoint building with a muted deep-green roof panel in the mid-ground, warm
> low sun and long shadows across the gravel yard. No people in sharp focus, no text, no logos, no
> flags, 16:9, high resolution.

**Видео (EN):**
> Animate this exact terminal frame into a seamless 6–10 second loop, camera locked with a faint
> drift along the rail cars. Motion: heat haze shimmers above the tracks, dust drifts low across
> the gravel, clouds move slowly overhead, a loose tarp corner on one flatbed car flutters gently.
> No cuts, no new cars entering frame, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## Чек-лист: от промпта до продакшна

1. **Сгенерировать стилл** в Gemini/Imagen по промпту из соответствующего раздела (используй
   английский текст «Стилл (EN)» как есть или чуть подкрути под вкус — структура сцены/свет/
   акценты менять нежелательно, чтобы держать единый стиль сета).
2. **Сжать стилл до JPG ≤300 КБ, ~1600×900:**
   ```bash
   sips -Z 1600 in.png --out out.jpg
   # либо через Squoosh: squoosh.app → MozJPEG, качество ~75-80
   ```
3. **Сгенерировать видео** через Gemini image-to-video, подав на вход готовый сжатый `.jpg` как
   референс-кадр и промпт «Видео (EN)» из того же раздела.
4. **Сжать видео до mp4 ≤2.5 МБ, 1280×720, H.264:**
   ```bash
   ffmpeg -i in.mp4 -vf scale=1280:720 -c:v libx264 -crf 28 -movflags +faststart -an out.mp4
   ```
   Если после `-crf 28` всё ещё тяжелее лимита — поднять `-crf` до 30–32 (потеря качества
   минимальна на локоп-видео такого рода).
5. **Проверить луп** — открыть файл и убедиться, что переход последний→первый кадр не дёргается.
   Если дёргается — либо перегенерировать с более явной подсказкой «seamless loop, first and last
   frame matching», либо обрезать/подрезать через `ffmpeg -i in.mp4 -vf "fps=25"` под кратную длину.
6. **Разложить файлы** строго по конвенции:
   ```
   frontend/public/media/hero/hero-main.jpg
   frontend/public/media/hero/hero-main.mp4
   frontend/public/media/services/wagons.jpg
   frontend/public/media/services/wagons.mp4
   frontend/public/media/services/agro-livestock.jpg
   ... и т.д. для каждого ключа из таблицы выше
   ```
7. **Коммит + пуш.** Файлы в `frontend/public/media/` — статика, попадают в билд без изменений
   кода.
8. **Сказать Claude «подключи медиа»** (или просто задеплоить) — компонент карточек/hero уже
   написан с фолбэками на случай отсутствия файла, так что можно раскладывать не всё сразу: чего
   нет — останется на текущей заглушке, ничего не сломается.

Файлы можно раскладывать частями (например, сначала `hero-main` + 2–3 самых заметных ключа), не
обязательно генерировать все 40 файлов за один присест.
