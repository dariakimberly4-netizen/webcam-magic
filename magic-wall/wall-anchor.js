(() => {
  const wall = document.getElementById('wall');
  const camera = document.getElementById('camera');
  const status = document.getElementById('cameraStatus');
  const modeStatus = document.getElementById('modeStatus');
  const button = document.getElementById('anchorWallBtn');
  const startBtn = document.getElementById('startBtn');
  const toast = document.getElementById('toast');
  if (!wall || !button) return;

  let xrSession = null;
  let hitSource = null;
  let localSpace = null;
  let anchorPoint = null;
  let anchorBaseWidth = 0;
  let anchorBaseDistance = 1;
  let stableVerticalFrames = 0;
  let fallbackActive = false;
  let fallbackOrigin = null;
  let lastOrientation = null;
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
    say.t = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function matVec(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
      m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
    ];
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
  }

  function normalYFromQuaternion(q) {
    const x = q.x, z = q.z;
    return 1 - 2 * (x * x + z * z);
  }

  function projectAnchor(view) {
    if (!anchorPoint) return;
    const viewMatrix = view.transform.inverse.matrix;
    const projection = view.projectionMatrix;
    const viewP = matVec(viewMatrix, [anchorPoint.x, anchorPoint.y, anchorPoint.z, 1]);
    const clip = matVec(projection, viewP);
    if (!clip[3] || clip[3] <= 0) return;
    const ndcX = clip[0] / clip[3];
    const ndcY = clip[1] / clip[3];
    const x = (ndcX * 0.5 + 0.5) * window.innerWidth;
    const y = (1 - (ndcY * 0.5 + 0.5)) * window.innerHeight;
    const currentDistance = distance(view.transform.position, anchorPoint);
    const scale = Math.max(0.45, Math.min(2.3, anchorBaseDistance / currentDistance));
    const width = Math.max(180, Math.min(window.innerWidth * 0.96, anchorBaseWidth * scale));
    wall.style.left = x + 'px';
    wall.style.top = y + 'px';
    wall.style.width = width + 'px';
    wall.style.height = (width * 0.56) + 'px';
    wall.style.transform = 'translate(-50%,-50%)';
  }

  async function startXR() {
    if (!navigator.xr) return false;
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
      if (!supported) return false;
      xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local-floor'],
        domOverlay: { root: document.body }
      });
      if (!xrSession.domOverlayState) {
        await xrSession.end();
        xrSession = null;
        return false;
      }
      localSpace = await xrSession.requestReferenceSpace('local');
      const viewerSpace = await xrSession.requestReferenceSpace('viewer');
      hitSource = await xrSession.requestHitTestSource({
        space: viewerSpace,
        offsetRay: new XRRay({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 })
      });
      if (camera) camera.style.visibility = 'hidden';
      reticle.style.display = 'block';
      button.textContent = '✕ STOP WALL ANCHOR';
      status.textContent = 'AR scanning';
      modeStatus.textContent = 'Just aim at wall';
      stableVerticalFrames = 0;
      anchorPoint = null;
      anchorBaseWidth = Math.max(220, wall.getBoundingClientRect().width || window.innerWidth * 0.75);
      xrSession.addEventListener('end', cleanupXR, { once: true });
      xrSession.requestAnimationFrame(onXRFrame);
      say('Just point at the wall. Magic Wall will anchor automatically.');
      return true;
    } catch (_) {
      xrSession = null;
      return false;
    }
  }

  function onXRFrame(time, frame) {
    if (!xrSession) return;
    xrSession.requestAnimationFrame(onXRFrame);
    const pose = frame.getViewerPose(localSpace);
    if (!pose || !pose.views.length) return;
    const view = pose.views[0];
    if (anchorPoint) {
      projectAnchor(view);
      return;
    }
    const results = hitSource ? frame.getHitTestResults(hitSource) : [];
    if (!results.length) {
      stableVerticalFrames = 0;
      modeStatus.textContent = 'Aim at wall';
      return;
    }
    const hitPose = results[0].getPose(localSpace);
    if (!hitPose) return;
    const isVertical = Math.abs(normalYFromQuaternion(hitPose.transform.orientation)) < 0.5;
    if (isVertical) {
      stableVerticalFrames++;
      reticle.style.borderColor = '#86efac';
      modeStatus.textContent = 'Wall found';
      if (stableVerticalFrames >= 8) {
        const p = hitPose.transform.position;
        anchorPoint = { x: p.x, y: p.y, z: p.z };
        anchorBaseDistance = distance(view.transform.position, anchorPoint);
        reticle.style.display = 'none';
        status.textContent = 'Wall anchored';
        modeStatus.textContent = 'Automatic';
        say('Done. The picture is anchored to the wall.');
      }
    } else {
      stableVerticalFrames = 0;
      reticle.style.borderColor = 'rgba(244,213,141,.98)';
      modeStatus.textContent = 'Aim at wall';
    }
  }

  function cleanupXR() {
    if (hitSource) { try { hitSource.cancel(); } catch (_) {} }
    hitSource = null;
    localSpace = null;
    anchorPoint = null;
    stableVerticalFrames = 0;
    reticle.style.display = 'none';
    if (camera) camera.style.visibility = 'visible';
    button.textContent = '🧱 RE-ANCHOR WALL';
    status.textContent = 'Rear camera';
    modeStatus.textContent = 'Ready';
    xrSession = null;
  }

  function normalizeDelta(a, b) {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  function onOrientation(e) {
    if (typeof e.alpha !== 'number') return;
    lastOrientation = { alpha: e.alpha, beta: e.beta || 0, gamma: e.gamma || 0 };
    if (!fallbackActive || !fallbackOrigin) return;
    const yaw = normalizeDelta(lastOrientation.alpha, fallbackOrigin.alpha);
    const pitch = lastOrientation.beta - fallbackOrigin.beta;
    const sensitivityX = Math.min(8, window.innerWidth / 50);
    const sensitivityY = Math.min(7, window.innerHeight / 80);
    wall.style.left = (window.innerWidth / 2 - yaw * sensitivityX) + 'px';
    wall.style.top = (window.innerHeight * 0.45 + pitch * sensitivityY) + 'px';
    wall.style.transform = 'translate(-50%,-50%)';
  }

  function clearAutoTimers() {
    if (autoTimer) clearTimeout(autoTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    autoTimer = null;
    countdownTimer = null;
  }

  async function startFallback(auto = true) {
    if (fallbackActive) return;
    fallbackActive = true;
    fallbackOrigin = null;
    reticle.style.display = 'block';
    button.textContent = '✕ STOP AUTO ANCHOR';
    status.textContent = 'Auto wall';
    modeStatus.textContent = 'Aim at wall';

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch (_) {}
    }
    window.addEventListener('deviceorientation', onOrientation, true);

    if (!auto) {
      say('Aim at the wall. Magic Wall will anchor automatically.');
      return;
    }

    let seconds = 3;
    modeStatus.textContent = 'Aim at wall · 3';
    say('Just aim at the wall. No tapping needed.');
    countdownTimer = setInterval(() => {
      seconds -= 1;
      if (seconds > 0) modeStatus.textContent = 'Aim at wall · ' + seconds;
    }, 1000);
    autoTimer = setTimeout(() => {
      setFallbackAnchor();
    }, 3000);
  }

  function setFallbackAnchor() {
    if (!fallbackActive || fallbackOrigin) return;
    clearAutoTimers();
    fallbackOrigin = lastOrientation || { alpha: 0, beta: 0, gamma: 0 };
    reticle.style.display = 'none';
    button.textContent = '🧱 RE-ANCHOR WALL';
    status.textContent = 'Wall anchored';
    modeStatus.textContent = 'Automatic';
    say('Done. Magic Wall anchored itself.');
  }

  function stopFallback() {
    clearAutoTimers();
    fallbackActive = false;
    fallbackOrigin = null;
    lastOrientation = null;
    window.removeEventListener('deviceorientation', onOrientation, true);
    reticle.style.display = 'none';
    button.textContent = '🧱 RE-ANCHOR WALL';
    status.textContent = 'Rear camera';
    modeStatus.textContent = 'Ready';
  }

  function waitForCameraThenAutoAnchor() {
    let tries = 0;
    const watcher = setInterval(() => {
      tries++;
      const text = (status.textContent || '').toLowerCase();
      if (text.includes('rear camera') || text.includes('camera on')) {
        clearInterval(watcher);
        if (!xrSession && !fallbackActive) startFallback(true);
      } else if (tries > 50) {
        clearInterval(watcher);
      }
    }, 300);
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      waitForCameraThenAutoAnchor();
    });
  }

  button.addEventListener('click', async () => {
    if (xrSession) {
      await xrSession.end();
      return;
    }
    if (fallbackActive) {
      stopFallback();
      setTimeout(() => startFallback(true), 150);
      return;
    }
    button.disabled = true;
    button.textContent = 'CHECKING AR…';
    const started = await startXR();
    button.disabled = false;
    if (!started) await startFallback(true);
  });
})();