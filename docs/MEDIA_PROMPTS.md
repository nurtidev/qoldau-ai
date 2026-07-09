# Промпты для генерации медиа (Gemini/Imagen — стиллы, Gemini image-to-video — видео-лупы)

Как пользоваться: генерируешь стилл по промпту → сохраняешь и сжимаешь по требованиям ниже →
на его основе (image-to-video) генерируешь короткий луп → кладёшь оба файла под нужным именем в
указанную папку → коммит-пуш → после раскладки скажи Claude «подключи медиа» — код с фолбэками
уже готов, картинки/видео подхватятся автоматически, ничего не сломается, пока файла нет.

## Общий стилевой стандарт (применяй ко всем промптам ниже)

Единый визуальный язык для всего сета — если сцены будут «в одном фильме», портал не развалится
на разномастные стоковые фото.

- **Модерн и оптимизм.** Сет транслирует «мы обновляемся и развиваемся»: everything looks new
  and thriving — brand-new equipment fresh from the factory, contemporary architecture (glass,
  clean lines), immaculate infrastructure, sense of growth and renewal. Никакой ветхости,
  ржавчины, потёртой техники и уставших зданий — всё в кадре выглядит только что построенным,
  купленным, покрашенным.
- **Время суток / свет.** Раннее утро, «рассветный золотой час» (рассвет = будущее и обновление,
  НЕ вечерний закат) — свежий низкий тёплый свет, длинные мягкие утренние тени, лёгкая утренняя
  дымка/роса, прозрачный чистый воздух. Никаких дневных плоских кадров и никакой студийной
  подсветки.
- **Палитра.** Естественные тона казахстанской степи и современных объектов (охра, пшеничное
  золото, сталь, стекло, бетон, небо) + **точечные** акценты цветов Байтерека — глубокий зелёный
  `#007A40` и золото `#B4975A`. Это НЕ заливка кадра зелёным/золотым, а случайные детали внутри
  сцены: зелёный кузов новой спецтехники, золотистый отблеск на свежем металле в рассветном
  свете, зелёная кровля нового корпуса. Акцент должен выглядеть органично, а не как брендинг.
- **Люди — без крупных планов лиц.** Прав на генерацию узнаваемых лиц нет. Если в кадре нужен
  человек — он снят со спины, силуэтом, издалека или не в фокусе; лицо не читается крупным планом.
  По умолчанию предпочитай сцены вообще без людей — акцент на технике, инфраструктуре, ландшафте и
  продукте труда.
- **Казахстан узнаваем.** Степной ландшафт (плоский горизонт, редкие холмы, широкое небо),
  современная инфраструктура (новые терминалы, ЖД-магистрали, порт, теплицы, цеха, деловые центры
  в стиле Астаны) — без клюквы, без юрт-декораций для несельских сцен. Узнаваемость — через
  ландшафт и современную архитектуру, а не через ветхость.
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
- **Обязательные негативы (в конец КАЖДОГО промпта):** `no rust, no aging or worn equipment,
  no dilapidated soviet-era buildings, no dust and decay`. Это страховка принципа «модерн и
  оптимизм» — модели любят добавлять «фактурную» ржавчину и патину, здесь она запрещена.
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
  без смены плана. Движение — только внутри сцены: трава/колосья на ветру, флаги, пар, утренняя
  дымка, блики на воде или металле, облака, медленно движущаяся вдалеке техника.
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

**RU:** Главный экран портала — Байтерек (холдинг, вся экономика) на фоне делового Казахстана:
монумент «Байтерек» в Астане на фоне современного футуристичного делового скайлайна, рассвет —
город просыпается и растёт.

