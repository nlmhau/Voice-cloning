// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - AUDIO DSP & WAVEFORM (UI/js/audio-dsp.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── BỘ TINH CHỈNH CHẤT GIỌNG DSP (PITCH, SPEED, BASS) ─────────────
let curCloneAudioBlob = null;
let dspAudioCtx = null;
let dspSource = null;
let dspBassFilter = null;
let dspBuffer = null;
let isDspPlaying = false;

function audioBufferToWavBlob(abuffer){
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  let pos = 0;

  function setUint16(data){ out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data){ out.setUint32(pos, data, true); pos += 4; }

  out.setUint32(0, 0x46464952, false); // "RIFF"
  out.setUint32(4, length - 8, true);
  out.setUint32(8, 0x45564157, false); // "WAVE"
  out.setUint32(12, 0x20746d66, false); // "fmt "
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, numOfChan, true);
  out.setUint32(24, abuffer.sampleRate, true);
  out.setUint32(28, abuffer.sampleRate * 2 * numOfChan, true);
  out.setUint16(32, numOfChan * 2, true);
  out.setUint16(34, 16, true); // 16-bit
  out.setUint32(36, 0x61746164, false); // "data"
  out.setUint32(40, length - 44, true);

  pos = 44;
  const channels = [];
  for(let i = 0; i < numOfChan; i++) channels.push(abuffer.getChannelData(i));

  for(let i = 0; i < abuffer.length; i++){
    for(let ch = 0; ch < numOfChan; ch++){
      let sample = Math.max(-1, Math.min(1, channels[ch][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

async function napDspBuffer(blob){
  if(!blob) return null;
  if(!dspAudioCtx){
    dspAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(dspAudioCtx.state === 'suspended'){
    await dspAudioCtx.resume();
  }
  const arr = await blob.arrayBuffer();
  dspBuffer = await dspAudioCtx.decodeAudioData(arr.slice(0));
  return dspBuffer;
}

function capNhatDspNotePlaceholder(){
  const p = document.getElementById('tunePitch');
  const s = document.getElementById('tuneSpeed');
  const b = document.getElementById('tuneBass');
  const noteInp = document.getElementById('saveVoiceNote');
  if(!p || !s || !b || !noteInp) return;
  const pVal = parseInt(p.value);
  const sVal = parseFloat(s.value).toFixed(2);
  const bVal = parseInt(b.value);
  const str = `Cao độ: ${pVal >= 0 ? '+' : ''}${pVal}st | Tốc độ: ${sVal}x | Bass: +${bVal}dB`;
  noteInp.placeholder = str;
}

async function toggleNgheThuDsp(){
  const btn = document.getElementById('btnTunePreview');
  const st = document.getElementById('tuneAudioStatus');
  if(isDspPlaying){
    dungNgheThuDsp();
    return;
  }

  let blobToPlay = curCloneAudioBlob;
  if(!blobToPlay){
    const khoi = document.getElementById('clone');
    if(khoi && khoi._file){
      blobToPlay = khoi._file;
    } else {
      toast('Chưa có âm thanh để nghe thử. Hãy nhân bản giọng trước!', true);
      return;
    }
  }

  if(btn) btn.disabled = true;
  if(st) st.textContent = 'Đang giải mã âm thanh...';
  try{
    await napDspBuffer(blobToPlay);
    if(!dspBuffer) throw new Error('Không thể giải mã tệp âm thanh');

    dspSource = dspAudioCtx.createBufferSource();
    dspSource.buffer = dspBuffer;

    const p = document.getElementById('tunePitch');
    const s = document.getElementById('tuneSpeed');
    const b = document.getElementById('tuneBass');

    const pitchVal = p ? parseFloat(p.value) : 0;
    const speedVal = s ? parseFloat(s.value) : 1;
    const bassVal = b ? parseFloat(b.value) : 0;

    dspSource.detune.value = pitchVal * 100;
    dspSource.playbackRate.value = speedVal;

    dspBassFilter = dspAudioCtx.createBiquadFilter();
    dspBassFilter.type = 'lowshelf';
    dspBassFilter.frequency.value = 220;
    dspBassFilter.gain.value = bassVal;

    dspSource.connect(dspBassFilter);
    dspBassFilter.connect(dspAudioCtx.destination);

    dspSource.onended = () => {
      dungNgheThuDsp();
    };

    if(window.AudioManager && typeof window.AudioManager.stopAll === 'function') {
      window.AudioManager.stopAll();
    }
    dspSource.start(0);
    isDspPlaying = true;
    if(btn){
      btn.innerHTML = '⏹ Dừng nghe thử';
      btn.style.background = '#fee2e2';
      btn.style.color = '#b91c1c';
      btn.style.borderColor = '#f87171';
    }
    if(st) st.textContent = '🔊 Đang phát hiệu ứng tinh chỉnh...';
  }catch(err){
    console.error(err);
    toast('Lỗi phát âm thanh DSP: ' + err.message, true);
    dungNgheThuDsp();
  }finally{
    if(btn) btn.disabled = false;
  }
}

function dungNgheThuDsp(){
  if(dspSource){
    try{ dspSource.stop(); }catch(_){}
    try{ dspSource.disconnect(); }catch(_){}
    dspSource = null;
  }
  dspBassFilter = null;
  isDspPlaying = false;
  const btn = document.getElementById('btnTunePreview');
  const st = document.getElementById('tuneAudioStatus');
  if(btn){
    btn.innerHTML = '▶ Nghe thử chất giọng';
    btn.style.background = '#e0e7ff';
    btn.style.color = '#3730a3';
    btn.style.borderColor = '#818cf8';
  }
  if(st) st.textContent = 'Sẵn sàng nghe thử';
}
window.dungDspPreview = dungNgheThuDsp;

function datLaiDsp(){
  const p = document.getElementById('tunePitch');
  const pV = document.getElementById('tunePitchV');
  const s = document.getElementById('tuneSpeed');
  const sV = document.getElementById('tuneSpeedV');
  const b = document.getElementById('tuneBass');
  const bV = document.getElementById('tuneBassV');

  if(p) p.value = 0;
  if(pV) pV.textContent = '0 st (Chuẩn)';
  if(s) s.value = 1.00;
  if(sV) sV.textContent = '1.00x';
  if(b) b.value = 0;
  if(bV) bV.textContent = '0 dB';

  capNhatDspNotePlaceholder();
  toast('Đã đặt lại thông số tinh chỉnh về mặc định');
  if(isDspPlaying){
    dungNgheThuDsp();
    toggleNgheThuDsp();
  }
}

async function taiWavDaTinhChinh(){
  let blobToUse = curCloneAudioBlob;
  if(!blobToUse){
    const khoi = document.getElementById('clone');
    if(khoi && khoi._file) blobToUse = khoi._file;
  }
  if(!blobToUse){
    toast('Chưa có âm thanh để xuất tệp', true);
    return;
  }
  const st = document.getElementById('tuneAudioStatus');
  if(st) st.textContent = 'Đang xử lý xuất tệp WAV...';
  try{
    await napDspBuffer(blobToUse);
    const p = document.getElementById('tunePitch');
    const s = document.getElementById('tuneSpeed');
    const b = document.getElementById('tuneBass');

    const pitchVal = p ? parseFloat(p.value) : 0;
    const speedVal = s ? parseFloat(s.value) : 1;
    const bassVal = b ? parseFloat(b.value) : 0;

    const originalDuration = dspBuffer.duration;
    const newDuration = originalDuration / speedVal;
    const sampleRate = dspBuffer.sampleRate;
    const length = Math.ceil(newDuration * sampleRate);

    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      dspBuffer.numberOfChannels,
      length,
      sampleRate
    );

    const src = offlineCtx.createBufferSource();
    src.buffer = dspBuffer;
    src.detune.value = pitchVal * 100;
    src.playbackRate.value = speedVal;

    const bFilter = offlineCtx.createBiquadFilter();
    bFilter.type = 'lowshelf';
    bFilter.frequency.value = 220;
    bFilter.gain.value = bassVal;

    src.connect(bFilter);
    bFilter.connect(offlineCtx.destination);
    src.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(renderedBuffer);

    const tenInp = document.getElementById('saveVoiceName');
    const tenGiong = ((tenInp ? tenInp.value.trim() : '') || 'giong-tinh-chinh').replace(/[^a-zA-Z0-9_À-ɏẠ-ỹ-]/g, '_');
    await taiTepChonThuMuc(wavBlob, 'omdiom-' + tenGiong + '-' + Date.now() + '.wav', 'Tệp âm thanh WAV', 'audio/wav', 'wav');
    if(st) st.textContent = '✓ Đã xuất tệp thành công';
  }catch(err){
    console.error(err);
    toast('Lỗi xuất tệp WAV: ' + err.message, true);
    if(st) st.textContent = 'Lỗi xuất tệp';
  }
}

function taoSong(el,n){
  if(!el||el.childElementCount)return;
  for(let i=0;i<n;i++){
    const it=document.createElement('i');const env=Math.sin(Math.PI*i/n);
    it.style.height=(5+env*(8+28*Math.abs(Math.sin(i*1.37)*Math.cos(i*.28))))+'px';
    el.appendChild(it)
  }
}
$$('[data-wave]').forEach(el=>taoSong(el,90));

async function veSongThuc(el,blob){
  try{
    const buf=await blob.arrayBuffer();
    const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();
    const ab=await ac.decodeAudioData(buf);const d=ab.getChannelData(0);
    const its=Array.from(el.querySelectorAll('i'));const n=its.length;
    const step=Math.max(1,Math.floor(d.length/n));const pk=[];let mx=1e-9;
    for(let i=0;i<n;i++){let m=0;const end=Math.min((i+1)*step,d.length);
      for(let j=i*step;j<end;j++){const v=Math.abs(d[j]);if(v>m)m=v}
      pk.push(m);if(m>mx)mx=m}
    its.forEach((it,i)=>{it.style.height=(5+(pk[i]/mx)*33)+'px'});ac.close();
    el.dataset.real='1'
  }catch(e){}
}
