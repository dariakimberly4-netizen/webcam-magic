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
    if (modeStatus) modeStatus.textContent = 'Video fixed';
    say('Steady Wall is on. Small hand movements will not move the video.');
  }

  function unlockSteady() {
    locked = false;
    saved = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // When a video is selected, wait for auto-placement to finish, then freeze it.
  window.addEventListener('magicwall:content-ready', (event) => {
    if (!event.detail || event.detail.type !== 'video') return;
    unlockSteady();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(lockSteady, 3400);
  });

  // Re-anchoring intentionally unlocks the wall, then re-locks after the new position settles.
  const reanchor = document.getElementById('anchorWallBtn');
  if (reanchor) {
    reanchor.addEventListener('click', () => {
      unlockSteady();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(lockSteady, 3400);
    });
  }

  // Manual position controls should still work. Re-freeze after the tap.
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-move],[data-scale],#centerBtn');
    if (!button) return;
    if (!locked) return;
    unlockSteady();
    setTimeout(lockSteady, 120);
  }, true);
})();
