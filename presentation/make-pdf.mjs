// Сборка qoldau-pitch.pdf из скриншотов слайдов index.html —
// PDF получается пиксель-в-пиксель как HTML (2x retina).
// Запуск из любого места: node presentation/make-pdf.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(ROOT, '..', 'frontend', 'package.json'));
const { chromium } = require('@playwright/test');

const SLIDES = 12;
const build = path.join(ROOT, '.pdf-build');
fs.rmSync(build, { recursive: true, force: true });
fs.mkdirSync(build);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(ROOT, 'index.html'));
await page.waitForTimeout(1500); // шрифты и первый рендер
// служебный UI (счётчик, подсказки, заметки) в PDF не нужен
await page.addStyleTag({ content: '#counter,#hint,#notes{display:none!important}' });

const shots = [];
for (let i = 1; i <= SLIDES; i++) {
  const f = path.join(build, `slide-${String(i).padStart(2, '0')}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
  if (i < SLIDES) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(450); }
}

// Обёртка: каждая страница — полноразмерный снимок слайда
const html = `<!doctype html><style>
@page { size: 1280px 720px; margin: 0; }
html,body { margin:0; padding:0; }
img { display:block; width:1280px; height:720px; page-break-after:always; }
img:last-child { page-break-after:auto; }
</style>` + shots.map(f => `<img src="${path.basename(f)}">`).join('');

const wrapper = path.join(build, 'print.html');
fs.writeFileSync(wrapper, html);
const printPage = await browser.newPage();
await printPage.goto('file://' + wrapper, { waitUntil: 'networkidle' });
await printPage.pdf({
  path: path.join(ROOT, 'qoldau-pitch.pdf'),
  preferCSSPageSize: true,
  printBackground: true,
});
await browser.close();
fs.rmSync(build, { recursive: true, force: true });
console.log('qoldau-pitch.pdf: ' + SLIDES + ' стр., собран из 2x-скриншотов слайдов');