**Стилл (EN):**
> Wide 16:9 photorealistic shot at early-morning golden hour, just after sunrise, in Astana,
> Kazakhstan. In the right two-thirds of the frame: the Baiterek monument — a tall white
> lattice-shell tower topped with a golden spherical crown — stands prominently, fully visible,
> straight and undistorted, geometrically accurate lattice structure; behind and around it a
> strikingly modern, futuristic business skyline of sleek new glass towers with clean lines
> catches the fresh low morning sun, everything looking new, immaculate and thriving, crisp clear
> morning air with only the lightest soft haze. The left third of the frame is calm, softly
> out-of-focus fresh morning sky in warm gold and soft blue with light clouds and no hard
> details — reserved negative space for a headline overlay. Long soft morning shadows, a sense of
> a city waking up and growing, optimistic dawn-of-a-new-day mood. Photoreal, high resolution,
> architecturally accurate single monument (do not duplicate or distort the tower), no people in
> sharp focus, no text, no logos, no watermarks, no letterboxing, full bleed edge to edge, no
> rust, no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact frame into a seamless 6–10 second loop, camera locked, no pan or zoom beyond
> the faintest drift. Motion sources: clouds drift almost imperceptibly across the morning sky
> behind the tower, window reflections in the distant skyline glint and twinkle very subtly as
> the sun climbs, soft golden highlights shimmer and creep across the surface of the golden
> sphere. No cuts, no people entering the frame, no text or logos appearing anywhere. 1280×720,
> H.264, no audio, first and last frame matching for a perfect loop.

**Альтернативы (не выбраны, доступны как запасной вариант):** B — панорама делового района Астаны
без монумента (набережная, скайлайн); C — современный индустриальный/логистический парк (цеха,
погрузка фур) без монумента и без агро-мотивов.

---

## `wagons` — лизинг вагонов и авиатранспорта

**RU:** Лизинг подвижного состава и авиатранспорта от Фонда развития промышленности — обновление
парка: вагоны будто только с завода, современный терминал.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot, just after sunrise, of a brand-new freight train
> at a modern, freshly built rail terminal in Kazakhstan. A long line of factory-new hopper wagons
> and tank cars in immaculate fresh paint — clean deep graphite-grey and one wagon in deep green —
> stands on new welded track with clean pale ballast; the low fresh sun rakes across the flawless
> painted steel, glossy highlights on the new metal. The entire train is factory-fresh from top to
> bottom: brand-new dark-grey bogies and wheelsets with cleanly painted axles, springs and
> couplers, spotless undercarriage — absolutely no rust anywhere including wheels, bogies, frames
> and couplers, no graffiti, no weathering, no service stencils or markings of any kind. In the
> background a modern terminal with clean lines, new masts and LED lighting gantries, crisp
> morning air with a light soft haze. Everything looks new, as if the rolling stock was delivered
> from the factory yesterday — sense of fleet renewal and growth. No people, no text, no lettering
> or numbers anywhere, no logos, 16:9, high resolution, no grain elevators, no rust, no aging or
> worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact terminal frame into a seamless 6–10 second loop, camera locked. Motion: the
> freight train inches forward almost imperceptibly along the track, light morning haze drifts
> above the rails, sun glints travel slowly across the glossy new paintwork, clouds drift very
> slowly. No hard cuts, no new elements entering frame, no text or logos. 1280×720, H.264, no
> audio, seamless loop.

---

## `agro-livestock` — животноводство (Агробизнес: развитие животноводства)

**RU:** Финансирование животноводческих хозяйств — современная ферма: новые светлые корпуса,
ухоженное поголовье на зелёном пастбище, ставка от 6% годовых.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot, just after sunrise, of a modern well-invested
> livestock farm in Kazakhstan: a healthy, well-groomed herd of sturdy beef cattle with glossy
> dark reddish coats grazing on a lush green pasture with fresh morning dew catching the low sun.
> No ear tags on the cattle, natural clean coats. In the mid-ground stand brand-new, bright
> light-colored livestock barns with clean metal roofs and modern ventilation, freshly painted,
> one roof in deep green; new galvanized fencing and clean feed equipment nearby. Soft morning
> mist lifting off the grass, long fresh shadows, wide clear sky, clean natural color grading
> throughout. Everything looks newly built and thriving — modern agriculture, renewal and growth.
> No people, no text, no logos, 16:9, high resolution, no dairy holstein cows, no mud, no rust,
> no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact pasture frame into a seamless 6–10 second loop, camera locked with a barely
> perceptible drift across the herd. Motion: cattle shift weight, swish tails, a few take slow
> grazing steps; morning mist lifts and drifts slowly off the grass; clouds crawl across the sky;
> dew glints subtly in the low sun. No new animals entering frame, no cuts, no text or logos.
> 1280×720, H.264, no audio, seamless loop.

---

## `ken-dala` — весенне-полевые и уборочные работы (Кең дала 2)

