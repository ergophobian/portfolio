import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:4173/index.html?${process.argv[3] || 'q=medium'}`);
await page.waitForFunction(() => window.__world?.mode === 'title', null, { timeout: 60000 });
await page.waitForTimeout(1000);
const code = process.argv[2];
console.log(JSON.stringify(await page.evaluate(code), null, 1));
if (process.argv[4]) { await page.waitForTimeout(+(process.argv[5] || 800)); await page.screenshot({ path: `../.preview/${process.argv[4]}.png` }); }
await browser.close();
