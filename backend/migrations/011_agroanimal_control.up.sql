-- 011_agroanimal_control: second hackathon control-case service —
-- "Агробизнес: развитие животноводства" (analogue of bgov.kz/ru/services/agroanimal2).
--
-- A realistic multi-step animal-husbandry financing form demonstrating the
-- form-builder's flexibility: prefill from mock eGov, calculated fields,
-- field-level conditions, diverse field types, and a stage-2 (follow-up
-- documents) step — same two-stage pattern introduced in 010 for the
-- leasing control case.

INSERT INTO services (title, description, category, org_name, status, form_schema, created_by)
VALUES (
  'Агробизнес: развитие животноводства',
  'Субсидируемое финансирование животноводческих хозяйств — крестьянских хозяйств, ТОО и сельских потребительских кооперативов: приобретение поголовья КРС, МРС, птицы и лошадей, кормов и оборудования, строительство и модернизация ферм. Льготная ставка — от 5% годовых, субсидирование части затрат — до 50%. Решение по заявке — до 10 рабочих дней.',
  'Агросектор',
  'АгроКапитал',
  'published',
  '{
    "steps": [
      {
        "id": "step_1",
        "title": "Хозяйство и заявитель",
        "fields": [
          {"id":"an1","type":"text","label":"ИИН / БИН","required":true,"prefill_from":"egov.iin"},
          {"id":"an2","type":"text","label":"Наименование / ФИО","required":true,"prefill_from":"egov.org_name"},
          {"id":"an3","type":"select","label":"Форма хозяйства","required":true,"options":["Крестьянское хозяйство (КХ)","Товарищество с ограниченной ответственностью (ТОО)","Сельский потребительский кооператив (СПК)"]},
          {"id":"an4","type":"select","label":"Регион","required":true,"options":["Акмолинская","Актюбинская","Алматинская","Атырауская","Восточно-Казахстанская","Жамбылская","Западно-Казахстанская","Карагандинская","Костанайская","Кызылординская","Павлодарская","Северо-Казахстанская","Туркестанская","Другой"]},
          {"id":"an5","type":"number","label":"Стаж работы в животноводстве, лет","required":true,"placeholder":"5"}
        ]
      },
      {
        "id": "step_2",
        "title": "Направление животноводства",
        "fields": [
          {"id":"an6","type":"select","label":"Вид скота","required":true,"options":["КРС молочное","КРС мясное","МРС (овцы/козы)","Птица","Коневодство","Свиноводство"]},
          {"id":"an7","type":"number","label":"Текущее поголовье, гол.","required":true},
          {"id":"an8","type":"radio","label":"Породность стада","required":true,"options":["Племенное","Товарное (непородное)"]},
          {"id":"an9","type":"select","label":"Порода / кросс птицы","options":["Бройлер","Яичный кросс","Индейка","Утка / гусь"],"condition":{"field_id":"an6","operator":"equals","value":"Птица"}},
          {"id":"an10","type":"text","label":"Порода / линия племенного стада","placeholder":"Например: казахская белоголовая, эдильбаевская","condition":{"field_id":"an8","operator":"equals","value":"Племенное"}}
        ]
      },
      {
        "id": "step_3",
        "title": "Параметры проекта",
        "fields": [
          {"id":"an11","type":"multiselect","label":"Цель финансирования","required":true,"options":["Приобретение поголовья","Корма","Оборудование","Строительство/модернизация фермы"]},
          {"id":"an12","type":"number","label":"Количество голов к приобретению","required":true},
          {"id":"an13","type":"currency","label":"Цена за голову, тенге","required":true},
          {"id":"an14","type":"calculated","label":"Стоимость приобретаемого поголовья","formula":"an12 * an13","mask":"currency","readonly":true},
          {"id":"an15b","type":"textarea","label":"Описание проекта строительства/модернизации фермы","placeholder":"Опишите планируемые работы, если выбрана соответствующая цель финансирования"}
        ]
      },
      {
        "id": "step_4",
        "title": "Финансовая модель",
        "fields": [
          {"id":"an15","type":"currency","label":"Запрашиваемая сумма финансирования, тенге","required":true},
          {"id":"an16","type":"number","label":"Доля субсидирования затрат, %","required":true,"placeholder":"50"},
          {"id":"an17","type":"calculated","label":"Сумма субсидии (расчётно)","formula":"an15 * an16 / 100","mask":"currency","readonly":true},
          {"id":"an18","type":"select","label":"Срок финансирования, мес.","required":true,"options":["12","24","36","48","60","84"]},
          {"id":"an19","type":"calculated","label":"Ежемесячный платёж (ориентировочно, 5% годовых)","formula":"(an15 - an17) / an18 + (an15 - an17) * 0.05 / 12","mask":"currency","readonly":true}
        ]
      },
      {
        "id": "step_5",
        "title": "Обеспечение и соответствие",
        "fields": [
          {"id":"an20","type":"select","label":"Вид залога","required":true,"options":["Поголовье скота (залог животных)","Недвижимость / здания фермы","Сельхозтехника и оборудование","Земельный участок / право землепользования","Без залога (гарантия/поручительство)"]},
          {"id":"an21","type":"currency","label":"Оценочная стоимость залога, тенге","required":true},
          {"id":"an22","type":"checkbox","label":"Подтверждаю отсутствие налоговой задолженности перед КГД","required":true},
          {"id":"an23","type":"checkbox","label":"Подтверждаю ветеринарное благополучие хозяйства (отсутствие карантинных ограничений)","required":true},
          {"id":"an24","type":"date","label":"Дата последнего ветеринарного осмотра / вакцинации"},
          {"id":"an25","type":"textarea","label":"Дополнительные сведения о хозяйстве","placeholder":"Любая дополнительная информация, важная для рассмотрения заявки"}
        ]
      },
      {
        "id": "step_6",
        "title": "Документы",
        "stage": 2,
        "fields": [
          {"id":"an_doc1","type":"file","label":"Справка о наличии сельскохозяйственных животных / идентификация животных (ИСЖ)","accept":".pdf","required":true},
          {"id":"an_doc2","type":"file","label":"Ветеринарные документы (справка о ветеринарном благополучии хозяйства)","accept":".pdf","required":true},
          {"id":"an_doc3","type":"file","label":"Акт на право пользования землёй / договор аренды пастбищ","accept":".pdf","required":true},
          {"id":"an_doc4","type":"file","label":"Финансовая отчётность за последний год","accept":".pdf","required":true},
          {"id":"an_doc5","type":"file","label":"Бизнес-план проекта","accept":".pdf","required":true},
          {"id":"an_doc6","type":"file","label":"Справка об отсутствии налоговой задолженности (КГД)","accept":".pdf","required":true},
          {"id":"an_doc7","type":"file","label":"Отчёт независимого оценщика по залоговому имуществу","accept":".pdf","required":false}
        ]
      }
    ]
  }',
  (SELECT id FROM users WHERE iin = '000000000000')
);
