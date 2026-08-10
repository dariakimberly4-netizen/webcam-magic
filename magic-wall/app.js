(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const welcome = $('#welcome');
  const app = $('#app');
  const camera = $('#camera');
  const wall = $('#wall');
  const content = $('#content');
  const status = $('#cameraStatus');
  const modeStatus = $('#modeStatus');
  const panel = $('#panel');
  const toast = $('#toast');

  let stream = null;
  let locked = false;
  let cover = false;
  let currentVideo = null;
  let slides = [];
  let slideIndex = 0;
  const urls = [];
  const state = { x: 50, y: 45, w: 78 };

  function say(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(say.timer);
    say.timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function showApp() {
    welcome.style.display = 'none';
    app.style.display = 'block';
  }

  async function startCamera() {
    showApp();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status.textContent = 'Preview mode';
      say('Camera is unavailable here. Preview mode is active.');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      camera.srcObject = stream;
      status.textContent = 'Camera on';
      say('Camera ready. Point your phone at a wall.');
    } catch (e) {
      status.textContent = 'Camera blocked';
      say('Allow camera permission, or use Preview mode.');
    }
  }

  function preview() {
    showApp();
    status.textContent = 'Preview mode';
    galaxy();
  }

  function updateWall() {
    wall.style.left = state.x + '%';
    wall.style.top = state.y + '%';
    wall.style.width = state.w + 'vw';
    wall.style.height = Math.max(28, state.w * 0.56) + 'vw';
  }

  function clearWall() {
    content.innerHTML = '';
    currentVideo = null;
  }

  function fileUrl(file) {
    const url = URL.createObjectURL(file);
    urls.push(url);
    return url;
  }

  function pick(accept, multiple, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => input.files.length && callback([...input.files]);
    input.click();
  }

  function showPhoto(file) {
    clearWall();
    const img = new Image();
    img.src = fileUrl(file);
    img.alt = 'Selected wall image';
    content.appendChild(img);
  }

  function showVideo(file) {
    clearWall();
    const video = document.createElement('video');
    video.src = fileUrl(file);
    video.playsInline = true;
    video.loop = true;
    content.appendChild(video);
    currentVideo = video;
    video.play().catch(() => {});
  }

  function galaxy() {
    clearWall();
    modeStatus.textContent = 'Galaxy';
    const g = document.createElement('div');
    g.className = 'galaxy';
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('i');
      s.className = 'star';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = -Math.random() * 2 + 's';
      g.appendChild(s);
    }
    content.appendChild(g);
  }

  function particles(emoji, label) {
    clearWall();
    modeStatus.textContent = label;
    const g = document.createElement('div');
    g.className = 'galaxy';
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = emoji;
      p.style.left = (-20 + Math.random() * 70) + '%';
      p.style.top = (30 + Math.random() * 75) + '%';
      p.style.animationDelay = (-Math.random() * 7) + 's';
      g.appendChild(p);
    }
    content.appendChild(g);
  }

  function affirmation() {
    clearWall();
    modeStatus.textContent = 'Affirmation';
    const g = document.createElement('div');
    g.className = 'galaxy';
    const text = document.createElement('div');
    text.className = 'affirmation';
    text.textContent = 'Even trembling hands can still hold purpose.';
    g.appendChild(text);
    content.appendChild(g);
  }

  function memories(files) {
    clearWall();
    modeStatus.textContent = 'Memories';
    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    files.slice(0, 4).forEach((file) => {
      const img = new Image();
      img.src = fileUrl(file);
      grid.appendChild(img);
    });
    content.appendChild(grid);
  }

  function renderSlide() {
    clearWall();
    if (!slides.length) return;
    const img = new Image();
    img.src = fileUrl(slides[slideIndex]);
    content.appendChild(img);
    modeStatus.textContent = `Slide ${slideIndex + 1}/${slides.length}`;
  }

  function portal() {
    clearWall();
    modeStatus.textContent = 'Portal';
    const p = document.createElement('div');
    p.className = 'portal';
    content.appendChild(p);
  }

  function mode(name) {
    $$('.mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === name));
    if (name === 'photo') pick('image/*', false, (f) => showPhoto(f[0]));
    if (name === 'video') pick('video/*', false, (f) => showVideo(f[0]));
    if (name === 'butterflies') particles('🦋', 'Butterflies');
    if (name === 'galaxy') galaxy();
    if (name === 'flowers') particles('🌸', 'Flowers');
    if (name === 'affirmation') affirmation();
    if (name === 'memories') pick('image/*', true, memories);
    if (name === 'presentation') pick('image/*', true, (f) => { slides = f; slideIndex = 0; renderSlide(); });
    if (name === 'portal') portal();
  }

  $('#startBtn').onclick = startCamera;
  $('#demoBtn').onclick = preview;
  $$('.mode').forEach((b) => b.onclick = () => mode(b.dataset.mode));

  $$('[data-move]').forEach((b) => b.onclick = () => {
    if (locked) return say('Unlock the wall first.');
    const d = b.dataset.move;
    if (d === 'up') state.y -= 3;
    if (d === 'down') state.y += 3;
    if (d === 'left') state.x -= 3;
    if (d === 'right') state.x += 3;
    state.x = Math.max(10, Math.min(90, state.x));
    state.y = Math.max(15, Math.min(85, state.y));
    updateWall();
  });

  $$('[data-scale]').forEach((b) => b.onclick = () => {
    if (locked) return say('Unlock the wall first.');
    state.w += b.dataset.scale === 'up' ? 5 : -5;
    state.w = Math.max(35, Math.min(96, state.w));
    updateWall();
  });

  $('#centerBtn').onclick = () => {
    if (locked) return say('Unlock the wall first.');
    state.x = 50; state.y = 45; state.w = 78;
    updateWall();
    say('Wall centered');
  };

  $('#playBtn').onclick = () => {
    if (currentVideo) {
      if (currentVideo.paused) currentVideo.play();
      else currentVideo.pause();
      return;
    }
    if (slides.length) {
      slideIndex = (slideIndex + 1) % slides.length;
      renderSlide();
      return;
    }
    say('Choose a video or slides first.');
  };

  $('#menuBtn').onclick = () => panel.classList.toggle('show');
  $('#closePanel').onclick = () => panel.classList.remove('show');

  $('#lockBtn').onclick = () => {
    locked = !locked;
    wall.classList.toggle('locked', locked);
    $('#lockBtn').textContent = locked ? 'UNLOCK WALL' : 'LOCK WALL';
  };

  $('#fitBtn').onclick = () => {
    cover = !cover;
    wall.classList.toggle('fit-cover', cover);
    $('#fitBtn').textContent = cover ? 'FIT: COVER' : 'FIT: CONTAIN';
  };

  $('#mirrorBtn').onclick = () => camera.classList.toggle('mirror');

  $('#voiceBtn').onclick = () => say('Voice commands will be added in a later version.');

  $('#fullscreenBtn').onclick = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) {
      say('Full screen is unavailable in this browser.');
    }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  window.addEventListener('beforeunload', () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    if (stream) stream.getTracks().forEach((t) => t.stop());
  });

  updateWall();
})();