**RU:** Льготное кредитование весенне-полевых и уборочных работ (семена, ГСМ, удобрения) —
ставка 5% годовых, срок до 18 месяцев. Новый современный комбайн в спелой пшенице.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot, just after sunrise, of a brand-new modern combine
> harvester working an endless ripe golden wheat field in Kazakhstan. The combine is
> factory-fresh: immaculate bright paintwork in deep green with clean light-grey trim, spotless
> glass cab, new tires — as if delivered this season, no dust crust, no wear, no visible brand
> logos or lettering. Heavy ripe golden wheat heads fill the foreground in sharp focus, sparkling
> with morning light; the combine works in the mid-distance leaving a clean cut swath, a thin
> bright trail of chaff backlit by the fresh low sun. Flat horizon, wide clear morning sky with a
> few soft gilded clouds, crisp air. Sense of a new harvest season and modern, renewed farming.
> No people in sharp focus, no text, no logos, 16:9, high resolution, no green unripe wheat, no
> rust, no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact wheat-field frame into a seamless 6–10 second loop, camera locked. Motion:
> golden wheat heads ripple in slow waves across the field as wind passes through, the combine
> harvester creeps forward at the edge of the frame with a light bright trail of chaff drifting
> behind it, clouds move slowly overhead. No hard cuts, no camera pan beyond a faint drift, no
> text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `orleu` — Өрлеу, льготное кредитование МСБ (переработка/производство)

**RU:** Флагманская программа льготного кредитования МСБ фонда «Даму» — ставка 12,6%, лимит до
7 млрд ₸ на инвестиционные цели. Новый современный цех.

**Стилл (EN):**
> Photorealistic early-morning shot inside a brand-new small-scale food-processing or
> light-manufacturing workshop with large factory windows; fresh low morning sun streams through
> the glass onto gleaming new stainless-steel production lines and neatly stacked pallets of
> finished goods wrapped in clean plastic. A brand-new forklift with a deep-green chassis is
> parked mid-frame, no driver visible. Light morning haze hangs in the sunbeams. Immaculate,
> orderly, freshly commissioned industrial space — a growing modern business. No people in sharp
> focus, no text, no logos, 16:9, high resolution, no rust, no aging or worn equipment, no
> dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact workshop frame into a seamless 6–10 second loop, camera locked with a faint
> drift along the production line. Motion: light haze drifts slowly through the sunbeams, a
> conveyor belt in the background inches forward, light flares gently shift on the polished
> stainless steel. No people entering frame, no cuts, no text or logos. 1280×720, H.264, no
> audio, seamless loop.

---

## `isker` — Іскер аймақ, малый бизнес в регионах

**RU:** Субсидирование ставки для малого бизнеса «Іскер аймақ» — конечная ставка 12,6%, сумма до
200 млн ₸. Современный региональный город: обновлённая улица, свежие фасады.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a small business street in a modern
> Kazakhstani regional town, recently renovated streetscape: a row of freshly finished
> single-story shopfronts with clean contemporary facades, new paving and young street trees, a
> small modern service garage with its new roller door half open, fresh low morning sun raking
> across the buildings. A brand-new compact delivery van with a deep-green livery panel (no text,
> no logo) is parked at the curb on fresh asphalt. Sparse pedestrians are visible only as distant,
> out-of-focus silhouettes. Recognizably Kazakhstani provincial scale — modest in size but new,
> clean and thriving, a town investing in itself. No text, no logos, no readable signage, no
> American or Western-European architecture, 16:9, high resolution, no rust, no aging or worn
> equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact street frame into a seamless 6–10 second loop, camera locked. Motion: a crisp
> new awning corner flutters lightly in the breeze, young street trees sway gently, distant
> silhouetted pedestrians walk slowly and exit frame naturally, morning light brightens very
> subtly. No new signage appears, no cuts, no text or logos. 1280×720, H.264, no audio, seamless
> loop.

---

## `leasing-agro` — льготный лизинг сельхозтехники

**RU:** Лизинг тракторов, комбайнов и посевных комплексов от «КазАгроФинанс» — ставка 6%, срок до
10 лет. Техника будто только с конвейера.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a neat row of brand-new agricultural
> machinery — tractors and seeders straight from the factory — parked in formation on a clean
> paved lot at the edge of a modern farm, like a dealership showcase. Fresh low morning sun rakes
> across the flawless glossy paintwork, one tractor's fender catching a warm golden highlight,
> new tires with crisp tread. Flat steppe and a modern silver grain silo stand in the soft-focus
> background. Long fresh shadows across the pavement, light morning haze. No people, no text, no
> logos, no visible brand emblems, no greenhouses, 16:9, high resolution, no rust, no aging or
> worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact machinery-lot frame into a seamless 6–10 second loop, camera locked with a
> very slow lateral drift along the row. Motion: light glints travel slowly across the polished
> tractor bodywork as if clouds pass overhead, morning haze drifts faintly, a wind sock in the
> background flutters gently. No cuts, no new vehicles entering frame, no text or logos.
> 1280×720, H.264, no audio, seamless loop.

