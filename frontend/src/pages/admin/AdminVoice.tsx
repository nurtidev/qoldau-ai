import { useEffect, useMemo, useState } from 'react'
import { I } from '@/components/icons'
import { useIsBelowLaptop } from '@/hooks/useMediaQuery'

/*
 * Qoldau Voice — ROADMAP-ПРОТОТИП (дорожная карта Q3–Q4 2026).
 *
 * Это демонстрационный модуль из питча: «Качество консультаций — измеримо».
 * Идея — живой звонок или визит в офис → транскрипция AI → автоматическая
 * оценка качества консультации по чек-листу. Целевой сегмент — старшее
 * поколение клиентов, которым сложно с цифровыми каналами: институт развития
 * хочет измерять качество ЖИВЫХ консультаций, а не только онлайн-воронку.
 *
 * ВНИМАНИЕ: страница работает на статичном фронтенд-массиве DEMO_CONSULTATIONS.
 * Никакого бэкенда, реальных звонков и записей здесь нет — это макет
 * будущего продукта, а не рабочий инструмент. Все ФИО и реплики вымышлены;
 * названия программ — реальные (канон фактов, миграция 013).
 */

// ─── Типы демо-данных ────────────────────────────────────────────────────────

type Channel = 'call' | 'office'
type Lang = 'ru' | 'kz'
type Status = 'excellent' | 'good' | 'attention'
type Role = 'consultant' | 'client'

interface Turn {
  t: string        // таймкод mm:ss
  role: Role
  text: string
}

interface Criterion {
  label: string
  score: number    // 0..10
  comment: string
}

interface Consultation {
  id: string
  date: string     // ISO
  channel: Channel
  consultant: string
  topic: string    // реальное название программы (канон)
  org: string      // оператор программы
  lang: Lang
  durationSec: number
  score: number    // итоговая оценка 0..100
  status: Status
  transcript: Turn[]
  criteria: Criterion[]
  verdict: string
  recommendation: string
}

// Единый чек-лист критериев AI-оценки — порядок фиксирован для всех кейсов.
// Значения score/comment задаются в каждом кейсе.

// ─── Демо-массив консультаций ────────────────────────────────────────────────

