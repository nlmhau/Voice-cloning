// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - FILE MANAGER & HISTORY (UI/js/file-manager.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── CHỌN THƯ MỤC VÀ TẢI TỆP VỀ MÁY ─────────────
let curMasterWavBlob = null;

async function taiTepChonThuMuc(blobOrText, defaultName, fileTypeDesc, mimeType, fileExt){
  if(window.showSaveFilePicker){
    try {
      const opts = {
        suggestedName: defaultName,
        types: [{
          description: fileTypeDesc || 'Tệp',
          accept: { [mimeType]: ['.' + fileExt] }
        }]
      };
      const handle = await window.showSaveFilePicker(opts);
      const writable = await handle.createWritable();
      await writable.write(blobOrText);
      await writable.close();
      toast('✓ Đã lưu thành công: ' + handle.name);
      return;
    } catch(err){
      if(err.name === 'AbortError') return; // Người dùng hủy chọn
      console.warn('showSaveFilePicker fallback:', err);
    }
  }

  // Fallback tải chuẩn qua trình duyệt
  const blob = (typeof blobOrText === 'string') 
    ? new Blob([blobOrText], { type: mimeType + ';charset=utf-8' })
    : blobOrText;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Đang tải tệp: ' + defaultName);
}

async function taiTronBoVaoThuMuc(blobWav, textContent, srtContent, baseName){
  const prefix = baseName || ('omdiom-' + Date.now());
  if(window.showDirectoryPicker){
    try {
      const dirHandle = await window.showDirectoryPicker();
      
      // 1. Lưu file WAV
      if(blobWav){
        const fWav = await dirHandle.getFileHandle(prefix + '.wav', { create: true });
        const wr = await fWav.createWritable();
        await wr.write(blobWav);
        await wr.close();
      }

      // 2. Lưu file TXT
      if(textContent){
        const fTxt = await dirHandle.getFileHandle(prefix + '.txt', { create: true });
        const wr = await fTxt.createWritable();
        await wr.write(textContent);
        await wr.close();
      }

      // 3. Lưu file SRT
      if(srtContent){
        const fSrt = await dirHandle.getFileHandle(prefix + '.srt', { create: true });
        const wr = await fSrt.createWritable();
        await wr.write(srtContent);
        await wr.close();
      }

      toast('✓ Đã lưu trọn bộ 3 tệp (.WAV, .TXT, .SRT) vào thư mục: ' + dirHandle.name);
      return;
    } catch(err){
      if(err.name === 'AbortError') return;
      console.warn('showDirectoryPicker fallback:', err);
    }
  }

  // Fallback lần lượt tải 3 tệp nếu trình duyệt không hỗ trợ chọn cả thư mục
  if(blobWav) await taiTepChonThuMuc(blobWav, prefix + '.wav', 'Tệp âm thanh WAV', 'audio/wav', 'wav');
  if(textContent) await taiTepChonThuMuc(textContent, prefix + '.txt', 'Tệp văn bản TXT', 'text/plain', 'txt');
  if(srtContent) await taiTepChonThuMuc(srtContent, prefix + '.srt', 'Tệp phụ đề SRT', 'text/plain', 'srt');
}


// ═══════════════════════════════════════════════════════════════
// GLOBAL AUDIO MANAGER — BỘ QUẢN LÝ ÂM THANH TOÀN CỤC (SINGLETON)
// Đảm bảo trong toàn hệ thống CHỈ CÓ DUY NHẤT 1 ÂM THANH ĐƯỢC PHÁT
// ═══════════════════════════════════════════════════════════════
window.AudioManager = {
  currentAudio: null,
  currentController: null,

  stopAll: function() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if (this.currentController && typeof this.currentController.onStop === 'function') {
      try { this.currentController.onStop(); } catch (e) {}
      this.currentController = null;
    }

    // Reset toàn bộ các hộp player
    document.querySelectorAll('[data-box]').forEach(function(b) {
      if (b._audio) {
        try {
          b._audio.pause();
        } catch (e) {}
      }
      b.classList.remove('playing');
      const btn = b.querySelector('[data-play]');
      if (btn) {
        btn.innerHTML = '▶';
        btn.title = 'Phát âm thanh';
        btn.classList.remove('is-playing');
      }
    });

    // Reset các nút "Nghe" trong bảng lịch sử
    document.querySelectorAll('[data-nghe]').forEach(function(btn) {
      btn._isPlaying = false;
      btn.innerHTML = '▶ Nghe';
      btn.style.background = '';
      btn.style.color = '';
    });

    // Dừng DSP preview nếu đang chạy
    if (typeof window.dungDspPreview === 'function') {
      window.dungDspPreview();
    }
  },

  play: function(audioEl, controller) {
    if (!audioEl) return false;

    // Nếu chính audio này đang chạy -> Bấm lần 2 sẽ DỪNG NGAY (Toggle)
    if (this.currentAudio === audioEl && !audioEl.paused) {
      this.stopAll();
      return false;
    }

    // Dừng tất cả âm thanh trước đó
    this.stopAll();

    this.currentAudio = audioEl;
    this.currentController = controller || null;

    audioEl.play().catch(function(e) {
      console.warn('Audio playback error:', e);
    });
    return true;
  }
};

