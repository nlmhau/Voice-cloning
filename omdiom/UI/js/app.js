// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - MAIN APPLICATION CONTROLLER (UI/js/app.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── tham số từng tab ─────────────
function thamSo(khoi){
  const s=khoi.querySelector('input[type=range]');
  const all=Array.from(khoi.querySelectorAll('.setting'));
  const stepsEl=all[0].querySelector('input');
  const speedEl=all[1].querySelector('input');
  const guidEl=all[2].querySelector('input');
  return {
    num_step:STEPS[+stepsEl.value],
    speed:parseFloat(speedEl.value),
    guidance_scale:parseFloat(guidEl.value)||2.0
  }
}
function noiThamSo(khoi){
  const t=thamSo(khoi);
  const out=khoi.querySelector('[data-echo]');
  if(out)out.textContent='num_step='+t.num_step+' · speed='+t.speed.toFixed(2)+' · guidance='+t.guidance_scale;
  return t
}

// ───────────── gọi API ─────────────
async function goiApi(path,fd){
  const url=cfg.url.replace(/\/$/,'')+path;
  const h={};if(cfg.key)h['X-API-Key']=cfg.key;
  const t0=performance.now();
  const r=await fetch(url,{method:'POST',body:fd,headers:h});
  if(!r.ok){let m='HTTP '+r.status;try{const j=await r.json();m+=' — '+(j.detail||j.error||'')}catch(e){}throw new Error(m)}
  return {blob:await r.blob(),genTime:parseFloat(r.headers.get('X-Gen-Time')||'0'),duration:parseFloat(r.headers.get('X-Audio-Duration')||'0'),rtf:parseFloat(r.headers.get('X-RTF')||'0'),mode:r.headers.get('X-Mode')||'tts',wall:(performance.now()-t0)/1000}
}

// ───────────── QUẢN LÝ TIẾN TRÌNH HOÀN THÀNH (VÒNG TRÒN + THANH LOAD 0-100%) ─────────────
function batDauTienTrinh(khoi, btn, tenChucNang, thoiGianUocTinhMs){
  const pBox = khoi.querySelector('[data-prog]');
  const audioBox = khoi.querySelector('[data-box]');
  if(audioBox) audioBox.style.display = 'none';
  if(pBox) pBox.style.display = 'flex';

  const circleVal = pBox ? pBox.querySelector('.circle-val') : null;
  const circleText = pBox ? pBox.querySelector('.circle-text') : null;
  const progFill = pBox ? pBox.querySelector('.prog-fill') : null;
  const progStatus = pBox ? pBox.querySelector('.prog-status') : null;
  const progStepText = pBox ? pBox.querySelector('.prog-step-text') : null;
  const progTimer = pBox ? pBox.querySelector('.prog-timer') : null;

  const chuVi = 251.3;
  let phanTramHienTai = 0;
  const t0 = performance.now();
  const msUocTinh = thoiGianUocTinhMs || 10000;

  function setVal(pt, statusMsg, stepMsg){
    phanTramHienTai = Math.max(0, Math.min(100, pt));
    const offset = chuVi - (phanTramHienTai / 100) * chuVi;
    if(circleVal) circleVal.style.strokeDashoffset = offset;
    if(circleText) circleText.textContent = Math.round(phanTramHienTai) + '%';
    if(progFill) progFill.style.width = phanTramHienTai + '%';
    if(progStatus && statusMsg) progStatus.textContent = statusMsg;
    if(progStepText && stepMsg) progStepText.textContent = stepMsg;
    if(btn) {
      if(btn.tagName === 'BUTTON' && btn.classList.contains('primary')){
        btn.innerHTML = '◌ &nbsp;<b>' + Math.round(phanTramHienTai) + '%</b> &nbsp;Đang tạo...';
      } else {
        btn.innerHTML = '◌ ' + Math.round(phanTramHienTai) + '%';
      }
    }
  }

  if(btn) btn.classList.add('is-generating');
  setVal(3, 'Bắt đầu: ' + tenChucNang, 'Bước 1/4 · Tiền xử lý');

  const intervalId = setInterval(function(){
    const elapsed = performance.now() - t0;
    if(progTimer) progTimer.textContent = (elapsed / 1000).toFixed(1) + 's';

    // Đường cong tiến trình tự nhiên mượt mà 0% -> 95%
    const ratio = elapsed / msUocTinh;
    let target = 0;
    let st = '';
    let sp = '';

    if (ratio < 0.20) {
      target = 3 + (ratio / 0.20) * 32; // 3% -> 35%
      st = 'Đang phân tích cú pháp & ngữ âm câu...';
      sp = 'Bước 1/4 · Tiền xử lý';
    } else if (ratio < 0.75) {
      target = 35 + ((ratio - 0.20) / 0.55) * 45; // 35% -> 80%
      st = 'Đang khuếch tán âm học AI (Diffusion Sampling)...';
      sp = 'Bước 2/4 · Trích xuất giọng';
    } else {
      // Tiệm cận 95% trong lúc chờ server trả kết quả
      target = 80 + Math.min(15, (ratio - 0.75) * 12); // 80% -> 95%
      st = 'Đang giải mã Vocoder & chèn khoảng lặng PCM...';
      sp = 'Bước 3/4 · Tổng hợp âm thanh';
    }
    target = Math.min(95, target);
    if(phanTramHienTai < target){
      setVal(phanTramHienTai + (target - phanTramHienTai) * 0.28, st, sp);
    }
  }, 90);

  return {
    hoanTat: function(onDone){
      clearInterval(intervalId);
      if(btn) btn.classList.remove('is-generating');
      setVal(100, '✓ Đã hoàn tất 100%!', 'Bước 4/4 · Hoàn thành');
      if(circleVal) circleVal.style.stroke = '#4dcac1';
      if(circleText) circleText.innerHTML = '<span style="color:#0f766e">✓ 100%</span>';
      setTimeout(function(){
        if(pBox) pBox.style.display = 'none';
        if(audioBox) audioBox.style.display = '';
        if(circleVal){ circleVal.style.stroke = 'var(--yellow)'; circleVal.style.strokeDashoffset = chuVi; }
        if(circleText) circleText.textContent = '0%';
        if(onDone) onDone();
      }, 400);
    },
    thatBai: function(errMsg){
      clearInterval(intervalId);
      if(btn) btn.classList.remove('is-generating');
      if(circleVal) circleVal.style.stroke = '#ef4444';
      if(circleText) circleText.innerHTML = '<span style="color:#b91c1c">✕</span>';
      if(progStatus) progStatus.textContent = 'Lỗi: ' + errMsg;
      setTimeout(function(){
        if(pBox) pBox.style.display = 'none';
        if(audioBox) audioBox.style.display = '';
        if(circleVal){ circleVal.style.stroke = 'var(--yellow)'; circleVal.style.strokeDashoffset = chuVi; }
        if(circleText) circleText.textContent = '0%';
      }, 2500);
    }
  };
}


