// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - STUDIO PHÂN VAI & ĐỐI THOẠI (UI/js/dialogue-studio.js)
// ═══════════════════════════════════════════════════════════════

let danhSachVai = [
  { id: 'vai_1', ten: 'Người dẫn chuyện', giong: 'Cao_Hung', mau: '#3b82f6' },
  { id: 'vai_2', ten: 'Bác Ba', giong: 'Minh_Quy', mau: '#eab308' },
  { id: 'vai_3', ten: 'Phương Thy', giong: 'Phuong_Thy', mau: '#ec4899' }
];

let curDlgWavBlob = null;
let curDlgText = '';
let curDlgSrt = '';

const DANH_SACH_GIONG_CHUNG = [
  { id: 'Cao_Hung', ten: 'Cao Hùng (Nam lớn tuổi, trầm ấm)' },
  { id: 'Minh_Quy', ten: 'Minh Quý (Nam miền Nam, ấm áp)' },
  { id: 'Phuong_Thy', ten: 'Phương Thy (Nữ dịu dàng, truyền cảm)' },
  { id: 'Minh_Nhi', ten: 'Minh Nhí (Nam hoạt bát, tự nhiên)' },
  { id: 'To_Thanh', ten: 'Tô Thành (Nam đĩnh đạc)' },
  { id: 'Linh_Duc_Tu', ten: 'Linh Dục Tú (Nam giọng trầm)' },
  { id: 'Ut_Linh', ten: 'Út Linh (Giọng nghệ thuật đặc trưng)' }
];

// Lấy danh sách giọng từ thư viện hiện có (kể cả giọng clone)
function layTatCaGiongCoSan(){
  const giongSet = new Map();
  DANH_SACH_GIONG_CHUNG.forEach(g => giongSet.set(g.id, g.ten));

  const selTts = document.getElementById('selGiongTts');
  if(selTts && selTts.options){
    for(let i = 0; i < selTts.options.length; i++){
      const opt = selTts.options[i];
      if(opt.value && !giongSet.has(opt.value)){
        giongSet.set(opt.value, opt.text);
      }
    }
  }
  return Array.from(giongSet.entries()).map(([id, ten]) => ({ id, ten }));
}

// ───────────── RENDER DÀN DIỄN VIÊN / DANH SÁCH VAI ─────────────
function veDanhSachVai(){
  const box = document.getElementById('danhSachVaiContainer');
  if(!box) return;

  const tatCaGiong = layTatCaGiongCoSan();

  box.innerHTML = danhSachVai.map((vai, idx) => {
    const optionsHtml = tatCaGiong.map(g => {
      const isSel = (g.id === vai.giong) ? 'selected' : '';
      return `<option value="${g.id}" ${isSel}>${g.ten}</option>`;
    }).join('');

    return `
      <div class="vai-item" data-idx="${idx}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#fffdf4;border:var(--line);border-radius:6px">
        <span style="font-weight:900;font-size:12px;color:${vai.mau};min-width:20px">${idx + 1}.</span>
        <div style="flex:1">
          <input type="text" class="inp-ten-vai" data-idx="${idx}" value="${vai.ten}" placeholder="Tên nhân vật..." style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:5px;padding:0 8px;font-weight:700;font-size:12px">
        </div>
        <div style="flex:1.5">
          <select class="sel-giong-vai" data-idx="${idx}" style="width:100%;height:32px;border:1px solid #cbd5e1;border-radius:5px;padding:0 6px;font-size:11.5px">
            ${optionsHtml}
          </select>
        </div>
        ${danhSachVai.length > 1 ? `<button type="button" class="btn small mini-del btn-xoa-vai" data-idx="${idx}" title="Xóa nhân vật này" style="height:32px;padding:0 8px">✕</button>` : ''}
      </div>
    `;
  }).join('');

  // Gán sự kiện thay đổi tên & giọng
  box.querySelectorAll('.inp-ten-vai').forEach(inp => {
    inp.addEventListener('input', function(){
      const i = parseInt(this.dataset.idx);
      if(danhSachVai[i]){
        danhSachVai[i].ten = this.value.trim() || ('Nhân vật ' + (i + 1));
        veThanhCongCuKichBan();
      }
    });
  });

  box.querySelectorAll('.sel-giong-vai').forEach(sel => {
    sel.addEventListener('change', function(){
      const i = parseInt(this.dataset.idx);
      if(danhSachVai[i]){
        danhSachVai[i].giong = this.value;
      }
    });
  });

  box.querySelectorAll('.btn-xoa-vai').forEach(btn => {
    btn.addEventListener('click', function(){
      const i = parseInt(this.dataset.idx);
      if(danhSachVai.length > 1){
        danhSachVai.splice(i, 1);
        veDanhSachVai();
        veThanhCongCuKichBan();
      }
    });
  });

  veThanhCongCuKichBan();
}

