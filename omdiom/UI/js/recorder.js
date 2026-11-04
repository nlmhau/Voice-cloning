// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - VOICE RECORDER & AUDIO VAD ENGINE (UI/js/recorder.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── CHUẨN HÓA ENCODE FLOAT32 SANG WAV 16-BIT PCM ─────────────
function encodeFloat32ToWav(samples, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// ───────────── ENGINE VAD: PHÁT HIỆN GIỌNG NÓI & LỌC ĐOẠN SẠCH ─────────────
window.AudioVAD = {
  analyze: async function(blobOrFile, options = {}) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    let audioBuf = null;
    try {
      const arrBuf = await blobOrFile.arrayBuffer();
      audioBuf = await ctx.decodeAudioData(arrBuf);
    } catch(err) {
      ctx.close();
      throw new Error('Không thể giải mã tệp âm thanh: ' + err.message);
    }

    const sr = audioBuf.sampleRate;
    const rawData = audioBuf.getChannelData(0);
    const duration = audioBuf.duration;

    const minSeg = options.minSeg || 3.0;
    const maxSeg = options.maxSeg || 7.0;

    // 1. Tính RMS từng frame 0.05s
    const frameSize = Math.floor(sr * 0.05);
    const rmsArr = [];
    for(let i = 0; i + frameSize <= rawData.length; i += frameSize){
      let sumSq = 0;
      for(let j = i; j < i + frameSize; j++) sumSq += rawData[j] * rawData[j];
      rmsArr.push(Math.sqrt(sumSq / frameSize));
    }

    if(!rmsArr.length){
      ctx.close();
      throw new Error('Dữ liệu âm thanh quá ngắn hoặc rỗng');
    }

    // 2. Ước lượng ngưỡng im lặng thông minh (Noise Floor Estimation)
    const sortedRms = rmsArr.slice().sort((a,b) => a - b);
    const noiseFloor = sortedRms[Math.max(0, Math.floor(sortedRms.length * 0.08))];
    const maxRms = Math.max(...rmsArr);
    const meanRms = rmsArr.reduce((a,b)=>a+b, 0) / rmsArr.length;

    let silenceThresh = Math.max(noiseFloor * 2.0, maxRms * 0.08, 0.005);
    silenceThresh = Math.min(silenceThresh, meanRms * 0.4);

    // 3. Tìm các vùng có tiếng nói (RMS > silenceThresh)
    const voiceRegions = [];
    let inVoice = false;
    let regionStart = 0;
    for(let i = 0; i < rmsArr.length; i++){
      if(rmsArr[i] > silenceThresh && !inVoice){
        inVoice = true;
        regionStart = i;
      } else if(rmsArr[i] <= silenceThresh && inVoice){
        inVoice = false;
        const startSec = regionStart * 0.05;
        const endSec = i * 0.05;
        if(endSec - startSec >= 0.3){
          voiceRegions.push({ start: startSec, end: endSec });
        }
      }
    }
    if(inVoice){
      const startSec = regionStart * 0.05;
      const endSec = rmsArr.length * 0.05;
      if(endSec - startSec >= 0.3) voiceRegions.push({ start: startSec, end: endSec });
    }

    // 4. Gộp các đoạn gần nhau (< 0.45s gap)
    const merged = [];
    for(const r of voiceRegions){
      if(merged.length && r.start - merged[merged.length-1].end < 0.45){
        merged[merged.length-1].end = r.end;
      } else {
        merged.push({ start: r.start, end: r.end });
      }
    }

    // 5. Tạo candidate segments (3–7s) bằng sliding window
    const candidates = [];
    for(const region of merged){
      const rDur = region.end - region.start;
      if(rDur >= minSeg && rDur <= maxSeg){
        candidates.push({ start: region.start, end: region.end, dur: rDur });
      } else if(rDur > maxSeg){
        let s = region.start;
        while(s + minSeg <= region.end){
          const e = Math.min(s + maxSeg, region.end);
          candidates.push({ start: s, end: e, dur: e - s });
          s += 1.0;
        }
      }
    }

    // Nếu không có candidate đạt chuẩn 3–7s: lấy đoạn dài nhất trong merged hoặc toàn bộ audio
    if(!candidates.length && merged.length){
      const longest = merged.reduce((a,b) => (b.end - b.start) > (a.end - a.start) ? b : a);
      const d = Math.min(longest.end - longest.start, maxSeg);
      candidates.push({ start: longest.start, end: longest.start + d, dur: d });
    }

    if(!candidates.length && duration >= minSeg){
      const d = Math.min(duration, maxSeg);
      candidates.push({ start: 0, end: d, dur: d });
    }

    if(!candidates.length){
      candidates.push({ start: 0, end: duration, dur: duration });
    }

    // 6. Chấm điểm chất lượng âm học
    for(const c of candidates){
      const fStart = Math.floor(c.start / 0.05);
      const fEnd = Math.floor(c.end / 0.05);
      const seg = rmsArr.slice(fStart, fEnd);
      const mean = seg.reduce((a,b) => a + b, 0) / (seg.length || 1);
      const variance = seg.reduce((a,b) => a + (b - mean) * (b - mean), 0) / (seg.length || 1);
      const stability = 1 / (1 + Math.sqrt(variance) / (mean || 0.001));
      const durationBonus = 1 - Math.abs(c.dur - 5.5) / 5.5;
      c.score = parseFloat((mean * 10 + stability * 5 + durationBonus * 3).toFixed(1));
      c.meanRms = mean;
    }

    candidates.sort((a,b) => b.score - a.score);
    const topSegments = candidates.slice(0, 5);

    // 7. Hàm trích xuất PCM 16-bit WAV Blob
    function createSegmentWavBlob(seg){
      const startSample = Math.floor(seg.start * sr);
      const endSample = Math.min(Math.floor(seg.end * sr), rawData.length);
      const slice = rawData.subarray(startSample, endSample);
      return encodeFloat32ToWav(slice, sr);
    }

    function createFullWavBlob(){
      return encodeFloat32ToWav(rawData, sr);
    }

    try { ctx.close(); } catch(e){}

    return {
      duration: duration,
      sampleRate: sr,
      segments: topSegments,
      bestSegment: topSegments[0] || null,
      createWavBlob: createSegmentWavBlob,
      createFullWavBlob: createFullWavBlob,
      rawData: rawData
    };
  }
};