const DEMO_CONSULTATIONS: Consultation[] = [
  // 1. Эталон — Өрлеу (Даму), звонок, рус, пожилой клиент с пекарней.
  {
    id: 'c1',
    date: '2026-07-11T10:12:00',
    channel: 'call',
    consultant: 'Айгүл Сапарова',
    topic: 'Өрлеу — льготное кредитование МСБ',
    org: 'Даму',
    lang: 'ru',
    durationSec: 380,
    score: 94,
    status: 'excellent',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Здравствуйте! Единое окно поддержки бизнеса «Байтерек», меня зовут Айгүл. Подскажите, как могу к вам обращаться?' },
      { t: '00:08', role: 'client', text: 'Здравствуйте, дочка. Меня Раиса Петровна зовут. У меня пекарня небольшая, хочу оборудование обновить, но в банках ставки такие, что страшно.' },
      { t: '00:22', role: 'consultant', text: 'Поняла вас, Раиса Петровна. Давайте разберёмся вместе, спешить не будем. Скажите, пекарня давно работает и сколько человек у вас трудится?' },
      { t: '00:34', role: 'client', text: 'Четыре года уже. Нас пятеро, все местные.' },
      { t: '00:41', role: 'consultant', text: 'Отлично, это действующий малый бизнес — как раз для программы «Өрлеу» фонда «Даму». Смысл простой: государство берёт часть процентов на себя, и вы платите банку не рыночные двадцать с лишним, а 12,6% годовых. Переплата получается заметно меньше.' },
      { t: '00:58', role: 'client', text: 'А 12,6 — это на весь срок так и останется?' },
      { t: '01:05', role: 'consultant', text: 'Да, пока действует субсидия, ставка для вас фиксированная — 12,6%. На покупку оборудования лимит большой, вам его с запасом хватит. Давайте прикинем, какая сумма нужна на печи?' },
      { t: '01:20', role: 'client', text: 'Тысяч на восемь миллионов думаю.' },
      { t: '01:26', role: 'consultant', text: 'Восемь миллионов — вполне проходит. Теперь по документам: я перечислю по порядку и пришлю списком на телефон, чтобы вы не запоминали. Справка о доходах, документы на пекарню и заявка — её можно заполнить прямо на портале, я помогу. Хорошо?' },
      { t: '01:47', role: 'consultant', text: 'Тогда сделаем так: сегодня отправлю вам список и ссылку, вы соберёте документы, а в четверг я перезвоню и мы вместе подадим заявку. Договорились, Раиса Петровна?' },
      { t: '01:58', role: 'client', text: 'Договорились, спасибо большое, милая.' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 10, comment: 'Представилась, назвала организацию, уточнила, как обращаться к клиенту.' },
      { label: 'Выявление потребности', score: 9, comment: 'До подбора программы уточнила срок работы, число сотрудников и цель займа.' },
      { label: 'Корректность подбора программы', score: 10, comment: '«Өрлеу» подобрана верно: действующий МСБ, инвестиционная цель, сумма в пределах лимита.' },
      { label: 'Понятность объяснения условий', score: 10, comment: 'Ставку объяснила простыми словами и сравнила с рыночной, без терминов.' },
      { label: 'Проговорены следующие шаги', score: 10, comment: 'Чётко: список документов и ссылка на телефон, назначен конкретный день повторного звонка.' },
      { label: 'Тон и эмпатия', score: 10, comment: 'Тёплый темп, «спешить не будем», обращение по имени-отчеству.' },
    ],
    verdict: 'Образцовая консультация. Пожилой клиент получил решение на понятном языке и чёткий план действий.',
    recommendation: 'Сохранить как эталон для обучения новых консультантов. Особенно удачен приём «пришлю списком, чтобы вы не запоминали».',
  },

  // 2. Хорошо — Кең дала 2 (АКК), офис, рус, фермер перед посевной.
  {
    id: 'c2',
    date: '2026-07-10T14:35:00',
    channel: 'office',
    consultant: 'Ерлан Тұрсынов',
    topic: 'Кең дала 2 — кредитование весенне-полевых работ',
    org: 'Аграрная кредитная корпорация',
    lang: 'ru',
    durationSec: 545,
    score: 82,
    status: 'good',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Здравствуйте! Меня зовут Ерлан, консультант по аграрным программам. Присаживайтесь. Как к вам обращаться?' },
      { t: '00:09', role: 'client', text: 'Здравствуйте. Аскар аға, крестьянское хозяйство у меня. К посевной готовлюсь, на ГСМ и семена денег не хватает.' },
      { t: '00:20', role: 'consultant', text: 'Понял, Аскар аға. Как раз на весенне-полевые работы есть программа «Кең дала 2» от Аграрной кредитной корпорации. Ставка льготная — 5% годовых, это заметно ниже банковской. Срок до полутора лет, как раз до урожая рассчитаетесь.' },
      { t: '00:38', role: 'client', text: 'Пять процентов — это хорошо. А сколько дадут?' },
      { t: '00:43', role: 'consultant', text: 'Лимит большой, но вам посчитаем под площадь и потребность — обычно на семена, ГСМ и удобрения. Сколько гектаров засеваете?' },
      { t: '00:55', role: 'client', text: 'Гектаров триста.' },
      { t: '01:00', role: 'consultant', text: 'На такую площадь суммы точно хватит. По залогу — там предусмотрена гарантия «Даму» до 85%, это снижает требования банка, объясню отдельно.' },
      { t: '01:12', role: 'client', text: 'А документы какие нужны?' },
      { t: '01:16', role: 'consultant', text: 'Основное — документы на хозяйство, землю и расчёт затрат на посевную. Я дам вам памятку со списком.' },
      { t: '01:26', role: 'client', text: 'Хорошо. А подавать когда лучше?' },
      { t: '01:30', role: 'consultant', text: 'Лучше сейчас, до начала посевной, чтобы деньги пришли вовремя. Соберёте документы — приходите, подадим вместе.' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 9, comment: 'Представился, назвал должность, уточнил обращение.' },
      { label: 'Выявление потребности', score: 8, comment: 'Уточнил вид хозяйства, цель и площадь; расчёт суммы остался приблизительным.' },
      { label: 'Корректность подбора программы', score: 9, comment: '«Кең дала 2» — точное попадание: оборотные средства на ВПР, ставка 5%.' },
      { label: 'Понятность объяснения условий', score: 8, comment: 'Ставку и срок объяснил понятно; про гарантию «Даму» сказал, но подробно не раскрыл («объясню отдельно»).' },
      { label: 'Проговорены следующие шаги', score: 8, comment: 'Памятка со списком и рекомендация подать до посевной; конкретная дата не назначена.' },
      { label: 'Тон и эмпатия', score: 9, comment: 'Уважительное «Аскар аға», спокойный темп разговора.' },
    ],
    verdict: 'Сильная консультация. Программа подобрана точно, клиент понял условия; недостаёт назначенной даты подачи.',
    recommendation: 'Довести до эталона: назначать конкретный день подачи и коротко раскрывать выгоду гарантии «Даму», а не откладывать «на потом».',
  },

  // 3. Требует внимания — Іскер аймақ (Даму), звонок, рус. Консультант сыплет
  //    терминами, пожилой клиент не понял, следующий шаг не проговорён.
  {
    id: 'c3',
    date: '2026-07-10T11:04:00',
    channel: 'call',
    consultant: 'Марат Оспанов',
    topic: 'Іскер аймақ — субсидирование ставки для малого бизнеса',
    org: 'Даму',
    lang: 'ru',
    durationSec: 228,
    score: 38,
    status: 'attention',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Компания «Байтерек», Марат. Слушаю вас.' },
      { t: '00:04', role: 'client', text: 'Здравствуйте. Я слышал, государство проценты по кредиту возмещает. Магазинчик у меня, хотел разобраться.' },
      { t: '00:14', role: 'consultant', text: 'Да, это программа «Іскер аймақ», субсидирование номинальной ставки. Государство субсидирует сорок процентов купона, эффективная ставка выходит 12,6, дальше аннуитетными платежами гасите тело и вознаграждение.' },
      { t: '00:30', role: 'client', text: 'Простите, я не совсем... какой купон? Я про магазин спрашиваю.' },
      { t: '00:37', role: 'consultant', text: 'Купон — это номинал по ставке банка-партнёра, субсидия покрывает часть. Вам одобрят лимит до двухсот миллионов на срок субсидирования тридцать шесть месяцев.' },
      { t: '00:49', role: 'client', text: 'Двести миллионов? Мне бы миллиона три на товар...' },
      { t: '00:55', role: 'consultant', text: 'Ну это лимит, вы берёте сколько нужно. По скорингу пройдёте — подавайте заявку через портал, там ЭЦП понадобится.' },
      { t: '01:04', role: 'client', text: 'Какую-какую подпись? Я в этом совсем не понимаю...' },
      { t: '01:10', role: 'consultant', text: 'Электронная цифровая подпись. Ну, в общем, ставка выгодная, оформляйте. Всего доброго.' },
      { t: '01:17', role: 'client', text: 'Подождите, а мне куда идти-то...' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 5, comment: 'Представился коротко, но не уточнил имя клиента и не установил контакт.' },
      { label: 'Выявление потребности', score: 4, comment: 'Не выяснил вид и срок бизнеса; нужную сумму (3 млн ₸) назвал сам клиент — консультант её проигнорировал.' },
      { label: 'Корректность подбора программы', score: 7, comment: 'Программа в целом верная (малый бизнес, субсидирование ставки), но сумма клиента не сопоставлена с условиями.' },
      { label: 'Понятность объяснения условий', score: 2, comment: 'Термины «номинальная ставка», «купон», «аннуитет», «эффективная ставка», «ЭЦП» — без расшифровки. Клиент трижды переспросил и не понял.' },
      { label: 'Проговорены следующие шаги', score: 2, comment: 'Следующий шаг не проговорён: на прямой вопрос «куда идти» ответа не последовало, звонок завершён.' },
      { label: 'Тон и эмпатия', score: 3, comment: 'Формальный тон, переспросы клиента игнорируются, разговор завершён до решения его вопроса.' },
    ],
    verdict: 'Требует внимания. Пожилой клиент ушёл без понимания условий и без плана действий — высокий риск потери заявителя.',
    recommendation: 'Заменить термины простыми словами: «купон / номинальная ставка» → «процент банка», «эффективная ставка» → «сколько платите в итоге», «ЭЦП» → «электронная подпись, поможем оформить». Обязательно проговаривать конкретный следующий шаг и не завершать разговор, пока клиент не подтвердил, что понял, куда идти.',
  },

  // 4. Эталон — Бастау Бизнес (центры занятости), офис, КАЗ. Пожилой клиент из
  //    аула, грант на ремесло. Диалог на казахском; AI-оценка — на русском для
  //    ревьюера-администратора.
  {
    id: 'c4',
    date: '2026-07-09T09:30:00',
    channel: 'office',
    consultant: 'Динара Ахметова',
    topic: 'Грант «Бастау Бизнес»',
    org: 'Центры занятости (enbek.kz)',
    lang: 'kz',
    durationSec: 520,
    score: 96,
    status: 'excellent',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Сәлеметсіз бе! «Байтерек» кәсіпкерлерді қолдау орталығы, менің атым Динара. Сізге қалай жүгінсем болады?' },
      { t: '00:09', role: 'client', text: 'Ассалаумағалейкум, қызым. Мен Күләш апаң боламын. Ауылда тұрам, қолөнермен айналысайын деп едім, бастауға қаражат керек.' },
      { t: '00:22', role: 'consultant', text: 'Түсіндім, Күләш апа. Асықпай сөйлесейік. Сіз бұрын кәсіппен айналысқансыз ба, әлде жаңадан бастайсыз ба?' },
      { t: '00:33', role: 'client', text: 'Жаңадан. Кілем тоқығанды білем, соны сатсам деймін.' },
      { t: '00:40', role: 'consultant', text: 'Өте жақсы. Онда сізге «Бастау Бизнес» гранты қолайлы. Бұл — қайтарымсыз мемлекеттік көмек, яғни несие емес, қайтарудың қажеті жоқ. Мөлшері 400 айлық есептік көрсеткішке дейін, шамамен бір жарым миллион теңгеге жуық.' },
      { t: '00:58', role: 'client', text: 'Қайтармаймын ба? Пайызы жоқ па?' },
      { t: '01:04', role: 'consultant', text: 'Иә, пайызы да жоқ, қайтарудың да қажеті жоқ. Бірақ бір шарт бар: алдымен «Бастау Бизнес» тегін оқуынан өтіп, сертификат аласыз. Оны да өзіміз ұйымдастырамыз, қорықпаңыз.' },
      { t: '01:20', role: 'client', text: 'Оқуды қайдан табам, қаланы білмеймін ғой?' },
      { t: '01:27', role: 'consultant', text: 'Уайымдамаңыз. Оқу онлайн да, аудандық халықты жұмыспен қамту орталығында да бар. Қазір сізге ең жақын орталықтың мекенжайы мен телефонын қағазға жазып берем, ертең хабарласасыз.' },
      { t: '01:42', role: 'client', text: 'Ойбай, рахмет, қызым. Осылай айтсаң түсінікті екен.' },
      { t: '01:48', role: 'consultant', text: 'Рахмет сізге, Күләш апа. Сонымен: бірінші — оқу мен сертификат; екінші — құжаттарды бірге дайындаймыз; үшінші — өтінімді порталға саламыз. Әр қадамда көмектесем, жалғыз қалмайсыз.' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 10, comment: 'Поздоровалась на языке клиента, представилась, уточнила, как обращаться.' },
      { label: 'Выявление потребности', score: 10, comment: 'Выяснила, что бизнес новый, и вид деятельности — прежде чем предлагать программу.' },
      { label: 'Корректность подбора программы', score: 10, comment: '«Бастау Бизнес» — верно для начинающего: грант, не кредит; условие обучения названо.' },
      { label: 'Понятность объяснения условий', score: 10, comment: 'Объяснила «грант = не нужно возвращать, без процентов» простыми словами, сняла страх перед обучением.' },
      { label: 'Проговорены следующие шаги', score: 10, comment: 'Три чётких шага; адрес и телефон ближайшего центра переданы письменно.' },
      { label: 'Тон и эмпатия', score: 10, comment: '«Асықпай», «жалғыз қалмайсыз» — тёплая поддержка пожилого клиента на родном языке.' },
    ],
    verdict: 'Образцовая консультация на казахском. Клиент из сельской местности получил понятное решение и пошаговый план.',
    recommendation: 'Эталон работы со старшим поколением на родном языке. Тиражировать приём: обязательное обучение подаётся не как барьер, а как сопровождаемый шаг («қорықпаңыз», «жалғыз қалмайсыз»).',
  },

  // 5. Хорошо — Льготный лизинг сельхозтехники (КазАгроФинанс), звонок, рус.
  {
    id: 'c5',
    date: '2026-07-08T16:20:00',
    channel: 'call',
    consultant: 'Нұржан Бекенов',
    topic: 'Льготный лизинг сельхозтехники',
    org: 'КазАгроФинанс',
    lang: 'ru',
    durationSec: 330,
    score: 84,
    status: 'good',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Здравствуйте, «Байтерек», Нұржан. Слушаю вас.' },
      { t: '00:05', role: 'client', text: 'Здравствуйте. Трактор совсем старый, новый нужен, а сразу денег нет. Говорят, в лизинг можно?' },
      { t: '00:15', role: 'consultant', text: 'Да, есть льготный лизинг сельхозтехники от «КазАгроФинанс». Смысл такой: технику покупает лизинговая компания, вы ей пользуетесь и выплачиваете частями. Ставка 6% годовых, аванс может быть от нуля.' },
      { t: '00:32', role: 'client', text: 'От нуля — это как, совсем без первого взноса?' },
      { t: '00:37', role: 'consultant', text: 'Да, по ряду позиций первоначальный взнос не требуется. Срок лизинга — до десяти лет, платёж растягивается, нагрузка небольшая.' },
      { t: '00:48', role: 'client', text: 'А трактор любой можно?' },
      { t: '00:52', role: 'consultant', text: 'Из каталога техники, которую финансирует «КазАгроФинанс», — там основные марки есть. Я пришлю вам ссылку на каталог, посмотрите модели.' },
      { t: '01:02', role: 'client', text: 'Хорошо. А оформлять долго?' },
      { t: '01:06', role: 'consultant', text: 'Зависит от пакета документов. Давайте сегодня отправлю список и каталог, а завтра наберу вас и обсудим конкретную модель. Удобно после обеда?' },
      { t: '01:18', role: 'client', text: 'Удобно, спасибо.' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 7, comment: 'Представился и назвал организацию, но имя клиента не уточнил.' },
      { label: 'Выявление потребности', score: 8, comment: 'Понял цель (замена трактора) и ограничение (нет средств сразу); вид хозяйства не уточнил.' },
      { label: 'Корректность подбора программы', score: 9, comment: 'Льготный лизинг «КазАгроФинанс» — верно для покупки техники.' },
      { label: 'Понятность объяснения условий', score: 9, comment: 'Механику лизинга объяснил простыми словами: «покупает компания, вы пользуетесь и платите частями».' },
      { label: 'Проговорены следующие шаги', score: 9, comment: 'Каталог и список документов, назначен повторный звонок на конкретное время.' },
      { label: 'Тон и эмпатия', score: 8, comment: 'Доброжелательно, отвечает по существу.' },
    ],
    verdict: 'Хорошая консультация. Суть лизинга объяснена доступно, следующий шаг назначен на конкретное время.',
    recommendation: 'Мелочь до эталона: в начале уточнять имя клиента и вид хозяйства — это помогает точнее подобрать технику из каталога.',
  },

  // 6. Требует внимания — Микрокредитование (Даму), офис, рус. Вежливо, но
  //    следующий шаг размыт («почитайте на портале»), контакты не даны.
  {
    id: 'c6',
    date: '2026-07-07T13:15:00',
    channel: 'office',
    consultant: 'Гүлнара Сейтказы',
    topic: 'Микрокредитование для начинающих предпринимателей',
    org: 'Даму',
    lang: 'ru',
    durationSec: 250,
    score: 54,
    status: 'attention',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Здравствуйте, проходите, присаживайтесь. По какому вопросу?' },
      { t: '00:05', role: 'client', text: 'Здравствуйте. Мне бы небольшой заём, миллиона два, теплицу расширить. Пенсия есть, но не хватает.' },
      { t: '00:16', role: 'consultant', text: 'Понятно. Есть микрокредитование через микрофинансовые организации — партнёров «Даму». Сумма до двадцати миллионов, срок до пяти лет, вам двух миллионов хватит.' },
      { t: '00:29', role: 'client', text: 'А проценты какие?' },
      { t: '00:33', role: 'consultant', text: 'Ставку устанавливает сама микрофинансовая организация, у всех по-разному, надо смотреть.' },
      { t: '00:40', role: 'client', text: 'А у кого смотреть, у вас?' },
      { t: '00:44', role: 'consultant', text: 'Нет, это МФО-партнёры, их несколько. И там ещё условие — нужно пройти обучение «Бастау Бизнес», без сертификата не оформят.' },
      { t: '00:55', role: 'client', text: 'А это где, обучение?' },
      { t: '00:59', role: 'consultant', text: 'Информация есть на портале. В общем, вариант вам подходит, почитайте про условия. Всего доброго.' },
      { t: '01:07', role: 'client', text: 'А... хорошо, спасибо...' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 6, comment: 'Поздоровалась и пригласила сесть, но не представилась и не уточнила имя клиента.' },
      { label: 'Выявление потребности', score: 7, comment: 'Сумму и цель выяснила, но не уточнила, есть ли у клиента доступ к порталу и опыт оформления.' },
      { label: 'Корректность подбора программы', score: 8, comment: 'Микрокредитование через МФО — корректно для небольшой суммы начинающему; условие обучения названо верно.' },
      { label: 'Понятность объяснения условий', score: 5, comment: 'Про ставку «у всех по-разному, надо смотреть» — клиент остался без ориентира; что такое сертификат и зачем, не объяснила.' },
      { label: 'Проговорены следующие шаги', score: 3, comment: 'Шаг размыт: «почитайте на портале». Для пожилого клиента без цифрового навыка это тупик, конкретных контактов не дано.' },
      { label: 'Тон и эмпатия', score: 6, comment: 'Вежливо, но без вовлечённости; на прямые вопросы «а где» даны общие ответы.' },
    ],
    verdict: 'Требует внимания. Программа выбрана верно, но пожилой клиент остался без контактов МФО и без понимания, где пройти обязательное обучение.',
    recommendation: 'Не отправлять пожилого клиента «почитать на портале» как единственный шаг. Дать 1–2 конкретных МФО-партнёра с телефонами, записать, где и как пройти обучение «Бастау Бизнес», и проверить, сможет ли клиент подать заявку сам или нужна помощь в офисе.',
  },

  // 7. Хорошо — Агробизнес: животноводство (АКК), звонок, КАЗ. Диалог на
  //    казахском, покупка скота; AI-оценка — на русском.
  {
    id: 'c7',
    date: '2026-07-07T10:40:00',
    channel: 'call',
    consultant: 'Асхат Жұмабаев',
    topic: 'Агробизнес — развитие животноводства',
    org: 'Аграрная кредитная корпорация',
    lang: 'kz',
    durationSec: 315,
    score: 81,
    status: 'good',
    transcript: [
      { t: '00:00', role: 'consultant', text: 'Сәлеметсіз бе, «Байтерек», Асхат тыңдап тұр.' },
      { t: '00:05', role: 'client', text: 'Сәлеметсіз бе. Мал өсіремін деп ем, бірнеше бас сиыр алуға қаражат керек.' },
      { t: '00:14', role: 'consultant', text: 'Түсіндім. Аграрлық несие корпорациясының мал шаруашылығын дамыту бағдарламасы бар. Асыл тұқымды мал алуға, жемге, жабдыққа беріледі. Пайызы — жылдық 6%.' },
      { t: '00:29', role: 'client', text: 'Алты пайыз ба? Онда қолайлы екен. Қанша беруі мүмкін?' },
      { t: '00:35', role: 'consultant', text: 'Лимит үлкен, бірақ нақты сома шаруашылығыңыздың көлеміне қарай есептеледі. Қазір қанша бас малыңыз бар?' },
      { t: '00:45', role: 'client', text: 'Он шақты бас.' },
      { t: '00:48', role: 'consultant', text: 'Жақсы, соған қарай өсіруге есептейміз. Бағдарламаның «Игілік» деген бағыты дәл осыған келеді. Құжаттар тізімін смс-пен жіберем.' },
      { t: '01:00', role: 'client', text: 'Рахмет. Кейін не істеймін?' },
      { t: '01:04', role: 'consultant', text: 'Құжаттарды жинайсыз, мен ертең хабарласып, өтінімді бірге толтырамыз. Жарай ма?' },
      { t: '01:12', role: 'client', text: 'Жарайды, рахмет.' },
    ],
    criteria: [
      { label: 'Приветствие и идентификация', score: 7, comment: 'Представился и назвал организацию; имя клиента не уточнил.' },
      { label: 'Выявление потребности', score: 8, comment: 'Уточнил текущий размер поголовья до расчёта суммы.' },
      { label: 'Корректность подбора программы', score: 9, comment: 'Направление «Игілік» программы развития животноводства — верно для покупки скота, ставка 6%.' },
      { label: 'Понятность объяснения условий', score: 8, comment: 'Условия названы понятно; объяснил, что лимит считается под размер хозяйства.' },
      { label: 'Проговорены следующие шаги', score: 9, comment: 'Список документов по смс, назначен повторный контакт для совместной подачи.' },
      { label: 'Тон и эмпатия', score: 8, comment: 'Спокойно, на языке клиента, отвечает по сути.' },
    ],
    verdict: 'Хорошая консультация на казахском. Программа и направление подобраны точно, следующий шаг назначен.',
    recommendation: 'До эталона — уточнять имя клиента в начале и коротко проговаривать, какие именно документы войдут в смс-список.',
  },
]

