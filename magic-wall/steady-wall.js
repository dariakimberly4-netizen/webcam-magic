(() => {
  const wall = document.getElementById('wall');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const toast = document.getElementById('toast');
  if (!wall) return;

  let locked = false;
  let saved = null;
  let raf = null;
  let settleTimer = null;

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
      if (modeStatus) modeStatus.textContent = 'Auto projecting';
      return;
    } catch (_) {}

    // Some Android browsers block delayed autoplay with sound. Keep the
    // experience one-tap by falling back to muted playback automatically.
    try {
      video.muted = true;
      await video.play();
      if (modeStatus) modeStatus.textContent = 'Auto projecting';
      say('Video started automatically. Your browser muted it for autoplay.');
    } catch (_) {
      if (modeStatus) modeStatus.textContent = 'Video ready';
    }
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
    say('Video fixed on the wall and playing automatically.');
  }

  function unlockSteady() {
    locked = false;
    saved = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // Choosing a video starts playback immediately, then auto-placement freezes
  // the wall after it settles. No separate Play or Set Wall tap is required.
  window.addEventListener('magicwall:content-ready', (event) => {
    if (!event.detail || event.detail.type !== 'video') return;
    unlockSteady();
    autoPlayVideo();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(lockSteady, 3400);
  });

  const reanchor = document.getElementById('anchorWallBtn');
  if (reanchor) {
    reanchor.addEventListener('click', () => {
      unlockSteady();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(lockSteady, 3400);
    });
  }

  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-move],[data-scale],#centerBtn');
    if (!button) return;
    if (!locked) return;
    unlockSteady();
    setTimeout(lockSteady, 120);
  }, true);
})();