(function(){
  const MAX_REC_SEC = 30;
  const MIN_SEG = 3;
  const MAX_SEG = 7;

  let mediaRec = null;
  let audioCtx = null;
  let analyser = null;
  let recStream = null;
  let chunks = [];
  let recStart = 0;
  let recTimerId = null;
  let recLevelId = null;
  let fullBlob = null;
  let bestSegBlob = null;
  let segments = [];

  const btnStart = $('#btnRecStart');
  const btnStop = $('#btnRecStop');
  const btnReset = $('#btnRecReset');
  const btnUse = $('#btnRecUse');
  const elTimer = $('#recTimer');
  const elLevel = $('#recLevel');
  const elTag = $('#recTag');
  const elResult = $('#recResult');
  const elResultInfo = $('#recResultInfo');
  const elSegments = $('#recSegments');
  const elWarn = $('#recSecureWarn');
  const elWarnMsg = $('#recSecureWarnMsg');

  if(!btnStart) return;

  // Kiểm tra nếu đang mở dạng file:// và thiếu mediaDevices thì hiện cảnh báo ngay
  if(location.protocol === 'file:'){
    if(elWarn) elWarn.style.display = 'block';
  }

  function fmtTimer(sec){
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  function setRecState(state){
    if(state === 'idle'){
      elTag.textContent = 'SẴN SÀNG';
      elTag.className = 'tag';
      elTimer.className = 'rec-timer idle';
      elTimer.textContent = '00:00';
      elLevel.style.width = '0%';
      btnStart.disabled = false;
      btnStart.innerHTML = '🎙️ Bắt đầu ghi';
      btnStart.classList.remove('recording');
      btnStop.disabled = true;
      btnReset.disabled = true;
    } else if(state === 'recording'){
      elTag.textContent = 'ĐANG GHI...';
      elTag.className = 'tag bad';
      elTimer.className = 'rec-timer';
      btnStart.disabled = true;
      btnStart.classList.add('recording');
      btnStart.innerHTML = '🔴 Đang ghi...';
      btnStop.disabled = false;
      btnReset.disabled = true;
    } else if(state === 'done'){
      elTag.textContent = 'ĐÃ GHI XONG';
      elTag.className = 'tag ok';
      elTimer.className = 'rec-timer idle';
      btnStart.disabled = true;
      btnStart.classList.remove('recording');
      btnStop.disabled = true;
      btnReset.disabled = false;
    }
  }

  async function layAudioStream(){
    // 1. Kiểm tra hỗ trợ mediaDevices chuẩn
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch(e1) {
        // Thử lại với audio: true cơ bản (tránh lỗi do driver mic từ chối constraints)
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    }
    // 2. Thử API cũ (navigator.getUserMedia / webkitGetUserMedia)
    const legacyGUM = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if(legacyGUM){
      return new Promise(function(resolve, reject){
        legacyGUM.call(navigator, { audio: true }, resolve, reject);
      });
    }
    throw new Error('SECURE_CONTEXT_REQUIRED');
  }

  async function batDauGhi(){
    try {
      recStream = await layAudioStream();
      if(elWarn) elWarn.style.display = 'none';
    } catch(e){
      if(e.message === 'SECURE_CONTEXT_REQUIRED' || (location.protocol === 'file:' && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia))){
        if(elWarn){
          elWarn.style.display = 'block';
          if(elWarnMsg) elWarnMsg.textContent = 'Trình duyệt Chrome/Edge chặn Micro khi mở trực tiếp tệp file://.';
        }
        toast('Chrome chặn Micro trên file://. Vui lòng bấm vào liên kết trong ô để mở http://127.0.0.1:8000', true);
      } else if(e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError'){
        if(elWarn){
          elWarn.style.display = 'block';
          if(elWarnMsg) elWarnMsg.textContent = 'Bạn đã từ chối quyền truy cập Micro trên trình duyệt. Hãy bấm biểu tượng ổ khóa/camera trên thanh địa chỉ để cấp quyền lại.';
        }
        toast('Bạn chưa cấp quyền Micro cho trang web!', true);
      } else {
        toast('Không mở được micro: ' + (e.message || e.name), true);
      }
      return;
    }

    chunks = [];
    fullBlob = null;
    bestSegBlob = null;
    segments = [];
    elResult.classList.remove('show');

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      const src = audioCtx.createMediaStreamSource(recStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
    } catch(e){
      console.warn('Lỗi khởi tạo Analyser:', e);
    }

    let recOpts = {};
    if(typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported){
      if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) recOpts = {mimeType: 'audio/webm;codecs=opus'};
      else if(MediaRecorder.isTypeSupported('audio/webm')) recOpts = {mimeType: 'audio/webm'};
      else if(MediaRecorder.isTypeSupported('audio/mp4')) recOpts = {mimeType: 'audio/mp4'};
    }

    try {
      mediaRec = new MediaRecorder(recStream, recOpts);
    } catch(_){
      mediaRec = new MediaRecorder(recStream);
    }

    mediaRec.ondataavailable = function(e){ if(e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRec.onstop = function(){ xuLySauGhi(); };

    mediaRec.start(100);
    recStart = performance.now();
    setRecState('recording');

    // Timer cập nhật
    recTimerId = setInterval(function(){
      const elapsed = (performance.now() - recStart) / 1000;
      elTimer.textContent = fmtTimer(elapsed);
      if(elapsed >= MAX_REC_SEC){
        dungGhi();
      }
    }, 200);

    // Thanh mức âm lượng
    if(analyser){
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      recLevelId = setInterval(function(){
        if(!analyser) return;
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for(let i = 0; i < dataArr.length; i++) sum += dataArr[i];
        const avg = sum / dataArr.length;
        const pct = Math.min(100, (avg / 128) * 100);
        elLevel.style.width = pct + '%';
      }, 60);
    }
  }

  function dungGhi(){
    clearInterval(recTimerId);
    clearInterval(recLevelId);
    if(mediaRec && mediaRec.state === 'recording'){
      mediaRec.stop();
    }
    if(recStream){
      recStream.getTracks().forEach(function(t){ t.stop(); });
    }
    if(audioCtx){
      audioCtx.close().catch(function(){});
      audioCtx = null;
    }
    analyser = null;
    setRecState('done');
  }

  function resetGhi(){
    fullBlob = null;
    bestSegBlob = null;
    segments = [];
    elResult.classList.remove('show');
    elSegments.innerHTML = '';
    setRecState('idle');
  }

  async function xuLySauGhi(){
    if(!chunks.length){
      toast('Không nhận được dữ liệu âm thanh', true);
      resetGhi();
      return;
    }
    fullBlob = new Blob(chunks, {type: chunks[0].type || 'audio/webm'});
    const totalSec = (performance.now() - recStart) / 1000;

    elResult.classList.add('show');
    elResultInfo.textContent = 'Đang phân tích ' + totalSec.toFixed(1) + 's ghi âm...';
    elSegments.innerHTML = '<div class="muted">Đang phân tích độ sạch và tìm đoạn 3–7s tốt nhất...</div>';

    try {
      const vadRes = await window.AudioVAD.analyze(fullBlob, { minSeg: MIN_SEG, maxSeg: MAX_SEG });
      segments = vadRes.segments;

      if(!segments.length){
        elResultInfo.textContent = 'Không tìm được đoạn giọng nói rõ ràng. Hãy thử ghi lại.';
        elSegments.innerHTML = '';
        return;
      }

      elResultInfo.textContent = 'Đã tìm được ' + segments.length + ' đoạn tốt nhất (sắp theo chất lượng âm thanh):';

      // Render segments
      let html = '';
      for(let i = 0; i < segments.length; i++){
        const s = segments[i];
        html += '<div class="rec-seg' + (i === 0 ? ' best' : '') + '" data-seg-idx="' + i + '">' +
          '<span class="seg-info">' + (i === 0 ? '⭐ ' : '') + 'Đoạn ' + (i+1) + ': ' + s.start.toFixed(1) + 's → ' + s.end.toFixed(1) + 's (' + s.dur.toFixed(1) + 's)</span>' +
          '<span class="seg-score">Điểm: ' + s.score.toFixed(1) + '</span>' +
          '<button class="mini" data-seg-play="' + i + '" title="Nghe thử đoạn này">▶</button>' +
          '</div>';
      }
      elSegments.innerHTML = html;
      btnUse.disabled = false;

      let selectedIdx = 0;

      // Click select segment
      elSegments.querySelectorAll('.rec-seg').forEach(function(el){
        el.addEventListener('click', function(e){
          if(e.target.tagName === 'BUTTON') return;
          selectedIdx = parseInt(el.dataset.segIdx);
          elSegments.querySelectorAll('.rec-seg').forEach(function(s){s.classList.remove('best');});
          el.classList.add('best');
        });
      });

      // Play segment with window.AudioManager
      elSegments.querySelectorAll('[data-seg-play]').forEach(function(btn){
        btn.addEventListener('click', async function(e){
          e.stopPropagation();
          const idx = parseInt(btn.dataset.segPlay);
          const segBlob = await vadRes.createWavBlob(segments[idx]);
          const url = URL.createObjectURL(segBlob);
          const a = new Audio(url);
          a.onended = function(){ URL.revokeObjectURL(url); };
          window.AudioManager.play(a, btn);
        });
      });

      // Button "Dùng đoạn sạch nhất"
      btnUse.onclick = async function(){
        btnUse.disabled = true;
        btnUse.innerHTML = '⏳ Đang nạp clip...';
        bestSegBlob = await vadRes.createWavBlob(segments[selectedIdx]);

        const cloneSection = document.getElementById('clone');
        const fileInput = cloneSection.querySelector('[data-file]');
        const dropMain = cloneSection.querySelector('[data-dropmain]');
        const dropSub = cloneSection.querySelector('[data-dropsub]');
        const fileInfo = cloneSection.querySelector('[data-fileinfo]');

        const wavFile = new File([bestSegBlob], 'ghi_am_' + Date.now() + '.wav', {type: 'audio/wav'});

        const dt = new DataTransfer();
        dt.items.add(wavFile);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', {bubbles: true}));

        if(dropMain) dropMain.textContent = '🎙️ ' + wavFile.name;
        if(dropSub) dropSub.textContent = (bestSegBlob.size / 1024).toFixed(0) + ' KB · Ghi âm trực tiếp';
        if(fileInfo) fileInfo.textContent = 'Đoạn ' + (selectedIdx+1) + ': ' + segments[selectedIdx].start.toFixed(1) + 's → ' + segments[selectedIdx].end.toFixed(1) + 's (' + segments[selectedIdx].dur.toFixed(1) + 's) · Điểm: ' + segments[selectedIdx].score.toFixed(1);

        btnUse.innerHTML = '✓ Đã nạp clip mẫu từ ghi âm!';
        toast('Đã nạp đoạn sạch nhất (' + segments[selectedIdx].dur.toFixed(1) + 's) làm clip mẫu');
      };
    } catch(e){
      elResultInfo.textContent = 'Lỗi phân tích: ' + e.message;
      console.error('Lỗi phân tích ghi âm:', e);
    }
  }

  btnStart.addEventListener('click', batDauGhi);
  btnStop.addEventListener('click', dungGhi);
  btnReset.addEventListener('click', resetGhi);
})();


