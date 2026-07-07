-- 011 down: remove the seeded "Агробизнес: развитие животноводства" control
-- case. This is a seed service — there are no real applications against it
-- in production, so a plain delete is safe.

DELETE FROM services WHERE title = 'Агробизнес: развитие животноводства';
