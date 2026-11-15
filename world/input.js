// Keyboard, mouse-look, touch joystick and gamepad input, merged into one state object.
import { clamp } from './util.js';

export function createInput(canvas, { onInteract, onEmote, onAny }) {
  const keys = new Set();
  const state = {
    move: { x: 0, y: 0 },
    run: false,
    lookX: 0, lookY: 0,        // accumulated look deltas (radians), consumed by the camera each frame
    zoom: 0,
    touch: false,
    enabled: false,
  };

  // --- Keyboard ---------------------------------------------------------------
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  window.addEventListener('keydown', (e) => {
    if (!state.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (MOVE_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    onAny?.();
    if (e.code === 'KeyE' || e.code === 'Enter') onInteract?.();
    if (e.code === 'Space' || e.code === 'KeyQ') onEmote?.();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // --- Mouse look + wheel zoom -----------------------------------------------
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || !state.enabled) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerType === 'touch') return;
    state.lookX += (e.clientX - lastX) * 0.0052;
    state.lookY += (e.clientY - lastY) * 0.004;
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = (e) => {
    if (e.pointerType === 'touch') return;
    dragging = false;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    if (!state.enabled) return;
    e.preventDefault();
    state.zoom += clamp(e.deltaY, -120, 120) * 0.004;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Touch: left half = floating joystick, right half = look ----------------
  const stickEl = document.getElementById('joystick');
  const knobEl = stickEl?.querySelector('.knob');
  const STICK_R = 54;
  let stickId = null, stickX = 0, stickY = 0, lookId = null, lookLX = 0, lookLY = 0;
  const touchMove = { x: 0, y: 0 };
  canvas.addEventListener('touchstart', (e) => {
    if (!state.enabled) return;
    e.preventDefault();
    state.touch = true;
    onAny?.();
    for (const t of e.changedTouches) {
      if (stickId === null && t.clientX < window.innerWidth * 0.5) {
        stickId = t.identifier; stickX = t.clientX; stickY = t.clientY;
        if (stickEl) {
          stickEl.style.left = `${stickX}px`; stickEl.style.top = `${stickY}px`;
          stickEl.classList.add('active');
          knobEl.style.transform = 'translate(-50%, -50%)';
        }
      } else if (lookId === null) {
        lookId = t.identifier; lookLX = t.clientX; lookLY = t.clientY;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - stickX, dy = t.clientY - stickY;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        touchMove.x = dx / STICK_R; touchMove.y = -dy / STICK_R;
        if (knobEl) knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === lookId) {
        state.lookX += (t.clientX - lookLX) * 0.007;
        state.lookY += (t.clientY - lookLY) * 0.005;
        lookLX = t.clientX; lookLY = t.clientY;
      }
    }
  }, { passive: false });
  const touchEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null; touchMove.x = touchMove.y = 0;
        stickEl?.classList.remove('active');
      } else if (t.identifier === lookId) lookId = null;
    }
  };
  canvas.addEventListener('touchend', touchEnd);
  canvas.addEventListener('touchcancel', touchEnd);

  // --- Per-frame merge (keyboard + touch + gamepad) ------------------------------
  let padInteract = false;
  state.poll = (dt) => {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (x || y) { const m = Math.hypot(x, y); x /= m; y /= m; }
    if (touchMove.x || touchMove.y) {
      x = touchMove.x; y = touchMove.y;
      const m = Math.hypot(x, y);
      run = m > 0.86;                                   // push the stick all the way to run
      if (m > 0.02) { const s = Math.min(1, m / 0.8) / m; x *= s; y *= s; }
    }
    const pad = navigator.getGamepads?.()[0];
    if (pad && state.enabled) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const ax = dz(pad.axes[0] || 0), ay = dz(pad.axes[1] || 0);
      if (ax || ay) { x = ax; y = -ay; run = Math.hypot(ax, ay) > 0.9 || pad.buttons[10]?.pressed; }
      state.lookX += dz(pad.axes[2] || 0) * 2.2 * dt;
      state.lookY += dz(pad.axes[3] || 0) * 1.4 * dt;
      const a = !!pad.buttons[0]?.pressed;
      if (a && !padInteract) onInteract?.();
      padInteract = a;
    }
    if (!state.enabled) { x = 0; y = 0; run = false; }
    state.move.x = x; state.move.y = y; state.run = run;
  };
  return state;
}
