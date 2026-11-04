// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - TTS ENGINE & SRT / TERMINAL (UI/js/tts-engine.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── HÀM HỖ TRỢ TERMINAL & SRT ─────────────
let curTtsText = '';
let curTtsSrt = '';

function logTerm(tag, msg, type){
  const box = document.getElementById('ttsTerminal');
  if(!box) return;
  const now = new Date().toTimeString().split(' ')[0];
  const line = document.createElement('div');
  line.className = 'term-line';
  let tagCls = 'term-tag';
  if(type === 'ok') tagCls += ' term-ok';
  else if(type === 'accent') tagCls += ' term-accent';
  else if(type === 'err') tagCls += ' term-err';
  line.innerHTML = '<span class="term-dim">'+now+'</span> <span class="'+tagCls+'">['+tag+']</span> <span>'+msg+'</span>';
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function clearTerm(){
  const box = document.getElementById('ttsTerminal');
  if(box) box.innerHTML = '';
}

function formatSrtTime(sec){
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + ',' + String(ms).padStart(3,'0');
}

function taoNoiDungSrt(subtitles){
  return subtitles.map(function(s, idx){
    return (idx + 1) + '\n' + formatSrtTime(s.start) + ' --> ' + formatSrtTime(s.end) + '\n' + s.text + '\n';
  }).join('\n');
}

function tachCauTts(text, splitMode){
  text = (text || '').trim();
  if(!text) return [];
  if(splitMode === 'sentence'){
    const raw = text.split(/([.?!;\n]+)/);
    const chunks = [];
    let cur = '';
    for(const p of raw){
      cur += p;
      if(/[.?!;\n]+/.test(p)){
        const c = cur.trim();
        if(c) chunks.push(c);
        cur = '';
      }
    }
    if(cur.trim()) chunks.push(cur.trim());
    return chunks.filter(Boolean);
  } else if(splitMode === 'paragraph'){
    return text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  }
  return [text];
}

async function ghepAudioVoiKhoangLang(buffers, pauseSec, sampleRate){
  const pauseSamples = Math.floor(sampleRate * Math.max(0, pauseSec));
  let totalLen = 0;
  for(let i = 0; i < buffers.length; i++){
    totalLen += buffers[i].length;
    if(i < buffers.length - 1) totalLen += pauseSamples;
  }
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for(let i = 0; i < buffers.length; i++){
    merged.set(buffers[i], offset);
    offset += buffers[i].length;
    if(i < buffers.length - 1 && pauseSamples > 0){
      offset += pauseSamples; // silence zeros
    }
  }

  // Encode WAV 16-bit PCM
  const wavBuf = new ArrayBuffer(44 + merged.length * 2);
  const view = new DataView(wavBuf);
  function writeStr(off, s){ for(let i=0;i<s.length;i++) view.setUint8(off+i, s.charCodeAt(i)); }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + merged.length * 2, true);
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
  view.setUint32(40, merged.length * 2, true);
  for(let i = 0; i < merged.length; i++){
    const s16 = Math.max(-1, Math.min(1, merged[i])) * 32767;
    view.setInt16(44 + i * 2, s16, true);
  }
  return new Blob([wavBuf], {type: 'audio/wav'});
}

// ───────────── SỰ KIỆN TẢI & XEM TRƯỚC TXT / SRT (TAB TTS) ─────────────
(function(){
  const btnDlTxt = document.getElementById('btnDlTxt');
  const btnDlSrt = document.getElementById('btnDlSrt');
  const btnTabTxt = document.getElementById('btnTabTxt');
  const btnTabSrt = document.getElementById('btnTabSrt');
  const boxTxt = document.getElementById('boxViewTxt');
  const boxSrt = document.getElementById('boxViewSrt');

  if(btnTabTxt && btnTabSrt && boxTxt && boxSrt){
    btnTabTxt.addEventListener('click', function(){
      btnTabTxt.classList.add('selected');
      btnTabSrt.classList.remove('selected');
      boxTxt.style.display = 'block';
      boxSrt.style.display = 'none';
    });
    btnTabSrt.addEventListener('click', function(){
      btnTabSrt.classList.add('selected');
      btnTabTxt.classList.remove('selected');
      boxTxt.style.display = 'none';
      boxSrt.style.display = 'block';
    });
  }

  const btnDlAll = document.getElementById('btnDlAll');

  if(btnDlTxt){
    btnDlTxt.addEventListener('click', function(){
      if(!curTtsText){ toast('Chưa có nội dung văn bản để tải', true); return; }
      taiTepChonThuMuc(curTtsText, 'omdiom-van-ban-' + Date.now() + '.txt', 'Tệp văn bản TXT', 'text/plain', 'txt');
    });
  }

  if(btnDlSrt){
    btnDlSrt.addEventListener('click', function(){
      if(!curTtsSrt){ toast('Chưa có phụ đề SRT để tải', true); return; }
      taiTepChonThuMuc(curTtsSrt, 'omdiom-phu-de-' + Date.now() + '.srt', 'Tệp phụ đề SRT', 'text/plain', 'srt');
    });
  }

  if(btnDlAll){
    btnDlAll.addEventListener('click', function(){
      if(!curMasterWavBlob && !curTtsText && !curTtsSrt){ toast('Chưa có dữ liệu kết quả để lưu', true); return; }
      taiTronBoVaoThuMuc(curMasterWavBlob, curTtsText, curTtsSrt, 'omdiom-' + Date.now());
    });
  }
})();



