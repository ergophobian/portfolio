// Drives the site in real Chrome via Playwright and saves screenshots to .preview/.
// Usage: node shoot.mjs <scenario> [--mobile] [--q=high|medium|low] [--webgl] [--headed]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', '.preview');
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith('--')) || 'title';
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1];
const BASE = opt('base', 'http://127.0.0.1:4173');
const mobile = flag('mobile');
const q = opt('q', '');
const tag = `${scenario}${mobile ? '-mobile' : ''}${q ? '-' + q : ''}${flag('webgl') ? '-webgl' : ''}`;

const browser = await chromium.launch({
  channel: 'chrome', headless: !flag('headed'),
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext(mobile
  ? { ...devices['iPhone 14 Pro'], defaultBrowserType: undefined }
  : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

const qs = new URLSearchParams();
if (q) qs.set('q', q);
if (flag('webgl')) qs.set('webgl', '1');
const url = `${BASE}/index.html${qs.size ? '?' + qs : ''}`;
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${tag}-${name}.png` }); console.log(`saved .preview/${tag}-${name}.png`); };
const world = (fn, arg) => page.evaluate(fn, arg);
const waitMode = (m, timeout = 60000) => page.waitForFunction((mm) => window.__world?.mode === mm, m, { timeout });
const stats = async (label) => console.log(label, JSON.stringify(await world(() => ({ mode: __world.mode, fps: __world.fps, backend: __world.backend, tier: __world.tier, dpr: __world.dprScale, info: __world.info?.(), pos: __world.player ? [+__world.player.position.x.toFixed(2), +__world.player.position.z.toFixed(2)] : null }))));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
try {
  await waitMode('title');
  console.log('load→title ms', Date.now() - t0);
  const run = {
    async title() { await page.waitForTimeout(2500); await shot('title'); await stats('title'); },
    async play() {
      await page.click('#btn-start'); await waitMode('play'); await page.waitForTimeout(1500);
      await shot('spawn'); await stats('spawn');
    },
    async walk() {
      await page.click('#btn-start'); await waitMode('play'); await page.waitForTimeout(800);
      await shot('1-spawn');
      const start = await world(() => __world.player.position.z);
      await page.keyboard.down('KeyW'); await page.waitForTimeout(2500); await shot('2-walking');
      await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1200); await shot('3-running');
      await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
      const end = await world(() => __world.player.position.z);
      console.log('walked metres:', (start - end).toFixed(2));
      await page.waitForTimeout(3000); await stats('after-walk');
    },
    async desk() {
      await page.click('#btn-start'); await waitMode('play');
      await world(() => { const p = __world.player.position; p.set(-0.3, 0, 4.2); __world.rig.yaw = 0.25; __world.rig.pitch = 0.16; });
      await page.waitForTimeout(1600); await shot('1-near-desk'); await stats('near-desk');
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1300); await page.keyboard.up('KeyW');
      await page.waitForTimeout(500); await shot('2-prompt');
      await waitMode('desktop', 15000); await page.waitForTimeout(900); await shot('3-desktop');
      await page.keyboard.press('Escape').catch(() => {});
    },
    async tour() {
      await page.click('#btn-start'); await waitMode('play');
      const views = [
        ['pond', -6, 10, 2.2, 0.22, 6], ['dogs', 3.5, 13, 0.6, 0.2, 5.5], ['trees', 4, -5, 3.6, 0.1, 7],
        ['desk-close', 0.2, 2.6, 0.5, 0.18, 3.2], ['wide', 10, 16, 0.6, 0.38, 10],
      ];
      for (const [name, x, z, yaw, pitch, dist] of views) {
        await world(([x, z, yaw, pitch, dist]) => { __world.player.position.set(x, 0, z); Object.assign(__world.rig, { yaw, pitch, dist }); }, [x, z, yaw, pitch, dist]);
        await page.waitForTimeout(1700); await shot(name);
      }
      await stats('tour');
    },
  };
  await run[scenario]();
} catch (e) {
  console.log('SCENARIO ERROR', e.message.split('\n')[0]);
  await shot('error').catch(() => {});
}
console.log(logs.length ? 'CONSOLE:\n' + [...new Set(logs)].slice(0, 25).join('\n') : 'console clean');
await browser.close();