// ───────────── RENDER NÚT CHÈN NHANH VAI DIỄN ─────────────
function veThanhCongCuKichBan(){
  const btnGroup = document.getElementById('quickRoleButtons');
  if(!btnGroup) return;

  btnGroup.innerHTML = danhSachVai.map((vai) => {
    return `
      <button type="button" class="btn small btn-chen-vai" data-role="${vai.ten}" style="background:#f1f5f9;border:1.5px solid #64748b;border-radius:5px;font-size:11.5px;font-weight:700;display:flex;align-items:center;gap:4px">
        <span style="color:${vai.mau}">●</span> + [${vai.ten}]
      </button>
    `;
  }).join('');

  btnGroup.querySelectorAll('.btn-chen-vai').forEach(btn => {
    btn.addEventListener('click', function(e){
      e.preventDefault();
      const roleName = this.dataset.role;
      chenVaoKichBan(`[${roleName}]: `);
    });
  });
}

function chenVaoKichBan(textToInsert){
  const ta = document.getElementById('dialogueScriptText');
  if(!ta) return;

  const start = ta.selectionStart || 0;
  const end = ta.selectionEnd || 0;
  const val = ta.value || '';

  const before = val.substring(0, start);
  const after = val.substring(end);
  const needNewline = (start > 0 && !before.endsWith('\n'));

  const ins = (needNewline ? '\n' : '') + textToInsert;
  ta.value = before + ins + after;

  const newPos = start + ins.length;
  ta.selectionStart = newPos;
  ta.selectionEnd = newPos;
  ta.focus();

  ta.dispatchEvent(new Event('input', { bubbles: true }));
  const countEl = document.getElementById('dialogueCount');
  if(countEl) countEl.textContent = ta.value.length;
}

// ───────────── LOG TERMINAL KỊCH BẢN ─────────────
function logTermDlg(tag, msg, type){
  const box = document.getElementById('dlgTerminal');
  if(!box) return;
  const now = new Date().toTimeString().split(' ')[0];
  const line = document.createElement('div');
  line.className = 'term-line';
  let tagCls = 'term-tag';
  if(type === 'ok') tagCls += ' term-ok';
  else if(type === 'accent') tagCls += ' term-accent';
  else if(type === 'err') tagCls += ' term-err';
  line.innerHTML = `<span class="term-dim">${now}</span> <span class="${tagCls}">[${tag}]</span> <span>${msg}</span>`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearTermDlg(){
  const box = document.getElementById('dlgTerminal');
  if(box) box.innerHTML = '';
}

// ───────────── PHÂN TÍCH KỊCH BẢN (SCRIPT PARSER) ─────────────
function phanTichKichBan(rawText, defaultPause){
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cues = [];
  let currentRole = danhSachVai[0];

  for(let line of lines){
    // Kiểm tra dòng khoảng nghỉ độc lập dạng: [nghỉ: 1.2s] hoặc [nghỉ: 500ms]
    const pauseMatch = line.match(/^\[nghỉ:\s*([0-9.]+)\s*(s|ms)?\]$/i);
    if(pauseMatch){
      let sec = parseFloat(pauseMatch[1]);
      if(pauseMatch[2] && pauseMatch[2].toLowerCase() === 'ms') sec = sec / 1000;
      cues.push({
        type: 'pause',
        sec: Math.max(0.1, Math.min(5.0, sec)),
        text: `[Khoảng nghỉ: ${sec.toFixed(2)}s]`
      });
      continue;
    }

    // Kiểm tra dòng có gắn nhãn vai diễn: [Tên vai]: nội dung HOẶC Tên vai: nội dung
    let roleFound = null;
    let content = line;

    // 1. Dạng [Tên vai]: ...
    const tagMatch = line.match(/^\[([^\]]+)\]\s*:\s*(.+)$/);
    if(tagMatch){
      const roleName = tagMatch[1].trim().toLowerCase();
      roleFound = danhSachVai.find(v => v.ten.toLowerCase() === roleName);
      content = tagMatch[2].trim();
    } else {
      // 2. Dạng Tên vai: ...
      const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
      if(colonMatch){
        const roleName = colonMatch[1].trim().toLowerCase();
        roleFound = danhSachVai.find(v => v.ten.toLowerCase() === roleName);
        if(roleFound) content = colonMatch[2].trim();
      }
    }

    if(roleFound){
      currentRole = roleFound;
    }

    // Tách các đoạn nhỏ nếu trong lời thoại có chèn [nghỉ: Xs]
    const subParts = content.split(/(\[nghỉ:\s*[0-9.]+\s*(?:s|ms)?\])/i);
    for(let part of subParts){
      part = part.trim();
      if(!part) continue;

      const subPauseMatch = part.match(/^\[nghỉ:\s*([0-9.]+)\s*(s|ms)?\]$/i);
      if(subPauseMatch){
        let sec = parseFloat(subPauseMatch[1]);
        if(subPauseMatch[2] && subPauseMatch[2].toLowerCase() === 'ms') sec = sec / 1000;
        cues.push({
          type: 'pause',
          sec: Math.max(0.1, Math.min(5.0, sec)),
          text: `[Khoảng nghỉ: ${sec.toFixed(2)}s]`
        });
      } else {
        cues.push({
          type: 'dialogue',
          roleName: currentRole.ten,
          voiceId: currentRole.giong,
          text: part,
          pauseAfter: defaultPause
        });
      }
    }
  }

  return cues;
}

