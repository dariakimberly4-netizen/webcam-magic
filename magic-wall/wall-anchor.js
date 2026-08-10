(() => {
  const wall = document.getElementById('wall');
  const camera = document.getElementById('camera');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const button = document.getElementById('anchorWallBtn');
  const toast = document.getElementById('toast');
  if (!wall || !button) return;

  let autoTimer = null;
  let countdownTimer = null;

  const reticle = document.createElement('div');
  reticle.id = 'wallReticle';
  reticle.innerHTML = '<span></span>';
  reticle.style.cssText = 'position:fixed;left:50%;top:42%;width:86px;height:86px;transform:translate(-50%,-50%);border:4px solid rgba(244,213,141,.98);border-radius:50%;z-index:28;pointer-events:none;display:none;box-shadow:0 0 24px rgba(244,213,141,.65)';
  reticle.firstElementChild.style.cssText = 'position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);background:#f4d58d;border-radius:50%;box-shadow:0 0 16px #f4d58d';
  document.body.appendChild(reticle);

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function keepCameraVisible() {
    if (!camera) return;
    camera.style.visibility = 'visible';
    camera.style.opacity = '1';
    camera.style.display = 'block';
  }

  function centerProjection() {
    const width = Math.min(window.innerWidth * 0.78, 560);
    wall.style.left = '50%';
    wall.style.top = '42%';
    wall.style.width = width + 'px';
    wall.style.height = (width * 0.5625) + 'px';
    wall.style.transform = 'translate(-50%,-50%)';
  }

  function clearTimers() {
    if (autoTimer) clearTimeout(autoTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    autoTimer = null;
    countdownTimer = null;
  }

  function finishAutoPlacement() {
    clearTimers();
    keepCameraVisible();
    centerProjection();
    reticle.style.display = 'none';
    button.textContent = '🧱 RE-ANCHOR WALL';
    if (status) status.textContent = 'Steady wall';
    if (modeStatus) modeStatus.textContent = 'Video set';
    window.dispatchEvent(new CustomEvent('magicwall:wall-anchored'));
    say('Done. The video is centered and fixed on the wall view.');
  }

  function startAutoPlacement() {
    clearTimers();
    keepCameraVisible();
    centerProjection();
    reticle.style.display = 'block';
    button.textContent = '✕ CANCEL AUTO SET';
    if (status) status.textContent = 'Rear camera';

    let seconds = 3;
    if (modeStatus) modeStatus.textContent = 'Aim at wall · 3';
    say('Point the rear camera at the wall. I will set the video automatically.');

    countdownTimer = setInterval(() => {
      seconds -= 1;
      if (seconds > 0 && modeStatus) modeStatus.textContent = 'Aim at wall · ' + seconds;
    }, 1000);

    autoTimer = setTimeout(finishAutoPlacement, 3000);
  }

  window.addEventListener('magicwall:content-ready', (event) => {
    if (event.detail && event.detail.type === 'video') startAutoPlacement();
  });

  button.addEventListener('click', () => {
    if (autoTimer || countdownTimer) {
      clearTimers();
      reticle.style.display = 'none';
      button.textContent = '🧱 RE-ANCHOR WALL';
      if (modeStatus) modeStatus.textContent = 'Ready';
      return;
    }
    startAutoPlacement();
  });

  window.addEventListener('resize', () => {
    if (status && status.textContent === 'Steady wall') centerProjection();
  });

  keepCameraVisible();
})();