---

## `damu-guarantee` — гарантии Даму для малого бизнеса (цех/мастерская)

**RU:** Гарантирование кредитов МСБ и гарантия для начинающих предпринимателей — покрытие до 85%
суммы кредита, снижает требования банка к залогу. Современная, свежо оборудованная мастерская.

**Стилл (EN):**
> Photorealistic early-morning shot inside a modern, newly equipped independent workshop — a
> metalworking or carpentry shop — with fresh low morning sun streaming through a large open
> roller door onto clean new workbenches, a full set of new hand tools arranged on a tidy
> pegboard, and a precisely made metal frame or wooden structure in progress on a workbench. A
> few bright sparks or fresh wood shavings catch the light mid-air near a tool in use, operator's
> hands visible at the edge of frame but no face. A brand-new deep-green tool cabinet stands
> against the wall. Modern, well-invested small-business atmosphere — a craftsman starting the
> day in a shop he is proud of. No readable text, no logos, 16:9, high resolution, no rust, no
> aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact workshop frame into a seamless 6–10 second loop, camera locked. Motion:
> sparks or wood shavings drift and fall gently, fine motes float through the sunbeam from the
> open door, a hanging tool on the pegboard sways very slightly, morning light flickers subtly.
> Hands at the edge of frame move only minimally and naturally, no face ever comes into focus.
> No cuts, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `microcredit` — микрокредитование для начинающих предпринимателей

**RU:** Микрокредиты до 20 млн ₸ для начинающих предпринимателей через МФО-партнёров фонда
«Даму» — старт малого дела, требуется сертификат «Бастау Бизнес». Только что открывшаяся пекарня.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a brand-new artisan bakery-café on its opening
> day in a Kazakh city street: warm light glows from inside through a large spotless front window
> onto freshly laid sidewalk paving, fresh round loaves and pastries stacked on new wooden shelves
> visible through the glass, a blank freshly-painted sign board above the door (no letters, no
> logo — just a clean deep-green painted panel), crisp new awning, immaculate renovated facade.
> Two new café chairs and a small table stand outside, steam rises from a cup left on the
> windowsill. The street is still quiet, fresh low sun raking down the facade, long morning
> shadows. A figure in an apron is visible only as a soft out-of-focus silhouette deep inside the
> shop. First-day-of-business optimism — a new venture opening its doors. No readable text, no
> logos, no faces, no American or Western-European architecture, 16:9, high resolution, no rust,
> no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact bakery-front frame into a seamless 6–10 second loop, camera locked. Motion:
> steam curls slowly from the cup on the windowsill, warm interior light flickers very subtly, the
> out-of-focus silhouette inside moves minimally and naturally without ever coming into focus, a
> paper napkin corner on the outdoor table lifts gently in the breeze. No cuts, no people entering
> the street, no text or signage appearing. 1280×720, H.264, no audio, seamless loop.

---

## `export` — экспортное финансирование и страхование (KazakhExport)

**RU:** Страхование экспортных контрактов и пред-/постэкспортное финансирование от ЭКА
KazakhExport — покрытие до 80% убытков при неоплате, для несырьевого экспорта. Обновлённый
современный порт.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of the modern container quay at the Port of Aktau
> on the Caspian Sea: two or three freshly painted modern gantry cranes catching the low sunrise
> light, low tidy stacks of clean new shipping containers in crisp solid colors with one stack
> corner glowing warm gold, a single well-maintained mid-size cargo ship moored at the quay, calm
> sea reflecting the fresh morning sky. A realistic small Caspian port — modest in scale, not a
> global mega-terminal, but visibly modernized and thriving. Light morning haze over the water.
> No people, no text, no logos, no readable container markings, no giant container mountains,
> 16:9, high resolution, no rust, no aging or worn equipment, no dilapidated soviet-era
> buildings, no dust and decay.

