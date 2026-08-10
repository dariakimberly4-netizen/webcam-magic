(() => {
  const camera = document.getElementById('camera');
  const wall = document.getElementById('wall');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const toast = document.getElementById('toast');
  const reanchor = document.getElementById('anchorWallBtn');
  if (!camera || !wall) return;

  let scanToken = 0;

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function drawCover(ctx, video, w, h) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;
    const scale = Math.max(w / vw, h / vh);
    const sw = w / scale, sh = h / scale;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
    return true;
  }

  function integral(values, w, h) {
    const stride = w + 1;
    const out = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) {
        row += values[(y - 1) * w + x - 1];
        out[y * stride + x] = out[(y - 1) * stride + x] + row;
      }
    }
    return out;
  }

  function sumRect(ii, w, x, y, rw, rh) {
    const s = w + 1, x2 = x + rw, y2 = y + rh;
    return ii[y2 * s + x2] - ii[y * s + x2] - ii[y2 * s + x] + ii[y * s + x];
  }

  function analyzeFrame() {
    const screenW = Math.max(1, innerWidth), screenH = Math.max(1, innerHeight);
    const w = 64, h = Math.max(84, Math.min(128, Math.round(w * screenH / screenW)));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !drawCover(ctx, camera, w, h)) return null;

    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float64Array(w * h), grad = new Float64Array(w * h), sq = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const p = i * 4;
      gray[i] = .299 * rgba[p] + .587 * rgba[p + 1] + .114 * rgba[p + 2];
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = gray[i];
      const dx = x + 1 < w ? Math.abs(v - gray[i + 1]) : 0;
      const dy = y + 1 < h ? Math.abs(v - gray[i + w]) : 0;
      grad[i] = dx + dy; sq[i] = v * v;
    }

    const ig = integral(gray, w, h), isq = integral(sq, w, h), ie = integral(grad, w, h);
    const selected = document.querySelector('#content video');
    let aspect = selected && selected.videoWidth && selected.videoHeight ? selected.videoWidth / selected.videoHeight : 16 / 9;
    aspect = Math.max(1.15, Math.min(2.2, aspect));
    const yMin = Math.round(h * .16), yMax = Math.round(h * .69);
    const widths = [.82,.72,.62,.52,.44].map(v => Math.round(w * v));
    let best = null;

    for (const rw of widths) {
      const rh = Math.max(14, Math.round(rw / aspect));
      if (rh > yMax - yMin) continue;
      for (let y = yMin; y + rh <= yMax; y += 2) for (let x = 2; x + rw <= w - 2; x += 2) {
        const area = rw * rh;
        const gs = sumRect(ig, w, x, y, rw, rh), ss = sumRect(isq, w, x, y, rw, rh), es = sumRect(ie, w, x, y, rw, rh);
        const mean = gs / area, variance = Math.max(0, ss / area - mean * mean), std = Math.sqrt(variance), edge = es / area;
        const cx = x + rw / 2, cy = y + rh / 2;
        const centerPenalty = Math.hypot((cx - w * .5) / w, (cy - h * .40) / h) * 22;
        const darkPenalty = mean < 42 ? (42 - mean) * 1.7 : 0;
        const score = edge * 1.35 + std * .42 + centerPenalty + darkPenalty - (rw * rh) / (w * h) * 16;
        if (!best || score < best.score) best = { x, y, w: rw, h: rh, score, gridW: w, gridH: h };
      }
    }
    return best;
  }

  function fit(best) {
    const sw = innerWidth, sh = innerHeight;
    if (!best) {
      const width = Math.min(sw * .78, 560);
      wall.style.left = sw * .5 + 'px'; wall.style.top = sh * .43 + 'px';
      wall.style.width = width + 'px'; wall.style.height = width * .5625 + 'px';
      wall.style.transform = 'translate(-50%,-50%)';
      return;
    }
    const px = best.w * .06, py = best.h * .06;
    const x = (best.x + px) / best.gridW * sw, y = (best.y + py) / best.gridH * sh;
    const rw = (best.w - px * 2) / best.gridW * sw, rh = (best.h - py * 2) / best.gridH * sh;
    wall.style.left = x + rw / 2 + 'px'; wall.style.top = y + rh / 2 + 'px';
    wall.style.width = rw + 'px'; wall.style.height = rh + 'px'; wall.style.transform = 'translate(-50%,-50%)';
  }

  async function autoFindWall() {
    const token = ++scanToken;
    camera.style.visibility = 'visible'; camera.style.opacity = '1';
    if (status) status.textContent = 'Finding wall';
    if (modeStatus) modeStatus.textContent = 'Hold toward wall';
    say('Just point at the wall. I am finding the flat area automatically.');

    let tries = 0;
    while ((!camera.videoWidth || camera.readyState < 2) && tries++ < 20) {
      await wait(150); if (token !== scanToken) return;
    }
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const r = analyzeFrame(); if (r) samples.push(r);
      await wait(220); if (token !== scanToken) return;
    }
    samples.sort((a,b) => a.score - b.score);
    fit(samples[0] || null);
    if (status) status.textContent = 'Wall found';
    if (modeStatus) modeStatus.textContent = 'Auto fitted';
    window.dispatchEvent(new CustomEvent('magicwall:auto-fit-done', { detail: { type: 'video' } }));
  }

  window.addEventListener('magicwall:content-ready', e => {
    if (e.detail && e.detail.type === 'video') setTimeout(autoFindWall, 120);
  });
  if (reanchor) reanchor.addEventListener('click', () => setTimeout(autoFindWall, 80));
})();