// ───────────── hộp âm thanh ─────────────

function fmt(s){if(!isFinite(s))return '0:00';const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+String(x).padStart(2,'0')}
function hopCua(el){return el.closest('.left')||document}

function ganAudio(khoi,blob,nhan){
  const box=khoi.querySelector('[data-box]');
  const btnPlay=box.querySelector('[data-play]');
  const elTime=box.querySelector('[data-time]');
  const elState=box.querySelector('[data-state]');
  const elWave=box.querySelector('[data-wave]');
  const btnDl=khoi.querySelector('[data-dl]');

  // Dừng ngay audio cũ nếu đang có trong box này
  if(box._audio){
    try {
      box._audio.pause();
      box._audio.currentTime = 0;
    } catch(e) {}
  }
  if(box._url) URL.revokeObjectURL(box._url);

  const url=URL.createObjectURL(blob);
  box._url=url;
  const audio=new Audio(url);
  box._audio=audio;

  taoSong(elWave,90);
  veSongThuc(elWave,blob);
  elState.textContent=nhan;
  elTime.textContent='0:00 / 0:00';
  btnDl.disabled=false;
  box._blob=blob;

  audio.addEventListener('loadedmetadata',()=>{
    elTime.textContent='0:00 / '+fmt(audio.duration);
  });
  audio.addEventListener('timeupdate',()=>{
    elTime.textContent=fmt(audio.currentTime)+' / '+fmt(audio.duration);
  });

  // Khi audio phát: Đổi nút sang ⏹ DỪNG với màu đỏ nổi bật
  audio.addEventListener('play',()=>{
    btnPlay.innerHTML='⏹';
    btnPlay.title='Dừng âm thanh';
    btnPlay.classList.add('is-playing');
    box.classList.add('playing');
  });

  // Khi audio tạm dừng hoặc kết thúc: Đổi nút về ▶
  audio.addEventListener('pause',()=>{
    btnPlay.innerHTML='▶';
    btnPlay.title='Phát âm thanh';
    btnPlay.classList.remove('is-playing');
    box.classList.remove('playing');
  });

  audio.addEventListener('ended',()=>{
    btnPlay.innerHTML='▶';
    btnPlay.title='Phát âm thanh';
    btnPlay.classList.remove('is-playing');
    box.classList.remove('playing');
    if(window.AudioManager && window.AudioManager.currentAudio === audio){
      window.AudioManager.currentAudio = null;
    }
  });

  // Bấm nút play: Nếu đang chạy -> DỪNG NGAY. Nếu đang tắt -> PHÁT (và dập tắt các âm thanh khác)
  btnPlay.onclick=()=>{
    window.AudioManager.play(audio, {
      onStop: function() {
        btnPlay.innerHTML='▶';
        btnPlay.title='Phát âm thanh';
        btnPlay.classList.remove('is-playing');
        box.classList.remove('playing');
      }
    });
  };

  btnDl.onclick=()=>taiTepChonThuMuc(box._blob||blob, 'omdiom-'+Date.now()+'.wav', 'Tệp âm thanh WAV', 'audio/wav', 'wav');

  elWave.onclick=(e)=>{
    const r=elWave.getBoundingClientRect();
    const newTime = ((e.clientX-r.left)/r.width)*(audio.duration||0);
    audio.currentTime = newTime;
    if(audio.paused){
      window.AudioManager.play(audio);
    }
  };
}

