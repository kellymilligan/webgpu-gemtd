import { h, render } from 'preact';
import { Controller } from './app/controller';
import { webgpuUsable } from './render/capabilities';
import { SceneView } from './render/scene';
import { App } from './ui/App';

async function boot() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui')!;
  const params = new URLSearchParams(location.search);
  const pref = params.get('renderer');
  const forceWebGL = pref === 'webgl' || (pref !== 'webgpu' && !(await webgpuUsable()));
  const view = new SceneView(canvas, forceWebGL);
  try {
    await view.init();
  } catch (err) {
    console.error(err);
    uiRoot.innerHTML = `<div class="fatal">This browser couldn't start the renderer (WebGPU or WebGL 2 is required).</div>`;
    return;
  }

  const seed = params.get('seed');
  let ctl: Controller;
  if (seed) {
    ctl = new Controller();
    ctl.newGame(seed);
  } else ctl = Controller.fromSave() ?? new Controller();
  (window as unknown as { facet: unknown }).facet = { ctl, view };

  render(h(App, { ctl, backend: view.backend }), uiRoot);
  bindInput(canvas, view, ctl);

  window.addEventListener('resize', () => view.resize());
  let last = performance.now();
  view.renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const alpha = ctl.tick(dt);
    view.frame(ctl, alpha, dt);
  });
}

function bindInput(canvas: HTMLCanvasElement, view: SceneView, ctl: Controller) {
  let drag: { x: number; y: number; moved: boolean; button: number } | null = null;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: false, button: e.button };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved) {
        view.rig.panPixels(dx, dy, canvas.clientHeight);
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
      return;
    }
    ctl.setHover(view.pick(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved) return;
    const tile = view.pick(e.clientX, e.clientY);
    if (!tile) return;
    if (d.button === 0) ctl.clickTile(tile.x, tile.y);
    else if (d.button === 2) {
      ctl.selection = null;
      ctl.notify(true);
    }
  });
  canvas.addEventListener('pointerleave', () => ctl.setHover(null));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.rig.zoom(e.deltaY);
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    view.rig.setKey(e.code, true);
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        ctl.togglePause();
        break;
      case 'Digit1':
        ctl.setSpeed(1);
        break;
      case 'Digit2':
        ctl.setSpeed(2);
        break;
      case 'Digit3':
        ctl.setSpeed(4);
        break;
      case 'KeyC':
        ctl.toggleCodex();
        break;
      case 'KeyU':
        ctl.dispatch({ type: 'upgradeOdds' });
        break;
      case 'KeyQ':
        view.rig.rotate(-1);
        break;
      case 'KeyE':
        view.rig.rotate(1);
        break;
      case 'Escape':
        if (ctl.codexOpen) ctl.toggleCodex(false);
        else {
          ctl.selection = null;
          ctl.notify(true);
        }
        break;
    }
  });
  window.addEventListener('keyup', (e) => view.rig.setKey(e.code, false));
  window.addEventListener('blur', () => {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) view.rig.setKey(k, false);
  });
}

boot();