// ───────────── BẢNG ÁNH XẠ THẺ CẢM XÚC TIẾNG VIỆT <-> OMNIVOICE ─────────────
const MAP_THE_VN_SANG_OMNI = {
  '\\[cười\\]': '[laughter]',
  '\\[cuoi\\]': '[laughter]',
  '\\[thở dài\\]': '[sigh]',
  '\\[tho dai\\]': '[sigh]',
  '\\[ngạc nhiên\\]': '[surprise-oh]',
  '\\[ngạc nhiên-ồ\\]': '[surprise-oh]',
  '\\[ngạc nhiên-o\\]': '[surprise-oh]',
  '\\[ngac nhien\\]': '[surprise-oh]',
  '\\[ngac nhien-o\\]': '[surprise-oh]',
  '\\[ngạc nhiên-à\\]': '[surprise-ah]',
  '\\[ngac nhien-a\\]': '[surprise-ah]',
  '\\[ngạc nhiên-dô\\]': '[surprise-yo]',
  '\\[trầm trồ\\]': '[surprise-wa]',
  '\\[trầm trồ-oa\\]': '[surprise-wa]',
  '\\[tram tro\\]': '[surprise-wa]',
  '\\[tram tro-oa\\]': '[surprise-wa]',
  '\\[nghi vấn\\]': '[question-ah]',
  '\\[nghi vấn-hả\\]': '[question-ah]',
  '\\[nghi van\\]': '[question-ah]',
  '\\[nghi van-ha\\]': '[question-ah]',
  '\\[thắc mắc\\]': '[question-oh]',
  '\\[thắc mắc-ơ\\]': '[question-oh]',
  '\\[thac mac\\]': '[question-oh]',
  '\\[thac mac-o\\]': '[question-oh]',
  '\\[thắc mắc-hở\\]': '[question-ei]',
  '\\[thắc mắc-í\\]': '[question-yi]',
  '\\[đồng tình\\]': '[confirmation-en]',
  '\\[đồng tình-ừm\\]': '[confirmation-en]',
  '\\[dong tinh\\]': '[confirmation-en]',
  '\\[ừm\\]': '[confirmation-en]',
  '\\[um\\]': '[confirmation-en]',
  '\\[bất mãn\\]': '[dissatisfaction-hnn]',
  '\\[bất mãn-hừm\\]': '[dissatisfaction-hnn]',
  '\\[bat man\\]': '[dissatisfaction-hnn]',
  '\\[hừm\\]': '[dissatisfaction-hnn]',
  '\\[hum\\]': '[dissatisfaction-hnn]'
};

const MAP_THE_OMNI_SANG_VN = {
  '[laughter]': '[cười]',
  '[sigh]': '[thở dài]',
  '[surprise-oh]': '[ngạc nhiên]',
  '[surprise-wa]': '[trầm trồ]',
  '[question-ah]': '[nghi vấn]',
  '[question-oh]': '[thắc mắc]',
  '[confirmation-en]': '[đồng tình]',
  '[dissatisfaction-hnn]': '[bất mãn]',
  '[surprise-ah]': '[ngạc nhiên]',
  '[surprise-yo]': '[ngạc nhiên]',
  '[question-en]': '[nghi vấn]',
  '[question-ei]': '[thắc mắc]',
  '[question-yi]': '[thắc mắc]'
};

function chuyenTheVnSangOmni(text){
  if(!text || typeof text !== 'string') return text;
  let res = text;
  for(const [pattern, omniTag] of Object.entries(MAP_THE_VN_SANG_OMNI)){
    const reg = new RegExp(pattern, 'gi');
    res = res.replace(reg, omniTag);
  }
  return res;
}

function chuyenTheOmniSangVn(text){
  if(!text || typeof text !== 'string') return text;
  let res = text;
  for(const [omniTag, vnTag] of Object.entries(MAP_THE_OMNI_SANG_VN)){
    const escaped = omniTag.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
    const reg = new RegExp(escaped, 'gi');
    res = res.replace(reg, vnTag);
  }
  return res;
}

window.chuyenTheVnSangOmni = chuyenTheVnSangOmni;
window.chuyenTheOmniSangVn = chuyenTheOmniSangVn;

// ───────────── KHỞI TẠO BỘ CHÈN THẺ CẢM XÚC (EMOTION TAGS) ─────────────
function khoiTaoEmotionToolbar(){
  document.querySelectorAll('.btn-emotion').forEach(btn => {
    btn.addEventListener('click', function(e){
      e.preventDefault();
      const tag = this.dataset.tag;
      if(!tag) return;

      // Tìm textarea gần nhất (cùng .card hoặc cùng tab active)
      const card = this.closest('.card') || this.closest('.main-content');
      let ta = card ? card.querySelector('textarea[data-text]') : null;
      if(!ta){
        const activePane = document.querySelector('.main-content:not(.hidden)');
        if(activePane) ta = activePane.querySelector('textarea[data-text]');
      }
      if(!ta) ta = document.querySelector('textarea[data-text]');
      if(!ta) return;

      const start = ta.selectionStart || 0;
      const end = ta.selectionEnd || 0;
      const val = ta.value || '';

      const before = val.substring(0, start);
      const after = val.substring(end);
      const needSpaceBefore = (start > 0 && !before.endsWith(' ') && !before.endsWith('\n'));
      const needSpaceAfter = (after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n') && !after.startsWith('.') && !after.startsWith(','));

      const insertStr = (needSpaceBefore ? ' ' : '') + tag + (needSpaceAfter ? ' ' : '');
      ta.value = before + insertStr + after;

      const newPos = start + insertStr.length;
      ta.selectionStart = newPos;
      ta.selectionEnd = newPos;
      ta.focus();

      ta.dispatchEvent(new Event('input', { bubbles: true }));
      toast('✓ Đã chèn thẻ: ' + tag);
    });
  });
}

// Khởi chạy khi DOM sẵn sàng
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', khoiTaoEmotionToolbar);
} else {
  khoiTaoEmotionToolbar();
}