// ───────────── nút chạy từng chế độ ─────────────
async function chay(tab){
  const khoi=document.getElementById(tab);
  const ta=khoi.querySelector('[data-text]');
  const text=(ta.value||'').trim();
  if(!text){toast('Hãy nhập văn bản trước khi tạo giọng.');ta.focus();return}
  const btn=khoi.querySelector('[data-run]');
  const nhanGoc=btn.innerHTML;
  const p=thamSo(khoi);
  let che={tts:'Văn bản → Giọng',clone:'Nhân bản',design:'Thiết kế'}[tab];

  if(!cfg.url){toast('Chưa cấu hình backend.',true);return}

  // ═══════════════════════════════════════════════════════════════
  // XỬ LÝ CHUYÊN SÂU TAB TTS (CÂU TỪNG CÂU + TERMINAL + TXT + SRT)
  // ═══════════════════════════════════════════════════════════════
  if(tab === 'tts'){
    const sg = document.getElementById('selGiongTts');
    const voiceId = sg && sg.value ? sg.value : 'Cao_Hung';
    const voiceName = sg && sg.options[sg.selectedIndex] ? sg.options[sg.selectedIndex].text.split(' · ')[0] : voiceId;
    che = 'Có sẵn · ' + voiceName;

    const splitBtn = document.querySelector('#grpSplitMode .segment.selected');
    const splitMode = splitBtn ? splitBtn.dataset.split : 'none';
    const pauseSent = parseFloat(document.getElementById('tPauseSent')?.value || '0.5');
    const pausePara = parseFloat(document.getElementById('tPausePara')?.value || '1.0');
    const pauseVal = splitMode === 'paragraph' ? pausePara : pauseSent;

    const chunks = tachCauTts(text, splitMode);
    const totalChunks = chunks.length;

    btn.disabled = true;
    clearTerm();
    logTerm('TIỀN XỬ LÝ', 'Độ dài văn bản: ' + text.length + ' ký tự | Chế độ ngắt nghỉ: ' + (splitMode === 'sentence' ? 'Theo từng câu' : (splitMode === 'paragraph' ? 'Theo từng đoạn' : 'Liền mạch')));
    logTerm('PHÂN TÁCH', 'Đã chia thành ' + totalChunks + ' đoạn đọc | Khoảng lặng chèn: ' + pauseVal.toFixed(2) + 's', 'accent');
    logTerm('CẤU HÌNH AI', 'Giọng mẫu: ' + voiceName + ' | num_step=' + p.num_step + ' | speed=' + p.speed.toFixed(2) + ' | guidance=' + p.guidance_scale.toFixed(1));

    const uocTinhMs = Math.max(5000, totalChunks * 2800);
    const tienTrinh = batDauTienTrinh(khoi, btn, che, uocTinhMs);

    const AC = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AC();
    const pcmBuffers = [];
    const subtitleEntries = [];
    let curTime = 0.0;
    let totalGenTime = 0.0;
    let sr = 24000;

    try {
      for(let i = 0; i < totalChunks; i++){
        const chunkText = chunks[i];
        const chunkShort = chunkText.length > 45 ? chunkText.substring(0, 42) + '...' : chunkText;
        logTerm('TIẾN TRÌNH ' + (i+1) + '/' + totalChunks, 'Đang mã hóa: "' + chunkShort + '"...');

        const fd = new FormData();
        const textGuiModel = typeof chuyenTheVnSangOmni === 'function' ? chuyenTheVnSangOmni(chunkText) : chunkText;
        fd.append('text', textGuiModel);
        fd.append('voice_id', voiceId);
        fd.append('num_step', String(p.num_step));
        fd.append('speed', String(p.speed));
        fd.append('guidance_scale', String(p.guidance_scale));
        fd.append('split_mode', 'none');

        const d = await goiApi('/api/tts', fd);
        totalGenTime += d.genTime;

        // Giải mã PCM của câu này để lấy thời lượng chính xác tuyệt đối
        const arrBuf = await d.blob.arrayBuffer();
        const aBuf = await audioCtx.decodeAudioData(arrBuf);
        sr = aBuf.sampleRate;
        const pcmData = aBuf.getChannelData(0);
        pcmBuffers.push(pcmData);

        const chunkDur = aBuf.duration;
        const startTime = curTime;
        const endTime = curTime + chunkDur;

        subtitleEntries.push({
          start: startTime,
          end: endTime,
          text: chunkText
        });

        const rtf = chunkDur > 0 ? (d.genTime / chunkDur) : 0;
        logTerm('HOÀN TẤT ' + (i+1) + '/' + totalChunks, '✓ Xong trong ' + d.genTime.toFixed(2) + 's | Âm thanh: ' + chunkDur.toFixed(2) + 's | RTF: ' + rtf.toFixed(2), 'ok');

        curTime = endTime + (i < totalChunks - 1 ? pauseVal : 0.0);
      }

      // Ghép nối các đoạn PCM và chèn khoảng lặng tự nhiên
      logTerm('HẬU KỲ', 'Đang nối ' + totalChunks + ' đoạn PCM & chèn khoảng lặng ' + pauseVal.toFixed(2) + 's...', 'accent');
      const masterBlob = await ghepAudioVoiKhoangLang(pcmBuffers, pauseVal, sr);
      const totalDur = curTime;
      const avgRtf = totalDur > 0 ? (totalGenTime / totalDur) : 0;

      // Sinh nội dung SRT
      const srtContent = taoNoiDungSrt(subtitleEntries);
      curTtsText = text;
      curTtsSrt = srtContent;
      curMasterWavBlob = masterBlob;

      logTerm('PHỤ ĐỀ SRT', 'Đã tạo ' + subtitleEntries.length + ' mốc thời gian phụ đề chuẩn xác.', 'ok');
      logTerm('TỔNG KẾT', '★ Tổng thời lượng: ' + totalDur.toFixed(2) + 's | Thời gian sinh: ' + totalGenTime.toFixed(2) + 's | RTF TB: ' + avgRtf.toFixed(2), 'ok');

      // Cập nhật ô xem trước TXT & SRT
      const txtArea = document.getElementById('txtPreviewArea');
      const srtArea = document.getElementById('srtPreviewArea');
      if(txtArea) txtArea.value = curTtsText;
      if(srtArea) srtArea.value = curTtsSrt;

      // Kích hoạt các nút tải WAV, TXT, SRT
      const btnDlTxt = document.getElementById('btnDlTxt');
      const btnDlSrt = document.getElementById('btnDlSrt');
      if(btnDlTxt) btnDlTxt.disabled = false;
      if(btnDlSrt) btnDlSrt.disabled = false;
      const btnDlAll = document.getElementById("btnDlAll"); if(btnDlAll) btnDlAll.disabled = false;

      tienTrinh.hoanTat(function(){
        window.AudioManager.stopAll();
        ganAudio(khoi, masterBlob, che.toUpperCase() + ' · XONG');
        dienThongKe(khoi, { duration: totalDur, genTime: totalGenTime, rtf: avgRtf });
        const b = khoi.querySelector('[data-box]');
        if(b && b._audio){
          window.AudioManager.play(b._audio);
        }
      });

      const ts = 'step' + p.num_step + ' · sp' + p.speed.toFixed(2);
      history.unshift({
        gio: new Date().toLocaleTimeString('vi-VN'),
        che: che,
        ts: ts,
        dur: totalDur,
        url: URL.createObjectURL(masterBlob),
        txt: curTtsText,
        srt: curTtsSrt
      });
      if(history.length > 15) history.pop();
      veLichSu();

      toast('Tạo giọng hoàn tất: ' + totalDur.toFixed(2) + 's (' + totalChunks + ' câu)');
      audioCtx.close();
    } catch(e){
      logTerm('LỖI', e.message, 'err');
      tienTrinh.thatBai(e.message);
      toast('Lỗi: ' + e.message, true);
      audioCtx.close();
    } finally {
      btn.disabled = false;
      btn.innerHTML = nhanGoc;
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHẾ ĐỘ NHÂN BẢN & THIẾT KẾ GIỌNG
  // ═══════════════════════════════════════════════════════════════
  let fd=null;
  const textGuiModel = typeof chuyenTheVnSangOmni === 'function' ? chuyenTheVnSangOmni(text) : text;
  if(tab==='clone'){
    if(!khoi._file){toast('Chọn clip mẫu trước.',true);return}
    fd=new FormData();fd.append('text',textGuiModel);fd.append('ref_audio',khoi._file);
    fd.append('ref_text',khoi.querySelector('[data-reftext]').value.trim());
  }else if(tab==='design'){
    const ins=khoi.querySelector('[data-instruct]').textContent.trim();
    if(!ins){toast('Chọn ít nhất một thuộc tính giọng.',true);return}
    fd=new FormData();fd.append('text',textGuiModel);fd.append('instruct',ins);
  }
  fd.append('num_step',String(p.num_step));
  fd.append('speed',String(p.speed));
  fd.append('guidance_scale',String(p.guidance_scale));

  const ts='step'+p.num_step+' · sp'+p.speed.toFixed(2);
  btn.disabled=true;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const uocTinhMs = Math.max(6000, Math.min(45000, wordCount * 1100));
  const tienTrinh = batDauTienTrinh(khoi, btn, che, uocTinhMs);

  try{
    const d=await goiApi('/api/'+tab,fd);
    tienTrinh.hoanTat(function(){
      window.AudioManager.stopAll();
      ganAudio(khoi,d.blob,che.toUpperCase()+' · XONG');
      dienThongKe(khoi,d);
      const b=khoi.querySelector('[data-box]');
      if(b&&b._audio){
        window.AudioManager.play(b._audio);
      }
    });
    history.unshift({gio:new Date().toLocaleTimeString('vi-VN'),che:che,ts:ts,dur:d.duration,url:URL.createObjectURL(d.blob),txt:text});
    if(history.length>15)history.pop();
    veLichSu();
    toast('Xong trong '+d.genTime.toFixed(2)+'s · RTF '+d.rtf.toFixed(2));
    const saveCard=$('#saveVoiceCard');
    if(saveCard){
      if(tab==='clone'){
        saveCard.style.display='block';
        $('#saveVoiceStatus').textContent='';
        $('#saveVoiceName').value='';
        curCloneAudioBlob = d.blob;
        if(typeof capNhatDspNotePlaceholder === 'function') capNhatDspNotePlaceholder();
      }
      else{saveCard.style.display='none'}
    }
  }catch(e){
    tienTrinh.thatBai(e.message);
    toast('Lỗi: '+e.message,true);
    datTrangThai('err');
  }finally{
    btn.disabled=false;btn.innerHTML=nhanGoc;
  }
}

// ───────────── tải tệp văn bản .txt & ngắt nghỉ ─────────────
const txtDrop=document.getElementById('txtDrop');
const txtFileInput=document.getElementById('txtFileInput');
const ttsText=document.querySelector('#tts [data-text]');
const ttsCount=document.querySelector('#tts [data-count]');

if(txtDrop&&txtFileInput){
  txtDrop.addEventListener('click',()=>txtFileInput.click());
  txtDrop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();txtFileInput.click()}});
  ['dragenter','dragover'].forEach(ev=>txtDrop.addEventListener(ev,e=>{e.preventDefault();txtDrop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>txtDrop.addEventListener(ev,e=>{e.preventDefault();txtDrop.classList.remove('over')}));
  txtDrop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)docFileTxt(f)});
  txtFileInput.addEventListener('change',()=>{if(txtFileInput.files[0])docFileTxt(txtFileInput.files[0])});

  function docFileTxt(f){
    if(!f.name.toLowerCase().endsWith('.txt')&&f.type!=='text/plain'){toast('Vui lòng chọn tệp văn bản đuôi .txt',true);return}
    const reader=new FileReader();
    reader.onload=(e)=>{
      const content=e.target.result;
      if(ttsText){
        ttsText.value=content;
        if(ttsCount)ttsCount.textContent=content.length;
        const words=content.trim().split(/\s+/).filter(Boolean).length;
        const sentences=content.split(/[.?!;\n]+/).filter(s=>s.trim().length>0).length;
        const mainTitle=document.getElementById('txtDropTitle');
        const subTitle=document.getElementById('txtDropSub');
        if(mainTitle)mainTitle.textContent=f.name;
        if(subTitle)subTitle.textContent=(f.size/1024).toFixed(1)+' KB · '+words+' từ · '+sentences+' câu';
        txtDrop.style.background='#bdeeea';
        toast('Đã nạp file: '+f.name+' ('+words+' từ, '+sentences+' câu)');
      }
    };
    reader.readAsText(f,'UTF-8');
  }
}