**Видео (EN):**
> Animate this exact port frame into a seamless 6–10 second loop, camera locked with a barely
> perceptible drift toward the cranes. Motion: one gantry crane's cable and spreader sway gently,
> calm water ripples and glints in the low morning sun, morning haze drifts slowly over the water,
> gulls optionally drift far in the background. No cuts, no new ships entering frame, no text or
> logos. 1280×720, H.264, no audio, seamless loop.

---

## `greenhouse` — теплицы и садоводство (задел на будущее)

**RU:** Задел под будущие услуги АКК по защищённому грунту и интенсивному садоводству —
современные теплицы, ряды зелени, капельный полив. В каталоге такой услуги пока нет, но резолвер
уже матчит title по «теплиц»/«садов».

**Стилл (EN):**
> Photorealistic early-morning shot inside a brand-new industrial glass greenhouse in Kazakhstan:
> long straight rows of vivid green vegetable plants (tomatoes or cucumbers on vertical strings)
> receding into the distance, thin new black drip-irrigation lines running along each row with
> tiny water droplets catching the low morning sun. Fresh light floods through the spotless glass
> roof panels at a raking angle, new structural steel columns painted deep green. Light mist hangs
> in the air between the rows. Immaculate, high-tech horticulture — newly commissioned facility.
> No people, no text, no logos, 16:9, high resolution, no rust, no aging or worn equipment, no
> dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact greenhouse frame into a seamless 6–10 second loop, camera locked with a
> barely perceptible push down the row. Motion: fine mist drifts slowly between the plant rows,
> leaves tremble very slightly as ventilation air moves, water droplets on the drip lines glint
> and occasionally fall, morning light shifts subtly across the glass panels. No cuts, no people,
> no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `agro-generic` — обобщённая карточка категории «Агросектор»

**RU:** Фолбэк-обложка для любой услуги категории «Агросектор», не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic early-morning golden-hour aerial-adjacent shot of a modern Kazakh farmstead: a
> patchwork of well-tended cultivated fields in varying shades of green and gold stretching to
> the horizon, a cluster of new silver grain silos and a freshly built equipment barn in the
> mid-ground, a clean access road cutting through the fields with one brand-new tractor visible
> far in the distance. Fresh low sun, long morning shadows across the furrows, light mist lifting
> off the fields, a few scattered clouds. A thriving, well-invested modern farm. No people in
> sharp focus, no text, no logos, no greenhouses, 16:9, high resolution, no rust, no aging or
> worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact farmstead frame into a seamless 6–10 second loop, camera locked with a very
> faint drift. Motion: crop rows sway gently in the wind, the distant tractor creeps almost
> imperceptibly along the access road, clouds drift slowly, morning mist lifts faintly off the
> fields. No cuts, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `leasing-generic` — обобщённая карточка категории «Лизинг»

**RU:** Фолбэк-обложка для любой услуги категории «Лизинг», не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a modern equipment yard: rows of brand-new
> heavy machinery (excavators, generators, flatbed trailers) fresh from the factory, parked in
> orderly lines on clean pavement under a fresh morning sky, glossy immaculate paintwork
> everywhere, one machine's chassis panel in deep green catching the low sun. New fencing and a
> modern warehouse building with clean lines frame the background. Long morning shadows, light
> haze in the air — a dealership-fresh fleet ready for delivery. No people, no text, no logos, no
> readable brand marks, 16:9, high resolution, no rust, no aging or worn equipment, no
> dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact equipment-yard frame into a seamless 6–10 second loop, camera locked with a
> slow lateral drift along the rows. Motion: light glints travel across the glossy metal surfaces
> as if clouds pass, morning haze drifts faintly, a flag or wind sock in the background flutters
> gently. No cuts, no new machinery entering frame, no text or logos. 1280×720, H.264, no audio,
> seamless loop.

---

## `finance-generic` — обобщённая карточка категории «Финансирование»

**RU:** Фолбэк-обложка для услуг категории «Финансирование» — растущий бизнес и стройка нового
комплекса как образ финансируемого проекта.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a well-organized construction site for a new
> business complex on the edge of a Kazakh city: a clean steel building frame rising under a
> brand-new tower crane, neat concrete foundations and precisely stacked new rebar in the
> foreground, workers visible only as small distant silhouettes in crisp hard hats and clean
> safety vests. Fresh low morning sun catches the crane's cab, one new safety barrier panel
> painted deep green. A modern skyline with glass office towers rises in the light morning haze
> behind — the city is growing. No readable text, no logos, no faces in focus, 16:9, high
> resolution, no rust, no aging or worn equipment, no dilapidated soviet-era buildings, no dust
> and decay.