// ───────────── thống kê + lịch sử ─────────────
function dienThongKe(khoi,d){
  const g=k=>khoi.querySelector('[data-m="'+k+'"]');
  if(g('dur'))g('dur').textContent=d.duration?d.duration.toFixed(2)+'s':'—';
  if(g('gen'))g('gen').textContent=d.genTime?d.genTime.toFixed(2)+'s':'—';
  if(g('rtf'))g('rtf').textContent=d.rtf?d.rtf.toFixed(2):'—';
}
function veLichSu(){
  const bodies=$$('[data-hist]');
  if(!history.length){bodies.forEach(b=>b.innerHTML='<tr><td colspan="5" class="empty">Chưa có kết quả nào.</td></tr>');return}
  const html=history.slice(0,15).map(function(h,i){
    const hasTxt = Boolean(h.txt);
    const hasSrt = Boolean(h.srt);
    return '<tr><td>'+h.gio+'</td><td>'+h.che+'</td><td>'+h.ts+'</td><td>'+(h.dur?h.dur.toFixed(2)+'s':'—')+'</td><td>'+
      '<div class="act-group">'+
        '<button class="mini" data-nghe="'+i+'" title="Nghe lại âm thanh này">▶ Nghe</button>'+
        '<button class="mini mini-dl" data-hdl="'+i+'" title="Tải xuống tệp WAV">↓ WAV</button>'+
        (hasTxt ? '<button class="mini mini-txt" data-htxt="'+i+'" title="Tải tệp văn bản .TXT">↓ TXT</button>' : '')+
        (hasSrt ? '<button class="mini mini-srt" data-hsrt="'+i+'" title="Tải tệp phụ đề .SRT">↓ SRT</button>' : '')+
        '<button class="mini mini-del" data-hxoa="'+i+'" title="Xóa kết quả này">✕</button>'+
      '</div></td></tr>';
  }).join('');
  bodies.forEach(b=>b.innerHTML=html);
  
  // Gán sự kiện Nghe từng file trong lịch sử
  $$('[data-nghe]').forEach(btn=>{btn.onclick=()=>{
    const idx = +btn.dataset.nghe;
    const h = history[idx];
    if(!h || !h.url) return;

    // Nếu chính nút này đang phát -> Bấm lần 2 sẽ DỪNG LẠI NGAY
    if(btn._isPlaying){
      window.AudioManager.stopAll();
      return;
    }

    // Dừng tất cả âm thanh khác
    window.AudioManager.stopAll();

    const a = new Audio(h.url);
    btn._isPlaying = true;
    btn.innerHTML = '⏹ Dừng';
    btn.style.background = '#ffcaca';
    btn.style.color = '#991b1b';

    a.onended = function() {
      btn._isPlaying = false;
      btn.innerHTML = '▶ Nghe';
      btn.style.background = '';
      btn.style.color = '';
      if(window.AudioManager && window.AudioManager.currentAudio === a){
        window.AudioManager.currentAudio = null;
      }
    };

    window.AudioManager.play(a, {
      onStop: function() {
        btn._isPlaying = false;
        btn.innerHTML = '▶ Nghe';
        btn.style.background = '';
        btn.style.color = '';
      }
    });

    toast('Đang phát: ' + (h.che || 'Âm thanh'));
  }});

  // Gán sự kiện Tải từng file riêng (có chọn thư mục)
  $$('[data-hdl]').forEach(btn=>{btn.onclick=async()=>{
    const h=history[+btn.dataset.hdl];
    if(h&&h.url){
      const safeChe=(h.che||'am_thanh').replace(/[^a-zA-Z0-9_À-ɏẠ-ỹ-]/g,'_');
      try {
        const res = await fetch(h.url);
        const bl = await res.blob();
        await taiTepChonThuMuc(bl, 'omdiom-'+safeChe+'-'+Date.now()+'.wav', 'Tệp âm thanh WAV', 'audio/wav', 'wav');
      } catch(_) {
        const a=document.createElement('a');a.href=h.url;a.download='omdiom-'+safeChe+'-'+Date.now()+'.wav';a.click();
      }
    }
  }});

  // Gán sự kiện Tải TXT từ lịch sử (có chọn thư mục)
  $$('[data-htxt]').forEach(btn=>{btn.onclick=()=>{
    const h=history[+btn.dataset.htxt];
    if(h&&h.txt){
      taiTepChonThuMuc(h.txt, 'omdiom-van-ban-'+Date.now()+'.txt', 'Tệp văn bản TXT', 'text/plain', 'txt');
    }
  }});

  // Gán sự kiện Tải SRT từ lịch sử (có chọn thư mục)
  $$('[data-hsrt]').forEach(btn=>{btn.onclick=()=>{
    const h=history[+btn.dataset.hsrt];
    if(h&&h.srt){
      taiTepChonThuMuc(h.srt, 'omdiom-phu-de-'+Date.now()+'.srt', 'Tệp phụ đề SRT', 'text/plain', 'srt');
    }
  }});

  // Gán sự kiện Xóa từng file riêng
  $$('[data-hxoa]').forEach(btn=>{btn.onclick=()=>{
    const idx=+btn.dataset.hxoa;
    if(idx>=0&&idx<history.length){
      const x=history.splice(idx,1)[0];
      if(x&&x.url)URL.revokeObjectURL(x.url);
      veLichSu();
      toast('Đã xoá 1 tệp khỏi lịch sử');
    }
  }});
}