// thanh trượt thời gian nghỉ
const tps=document.getElementById('tPauseSent');
const tpp=document.getElementById('tPausePara');
if(tps)tps.addEventListener('input',()=>{const o=document.getElementById('tPauseSentV');if(o)o.textContent=parseFloat(tps.value).toFixed(2)+'s'});
if(tpp)tpp.addEventListener('input',()=>{const o=document.getElementById('tPauseParaV');if(o)o.textContent=parseFloat(tpp.value).toFixed(2)+'s'});

// modal hướng dẫn sử dụng
const helpModal=document.getElementById('helpModal');
const btnOpenHelp=document.getElementById('btnOpenHelp');
const btnCloseHelp=document.getElementById('btnCloseHelp');
const btnCloseHelp2=document.getElementById('btnCloseHelp2');
if(helpModal&&btnOpenHelp){
  btnOpenHelp.addEventListener('click',()=>helpModal.showModal());
  if(btnCloseHelp)btnCloseHelp.addEventListener('click',()=>helpModal.close());
  if(btnCloseHelp2)btnCloseHelp2.addEventListener('click',()=>helpModal.close());
}

// ───────────── gắn sự kiện chung ─────────────
function noiTab(id){
  const khoi=document.getElementById(id);
  if(!khoi)return;
  const ta=khoi.querySelector('[data-text]');
  const dem=khoi.querySelector('[data-count]');
  if(ta&&dem)ta.addEventListener('input',()=>{dem.textContent=ta.value.length;noiThamSo(khoi)});
  const r=khoi.querySelectorAll('.setting input');
  r.forEach(x=>x.addEventListener('input',()=>{
    const out=x.parentElement.querySelector('output');
    if(!out)return;
    if(x.type==='range'&&x.min==='0')out.textContent=STEPS[+x.value];
    else if(x.id&&x.id.indexOf('Speed')>=0)out.textContent=Number(x.value).toFixed(2)+'×';
    else out.textContent=Number(x.value).toFixed(1);
    noiThamSo(khoi)
  }));
  const btn=khoi.querySelector('[data-run]');
  if(btn)btn.addEventListener('click',()=>chay(id));
  noiThamSo(khoi);
}
['tts','clone','design'].forEach(noiTab);