// ───────────── CHẠY TỔNG HỢP KỊCH BẢN ĐỐI THOẠI ─────────────
async function chayKichBanDoiThoai(){
  const ta = document.getElementById('dialogueScriptText');
  const rawText = (ta?.value || '').trim();
  if(!rawText){
    toast('Vui lòng nhập kịch bản đối thoại trước khi tạo!', true);
    ta?.focus();
    return;
  }

  const btn = document.getElementById('btnRunDialogue');
  const origBtnText = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('is-generating');

  const dlgPauseDefault = parseFloat(document.getElementById('dlgPauseDefault')?.value || '0.6');
  const dlgSteps = document.getElementById('dlgSteps')?.value || '1';
  const num_step = (typeof STEPS !== 'undefined' && STEPS[+dlgSteps]) ? STEPS[+dlgSteps] : 16;
  const speed = parseFloat(document.getElementById('dlgSpeed')?.value || '1.0');

  const cues = phanTichKichBan(rawText, dlgPauseDefault);
  if(!cues.length){
    toast('Không tìm thấy lời thoại hợp lệ trong kịch bản!', true);
    btn.disabled = false;
    return;
  }

  clearTermDlg();
  logTermDlg('KỊCH BẢN', `Phát hiện ${cues.length} phân đoạn thoại · Dàn diễn viên: ${danhSachVai.map(v => v.ten).join(', ')}`, 'accent');

  // Giao diện tiến trình
  const progBox = document.getElementById('dlgProgBox');
  const audioBox = document.getElementById('dlgAudioBox');
  const progFill = document.getElementById('dlgProgFill');
  const progStatus = document.getElementById('dlgProgStatus');
  const progTimer = document.getElementById('dlgProgTimer');
  const progStep = document.getElementById('dlgProgStep');
  const circleVal = document.getElementById('dlgCircleVal');
  const circleText = document.getElementById('dlgCircleText');

  if(audioBox) audioBox.style.display = 'none';
  if(progBox) progBox.style.display = 'flex';

  const t0 = performance.now();
  const chuVi = 251.3;
  function updateProgress(percent, statusMsg, stepMsg){
    const p = Math.max(0, Math.min(100, percent));
    if(progFill) progFill.style.width = p + '%';
    if(circleVal) circleVal.style.strokeDashoffset = chuVi - (p / 100) * chuVi;
    if(circleText) circleText.textContent = Math.round(p) + '%';
    if(progStatus && statusMsg) progStatus.textContent = statusMsg;
    if(progStep && stepMsg) progStep.textContent = stepMsg;
    btn.innerHTML = `◌ &nbsp;<b>${Math.round(p)}%</b> &nbsp;Đang tạo thoại...`;
  }

  const timerInterval = setInterval(() => {
    const elapsed = (performance.now() - t0) / 1000;
    if(progTimer) progTimer.textContent = elapsed.toFixed(1) + 's';
  }, 100);

  const AC = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AC();
  const pcmBuffers = [];
  const subtitleEntries = [];
  let curTime = 0.0;
  let totalGenTime = 0.0;
  let sampleRate = 24000;

  try {
    for(let i = 0; i < cues.length; i++){
      const cue = cues[i];
      const percent = ((i + 0.2) / cues.length) * 90;

      if(cue.type === 'pause'){
        updateProgress(percent, `Chèn khoảng lặng ${cue.sec.toFixed(2)}s...`, `Phân đoạn ${i + 1}/${cues.length}`);
        logTermDlg('NGHỈ', `⏱️ Khoảng lặng ${cue.sec.toFixed(2)}s tại mốc ${curTime.toFixed(2)}s`);
        const pauseSamples = Math.floor(sampleRate * cue.sec);
        pcmBuffers.push(new Float32Array(pauseSamples));
        curTime += cue.sec;
        continue;
      }

      // Xử lý lời thoại
      const shortText = cue.text.length > 40 ? cue.text.substring(0, 37) + '...' : cue.text;
      updateProgress(percent, `[${cue.roleName}] nói: "${shortText}"`, `Phân đoạn ${i + 1}/${cues.length}`);
      logTermDlg(`THOẠI ${i + 1}/${cues.length}`, `[${cue.roleName}] (${cue.voiceId}): "${shortText}"`);

      const textGuiModel = (typeof chuyenTheVnSangOmni === 'function') ? chuyenTheVnSangOmni(cue.text) : cue.text;

      const fd = new FormData();
      fd.append('text', textGuiModel);
      fd.append('voice_id', cue.voiceId);
      fd.append('num_step', String(num_step));
      fd.append('speed', String(speed));
      fd.append('guidance_scale', '2.0');
      fd.append('split_mode', 'none');

      const d = await goiApi('/api/tts', fd);
      totalGenTime += d.genTime;

      // Giải mã PCM
      const arrBuf = await d.blob.arrayBuffer();
      const aBuf = await audioCtx.decodeAudioData(arrBuf);
      sampleRate = aBuf.sampleRate;
      const pcmData = aBuf.getChannelData(0);
      pcmBuffers.push(pcmData);

      const chunkDur = aBuf.duration;
      const startTime = curTime;
      const endTime = curTime + chunkDur;

      subtitleEntries.push({
        start: startTime,
        end: endTime,
        text: `[${cue.roleName}]: ${cue.text}`
      });

      const rtf = chunkDur > 0 ? (d.genTime / chunkDur) : 0;
      logTermDlg(`XONG ${i + 1}/${cues.length}`, `✓ Xong trong ${d.genTime.toFixed(2)}s | Âm thanh: ${chunkDur.toFixed(2)}s | RTF: ${rtf.toFixed(2)}`, 'ok');

      curTime = endTime;

      // Thêm khoảng nghỉ tự nhiên giữa các lượt thoại
      if(i < cues.length - 1 && cues[i + 1].type !== 'pause' && cue.pauseAfter > 0){
        const pauseSamples = Math.floor(sampleRate * cue.pauseAfter);
        pcmBuffers.push(new Float32Array(pauseSamples));
        curTime += cue.pauseAfter;
      }
    }

    // Ghép toàn bộ PCM
    logTermDlg('HẬU KỲ', `Đang kết nối ${pcmBuffers.length} khối âm thanh và phụ đề phân vai...`, 'accent');
    updateProgress(96, 'Đang xuất tệp âm thanh hoàn chỉnh...', 'Bước cuối · Đóng gói WAV');

    const totalSamples = pcmBuffers.reduce((acc, b) => acc + b.length, 0);
    const mergedPcm = new Float32Array(totalSamples);
    let offset = 0;
    for(const b of pcmBuffers){
      mergedPcm.set(b, offset);
      offset += b.length;
    }

    // Encode WAV 16-bit
    const wavBuf = new ArrayBuffer(44 + mergedPcm.length * 2);
    const view = new DataView(wavBuf);
    function writeStr(off, s){ for(let i=0;i<s.length;i++) view.setUint8(off+i, s.charCodeAt(i)); }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + mergedPcm.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, mergedPcm.length * 2, true);
    for(let i = 0; i < mergedPcm.length; i++){
      const s16 = Math.max(-1, Math.min(1, mergedPcm[i])) * 32767;
      view.setInt16(44 + i * 2, s16, true);
    }
    const masterBlob = new Blob([wavBuf], { type: 'audio/wav' });

    const totalDur = curTime;
    const avgRtf = totalDur > 0 ? (totalGenTime / totalDur) : 0;

    curDlgWavBlob = masterBlob;
    curDlgText = rawText;
    curDlgSrt = typeof taoNoiDungSrt === 'function' ? taoNoiDungSrt(subtitleEntries) : '';

    // Cập nhật ô xem trước
    const txtArea = document.getElementById('dlgTxtPreviewArea');
    const srtArea = document.getElementById('dlgSrtPreviewArea');
    if(txtArea) txtArea.value = curDlgText;
    if(srtArea) srtArea.value = curDlgSrt;

    // Cập nhật thống kê
    const elDur = document.getElementById('dlgDur');
    const elGen = document.getElementById('dlgGen');
    const elRtf = document.getElementById('dlgRtf');
    if(elDur) elDur.textContent = totalDur.toFixed(2) + 's';
    if(elGen) elGen.textContent = totalGenTime.toFixed(2) + 's';
    if(elRtf) elRtf.textContent = avgRtf.toFixed(2);

    // Kích hoạt các nút tải
    ['btnDlDlgWav', 'btnDlDlgTxt', 'btnDlDlgSrt', 'btnDlDlgAll'].forEach(id => {
      const b = document.getElementById(id);
      if(b) b.disabled = false;
    });

    logTermDlg('HOÀN TẤT', `★ Tổng thời lượng: ${totalDur.toFixed(2)}s | Thời gian sinh: ${totalGenTime.toFixed(2)}s | RTF TB: ${avgRtf.toFixed(2)}`, 'ok');

    updateProgress(100, '✓ Tạo kịch bản hoàn tất 100%!', 'Thành công');
    clearInterval(timerInterval);

    setTimeout(() => {
      if(progBox) progBox.style.display = 'none';
      if(audioBox) audioBox.style.display = 'block';

      // Gắn audio player và phát âm thanh duy nhất
      window.AudioManager.stopAll();
      const dlgAudioBox = document.getElementById('dlgAudioBox');
      if(dlgAudioBox){
        ganAudio(dlgAudioBox.closest('.card'), masterBlob, 'KỊCH BẢN PHÂN VAI · XONG');
        if(dlgAudioBox._audio){
          window.AudioManager.play(dlgAudioBox._audio);
        }
      }

      // Lưu lịch sử
      if(typeof history !== 'undefined' && Array.isArray(history)){
        history.unshift({
          gio: new Date().toLocaleTimeString('vi-VN'),
          che: 'Studio phân vai',
          ts: `step${num_step} · ${danhSachVai.length} vai`,
          dur: totalDur,
          url: URL.createObjectURL(masterBlob),
          txt: curDlgText,
          srt: curDlgSrt
        });
        if(history.length > 15) history.pop();
        if(typeof veLichSu === 'function') veLichSu();
      }

      toast(`✓ Đã tạo xong kịch bản: ${totalDur.toFixed(2)}s (${cues.length} phân đoạn)`);
    }, 400);

  } catch(err){
    clearInterval(timerInterval);
    logTermDlg('LỖI', err.message, 'err');
    toast('Lỗi tạo kịch bản: ' + err.message, true);
    if(progBox) progBox.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-generating');
    btn.innerHTML = origBtnText;
    audioCtx.close();
  }
}

