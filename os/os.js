// KyleOS — a small window manager + apps for the desktop inside the monitor.
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const embedded = window.parent !== window;
  const isPhone = () => window.matchMedia('(max-width: 720px)').matches;

  const store = {
    get(key, fallback) { try { return localStorage.getItem(`kyleos:${key}`) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`kyleos:${key}`, value); } catch { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------------------
  // App registry
  // ---------------------------------------------------------------------------
  const ICON = {
    about: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4"/>',
    projects: '<rect x="3.5" y="4" width="7" height="7" rx="1.8"/><rect x="13.5" y="4" width="7" height="7" rx="1.8"/><rect x="3.5" y="14" width="7" height="6.5" rx="1.8"/><rect x="13.5" y="14" width="7" height="6.5" rx="1.8"/>',
    socials: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.200 6.100-3.800 8.500c-2.600-2.400-3.800-5.200-3.800-8.500s1.200-6.100 3.800-8.500z"/>',
    arcade: '<path d="M7 8h10a4.500 4.500 0 0 1 4.400 5.500l-.8 3.600a2.400 2.400 0 0 1-4.200 1L14.500 16h-5l-1.900 2.100a2.400 2.400 0 0 1-4.200-1l-.8-3.600A4.500 4.500 0 0 1 7 8z"/><path d="M7.500 11v3M6 12.500h3M15.500 11.500h.01M17.500 13.500h.01"/>',
    notes: '<path d="M6 3.500h9l3.500 3.500V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M9 10h6M9 13.500h6M9 17h3.500"/>',
    terminal: '<rect x="3" y="4.500" width="18" height="15" rx="2.500"/><path d="M7 10l3 2.500-3 2.500M12.500 15.500H17"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.500"/><path d="M8.500 7.500h7M8.500 12h.01M12 12h.01M15.500 12h.01M8.500 16h.01M12 16h.01M15.500 16h.01"/>',
    coffee: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 10.500h1.500a2.500 2.500 0 0 1 0 5H16M8 6c0-1 1-1 1-2M12 6c0-1 1-1 1-2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
    classic: '<path d="M4 6.500c2.500-1.300 4.500-1.300 7 0v5c-2.500-1.300-4.500-1.300-7 0v-5zM13 6.500c2.500-1.300 4.500-1.300 7 0v5c-2.500-1.300-4.500-1.300-7 0v-5zM4 14c2.500-1.300 4.500-1.300 7 0v5c-2.500-1.300-4.500-1.300-7 0v-5zM13 14c2.500-1.300 4.500-1.300 7 0v5c-2.500-1.300-4.500-1.300-7 0v-5z"/>',
    game: '<path d="M8 5.500v13l10.500-6.500L8 5.500z"/>',
  };
  const APPS = [
    { id: 'about', title: 'About Kyle', label: 'About', tone: '#ff8a4c', w: 640, h: 590 },
    { id: 'projects', title: 'Projects', tone: '#4fbf74', w: 660, h: 640 },
    { id: 'socials', title: 'Socials', tone: '#3aa8ee', w: 620, h: 580 },
    { id: 'arcade', title: 'Arcade', tone: '#a67bf0', w: 520, h: 430 },
    { id: 'notes', title: 'Notes', tone: '#eeb93a', w: 440, h: 420, flush: true },
    { id: 'terminal', title: 'Terminal', tone: '#39425f', w: 580, h: 380, flush: true },
    { id: 'calc', title: 'Calculator', tone: '#7f8bb5', w: 300, h: 440, flush: true },
    { id: 'coffee', title: 'Buy me a coffee', label: 'Coffee', tone: '#e8894a', w: 420, h: 520 },
    { id: 'settings', title: 'Settings', tone: '#5d6b8a', w: 500, h: 480 },
    { id: 'classic', title: 'Classic XP (2026 desktop)', label: 'Classic XP', tone: '#2f6fe0', w: 1100, h: 720, frame: '../desktop.html', max: true },
  ];
  const GAMES = {
    snake: { title: 'Snake', src: '../games/snake.html', w: 460, h: 540 },
    tetris: { title: 'Tetris', src: '../games/tetris.html', w: 520, h: 640 },
    g2048: { title: '2048', src: '../games/2048.html', w: 460, h: 600 },
    breakout: { title: 'Breakout', src: '../games/breakout.html', w: 540, h: 560 },
    pinball: { title: '3D Pinball — Space Cadet', src: '../pinball/index.html', w: 660, h: 560 },
  };
  const appById = (id) => APPS.find((a) => a.id === id);
  const glyph = (id, tone) => `<span class="glyph" style="--tone:${tone}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ICON.game}</svg></span>`;

  // ---------------------------------------------------------------------------
  // Window manager
  // ---------------------------------------------------------------------------
  const layer = $('#windows');
  const wins = new Map();          // key -> { el, app }
  let zTop = 10, cascade = 0;

  function focus(key) {
    for (const [k, w] of wins) w.el.classList.toggle('active', k === key);
    const w = wins.get(key);
    if (w) { w.el.style.zIndex = String(++zTop); w.el.classList.remove('minimized'); }
    $('#menu-app').textContent = w ? w.app.title : 'Desktop';
    syncDock();
  }
  function topWindow() {
    let best = null;
    for (const [k, w] of wins) {
      if (w.el.classList.contains('minimized')) continue;
      if (!best || +w.el.style.zIndex > +wins.get(best).el.style.zIndex) best = k;
    }
    return best;
  }
  function close(key) {
    const w = wins.get(key);
    if (!w) return;
    wins.delete(key);
    w.el.classList.add('closing');
    w.el.addEventListener('animationend', () => w.el.remove(), { once: true });
    setTimeout(() => w.el.remove(), 300);
    focus(topWindow());
  }
  function syncDock() {
    $$('.dock-btn').forEach((b) => {
      const running = [...wins.keys()].some((k) => k === b.dataset.app || (b.dataset.app === 'arcade' && k.startsWith('game:')));
      b.classList.toggle('running', running);
    });
  }

  function open(id, extra) {
    const app = extra || appById(id);
    if (!app) return;
    const key = extra ? `game:${id}` : id;
    closeLauncher();
    if (wins.has(key)) { focus(key); return wins.get(key).el; }

    const area = layer.getBoundingClientRect();
    const dockSpace = 96;
    const w = Math.min(app.w, area.width - 24), h = Math.min(app.h, area.height - dockSpace - 16);
    const x = Math.max(12, Math.min(area.width - w - 12, (area.width - w) / 2 + ((cascade % 5) - 2) * 28));
    const y = Math.max(10, Math.min(area.height - dockSpace - h, (area.height - dockSpace - h) / 2 + ((cascade % 5) - 2) * 22));
    cascade++;

    const el = document.createElement('section');
    el.className = 'window';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', app.title);
    el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    el.innerHTML = `
      <header class="win-bar">
        ${glyph(extra ? 'game' : app.id, app.tone || '#a67bf0')}
        <span class="win-title">${app.title}</span>
        <div class="win-ctl">
          <button type="button" class="mn" aria-label="Minimize"><svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg></button>
          <button type="button" class="mx" aria-label="Maximize"><svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="2"/></svg></button>
          <button type="button" class="x" aria-label="Close"><svg viewBox="0 0 16 16"><path d="M3.500 3.500l9 9M12.500 3.500l-9 9"/></svg></button>
        </div>
      </header>
      <div class="win-body${app.flush || app.frame || app.src ? ' flush' : ''}"></div>
      <div class="win-resize" aria-hidden="true"></div>`;
    const body = $('.win-body', el);
    const src = app.frame || app.src;
    if (src) {
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = app.title;
      frame.setAttribute('allow', 'autoplay; fullscreen');
      body.append(frame);
      frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch { /* cross-origin */ } });
    } else {
      body.append($(`#app-${app.id}`).content.cloneNode(true));
    }
    if (app.max && !isPhone()) el.classList.add('max');
    layer.append(el);
    wins.set(key, { el, app });

    el.addEventListener('pointerdown', () => focus(key), true);
    $('.x', el).addEventListener('click', () => close(key));
    $('.mn', el).addEventListener('click', () => { el.classList.add('minimized'); focus(topWindow()); });
    $('.mx', el).addEventListener('click', () => el.classList.toggle('max'));
    $('.win-bar', el).addEventListener('dblclick', (e) => { if (!e.target.closest('button')) el.classList.toggle('max'); });
    drag($('.win-bar', el), el, 'move');
    drag($('.win-resize', el), el, 'resize');
    focus(key);
    INIT[app.id]?.(el, key);
    return el;
  }

  /** Pointer-driven move / resize. Iframes are shielded while dragging so they do not swallow events. */
  function drag(handle, el, mode) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button') || isPhone() || el.classList.contains('max')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect(), area = layer.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      document.body.style.cursor = mode === 'move' ? 'grabbing' : 'nwse-resize';
      $$('iframe', layer).forEach((f) => { f.style.pointerEvents = 'none'; });
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (mode === 'move') {
          el.style.left = `${Math.max(-r.width + 90, Math.min(area.width - 90, r.left - area.left + dx))}px`;
          el.style.top = `${Math.max(0, Math.min(area.height - 50, r.top - area.top + dy))}px`;
        } else {
          el.style.width = `${Math.max(280, r.width + dx)}px`;
          el.style.height = `${Math.max(180, r.height + dy)}px`;
        }
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        document.body.style.cursor = '';
        $$('iframe', layer).forEach((f) => { f.style.pointerEvents = ''; });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, { once: true });
      handle.addEventListener('pointercancel', up, { once: true });
    });
  }

  // ---------------------------------------------------------------------------
  // App behaviour
  // ---------------------------------------------------------------------------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function leave() {
    if (embedded) window.parent.postMessage({ type: 'os:exit' }, '*');
    else window.location.href = '../index.html';
  }

  const INIT = {
    about(el) {
      $$('.tab', el).forEach((tab) => tab.addEventListener('click', () => {
        $$('.tab', el).forEach((t) => t.classList.toggle('active', t === tab));
        $$('.panel', el).forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
      }));
    },
    coffee(el) {
      $('[data-copy]', el).addEventListener('click', async (e) => {
        const text = e.currentTarget.dataset.copy;
        try { await navigator.clipboard.writeText(text); toast('Address copied'); }
        catch {
          const range = document.createRange();
          range.selectNodeContents($('#sol-address', el));
          const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
          toast('Select and copy the address');
        }
      });
    },
    arcade(el) {
      $$('.cab', el).forEach((b) => b.addEventListener('click', () => open(b.dataset.game, GAMES[b.dataset.game])));
    },
    notes(el) {
      const area = $('textarea', el), status = $('#notes-status', el);
      area.value = store.get('notes', 'Hi! You found the notes app.\n\nThings worth clicking around here:\n  • Projects — what I am building\n  • Arcade — Snake, Tetris, 2048, Breakout, Pinball\n  • Terminal — type "help"\n');
      let t;
      area.addEventListener('input', () => {
        status.textContent = 'Saving…';
        clearTimeout(t);
        t = setTimeout(() => { store.set('notes', area.value); status.textContent = 'Saved locally'; }, 350);
      });
    },
    settings(el) {
      const mark = () => {
        $$('[data-setting="wallpaper"] button', el).forEach((b) => b.classList.toggle('on', b.dataset.value === document.body.dataset.wallpaper));
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        $$('[data-setting="accent"] button', el).forEach((b) => b.classList.toggle('on', b.dataset.value === accent));
      };
      $$('[data-setting="wallpaper"] button', el).forEach((b) => b.addEventListener('click', () => {
        document.body.dataset.wallpaper = b.dataset.value; store.set('wallpaper', b.dataset.value); mark();
      }));
      $$('[data-setting="accent"] button', el).forEach((b) => b.addEventListener('click', () => {
        document.documentElement.style.setProperty('--accent', b.dataset.value); store.set('accent', b.dataset.value); mark();
      }));
      mark();
    },
    calc(el) {
      const screen = $('.calc-screen', el);
      let cur = '0', prev = null, op = null, fresh = true;
      const show = (v) => { screen.textContent = String(v).length > 12 ? Number(v).toPrecision(8).replace(/\.?0+($|e)/, '$1') : String(v); };
      const apply = () => {
        const a = parseFloat(prev), b = parseFloat(cur);
        const r = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : b === 0 ? NaN : a / b;
        cur = Number.isFinite(r) ? String(+r.toPrecision(12)) : 'Error';
      };
      const press = (k) => {
        if (cur === 'Error') { cur = '0'; prev = null; op = null; fresh = true; }
        if (/^[0-9]$/.test(k)) { cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
        else if (k === '.') { if (fresh) { cur = '0.'; fresh = false; } else if (!cur.includes('.')) cur += '.'; }
        else if (k === 'C') { cur = '0'; prev = null; op = null; fresh = true; }
        else if (k === '±') cur = String(-parseFloat(cur));
        else if (k === '%') cur = String(parseFloat(cur) / 100);
        else if (k === '=') { if (op && prev !== null) { apply(); prev = null; op = null; fresh = true; } }
        else { if (op && prev !== null && !fresh) apply(); prev = cur; op = k; fresh = true; }
        show(cur);
      };
      $$('.calc-keys button', el).forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
      el.addEventListener('keydown', (e) => {
        const map = { Enter: '=', Escape: 'C', x: '*', X: '*' };
        const k = map[e.key] || e.key;
        if (/^[0-9.+\-*/=%]$/.test(k) || k === 'C') { e.preventDefault(); e.stopPropagation(); press(k); }
      });
      el.tabIndex = -1;
      el.focus();
    },
    terminal(el) {
      const out = $('.term-out', el), input = $('.term-in', el), term = $('.terminal', el);
      const history = [];
      let hi = 0;
      const print = (html) => { out.insertAdjacentHTML('beforeend', `${html}\n`); term.scrollTop = term.scrollHeight; };
      const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const commands = {
        help: () => print('Commands: <span class="hi">about</span>, <span class="hi">projects</span>, <span class="hi">socials</span>, <span class="hi">open</span> &lt;app&gt;, <span class="hi">apps</span>, <span class="hi">games</span>, <span class="hi">neofetch</span>, <span class="hi">date</span>, <span class="hi">whoami</span>, <span class="hi">clear</span>, <span class="hi">exit</span>'),
        about: () => print('Kyle K. — Developer · Builder · Creator.\nCurrently focused on PepMaxx and Peak Revival-X. Masters in Data Science in progress.'),
        projects: () => print('<span class="hi">PepMaxx</span>         peptide tracking app (iOS/Android)   pepmaxx.com\n<span class="hi">Peak Revival-X</span>  TikTok Shop supplements brand\n<span class="hi">AutoFlow</span>        Chrome extension for Google Veo automation\n\nTry: open projects'),
        socials: () => { print('GitHub @ergophobian · TikTok @ergophobian · X @indefatigabile'); },
        apps: () => print(APPS.map((a) => a.id).join('  ')),
        games: () => print(Object.keys(GAMES).join('  ')),
        whoami: () => print('visitor'),
        date: () => print(new Date().toString()),
        clear: () => { out.textContent = ''; },
        exit: () => leave(),
        neofetch: () => print(`<span class="hi">  K   K </span>   kyle@meadow\n<span class="hi">  K  K  </span>   -----------\n<span class="hi">  KKK   </span>   OS: KyleOS 3.0\n<span class="hi">  K  K  </span>   Host: CRT on a desk in a meadow\n<span class="hi">  K   K </span>   Renderer: three.js r187\n             Uptime: ${Math.round(performance.now() / 1000)}s`),
        open: (arg) => {
          if (appById(arg)) { open(arg); print(`<span class="ok">opened ${esc(arg)}</span>`); }
          else if (GAMES[arg]) { open(arg, GAMES[arg]); print(`<span class="ok">launched ${esc(arg)}</span>`); }
          else print(`open: no such app "${esc(arg || '')}". Try: apps`);
        },
        sudo: () => print('Nice try.'),
      };
      print('KyleOS 3.0 — type <span class="hi">help</span> to get started.');
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); input.value = history[hi] || ''; e.preventDefault(); return; }
        if (e.key === 'ArrowDown') { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; e.preventDefault(); return; }
        if (e.key !== 'Enter') return;
        const line = input.value.trim();
        input.value = '';
        print(`<span class="cmd">kyle@meadow ~ % ${esc(line)}</span>`);
        if (!line) return;
        history.push(line); hi = history.length;
        const [cmd, ...rest] = line.split(/\s+/);
        if (commands[cmd.toLowerCase()]) commands[cmd.toLowerCase()](rest.join(' ').toLowerCase());
        else print(`command not found: ${esc(cmd)}. Type <span class="hi">help</span>.`);
      });
      term.addEventListener('click', () => { if (!String(getSelection())) input.focus(); });
      if (!isPhone()) input.focus();
    },
  };

  // ---------------------------------------------------------------------------
  // Chrome: desktop icons, dock, launcher, menu bar
  // ---------------------------------------------------------------------------
  const DESKTOP_ICONS = ['about', 'projects', 'socials', 'arcade', 'notes', 'terminal', 'coffee', 'classic'];
  $('#icons').innerHTML = DESKTOP_ICONS.map((id) => {
    const a = appById(id);
    return `<button type="button" class="d-icon" data-open="${id}">${glyph(id, a.tone)}<span>${a.label || a.title}</span></button>`;
  }).join('');
  $('#dock').innerHTML = APPS.map((a, i) => `${i === 8 ? '<span class="dock-sep"></span>' : ''}<button type="button" class="dock-btn" data-app="${a.id}" data-open="${a.id}" aria-label="${a.title}">${glyph(a.id, a.tone)}<span class="tip">${a.label || a.title}</span></button>`).join('');

  const launcher = $('#launcher'), logo = $('#menu-logo');
  launcher.innerHTML = `${APPS.map((a) => `<button type="button" role="menuitem" data-open="${a.id}">${glyph(a.id, a.tone)}${a.title}</button>`).join('')}<hr><button type="button" role="menuitem" data-leave>${glyph('game', '#e8894a').replace(ICON.game, '<path d="M10 6l-6 6 6 6M4 12h11a5 5 0 0 1 5 5v1"/>')}${embedded ? 'Back to the world' : 'Open the 3D world'}</button>`;
  function closeLauncher() { launcher.hidden = true; logo.setAttribute('aria-expanded', 'false'); }
  logo.addEventListener('click', (e) => {
    e.stopPropagation();
    launcher.hidden = !launcher.hidden;
    logo.setAttribute('aria-expanded', String(!launcher.hidden));
  });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#launcher, #menu-logo')) closeLauncher(); });
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (opener) {
      const id = opener.dataset.open;
      const w = wins.get(id);
      // Clicking a dock icon for the focused window minimises it, like a real dock.
      if (opener.classList.contains('dock-btn') && w && w.el.classList.contains('active') && !w.el.classList.contains('minimized')) {
        w.el.classList.add('minimized'); focus(topWindow());
      } else open(id);
    }
    if (e.target.closest('[data-leave]')) leave();
  });
  $('#menu-leave').addEventListener('click', leave);
  if (!embedded) $('#menu-leave span').textContent = 'Open the 3D world';

  const clock = $('#menu-clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}  ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    clock.dateTime = d.toISOString();
  };
  tick();
  setInterval(tick, 15000);

  // Esc closes the launcher, then the front window, then leaves the computer.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!launcher.hidden) { closeLauncher(); return; }
    const top = topWindow();
    if (top) close(top); else leave();
  });

  // The classic XP desktop posts 'exitDesktop' when it is shut down: just close its window.
  window.addEventListener('message', (e) => {
    if (e.data === 'exitDesktop') close('classic');
    if (e.data?.type === 'world:enter') $('#boot').classList.add('done');
  });

  // Restore settings, then boot.
  document.body.dataset.wallpaper = store.get('wallpaper', 'dusk');
  const accent = store.get('accent', '');
  if (accent) document.documentElement.style.setProperty('--accent', accent);
  setTimeout(() => {
    $('#boot').classList.add('done');
    const hash = location.hash.slice(1);
    if (appById(hash)) open(hash);
    else if (GAMES[hash]) open(hash, GAMES[hash]);
  }, embedded ? 350 : 900);

  window.KyleOS = { open, close, apps: APPS.map((a) => a.id), games: Object.keys(GAMES), windows: () => [...wins.keys()] };
})();
