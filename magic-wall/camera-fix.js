(() => {
  const camera = document.querySelector('#camera');
  const status = document.querySelector('#cameraStatus');
  const startBtn = document.querySelector('#startBtn');
  const switchBtn = document.querySelector('#switchCameraBtn');
  const rearBtn = document.querySelector('#rearCameraBtn');
  const welcome = document.querySelector('#welcome');
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  let stream = null;
  let devices = [];
  let currentId = null;

  const say = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  const showApp = () => {
    if (welcome) welcome.style.display = 'none';
    if (app) app.style.display = 'block';
  };

  const stop = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
  };

  const refresh = async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter(d => d.kind === 'videoinput');
  };

  const isRear = (label='') => /back|rear|environment|world|facing back/i.test(label);
  const isFront = (label='') => /front|user|selfie|facing front/i.test(label);

  const open = async (video) => {
    stop();
    stream = await navigator.mediaDevices.getUserMedia({video, audio:false});
    camera.srcObject = stream;
    await camera.play().catch(() => {});
    currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || null;
    await refresh();
    const current = devices.find(d => d.deviceId === currentId);
    if (isRear(current?.label)) status.textContent = 'Rear camera';
    else if (isFront(current?.label)) status.textContent = 'Front camera';
    else status.textContent = 'Camera on';
  };

  const useRear = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return say('Camera switching is unavailable.');
    showApp();
    try {
      await refresh().catch(() => {});
      const rear = devices.find(d => isRear(d.label));
      if (rear) await open({deviceId:{exact:rear.deviceId}});
      else await open({facingMode:{exact:'environment'}});
      status.textContent = 'Rear camera';
      say('Rear camera selected.');
    } catch (e) {
      try {
        await open({facingMode:{ideal:'environment'}});
        say('Back camera requested.');
      } catch (_) {
        say('Rear camera not available. Tap ↺ to try another camera.');
      }
    }
  };

  const start = async () => {
    showApp();
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Preview mode';
      return say('Camera is unavailable in this browser.');
    }
    try {
      await useRear();
    } catch (_) {
      status.textContent = 'Camera blocked';
      say('Allow Camera permission and try again.');
    }
  };

  const cycle = async () => {
    try {
      await refresh();
      if (devices.length < 2) return useRear();
      let i = devices.findIndex(d => d.deviceId === currentId);
      i = i < 0 ? 0 : (i + 1) % devices.length;
      const next = devices[i];
      await open({deviceId:{exact:next.deviceId}});
      if (isRear(next.label)) say('Rear camera selected.');
      else if (isFront(next.label)) say('Front camera selected. Tap ↺ again.');
      else say(`Camera ${i+1} selected.`);
    } catch (_) {
      say('Could not switch camera.');
    }
  };

  if (startBtn) startBtn.onclick = start;
  if (switchBtn) switchBtn.onclick = cycle;
  if (rearBtn) rearBtn.onclick = useRear;
})();