// ═══════════════════════════════════════════════════════════════
// HẠNG 1: QUẢN LÝ DỰ ÁN ÂM THANH (.OMPROJ / JSON)
// ═══════════════════════════════════════════════════════════════

function thuThapDuLieuDuAn(){
  // 1. Tab hiện tại
  const activeTabBtn = document.querySelector('.tabs .tab.active');
  const activeTab = activeTabBtn ? activeTabBtn.dataset.tab : 'tts';

  // 2. Dữ liệu Tab TTS
  const ttsText = document.querySelector('#tts textarea[data-text]')?.value || '';
  const selGiongTts = document.getElementById('selGiongTts')?.value || 'Cao_Hung';
  const tSteps = document.getElementById('tSteps')?.value || '1';
  const tSpeed = document.getElementById('tSpeed')?.value || '1';
  const tGuid = document.getElementById('tGuid')?.value || '2';
  const splitBtn = document.querySelector('#grpSplitMode .segment.selected');
  const splitMode = splitBtn ? splitBtn.dataset.split : 'sentence';
  const pauseSent = document.getElementById('tPauseSent')?.value || '0.5';
  const pausePara = document.getElementById('tPausePara')?.value || '1.0';
  const txtPreview = document.getElementById('txtPreviewArea')?.value || '';
  const srtPreview = document.getElementById('srtPreviewArea')?.value || '';

  // 3. Dữ liệu Tab Clone
  const cloneRefText = document.querySelector('#clone [data-reftext]')?.value || '';
  const cloneText = document.querySelector('#clone textarea[data-text]')?.value || '';
  const cSteps = document.getElementById('cSteps')?.value || '1';
  const cSpeed = document.getElementById('cSpeed')?.value || '1';
  const cGuid = document.getElementById('cGuid')?.value || '2';
  const tunePitch = document.getElementById('tunePitch')?.value || '0';
  const tuneSpeed = document.getElementById('tuneSpeed')?.value || '1.00';
  const tuneBass = document.getElementById('tuneBass')?.value || '0';
  const saveVoiceName = document.getElementById('saveVoiceName')?.value || '';
  const saveVoiceGender = document.getElementById('saveVoiceGender')?.value || '';
  const saveVoiceNote = document.getElementById('saveVoiceNote')?.value || '';

  // 4. Dữ liệu Tab Design
  const designText = document.querySelector('#design textarea[data-text]')?.value || '';
  const dSteps = document.getElementById('dSteps')?.value || '1';
  const dSpeed = document.getElementById('dSpeed')?.value || '1';
  const dGuid = document.getElementById('dGuid')?.value || '2';
  const designGender = document.querySelector('#design [data-group="gender"] .segment.selected')?.dataset.val || 'male';
  const designAge = document.querySelector('#design [data-group="age"] .segment.selected')?.dataset.val || 'young adult';
  const designPitch = document.querySelector('#design [data-group="pitch"] .segment.selected')?.dataset.val || 'moderate pitch';
  const designStyles = Array.from(document.querySelectorAll('#design .style-pill[aria-pressed="true"]')).map(el => el.dataset.val).filter(Boolean);

  // Dữ liệu Tab Dialogue Studio
  const dlgScript = document.getElementById('dialogueScriptText')?.value || '';
  const dlgRoles = (typeof danhSachVai !== 'undefined' && Array.isArray(danhSachVai)) ? JSON.parse(JSON.stringify(danhSachVai)) : [];
  const dlgSteps = document.getElementById('dlgSteps')?.value || '1';
  const dlgSpeed = document.getElementById('dlgSpeed')?.value || '1';
  const dlgPause = document.getElementById('dlgPauseDefault')?.value || '0.6';

  // 5. Lịch sử các câu đã tạo (chỉ lưu metadata và nội dung text, srt)
  const historyData = (Array.isArray(window.history) ? window.history : (typeof history !== 'undefined' && Array.isArray(history) ? history : [])).map(h => ({
    gio: h.gio,
    che: h.che,
    ts: h.ts,
    dur: h.dur,
    txt: h.txt || '',
    srt: h.srt || ''
  }));

  return {
    meta: {
      format: 'omproj',
      app: 'OmDiOm Voice Studio',
      version: '1.0',
      created_at: new Date().toISOString()
    },
    active_tab: activeTab,
    tts: {
      text: ttsText,
      voice_id: selGiongTts,
      num_step_idx: tSteps,
      speed: tSpeed,
      guidance_scale: tGuid,
      split_mode: splitMode,
      pause_sentence: pauseSent,
      pause_paragraph: pausePara,
      txt_preview: txtPreview,
      srt_preview: srtPreview
    },
    clone: {
      ref_text: cloneRefText,
      text: cloneText,
      num_step_idx: cSteps,
      speed: cSpeed,
      guidance_scale: cGuid,
      dsp: {
        pitch: tunePitch,
        speed: tuneSpeed,
        bass: tuneBass
      },
      save_info: {
        name: saveVoiceName,
        gender: saveVoiceGender,
        note: saveVoiceNote
      }
    },
    design: {
      text: designText,
      num_step_idx: dSteps,
      speed: dSpeed,
      guidance_scale: dGuid,
      gender: designGender,
      age: designAge,
      pitch: designPitch,
      styles: designStyles
    },
    dialogue: {
      script: dlgScript,
      roles: dlgRoles,
      num_step_idx: dlgSteps,
      speed: dlgSpeed,
      pause_default: dlgPause
    },
    history: historyData
  };
}

