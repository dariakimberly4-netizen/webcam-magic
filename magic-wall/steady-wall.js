(() => {
  const wall = document.getElementById('wall');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const toast = document.getElementById('toast');
  if (!wall) return;

  let locked = false;
  let saved = null;
  let raf = null;

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  async function autoPlayVideo() {
    const video = document.querySelector('#content video');
    if (!video) return;
    video.autoplay = true;
    video.playsInline = true;
    video.loop = true;

    try {
      await video.play();
      return;
    } catch (_) {}

    try {
      video.muted = true;
      await video.play();
      say('Video started automatically. Your browser muted it for autoplay.');
    } catch (_) {}
  }

  function capturePosition() {
    const r = wall.getBoundingClientRect();
    saved = {
      left: r.left + r.width / 2,
      top: r.top + r.height / 2,
      width: r.width,
      height: r.height
    };
  }

  function applySaved() {
    if (!locked || !saved) return;
    wall.style.left = saved.left + 'px';
    wall.style.top = saved.top + 'px';
    wall.style.width = saved.width + 'px';
    wall.style.height = saved.height + 'px';
    wall.style.transform = 'translate(-50%,-50%)';
    raf = requestAnimationFrame(applySaved);
  }

  function lockSteady() {
    capturePosition();
    locked = true;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(applySaved);
    if (status) status.textContent = 'Steady wall';
    if (modeStatus) modeStatus.textContent = 'Auto projecting';
    autoPlayVideo();
    say('Wall found. Video placed, fixed, and playing automatically.');
  }

  function unlockSteady() {
    locked = false;
    saved = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // Video selection starts playback while Auto Wall Finder decides where to put it.
  window.addEventListener('magicwall:content-ready', event => {
    if (!event.detail || event.detail.type !== 'video') return;
    unlockSteady();
    autoPlayVideo();
    if (status) status.textContent = 'Finding wall';
    if (modeStatus) modeStatus.textContent = 'Aim at wall';
  });

  // Freeze only after the camera-based wall finder has chosen the wall area.
  window.addEventListener('magicwall:wall-found', () => {
    unlockSteady();
    setTimeout(lockSteady, 120);
  });

  const reanchor = document.getElementById('anchorWallBtn');
  if (reanchor) {
    reanchor.addEventListener('click', () => {
      unlockSteady();
      if (status) status.textContent = 'Finding wall';
      if (modeStatus) modeStatus.textContent = 'Aim at wall';
    }, true);
  }

  // Manual controls remain optional. If used, lock again after the single tap.
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-move],[data-scale],#centerBtn');
    if (!button || !locked) return;
    unlockSteady();
    setTimeout(lockSteady, 120);
  }, true);
})();