// segmented (giữ nguyên hành vi gốc)
document.querySelectorAll('.segmented').forEach(group=>group.addEventListener('click',e=>{
  if(!e.target.classList.contains('segment'))return;
  group.querySelectorAll('.segment').forEach(b=>{b.classList.toggle('selected',b===e.target);b.setAttribute('aria-pressed',b===e.target?'true':'false')});
  capNhatInstruct()
}));
const styleGroup=$('[data-styles]');
if(styleGroup)styleGroup.addEventListener('click',e=>{
  const b=e.target.closest('.style-pill');if(!b)return;
  styleGroup.querySelectorAll('.style-pill').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b?'true':'false')});
  capNhatInstruct()
});
function capNhatInstruct(){
  const phan=[];
  document.querySelectorAll('.segmented').forEach(g=>{const s=g.querySelector('.segment.selected');if(s&&s.dataset.val)phan.push(s.dataset.val)});
  const st=document.querySelector('[data-styles] .style-pill[aria-pressed="true"]');
  const out=$('[data-instruct]');
  if(out)out.textContent=phan.join(', ');
}

// kéo thả clip
const drop=$('[data-drop]'),fileInput=$('[data-file]');
if(drop&&fileInput){
  const khoi=document.getElementById('clone');
  drop.addEventListener('click',()=>fileInput.click());
  drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}});
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)dungTep(f)});
  fileInput.addEventListener('change',()=>{if(fileInput.files[0])dungTep(fileInput.files[0])});
  async function dungTep(f){
    if(!f.type.startsWith('audio/') && !/\.(wav|mp3|m4a|ogg|flac|aac|webm)$/i.test(f.name)){
      toast('Tệp không phải định dạng âm thanh hợp lệ.', true);
      return;
    }
    if(f.size > 30*1024*1024){
      toast('Tệp quá lớn (>30 MB).', true);
      return;
    }

    drop.querySelector('[data-dropmain]').textContent = '🎵 ' + f.name;
    drop.querySelector('[data-dropsub]').textContent = 'Bấm để đổi tệp khác · Đang quét VAD...';
    drop.style.background = '#bdeeea';
    khoi.querySelector('[data-fileinfo]').textContent = (f.size/1024/1024).toFixed(2) + ' MB · ' + (f.type || 'audio');

    const panel = document.getElementById('uploadVadPanel');
    const elName = document.getElementById('uploadFileName');
    const elMeta = document.getElementById('uploadFileMeta');
    const elTitle = document.getElementById('uploadVadTitle');
    const elScore = document.getElementById('uploadVadScoreBadge');
    const elDetails = document.getElementById('uploadVadDetails');
    const btnPlayOrig = document.getElementById('btnPlayOriginal');
    const btnPlayClean = document.getElementById('btnPlayCleanSeg');
    const btnToggleSegs = document.getElementById('btnToggleAllSegs');
    const btnToggleMode = document.getElementById('btnToggleUseMode');
    const btnReanalyze = document.getElementById('btnReanalyzeVad');
    const elSegsList = document.getElementById('uploadVadSegsList');

    if(!panel) return;
    panel.style.display = 'block';
    elName.textContent = f.name;
    elMeta.textContent = (f.size / (1024*1024)).toFixed(2) + ' MB · Đang giải mã và phân tích VAD...';
    elDetails.textContent = '⏳ Đang quét phát hiện giọng nói và khoảng lặng...';
    btnPlayClean.style.display = 'none';
    btnToggleSegs.style.display = 'none';
    elSegsList.style.display = 'none';
    elSegsList.innerHTML = '';

    async function chayPhanTichVad(){
      elDetails.textContent = '⏳ Đang phân tích năng lượng RMS và lọc đoạn sạch...';
      try {
        if(!window.AudioVAD){
          elDetails.textContent = 'Đã nạp file thành công.';
          return;
        }

        const vadRes = await window.AudioVAD.analyze(f, { minSeg: 3.0, maxSeg: 7.0 });
        elMeta.textContent = (f.size / (1024*1024)).toFixed(2) + ' MB · ' + vadRes.duration.toFixed(1) + 's · ' + vadRes.sampleRate + ' Hz';

        // 1. Tạo file WAV chuẩn cho toàn bộ file gốc (để soundfile trên backend luôn đọc được)
        const fullWavBlob = vadRes.createFullWavBlob();
        const fullWavFile = new File([fullWavBlob], f.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' });
        khoi._originalWavFile = fullWavFile;

        // Cài đặt nút nghe file gốc
        const fullUrl = URL.createObjectURL(fullWavBlob);
        btnPlayOrig.onclick = function(){
          const a = new Audio(fullUrl);
          window.AudioManager.play(a, btnPlayOrig);
        };

        // 2. Tạo đoạn sạch nhất
        if(vadRes.bestSegment){
          const cleanBlob = vadRes.createWavBlob(vadRes.bestSegment);
          const cleanFile = new File([cleanBlob], 'clean_' + f.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' });
          khoi._cleanWavFile = cleanFile;
          
          // MẶC ĐỊNH: Tự động dùng đoạn sạch nhất cho AI nhân bản
          khoi._file = cleanFile;
          khoi._useMode = 'clean';

          elTitle.innerHTML = '⭐ Đã tự động chọn đoạn sạch nhất (VAD):';
          elScore.textContent = 'Điểm sạch: ' + vadRes.bestSegment.score.toFixed(1);
          elDetails.textContent = vadRes.bestSegment.start.toFixed(1) + 's → ' + vadRes.bestSegment.end.toFixed(1) + 's (Thời lượng: ' + vadRes.bestSegment.dur.toFixed(1) + 's) · Tối ưu cho AI nhân bản';
          
          btnPlayClean.style.display = 'inline-block';
          const cleanUrl = URL.createObjectURL(cleanBlob);
          btnPlayClean.onclick = function(){
            const a = new Audio(cleanUrl);
            window.AudioManager.play(a, btnPlayClean);
          };

          // Nút chuyển đổi dùng file gốc vs đoạn sạch
          btnToggleMode.style.display = 'inline-block';
          btnToggleMode.textContent = 'Dùng cả file gốc';
          btnToggleMode.style.background = '#fff';
          btnToggleMode.onclick = function(){
            if(khoi._useMode === 'clean'){
              khoi._file = khoi._originalWavFile;
              khoi._useMode = 'original';
              btnToggleMode.textContent = '✓ Dùng đoạn sạch';
              btnToggleMode.style.background = '#dcfce7';
              toast('Đang dùng: Toàn bộ file gốc (' + vadRes.duration.toFixed(1) + 's)');
            } else {
              khoi._file = khoi._cleanWavFile;
              khoi._useMode = 'clean';
              btnToggleMode.textContent = 'Dùng cả file gốc';
              btnToggleMode.style.background = '#fff';
              toast('Đang dùng: Đoạn sạch nhất (' + vadRes.bestSegment.dur.toFixed(1) + 's)');
            }
          };

          // Render danh sách các đoạn khác nếu có
          if(vadRes.segments.length > 1){
            btnToggleSegs.style.display = 'inline-block';
            btnToggleSegs.textContent = '📑 Chọn đoạn khác (' + vadRes.segments.length + ' đoạn)';
            btnToggleSegs.onclick = function(){
              elSegsList.style.display = (elSegsList.style.display === 'none') ? 'grid' : 'none';
            };

            let segHtml = '';
            for(let i = 0; i < vadRes.segments.length; i++){
              const s = vadRes.segments[i];
              segHtml += '<div class="rec-seg' + (i === 0 ? ' best' : '') + '" data-upseg-idx="' + i + '">' +
                '<span class="seg-info">' + (i === 0 ? '⭐ ' : '') + 'Đoạn ' + (i+1) + ': ' + s.start.toFixed(1) + 's → ' + s.end.toFixed(1) + 's (' + s.dur.toFixed(1) + 's)</span>' +
                '<span class="seg-score">Điểm: ' + s.score.toFixed(1) + '</span>' +
                '<button type="button" class="mini" data-upseg-play="' + i + '" title="Nghe thử đoạn này">▶</button>' +
                '</div>';
            }
            elSegsList.innerHTML = segHtml;

            // Gán sự kiện click chọn segment khác trong danh sách
            elSegsList.querySelectorAll('.rec-seg').forEach(item => {
              item.addEventListener('click', function(e){
                if(e.target.tagName === 'BUTTON') return;
                const idx = parseInt(item.dataset.upsegIdx);
                const chosenSeg = vadRes.segments[idx];
                const chosenBlob = vadRes.createWavBlob(chosenSeg);
                const chosenFile = new File([chosenBlob], 'clean_seg' + (idx+1) + '_' + f.name.replace(/\.[^.]+$/, '') + '.wav', { type: 'audio/wav' });
                
                khoi._cleanWavFile = chosenFile;
                khoi._file = chosenFile;
                khoi._useMode = 'clean';

                elSegsList.querySelectorAll('.rec-seg').forEach(s => s.classList.remove('best'));
                item.classList.add('best');

                elTitle.innerHTML = '✓ Đã chọn Đoạn ' + (idx+1) + ':';
                elScore.textContent = 'Điểm: ' + chosenSeg.score.toFixed(1);
                elDetails.textContent = chosenSeg.start.toFixed(1) + 's → ' + chosenSeg.end.toFixed(1) + 's (' + chosenSeg.dur.toFixed(1) + 's)';

                const newCleanUrl = URL.createObjectURL(chosenBlob);
                btnPlayClean.onclick = function(){
                  const a = new Audio(newCleanUrl);
                  window.AudioManager.play(a, btnPlayClean);
                };

                toast('Đã chọn Đoạn ' + (idx+1) + ' (' + chosenSeg.dur.toFixed(1) + 's) làm clip mẫu');
              });
            });

            // Gán sự kiện nghe từng đoạn
            elSegsList.querySelectorAll('[data-upseg-play]').forEach(pBtn => {
              pBtn.addEventListener('click', function(e){
                e.stopPropagation();
                const idx = parseInt(pBtn.dataset.upsegPlay);
                const b = vadRes.createWavBlob(vadRes.segments[idx]);
                const u = URL.createObjectURL(b);
                const a = new Audio(u);
                a.onended = function(){ URL.revokeObjectURL(u); };
                window.AudioManager.play(a, pBtn);
              });
            });
          }

          toast('✓ Đã tải file & tự động chọn đoạn sạch nhất (' + vadRes.bestSegment.dur.toFixed(1) + 's)!');
        } else {
          khoi._file = fullWavFile;
          khoi._useMode = 'original';
          elTitle.textContent = '✓ Âm thanh chuẩn:';
          elDetails.textContent = 'Thời lượng: ' + vadRes.duration.toFixed(1) + 's · Sẵn sàng nhân bản giọng';
          toast('✓ Đã nạp clip mẫu thành công!');
        }
      } catch(err){
        console.error('Lỗi phân tích VAD:', err);
        elDetails.textContent = 'Lỗi phân tích: ' + err.message;
        toast('Lỗi phân tích VAD: ' + err.message, true);
      }
    }

    btnReanalyze.onclick = chayPhanTichVad;
    chayPhanTichVad();
  }
}

// lịch sử
$$('[data-clear]').forEach(b=>b.addEventListener('click',()=>{
  if(!history.length){ toast('Lịch sử hiện đang trống'); return; }
  if(!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử các tệp âm thanh đã tạo?')) return;
  history.forEach(h=>{ if(h&&h.url) URL.revokeObjectURL(h.url); });
  history.length=0;
  veLichSu();
  toast('Đã xoá toàn bộ lịch sử âm thanh');
}));

// tab
let currentTab = 'tts';
let previousTab = 'tts';

function changeTab(tab){
  if(tab === 'ketnoi' && currentTab === 'ketnoi'){
    tab = previousTab || 'tts';
  }
  if(tab !== 'ketnoi') previousTab = tab;
  currentTab = tab;

  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $$('.config').forEach(b => {
    if(!b.classList.contains('small')) {
      b.style.background = (tab === 'ketnoi') ? 'var(--yellow)' : 'var(--panel)';
    }
  });
  ['tts','dialogue','clone','design','thuvien','ketnoi'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      const isTarget = (id === tab);
      el.classList.toggle('hidden', !isTarget);
      if(isTarget){
        el.classList.remove('tab-enter');
        void el.offsetWidth;
        el.classList.add('tab-enter');
      }
    }
  });
  const a=document.querySelector('.tab.active');if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest',inline:'center'});
  if(tab==='thuvien'&&cfg.url)taiThuVien();
}
$$('.tab').forEach(b=>b.addEventListener('click',()=>changeTab(b.dataset.tab)));
// tab đang chọn phải nhìn thấy trên màn hẹp ngay khi mở trang
(() => { const a = document.querySelector('.tab.active'); if (a && a.scrollIntoView) a.scrollIntoView({block:'nearest', inline:'center'}); })();