function khoiPhucDuLieuDuAn(proj){
  if(!proj || typeof proj !== 'object'){
    toast('Tệp dự án không hợp lệ!', true);
    return;
  }

  // 1. Khôi phục Tab TTS
  if(proj.tts){
    const t = proj.tts;
    const ttsTa = document.querySelector('#tts textarea[data-text]');
    if(ttsTa && t.text !== undefined){
      ttsTa.value = t.text;
      ttsTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const selG = document.getElementById('selGiongTts');
    if(selG && t.voice_id) selG.value = t.voice_id;

    const tSteps = document.getElementById('tSteps');
    if(tSteps && t.num_step_idx !== undefined){
      tSteps.value = t.num_step_idx;
      tSteps.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const tSpeed = document.getElementById('tSpeed');
    if(tSpeed && t.speed !== undefined){
      tSpeed.value = t.speed;
      tSpeed.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const tGuid = document.getElementById('tGuid');
    if(tGuid && t.guidance_scale !== undefined){
      tGuid.value = t.guidance_scale;
      tGuid.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if(t.split_mode){
      const segs = document.querySelectorAll('#grpSplitMode .segment');
      segs.forEach(s => {
        if(s.dataset.split === t.split_mode) s.classList.add('selected');
        else s.classList.remove('selected');
      });
    }

    const tPauseSent = document.getElementById('tPauseSent');
    if(tPauseSent && t.pause_sentence !== undefined){
      tPauseSent.value = t.pause_sentence;
      tPauseSent.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const tPausePara = document.getElementById('tPausePara');
    if(tPausePara && t.pause_paragraph !== undefined){
      tPausePara.value = t.pause_paragraph;
      tPausePara.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if(t.txt_preview !== undefined){
      const el = document.getElementById('txtPreviewArea');
      if(el) el.value = t.txt_preview;
      curTtsText = t.txt_preview;
      const b = document.getElementById('btnDlTxt');
      if(b && t.txt_preview) b.disabled = false;
    }
    if(t.srt_preview !== undefined){
      const el = document.getElementById('srtPreviewArea');
      if(el) el.value = t.srt_preview;
      curTtsSrt = t.srt_preview;
      const b = document.getElementById('btnDlSrt');
      if(b && t.srt_preview) b.disabled = false;
    }
    if((t.txt_preview || t.srt_preview) && document.getElementById('btnDlAll')){
      document.getElementById('btnDlAll').disabled = false;
    }
  }

  // 2. Khôi phục Tab Clone
  if(proj.clone){
    const c = proj.clone;
    const refTa = document.querySelector('#clone [data-reftext]');
    if(refTa && c.ref_text !== undefined) refTa.value = c.ref_text;
    const cloneTa = document.querySelector('#clone textarea[data-text]');
    if(cloneTa && c.text !== undefined){
      cloneTa.value = c.text;
      cloneTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cSteps = document.getElementById('cSteps');
    if(cSteps && c.num_step_idx !== undefined){
      cSteps.value = c.num_step_idx;
      cSteps.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cSpeed = document.getElementById('cSpeed');
    if(cSpeed && c.speed !== undefined){
      cSpeed.value = c.speed;
      cSpeed.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cGuid = document.getElementById('cGuid');
    if(cGuid && c.guidance_scale !== undefined){
      cGuid.value = c.guidance_scale;
      cGuid.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if(c.dsp){
      const tp = document.getElementById('tunePitch');
      if(tp && c.dsp.pitch !== undefined){
        tp.value = c.dsp.pitch;
        tp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const ts = document.getElementById('tuneSpeed');
      if(ts && c.dsp.speed !== undefined){
        ts.value = c.dsp.speed;
        ts.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const tb = document.getElementById('tuneBass');
      if(tb && c.dsp.bass !== undefined){
        tb.value = c.dsp.bass;
        tb.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    if(c.save_info){
      const sn = document.getElementById('saveVoiceName');
      if(sn && c.save_info.name !== undefined) sn.value = c.save_info.name;
      const sg = document.getElementById('saveVoiceGender');
      if(sg && c.save_info.gender !== undefined) sg.value = c.save_info.gender;
      const so = document.getElementById('saveVoiceNote');
      if(so && c.save_info.note !== undefined) so.value = c.save_info.note;
    }
  }

  // 3. Khôi phục Tab Design
  if(proj.design){
    const d = proj.design;
    const dTa = document.querySelector('#design textarea[data-text]');
    if(dTa && d.text !== undefined){
      dTa.value = d.text;
      dTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const dSteps = document.getElementById('dSteps');
    if(dSteps && d.num_step_idx !== undefined){
      dSteps.value = d.num_step_idx;
      dSteps.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const dSpeed = document.getElementById('dSpeed');
    if(dSpeed && d.speed !== undefined){
      dSpeed.value = d.speed;
      dSpeed.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const dGuid = document.getElementById('dGuid');
    if(dGuid && d.guidance_scale !== undefined){
      dGuid.value = d.guidance_scale;
      dGuid.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if(d.gender){
      document.querySelectorAll('#design [data-group="gender"] .segment').forEach(s => {
        const isSel = (s.dataset.val === d.gender);
        s.classList.toggle('selected', isSel);
        s.setAttribute('aria-pressed', isSel);
      });
    }
    if(d.age){
      document.querySelectorAll('#design [data-group="age"] .segment').forEach(s => {
        const isSel = (s.dataset.val === d.age);
        s.classList.toggle('selected', isSel);
        s.setAttribute('aria-pressed', isSel);
      });
    }
    if(d.pitch){
      document.querySelectorAll('#design [data-group="pitch"] .segment').forEach(s => {
        const isSel = (s.dataset.val === d.pitch);
        s.classList.toggle('selected', isSel);
        s.setAttribute('aria-pressed', isSel);
      });
    }
    if(Array.isArray(d.styles)){
      document.querySelectorAll('#design .style-pill').forEach(btn => {
        const isSel = d.styles.includes(btn.dataset.val);
        btn.setAttribute('aria-pressed', isSel);
      });
    }
    if(typeof capNhatInstruct === 'function') capNhatInstruct();
  }

  // Khôi phục Tab Dialogue Studio
  if(proj.dialogue){
    const dl = proj.dialogue;
    const dlgTa = document.getElementById('dialogueScriptText');
    if(dlgTa && dl.script !== undefined){
      dlgTa.value = dl.script;
      dlgTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if(Array.isArray(dl.roles) && dl.roles.length > 0 && typeof danhSachVai !== 'undefined'){
      danhSachVai = dl.roles;
      if(typeof veDanhSachVai === 'function') veDanhSachVai();
    }
    const sSt = document.getElementById('dlgSteps');
    if(sSt && dl.num_step_idx !== undefined){
      sSt.value = dl.num_step_idx;
      sSt.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const sSp = document.getElementById('dlgSpeed');
    if(sSp && dl.speed !== undefined){
      sSp.value = dl.speed;
      sSp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const sP = document.getElementById('dlgPauseDefault');
    if(sP && dl.pause_default !== undefined){
      sP.value = dl.pause_default;
      sP.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // 4. Khôi phục tab đang mở
  if(proj.active_tab){
    if(typeof changeTab === 'function'){
      changeTab(proj.active_tab);
    } else {
      const tabBtn = document.querySelector('.tabs .tab[data-tab="' + proj.active_tab + '"]');
      if(tabBtn) tabBtn.click();
    }
  }

  const tg = proj.meta?.created_at ? new Date(proj.meta.created_at).toLocaleTimeString('vi-VN') : '';
  toast('✓ Đã khôi phục hoàn tất dự án' + (tg ? ' lúc ' + tg : ''));
}

async function luuDuAnRaTep(){
  const data = thuThapDuLieuDuAn();
  const jsonStr = JSON.stringify(data, null, 2);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '_' + pad(now.getHours()) + 'h' + pad(now.getMinutes());
  const fileName = 'omdiom_du_an_' + dateStr + '.omproj';
  await taiTepChonThuMuc(jsonStr, fileName, 'Tệp dự án OmDiOm (*.omproj)', 'application/json', 'omproj');
}

function moDuAnTuTep(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const proj = JSON.parse(e.target.result);
      khoiPhucDuLieuDuAn(proj);
    } catch(err){
      toast('Lỗi: Tệp không đúng định dạng dự án OmDiOm (.omproj / JSON)', true);
    }
  };
  reader.onerror = function(){
    toast('Lỗi khi đọc tệp dự án từ máy tính!', true);
  };
  reader.readAsText(file, 'utf-8');
}

function khoiTaoQuanLyDuAn(){
  const btnSave = document.getElementById('btnSaveProj');
  const btnLoad = document.getElementById('btnLoadProj');
  const fileInput = document.getElementById('fileProjInput');

  if(btnSave){
    btnSave.addEventListener('click', function(e){
      e.preventDefault();
      luuDuAnRaTep();
    });
  }

  if(btnLoad && fileInput){
    btnLoad.addEventListener('click', function(e){
      e.preventDefault();
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', function(e){
      const file = e.target.files && e.target.files[0];
      if(file) moDuAnTuTep(file);
    });
  }

  // Hỗ trợ kéo thả trực tiếp tệp .omproj vào bất kỳ đâu trên cửa sổ Studio
  window.addEventListener('dragover', function(e){
    e.preventDefault();
  });
  window.addEventListener('drop', function(e){
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if(file && (file.name.endsWith('.omproj') || file.name.endsWith('.json'))){
      e.preventDefault();
      moDuAnTuTep(file);
    }
  });
}

// Khởi chạy bộ quản lý dự án khi DOM sẵn sàng
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', khoiTaoQuanLyDuAn);
} else {
  khoiTaoQuanLyDuAn();
}
