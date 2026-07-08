-- Откат демо-заявок сотруднической очереди (маркер form_data->>'_seed').
DELETE FROM applications
WHERE is_synthetic = FALSE
  AND form_data->>'_seed' = 'demo_012';
