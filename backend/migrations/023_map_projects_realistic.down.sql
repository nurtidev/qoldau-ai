-- 023_map_projects_realistic: откат — восстанавливаем суммы/органы/регионы
-- к состоянию до калибровки (миграция 014, сид карты проектов).
-- Матч по name (см. обоснование в .up.sql).

-- ─── Регионы: вернуть исходные (нестыковка город/регион) ──────────────────────
UPDATE map_projects SET region = 'Туркестанская'
WHERE name = 'Экспорт хлопкового волокна в Турцию';

UPDATE map_projects SET region = 'Алматинская'
WHERE name = 'Агрегационный центр по хранению овощей';

-- ─── Организации + суммы: вернуть Даму для 4 переатрибутированных проектов ────
UPDATE map_projects SET amount = 3200, org = 'Даму'
WHERE name = 'Приобретение 40 полувагонов';

UPDATE map_projects SET amount = 2650, org = 'Даму'
WHERE name = 'Приобретение 15 полувагонов-цистерн';

UPDATE map_projects SET amount = 4100, org = 'Даму'
WHERE name = 'Приобретение 60 контейнеровозов';

UPDATE map_projects SET amount = 6200, org = 'Даму'
WHERE name = 'Логистический хаб на границе с КНР';

-- ─── Суммы: вернуть исходные значения по остальным 24 проектам ────────────────
UPDATE map_projects SET amount = 2100
WHERE name = 'Модернизация молочной фермы на 1200 голов';

UPDATE map_projects SET amount = 5400
WHERE name = 'Тепличный комплекс 12 га';

UPDATE map_projects SET amount = 1850
WHERE name = 'Цех переработки полимеров';

UPDATE map_projects SET amount = 780
WHERE name = 'Экспорт муки в страны Центральной Азии';

UPDATE map_projects SET amount = 8500
WHERE name = 'Ветропарк мощностью 100 МВт';

UPDATE map_projects SET amount = 640
WHERE name = 'Гарантия по кредиту на цех металлоконструкций';

UPDATE map_projects SET amount = 2300
WHERE name = 'IT-парк для аутсорс-разработки';

UPDATE map_projects SET amount = 460
WHERE name = 'Развитие эко-турбазы на Бурабае';

UPDATE map_projects SET amount = 1340
WHERE name = 'Приобретение зерноуборочных комбайнов';

UPDATE map_projects SET amount = 990
WHERE name = 'Завод по производству рыбных консервов';

UPDATE map_projects SET amount = 520
WHERE name = 'Экспорт хлопкового волокна в Турцию';

UPDATE map_projects SET amount = 4700
WHERE name = 'Солнечная электростанция 60 МВт';

UPDATE map_projects SET amount = 210
WHERE name = 'Гарантия по кредиту на швейное производство';

UPDATE map_projects SET amount = 1580
WHERE name = 'Агрегационный центр по хранению овощей';

UPDATE map_projects SET amount = 350
WHERE name = 'Стартап-акселератор для финтех-компаний';

UPDATE map_projects SET amount = 3100
WHERE name = 'Реконструкция гостиничного комплекса';

UPDATE map_projects SET amount = 1120
WHERE name = 'Экспорт подсолнечного масла в страны Персидского залива';

UPDATE map_projects SET amount = 890
WHERE name = 'Цех по производству стройматериалов из ЗШО';

UPDATE map_projects SET amount = 175
WHERE name = 'Гарантия по кредиту на цех упаковки';

UPDATE map_projects SET amount = 970
WHERE name = 'Тепличный комплекс для выращивания клубники';

UPDATE map_projects SET amount = 610
WHERE name = 'Реставрация историко-туристского маршрута';

UPDATE map_projects SET amount = 730
WHERE name = 'Ветеринарная лаборатория и убойный цех';

UPDATE map_projects SET amount = 3900
WHERE name = 'Дата-центр уровня Tier III';

UPDATE map_projects SET amount = 145
WHERE name = 'Гарантия по кредиту на автосервисную сеть';
