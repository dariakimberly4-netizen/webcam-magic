(() => {
  const camera = document.getElementById('camera');
  const wall = document.getElementById('wall');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const toast = document.getElementById('toast');
  const reanchor = document.getElementById('anchorWallBtn');
  if (!camera || !wall) return;

  let scanToken = 0;
  let scanning = false;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForCamera(timeout = 5000) {
    return new Promise(resolve => {
      const started = performance.now();
      const check = () => {
        if (camera.readyState >= 2 && camera.videoWidth > 0 && camera.videoHeight > 0) return resolve(true);
        if (performance.now() - started > timeout) return resolve(false);
        setTimeout(check, 120);
      };
      check();
    });
  }

  function drawDisplayedCamera() {
    const sw = 120;
    const sh = Math.max(180, Math.round(sw * window.innerHeight / window.innerWidth));
    canvas.width = sw;
    canvas.height = sh;

    const vw = camera.videoWidth;
    const vh = camera.videoHeight;
    if (!vw || !vh) return false;

    // Match CSS object-fit: cover so detection maps to what the user sees.
    const scale = Math.max(sw / vw, sh / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (sw - dw) / 2;
    const dy = (sh - dh) / 2;
    ctx.drawImage(camera, dx, dy, dw, dh);
    return true;
  }

  function rectScore(gray, w, h, r) {
    let sum = 0;
    let sumSq = 0;
    let edge = 0;
    let n = 0;
    const step = 2;

    for (let y = r.y; y < r.y + r.h - step; y += step) {
      for (let x = r.x; x < r.x + r.w - step; x += step) {
        const i = y * w + x;
        const g = gray[i];
        const gr = gray[i + step];
        const gd = gray[(y + step) * w + x];
        sum += g;
        sumSq += g * g;
        edge += Math.abs(g - gr) + Math.abs(g - gd);
        n++;
      }
    }

    if (!n) return Number.POSITIVE_INFINITY;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const edgeMean = edge / n;

    // Walls tend to be broad, relatively smooth regions. Slightly prefer
    // normally lit regions and areas near the visual center.
    const darkPenalty = mean < 42 ? (42 - mean) * 2.2 : 0;
    const blownPenalty = mean > 242 ? (mean - 242) * 1.4 : 0;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const centerPenalty = Math.abs(cx - w * 0.5) * 0.10 + Math.abs(cy - h * 0.40) * 0.05;
    return variance * 0.48 + edgeMean * 2.8 + darkPenalty + blownPenalty + centerPenalty;
  }

  function findBestWallRect() {
    if (!drawDisplayedCamera()) return null;
    const w = canvas.width;
    const h = canvas.height;
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114) | 0;
    }

    const topSafe = Math.round(h * 0.17);
    const bottomSafe = Math.round(h * 0.68);
    const widths = [0.48, 0.58, 0.68, 0.78].map(v => Math.round(w * v));
    let best = null;

    for (const rw of widths) {
      const rh = Math.round(rw * 9 / 16);
      if (rh > bottomSafe - topSafe) continue;
      const xStep = Math.max(4, Math.round((w - rw) / 6));
      const yStep = Math.max(4, Math.round((bottomSafe - topSafe - rh) / 6));
      for (let y = topSafe; y <= bottomSafe - rh; y += yStep) {
        for (let x = 0; x <= w - rw; x += xStep) {
          const r = { x, y, w: rw, h: rh };
          const score = rectScore(gray, w, h, r);
          // Small reward for a larger usable wall area.
          const adjusted = score - rw * 0.08;
          if (!best || adjusted < best.score) best = { ...r, score: adjusted };
        }
      }
    }
    return best;
  }

  function median(values) {
    const a = [...values].sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  }

  function applyRect(r) {
    const w = canvas.width;
    const h = canvas.height;
    const left = ((r.x + r.w / 2) / w) * window.innerWidth;
    const top = ((r.y + r.h / 2) / h) * window.innerHeight;
    let width = (r.w / w) * window.innerWidth;

    // Keep projection comfortably above the control dock.
    width = Math.max(window.innerWidth * 0.46, Math.min(window.innerWidth * 0.82, width));
    const height = width * 9 / 16;
    const maxTop = window.innerHeight * 0.64 - height / 2;

    wall.style.left = left + 'px';
    wall.style.top = Math.min(top, maxTop) + 'px';
    wall.style.width = width + 'px';
    wall.style.height = height + 'px';
    wall.style.transform = 'translate(-50%,-50%)';

    window.dispatchEvent(new CustomEvent('magicwall:wall-found', {
      detail: { left, top: Math.min(top, maxTop), width, height }
    }));
  }

  function fallbackPlacement() {
    const width = Math.min(window.innerWidth * 0.74, 560);
    const height = width * 9 / 16;
    const left = window.innerWidth * 0.5;
    const top = Math.min(window.innerHeight * 0.40, window.innerHeight * 0.64 - height / 2);
    wall.style.left = left + 'px';
    wall.style.top = top + 'px';
    wall.style.width = width + 'px';
    wall.style.height = height + 'px';
    wall.style.transform = 'translate(-50%,-50%)';
    window.dispatchEvent(new CustomEvent('magicwall:wall-found', {
      detail: { left, top, width, height, fallback: true }
    }));
  }

  async function scanAndPlace() {
    const myToken = ++scanToken;
    if (scanning) await sleep(100);
    scanning = true;
    if (status) status.textContent = 'Finding wall';
    if (modeStatus) modeStatus.textContent = 'Hold toward wall';
    say('Just point at the wall. I am finding the best spot automatically.');

    const ready = await waitForCamera();
    if (!ready || myToken !== scanToken) {
      scanning = false;
      fallbackPlacement();
      return;
    }

    const results = [];
    for (let i = 0; i < 4; i++) {
      if (myToken !== scanToken) return;
      if (modeStatus) modeStatus.textContent = 'Finding wall ' + (i + 1) + '/4';
      const r = findBestWallRect();
      if (r) results.push(r);
      await sleep(320);
    }

    if (myToken !== scanToken) return;
    scanning = false;

    if (!results.length) {
      fallbackPlacement();
      return;
    }

    const chosen = {
      x: median(results.map(r => r.x)),
      y: median(results.map(r => r.y)),
      w: median(results.map(r => r.w)),
      h: median(results.map(r => r.h))
    };
    applyRect(chosen);
    if (status) status.textContent = 'Wall found';
    if (modeStatus) modeStatus.textContent = 'Auto placed';
  }

  window.addEventListener('magicwall:content-ready', event => {
    if (event.detail && event.detail.type === 'video') scanAndPlace();
  });

  if (reanchor) {
    reanchor.addEventListener('click', () => {
      scanAndPlace();
    });
  }
})();
