-- Откат 019_news_images: снимаем обложки, добавленные этой миграцией
-- (по путям, а не по title — безопасно, даже если title успели поменять).

UPDATE news SET image_url = NULL WHERE image_url IN (
  '/media/news/orleu-terms.jpg',
  '/media/news/ken-dala-sowing.jpg',
  '/media/news/isker-region.jpg',
  '/media/news/guarantee-industries.jpg',
  '/media/news/wagons-lease.jpg',
  '/media/news/kazakhexport-tashkent.jpg',
  '/media/news/livestock-financing.jpg',
  '/media/news/seedmoney-grants.jpg',
  '/media/news/story-combine.jpg',
  '/media/news/story-bakery.jpg',
  '/media/news/story-sheep-farm.jpg',
  '/media/news/media-forbes.jpg'
);