// ───────────── KHỞI TẠO STUDIO PHÂN VAI (STARTUP) ─────────────
function khoiTaoDialogueStudio(){
  veDanhSachVai();

  // Nút thêm nhân vật
  const btnThem = document.getElementById('btnThemVai');
  if(btnThem){
    btnThem.addEventListener('click', () => {
      const mauList = ['#3b82f6', '#eab308', '#ec4899', '#10b981', '#8b5cf6', '#f97316'];
      const nextId = 'vai_' + (danhSachVai.length + 1);
      const mau = mauList[danhSachVai.length % mauList.length];
      const giongList = layTatCaGiongCoSan();
      const giong = giongList[danhSachVai.length % giongList.length]?.id || 'Hai_Yen';

      danhSachVai.push({
        id: nextId,
        ten: 'Nhân vật ' + (danhSachVai.length + 1),
        giong: giong,
        mau: mau
      });
      veDanhSachVai();
      toast('✓ Đã thêm 1 nhân vật mới vào dàn diễn viên');
    });
  }

  // Bộ đếm ký tự kịch bản
  const ta = document.getElementById('dialogueScriptText');
  const countEl = document.getElementById('dialogueCount');
  if(ta && countEl){
    ta.addEventListener('input', () => {
      countEl.textContent = ta.value.length;
    });
  }

  // Thẻ cảm xúc & Thẻ nghỉ trong tab Dialogue
  const dlgPane = document.getElementById('dialogue');
  if(dlgPane){
    dlgPane.querySelectorAll('.btn-emotion').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = btn.dataset.tag;
        if(tag) chenVaoKichBan(' ' + tag + ' ');
      });
    });

    dlgPane.querySelectorAll('.btn-pause-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tag = btn.dataset.tag;
        if(tag) chenVaoKichBan('\n' + tag + '\n');
      });
    });

    // Slider mở rộng
    const sSteps = document.getElementById('dlgSteps');
    const sStepsV = document.getElementById('dlgStepsV');
    if(sSteps && sStepsV){
      sSteps.addEventListener('input', () => {
        if(typeof STEPS !== 'undefined') sStepsV.textContent = STEPS[+sSteps.value];
      });
    }

    const sSpeed = document.getElementById('dlgSpeed');
    const sSpeedV = document.getElementById('dlgSpeedV');
    if(sSpeed && sSpeedV){
      sSpeed.addEventListener('input', () => {
        sSpeedV.textContent = Number(sSpeed.value).toFixed(2) + '×';
      });
    }

    const sPause = document.getElementById('dlgPauseDefault');
    const sPauseV = document.getElementById('dlgPauseDefaultV');
    if(sPause && sPauseV){
      sPause.addEventListener('input', () => {
        sPauseV.textContent = Number(sPause.value).toFixed(2) + 's';
      });
    }

    // Tab xem trước TXT & SRT
    const btnTabTxt = document.getElementById('btnTabDlgTxt');
    const btnTabSrt = document.getElementById('btnTabDlgSrt');
    const boxTxt = document.getElementById('boxViewDlgTxt');
    const boxSrt = document.getElementById('boxViewDlgSrt');

    if(btnTabTxt && btnTabSrt && boxTxt && boxSrt){
      btnTabTxt.addEventListener('click', () => {
        btnTabTxt.classList.add('selected');
        btnTabSrt.classList.remove('selected');
        boxTxt.style.display = 'block';
        boxSrt.style.display = 'none';
      });
      btnTabSrt.addEventListener('click', () => {
        btnTabSrt.classList.add('selected');
        btnTabTxt.classList.remove('selected');
        boxTxt.style.display = 'none';
        boxSrt.style.display = 'block';
      });
    }

    // Các nút tải kịch bản
    const btnDlWav = document.getElementById('btnDlDlgWav');
    const btnDlTxt = document.getElementById('btnDlDlgTxt');
    const btnDlSrt = document.getElementById('btnDlDlgSrt');
    const btnDlAll = document.getElementById('btnDlDlgAll');

    if(btnDlWav){
      btnDlWav.addEventListener('click', () => {
        if(!curDlgWavBlob){ toast('Chưa có âm thanh kịch bản để tải', true); return; }
        taiTepChonThuMuc(curDlgWavBlob, 'omdiom-kich-ban-' + Date.now() + '.wav', 'Tệp âm thanh WAV', 'audio/wav', 'wav');
      });
    }
    if(btnDlTxt){
      btnDlTxt.addEventListener('click', () => {
        if(!curDlgText){ toast('Chưa có kịch bản để tải', true); return; }
        taiTepChonThuMuc(curDlgText, 'omdiom-kich-ban-' + Date.now() + '.txt', 'Tệp kịch bản TXT', 'text/plain', 'txt');
      });
    }
    if(btnDlSrt){
      btnDlSrt.addEventListener('click', () => {
        if(!curDlgSrt){ toast('Chưa có phụ đề để tải', true); return; }
        taiTepChonThuMuc(curDlgSrt, 'omdiom-phu-de-kich-ban-' + Date.now() + '.srt', 'Tệp phụ đề SRT', 'text/plain', 'srt');
      });
    }
    if(btnDlAll){
      btnDlAll.addEventListener('click', () => {
        if(!curDlgWavBlob && !curDlgText && !curDlgSrt){ toast('Chưa có dữ liệu để lưu', true); return; }
        taiTronBoVaoThuMuc(curDlgWavBlob, curDlgText, curDlgSrt, 'omdiom-kich-ban-' + Date.now());
      });
    }

    // Nút thực thi chính
    const btnRun = document.getElementById('btnRunDialogue');
    if(btnRun){
      btnRun.addEventListener('click', (e) => {
        e.preventDefault();
        chayKichBanDoiThoai();
      });
    }
  }
}

// Khởi chạy khi DOM sẵn sàng
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', khoiTaoDialogueStudio);
} else {
  khoiTaoDialogueStudio();
}