// ─── Справочники отображения (только токены дизайн-системы) ──────────────────

const STATUS_META: Record<Status, { label: string; text: string; soft: string; Icon: (typeof I)[keyof typeof I] }> = {
  excellent: { label: 'Отлично',           text: 'var(--color-success)',     soft: 'var(--color-success-soft)', Icon: I.CheckCircle },
  good:      { label: 'Хорошо',            text: 'var(--color-accent-text)',  soft: 'var(--color-accent-soft)',  Icon: I.Check },
  attention: { label: 'Требует внимания',  text: 'var(--color-warning)',      soft: 'var(--color-warning-soft)', Icon: I.Alert },
}

const CHANNEL_META: Record<Channel, { label: string; Icon: (typeof I)[keyof typeof I] }> = {
  call:   { label: 'Звонок', Icon: I.Phone },
  office: { label: 'Офис',   Icon: I.Building },
}

const LANG_META: Record<Lang, { label: string; full: string }> = {
  ru: { label: 'Рус', full: 'Русский' },
  kz: { label: 'Каз', full: 'Қазақша' },
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-KZ', { day: '2-digit', month: 'short' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('ru-KZ', { day: '2-digit', month: 'long' })}, ${d.toLocaleTimeString('ru-KZ', { hour: '2-digit', minute: '2-digit' })}`
}

