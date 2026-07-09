-- 017_holding_stats: администрируемые цифры о холдинге «Байтерек» для секции
-- «Институт развития страны» на главной. Набор фиксированный (4 записи) —
-- из админки правятся только value/label/asof/sort_order, создание/удаление
-- не предусмотрены. Все числа выверены по официальной отчётности и
-- публикациям холдинга (июль 2026).

CREATE TABLE holding_stats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_key    VARCHAR(60)  NOT NULL UNIQUE,  -- машинный ключ (assets, support_2025, …)
    value       VARCHAR(255) NOT NULL,         -- число/текст как строка: «15,91 трлн ₸»
    label       VARCHAR(255) NOT NULL,         -- подпись: «Активы холдинга»
    asof        VARCHAR(255),                  -- сноска мелким: «на 30.06.2025»
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO holding_stats (stat_key, value, label, asof, sort_order) VALUES
('assets',       '15,91 трлн ₸', 'Активы холдинга',                 'на 30.06.2025',                1),
('support_2025', '9 трлн ₸',     'Поддержка экономики за 2025 год',  '≈25 000 проектов',             2),
('rating',       'Baa1 / BBB',   'Рейтинги Moody''s и Fitch',        'прогноз «Стабильный», 2025',   3),
('founded',      '2013',         'Год основания',                    'Указ Президента РК',           4);

-- Нормализация наименования дочек к актуальному «НИХ» на случай, если в
-- сид-данных сохранилось прежнее «НУХ»/«управляющий холдинг» (переименование
-- АО с «управляющего» на «инвестиционный» — 30.12.2025). No-op, если таких нет.
UPDATE services
   SET org_name = 'АО «НИХ «Байтерек»'
 WHERE org_name ILIKE '%НУХ%'
    OR org_name ILIKE '%управляющий холдинг%';