**Видео (EN):**
> Animate this exact construction-site frame into a seamless 6–10 second loop, camera locked.
> Motion: the tower crane's cable sways very slightly, distant silhouetted workers move
> minimally, morning haze drifts across the site, light brightens subtly as the sun climbs. No
> cuts, no new elements entering frame, no text or logos. 1280×720, H.264, no audio, seamless
> loop.

---

## `credit-generic` — обобщённая карточка категории «Кредит»

**RU:** Фолбэк-обложка для кредитных программ без отдельного сюжета — оборотный капитал в
действии: отгрузка товара со склада современного дистрибьютора.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a modern distribution warehouse in a Kazakh
> industrial suburb: two brand-new white cargo vans backed up to a clean loading dock, neatly
> stacked shrink-wrapped pallets of boxed goods waiting on the spotless ramp, a new pallet jack
> mid-frame. Fresh low morning sun floods the open dock doors from outside, casting long shadows
> across the clean concrete; one van's rear door panel carries a plain deep-green stripe (no
> lettering). A worker is visible only from behind, far inside the warehouse, out of focus. Busy,
> healthy, freshly built working-capital atmosphere. No readable text, no logos, no faces, 16:9,
> high resolution, no rust, no aging or worn equipment, no dilapidated soviet-era buildings, no
> dust and decay.

**Видео (EN):**
> Animate this exact loading-dock frame into a seamless 6–10 second loop, camera locked. Motion:
> fine motes drift through the sunbeams from the dock doors, a strip curtain at the doorway sways
> gently, the distant out-of-focus figure shifts minimally, light flickers subtly as if clouds
> pass. No cuts, no vehicles moving in or out, no text or logos. 1280×720, H.264, no audio,
> seamless loop.

---

## `subsidy-generic` — обобщённая карточка категории «Субсидии»

**RU:** Фолбэк-обложка для субсидийных программ, включая возмещение затрат на НИОКР — современная
инженерная лаборатория, разработка и испытание прототипа.

**Стилл (EN):**
> Photorealistic early-morning shot inside a brand-new engineering R&D lab in Kazakhstan: a
> precision metal prototype device partially disassembled on an immaculate workbench under a
> fresh shaft of low morning sun from tall windows, new precision tools laid out in order, a
> modern oscilloscope-style instrument with dark blank screens beside it, tidy coiled cables and
> crisp 3D-printed parts on a new shelf. One equipment cabinet is painted deep green. A gloved
> hand adjusts a component at the very edge of the frame — no face, no person in focus. Precise,
> high-tech, optimistic — a freshly funded lab. No readable text or screen content, no logos,
> 16:9, high resolution, no rust, no aging or worn equipment, no dilapidated soviet-era
> buildings, no dust and decay.

**Видео (EN):**
> Animate this exact lab frame into a seamless 6–10 second loop, camera locked. Motion: fine
> motes drift through the morning window light, a small status LED on the instrument blinks
> softly, a loose cable end sways almost imperceptibly, the gloved hand at the frame edge moves
> minimally and naturally. No cuts, no faces, no readable screens or text appearing. 1280×720,
> H.264, no audio, seamless loop.

---

## `grant-generic` — обобщённая карточка категории «Гранты»

**RU:** Фолбэк-обложка для грантовых программ — стартапы и технологии: коворкинг технохаба в
Астане ранним утром, команда за работой (силуэты, без лиц).

**Стилл (EN):**
> Photorealistic early-morning shot inside a brand-new tech hub coworking space in Astana: an
> open loft floor with long new shared desks, laptops with dark blank screens, a glass-walled
> meeting pod, and a large clean whiteboard on wheels (no readable writing). Fresh low morning
> sun streams horizontally through floor-to-ceiling windows, silhouetting two or three young
> people at a far desk — backlit shapes only, no faces readable, an early team starting the day.
> A potted plant and a deep-green fabric acoustic panel add the only saturated color. Energetic
> new-day startup atmosphere in a freshly fitted-out space. No readable text, no logos, no faces,
> 16:9, high resolution, no rust, no aging or worn equipment, no dilapidated soviet-era
> buildings, no dust and decay.

