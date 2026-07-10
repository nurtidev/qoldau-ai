-- 021_fix_callcenter_number: откат — возвращаем прежний (ошибочный) номер 1414.

UPDATE knowledge_articles
SET body = replace(body, '1408', '1414'),
    updated_at = NOW()
WHERE body LIKE '%1408%';