// ───────────── KHỞI CHẠY ỨNG DỤNG (STARTUP) ─────────────
document.addEventListener('DOMContentLoaded', function(){
  // 1. Gán sự kiện bộ tinh chỉnh DSP
  const pInp = document.getElementById('tunePitch');
  const pOut = document.getElementById('tunePitchV');
  if(pInp && pOut){
    pInp.addEventListener('input', () => {
      const v = parseInt(pInp.value);
      pOut.textContent = (v === 0) ? '0 st (Chuẩn)' : ((v > 0 ? '+' : '') + v + ' st (' + (v > 0 ? 'Thanh cao' : 'Trầm ấm') + ')');
      if(typeof capNhatDspNotePlaceholder === 'function') capNhatDspNotePlaceholder();
      if(isDspPlaying && dspSource) dspSource.detune.value = v * 100;
    });
  }

  const sInp = document.getElementById('tuneSpeed');
  const sOut = document.getElementById('tuneSpeedV');
  if(sInp && sOut){
    sInp.addEventListener('input', () => {
      const v = parseFloat(sInp.value).toFixed(2);
      sOut.textContent = v + 'x';
      if(typeof capNhatDspNotePlaceholder === 'function') capNhatDspNotePlaceholder();
      if(isDspPlaying && dspSource) dspSource.playbackRate.value = parseFloat(v);
    });
  }

  const bInp = document.getElementById('tuneBass');
  const bOut = document.getElementById('tuneBassV');
  if(bInp && bOut){
    bInp.addEventListener('input', () => {
      const v = parseInt(bInp.value);
      bOut.textContent = (v === 0) ? '0 dB (Tự nhiên)' : ('+' + v + ' dB (' + (v >= 5 ? 'Rất đầm tiếng' : 'Ấm áp') + ')');
      if(typeof capNhatDspNotePlaceholder === 'function') capNhatDspNotePlaceholder();
      if(isDspPlaying && dspBassFilter) dspBassFilter.gain.value = v;
    });
  }

  const btnTunePreview = document.getElementById('btnTunePreview');
  if(btnTunePreview) btnTunePreview.addEventListener('click', toggleNgheThuDsp);

  const btnTuneReset = document.getElementById('btnTuneReset');
  if(btnTuneReset) btnTuneReset.addEventListener('click', datLaiDsp);

  const btnTuneDownload = document.getElementById('btnTuneDownload');
  if(btnTuneDownload) btnTuneDownload.addEventListener('click', taiWavDaTinhChinh);

  const btnSave = $('#btnSaveVoice');
  if(btnSave) btnSave.addEventListener('click', luuGiongClone);

  const inpSave = $('#saveVoiceName');
  if(inpSave) inpSave.addEventListener('keydown', function(e){ if(e.key === 'Enter') luuGiongClone(); });

  // 2. Startup logic
  
capNhatInstruct();
dienOC();veTabKetNoi();
veChonGiong();veThuVien();
capNhatHienThiThietBi(localDeviceChoice, isKaggleConnected());
if(cfg.url){
  taiThuVien();
  kiemTraCauHinhMay();
}
tuDongKetNoiCucBo();
kiemTra(true);
setInterval(()=>kiemTra(true),30000);
});