// Цвет заливки шкалы критерия по баллу (0..10): зелёный / янтарный / красный.
function criterionColor(score: number): string {
  if (score >= 8) return 'var(--color-success)'
  if (score >= 5) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

// ─── KPI-плитка ──────────────────────────────────────────────────────────────

function KpiTile({ label, value, hint, icon, accent }: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div className="card-elevated" style={{ padding: 20, borderRadius: 'var(--r-card)', border: '1px solid var(--color-border)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: accent ?? 'var(--color-primary-soft)', color: accent ? '#fff' : 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// ─── Строка списка консультаций ──────────────────────────────────────────────

function ConsultationRow({ item, active, onClick }: { item: Consultation; active: boolean; onClick: () => void }) {
  const ch = CHANNEL_META[item.channel]
  const st = STATUS_META[item.status]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '14px 16px', border: 'none',
        borderLeft: `3px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
        background: active ? 'var(--color-surface-2)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--color-surface-warm)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-2)', fontWeight: 500 }}>
          <ch.Icon size={14} style={{ color: 'var(--color-text-3)' }} />{ch.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums' }}>{formatDate(item.date)}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: st.text }}>
          <st.Icon size={14} />{item.score}
        </span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.35 }}>{item.topic}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{item.consultant}</span>
        <span className="badge" style={{ height: 18, fontSize: 11, background: 'var(--color-surface-2)', color: 'var(--color-text-2)' }}>
          {LANG_META[item.lang].label}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-3)' }}>
          <I.Clock size={12} />{formatDuration(item.durationSec)}
        </span>
      </div>
    </button>
  )
}

// ─── Транскрипция (диалог) ───────────────────────────────────────────────────

function TranscriptView({ turns }: { turns: Turn[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 460, overflowY: 'auto', paddingRight: 4 }}>
      {turns.map((turn, i) => {
        const isConsultant = turn.role === 'consultant'
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isConsultant ? 'flex-start' : 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, padding: '0 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: isConsultant ? 'var(--color-primary)' : 'var(--color-text-2)' }}>
                {isConsultant ? 'Консультант' : 'Клиент'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-3)', fontVariantNumeric: 'tabular-nums' }}>{turn.t}</span>
            </div>
            <div style={{
              maxWidth: '84%', padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.55,
              background: isConsultant ? 'var(--color-primary-tint)' : 'var(--color-surface-2)',
              color: 'var(--color-text)',
              borderTopLeftRadius: isConsultant ? 4 : 14,
              borderTopRightRadius: isConsultant ? 14 : 4,
            }}>
              {turn.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Чек-лист AI-оценки ──────────────────────────────────────────────────────

function CriteriaList({ criteria }: { criteria: Criterion[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {criteria.map((c) => {
        const color = criterionColor(c.score)
        return (
          <div key={c.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{c.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {c.score}<span style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 500 }}>/10</span>
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${(c.score / 10) * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 200ms' }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{c.comment}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Детальный вид консультации ──────────────────────────────────────────────

function DetailPanel({ item }: { item: Consultation }) {
  const st = STATUS_META[item.status]
  const ch = CHANNEL_META[item.channel]

  const metaChip = (icon: React.ReactNode, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-2)' }}>
      {icon}{text}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Шапка кейса */}
      <div className="card" style={{ padding: 24, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 6 }}>{item.org}</div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{item.topic}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: st.text }}>{item.score}</div>
            <span className="badge" style={{ background: st.soft, color: st.text, fontWeight: 600 }}>
              <st.Icon size={13} />{st.label}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
          {metaChip(<ch.Icon size={14} style={{ color: 'var(--color-text-3)' }} />, ch.label)}
          {metaChip(<I.User size={14} style={{ color: 'var(--color-text-3)' }} />, item.consultant)}
          {metaChip(<I.Calendar size={14} style={{ color: 'var(--color-text-3)' }} />, formatDateTime(item.date))}
          {metaChip(<I.Clock size={14} style={{ color: 'var(--color-text-3)' }} />, formatDuration(item.durationSec))}
          {metaChip(<I.Info size={14} style={{ color: 'var(--color-text-3)' }} />, LANG_META[item.lang].full)}
        </div>
      </div>

      {/* Транскрипция */}
      <div className="card" style={{ padding: 24, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <I.Mic size={18} style={{ color: 'var(--color-accent-text)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Транскрипция разговора</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: '0 0 16px' }}>
          Ключевой фрагмент, распознанный AI из аудиозаписи · {LANG_META[item.lang].full}
        </p>
        <TranscriptView turns={item.transcript} />
      </div>

      {/* AI-оценка */}
      <div className="card" style={{ padding: 24, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <I.Sparkle size={18} style={{ color: 'var(--color-accent-text)' }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>AI-оценка качества консультации</h3>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: '0 0 18px' }}>
          Разбор по чек-листу критериев с баллом и комментарием
        </p>
        <CriteriaList criteria={item.criteria} />
      </div>

      {/* Вердикт + рекомендация */}
      <div className="card" style={{ padding: 24, minWidth: 0 }}>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: st.soft, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <st.Icon size={16} style={{ color: st.text }} />
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: st.text }}>
              Итоговый вердикт
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.55 }}>{item.verdict}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'var(--color-primary-soft)', color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <I.ThumbsUp size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-3)', marginBottom: 4 }}>
              Рекомендация AI консультанту
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{item.recommendation}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Сегментированный фильтр ─────────────────────────────────────────────────

function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--color-surface-2)', borderRadius: 8, padding: 3, gap: 2, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              height: 30, padding: '0 12px', border: 'none', borderRadius: 6,
              background: on ? 'var(--color-surface)' : 'transparent',
              color: on ? 'var(--color-text)' : 'var(--color-text-3)',
              fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer',
              boxShadow: on ? 'var(--sh-xs)' : 'none',
              transition: 'background 120ms, color 120ms',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Страница ────────────────────────────────────────────────────────────────

export function AdminVoice() {
  const isNarrow = useIsBelowLaptop()
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string>(DEMO_CONSULTATIONS[0].id)

  const filtered = useMemo(() => DEMO_CONSULTATIONS.filter((c) =>
    (channelFilter === 'all' || c.channel === channelFilter) &&
    (statusFilter === 'all' || c.status === statusFilter),
  ), [channelFilter, statusFilter])

  // Если выбранный кейс выпал из фильтра — переводим выбор на первый доступный.
  useEffect(() => {
    if (filtered.length === 0) return
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id)
  }, [filtered, selectedId])

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0]

  // KPI считаются прямо из демо-выборки — без магических констант, чтобы плитки
  // всегда совпадали с тем, что видно в списке.
  const kpi = useMemo(() => {
    const n = DEMO_CONSULTATIONS.length
    const avgScore = Math.round(DEMO_CONSULTATIONS.reduce((s, c) => s + c.score, 0) / n)
    const attention = DEMO_CONSULTATIONS.filter((c) => c.status === 'attention').length
    const avgDur = Math.round(DEMO_CONSULTATIONS.reduce((s, c) => s + c.durationSec, 0) / n)
    return { n, avgScore, attentionPct: Math.round((attention / n) * 100), avgDur }
  }, [])

  return (
    <div className="page-fade admin-page">
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'var(--color-primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <I.Mic size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Qoldau Voice</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: '4px 0 0' }}>
            Звонок или офис → транскрипция AI → оценка качества консультации
          </p>
        </div>
      </div>

      {/* Бейдж прототипа — жюри не должно принять это за рабочий продукт */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px', borderRadius: 12, marginBottom: 24,
        background: 'var(--color-accent-soft)', border: '1px solid var(--color-border-strong)',
      }}>
        <I.Info size={16} style={{ color: 'var(--color-accent-text)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-accent-text)' }}>Прототип · Дорожная карта Q3–Q4 2026 · демо-данные.</strong>{' '}
          Модуль показывает будущий продукт: измерение качества живых консультаций для клиентов старшего поколения.
          Реальных звонков и записей здесь нет — все ФИО и реплики вымышлены, названия программ реальные.
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiTile label="Проанализировано" value={kpi.n} hint="консультаций в выборке" icon={<I.Mic size={16} />} />
        <KpiTile label="Средняя оценка" value={kpi.avgScore} hint="качество консультации, из 100" icon={<I.Star size={16} />} accent="var(--color-accent)" />
        <KpiTile label="Требует внимания" value={`${kpi.attentionPct}%`} hint="консультаций с риском" icon={<I.Alert size={16} />} accent="var(--color-warning)" />
        <KpiTile label="Средняя длительность" value={formatDuration(kpi.avgDur)} hint="минут на консультацию" icon={<I.Clock size={16} />} accent="var(--color-primary)" />
      </div>

      {/* Фильтры */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <I.Filter size={14} />Фильтр
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Канал</span>
          <Segmented<Channel | 'all'>
            value={channelFilter}
            onChange={setChannelFilter}
            options={[{ value: 'all', label: 'Все' }, { value: 'call', label: 'Звонок' }, { value: 'office', label: 'Офис' }]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>Статус</span>
          <Segmented<Status | 'all'>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Все' },
              { value: 'excellent', label: 'Отлично' },
              { value: 'good', label: 'Хорошо' },
              { value: 'attention', label: 'Требует внимания' },
            ]}
          />
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--color-text-3)' }}>
          Показано: {filtered.length} из {DEMO_CONSULTATIONS.length}
        </span>
      </div>

      {/* Master-detail: на узких экранах список сверху, детали под ним */}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : 'minmax(300px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Список */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', minWidth: 0, alignSelf: 'start' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 600 }}>
            Последние консультации
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-3)' }}>
              Нет консультаций под выбранный фильтр.
            </div>
          ) : (
            filtered.map((c) => (
              <ConsultationRow key={c.id} item={c} active={selected?.id === c.id} onClick={() => setSelectedId(c.id)} />
            ))
          )}
        </div>

        {/* Детали */}
        {selected && <DetailPanel item={selected} />}
      </div>
    </div>
  )
}
