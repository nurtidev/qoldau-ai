-- 019_news_images: фото-обложки для новостного модуля (12 материалов из 016_news).
-- Каждый UPDATE безопасен независимо от остальных — если title не найден (например,
-- редакция уже переименовала материал), просто 0 затронутых строк, миграция не падает.

UPDATE news SET image_url = '/media/news/orleu-terms.jpg'
  WHERE title = '«Өрлеу»: обновлённые условия льготного кредитования МСБ вступают в силу';

UPDATE news SET image_url = '/media/news/ken-dala-sowing.jpg'
  WHERE title = '«Кең дала 2»: открыт приём заявок на финансирование весенне-полевых работ';

UPDATE news SET image_url = '/media/news/isker-region.jpg'
  WHERE title = '«Іскер аймақ»: поддержка предпринимателей в моно- и малых городах';

UPDATE news SET image_url = '/media/news/guarantee-industries.jpg'
  WHERE title = 'Расширен перечень отраслей для гарантирования кредитов МСБ';

UPDATE news SET image_url = '/media/news/wagons-lease.jpg'
  WHERE title = 'Льготный лизинг подвижного состава: обновлены условия для перевозчиков';

UPDATE news SET image_url = '/media/news/kazakhexport-tashkent.jpg'
  WHERE title = 'KazakhExport открыл представительство в Ташкенте';

UPDATE news SET image_url = '/media/news/livestock-financing.jpg'
  WHERE title = 'Финансирование животноводства: приём заявок на льготные кредиты';

UPDATE news SET image_url = '/media/news/seedmoney-grants.jpg'
  WHERE title = 'Seed Money: открыт новый раунд грантов для технологических стартапов';

UPDATE news SET image_url = '/media/news/story-combine.jpg'
  WHERE title = '«Взял кредит по Кең дала 2 и купил комбайн — убираем урожай сами»';

UPDATE news SET image_url = '/media/news/story-bakery.jpg'
  WHERE title = 'Из домашней пекарни — в цех: как «Өрлеу» помог расширить производство';

UPDATE news SET image_url = '/media/news/story-sheep-farm.jpg'
  WHERE title = 'Семейная ферма выросла с 50 до 200 голов при поддержке льготного кредита';

UPDATE news SET image_url = '/media/news/media-forbes.jpg'
  WHERE title = 'Как цифровой портал меняет доступ бизнеса к мерам господдержки — Forbes Kazakhstan';