**Видео (EN):**
> Animate this exact coworking frame into a seamless 6–10 second loop, camera locked. Motion: the
> backlit silhouettes shift naturally in small movements (typing, leaning), fine motes drift in
> the horizontal sunbeams, the plant's leaves tremble faintly near a vent, light flares shift
> subtly on the glass wall. No cuts, no faces coming into focus, no text or screen content
> appearing. 1280×720, H.264, no audio, seamless loop.

---

## `invest-generic` — обобщённая карточка категории «Инвестиции»

**RU:** Фолбэк-обложка для инвестиционных услуг (в т.ч. сопровождение ПИИ Kazakh Invest) —
переговорная с панорамным видом на деловой квартал Астаны на рассвете.

**Стилл (EN):**
> Photorealistic early-morning shot of an immaculate executive meeting room on a high floor
> overlooking the modern business district of Astana: floor-to-ceiling windows with the city's
> sleek new glass towers glowing in the fresh sunrise light, a long polished dark-wood conference
> table with neatly arranged new chairs, closed leather folders and a carafe of water on the
> table, a deep-green upholstered chair at the head as the single color accent. Reflections of
> the waking skyline slide across the flawless tabletop — a city and a deal both about to begin.
> No people, no readable documents, no text, no logos, no flags, 16:9, high resolution, no rust,
> no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact meeting-room frame into a seamless 6–10 second loop, camera locked with the
> faintest push toward the window. Motion: sunrise light and cloud shadows shift slowly across
> the skyline outside, reflections glide subtly along the polished table, tiny motes drift in
> the window light, distant traffic far below moves almost imperceptibly. No cuts, no people
> entering, no text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `guarantee-generic` — обобщённая карточка категории «Гарантии»

**RU:** Фолбэк-обложка для любой гарантийной программы, не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a modern small manufacturing workshop's
> loading bay: a new roller shutter half-raised, neatly stacked fresh crates and shrink-wrapped
> pallets of goods ready for shipment, a brand-new hand truck with a deep-green frame leaning
> against the clean wall. Fresh low morning sun rakes across the spotless concrete floor and
> crisp crate edges. Calm, orderly, newly established small-business atmosphere conveying
> stability and backing. No people in sharp focus, no text, no logos, 16:9, high resolution, no
> rust, no aging or worn equipment, no dilapidated soviet-era buildings, no dust and decay.

**Видео (EN):**
> Animate this exact loading-bay frame into a seamless 6–10 second loop, camera locked. Motion:
> the roller shutter chain sways almost imperceptibly, fine motes drift through the morning
> sunbeam, a loose strap on one crate flutters gently. No cuts, no people entering frame, no
> text or logos. 1280×720, H.264, no audio, seamless loop.

---

## `export-generic` — обобщённая карточка категории «Экспорт»

**RU:** Фолбэк-обложка для любой экспортной услуги, не покрытой отдельным сюжетом.

**Стилл (EN):**
> Photorealistic early-morning golden-hour shot of a modern logistics hub at a Kazakh rail
> transfer terminal: a line of brand-new flatbed rail cars loaded with neatly covered cargo
> stretching toward the horizon, a freshly built compact terminal building with clean lines and a
> deep-green roof panel in the mid-ground, new lighting masts, fresh low sun and long morning
> shadows across the clean paved yard, light morning haze on the horizon. A modernized export
> gateway — new infrastructure, growing trade. No people in sharp focus, no text, no logos, no
> flags, 16:9, high resolution, no rust, no aging or worn equipment, no dilapidated soviet-era
> buildings, no dust and decay.

**Видео (EN):**
> Animate this exact terminal frame into a seamless 6–10 second loop, camera locked with a faint
> drift along the rail cars. Motion: light morning haze shimmers above the tracks, clouds move
> slowly overhead, a cover strap on one flatbed car flutters gently, sun glints travel across the
> new metal. No cuts, no new cars entering frame, no text or logos. 1280×720, H.264, no audio,
> seamless loop.

---

## Чек-лист: от промпта до продакшна

1. **Сгенерировать стилл** в Gemini/Imagen по промпту из соответствующего раздела (используй
   английский текст «Стилл (EN)» как есть или чуть подкрути под вкус — структура сцены/свет/
   акценты менять нежелательно, чтобы держать единый стиль сета; обязательные негативы из шапки
   не удалять).
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
