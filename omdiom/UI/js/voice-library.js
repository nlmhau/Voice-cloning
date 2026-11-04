// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - VOICE LIBRARY (UI/js/voice-library.js)
// ═══════════════════════════════════════════════════════════════

// ───────────── THƯ VIỆN GIỌNG (7 giọng đọc có sẵn) ─────────────
const GIONG_MAC_DINH = [
  {id: "Cao_Hung", name: "Cao Hùng (Ông già)", bytes: 9833, sha256: "b1c15629", gender: "Nam", note: "Nam lớn tuổi, trầm ấm, dạn dày"},
  {id: "Linh_Duc_Tu", name: "Linh Dục Tú (Nữ trẻ)", bytes: 5986, sha256: "255296e9", gender: "Nữ", note: "Nữ trẻ nhẹ nhàng, trong trẻo"},
  {id: "Minh_Nhi", name: "Minh Nhí (Trẻ em)", bytes: 11042, sha256: "306e603f", gender: "Trẻ em", note: "Bé gái ngây thơ, tự nhiên, hoạt bát"},
  {id: "Minh_Quy", name: "Minh Quý (Trai trẻ)", bytes: 11696, sha256: "379571be", gender: "Nam", note: "Nam thanh niên, rõ ràng, dứt khoát"},
  {id: "Phuong_Thy", name: "Phương Thy (Dẫn truyện)", bytes: 14796, sha256: "577413a6", gender: "Nữ", note: "Nữ dẫn truyện sâu lắng, truyền cảm"},
  {id: "To_Thanh", name: "Tô Thành (Kể chuyện)", bytes: 14498, sha256: "57ee3036", gender: "Kể chuyện", note: "Giọng kể chuyện lôi cuốn, nhịp nhàng"},
  {id: "Ut_Linh", name: "Út Linh (Ma mị / Huyền bí)", bytes: 15408, sha256: "1f52fe37", gender: "Huyền bí", note: "Nữ ma mị, huyền bí, kịch tính"}
];

const GIONG={ds:[...GIONG_MAC_DINH],dir:'voices/',cached:[]};

function veChonGiong(){
  const sel=$('#selGiongTts');if(!sel)return;
  const cu=sel.value;
  // CHỈ SỬ DỤNG 7 GIỌNG CÓ SẴN TRONG THƯ VIỆN ĐỂ CHẠY CỤC BỘ TRÊN GPU/CPU
  sel.innerHTML=GIONG.ds.map(function(v){
    const desc = v.note ? (' · ' + v.note) : (v.gender ? (' · ' + v.gender) : '');
    return '<option value="'+v.id+'">'+v.name+desc+'</option>';
  }).join('');
  if(cu&&GIONG.ds.some(function(v){return v.id===cu})){
    sel.value=cu;
  }else if(GIONG.ds.length){
    sel.value=GIONG.ds[0].id;
  }
}

function veThuVien(){
  const box=$('[data-vlist]');if(!box)return;
  const d=$('[data-vdir]');if(d)d.textContent='Thư mục: '+(GIONG.dir||'voices/');
  if(!GIONG.ds.length){
    box.innerHTML='<div class="muted">Thư viện trống. Hãy nhân bản giọng ở tab <b>Nhân bản giọng</b> rồi bấm lưu để thêm vào đây.</div>';veChonGiong();return;
  }
  box.innerHTML=GIONG.ds.map(function(v){
    const nap=GIONG.cached.indexOf(v.id)>=0;
    const sz=v.bytes?(Math.round(v.bytes/1024)+' KB'):'~10 KB';
    const tagVal=v.gender||(v.bytes?(Math.round(v.bytes/1024)+' KB'):'SẴN CÓ');
    const noteText=v.note?(v.note+' · '+sz):(v.id+' · '+sz);
    return '<div class="vrow"><span><b>'+v.name+'</b><small>'+noteText+'</small></span>'+
      '<span class="tag '+(nap?'ok':'')+'">'+(nap?'ĐÃ NẠP':tagVal)+'</span>'+
      '<button class="btn small" data-vnghe="'+v.id+'" data-vten="'+(v.name||'').replace(/"/g,'&quot;')+'">▶ Nghe</button>'+
      '<button class="btn small" data-vxoa="'+v.id+'" data-vten="'+(v.name||'').replace(/"/g,'&quot;')+'">Xoá</button></div>';
  }).join('');
  box.querySelectorAll('[data-vnghe]').forEach(function(b){b.onclick=function(){ngheThu(b.dataset.vnghe,b.dataset.vten)}});
  box.querySelectorAll('[data-vxoa]').forEach(function(b){b.onclick=function(){xoaGiong(b.dataset.vxoa,b.dataset.vten)}});
  veChonGiong();
}

async function taiThuVien(){
  if(!cfg.url){
    veThuVien();
    return;
  }
  const h={};if(cfg.key)h['X-API-Key']=cfg.key;
  try{
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/api/voices',{headers:h});
    if(!r.ok)throw new Error('HTTP '+r.status+(r.status===401||r.status===403?' — sai hoặc thiếu API key':''));
    const d=await r.json();
    if(d.voices&&d.voices.length){
      GIONG.ds=d.voices;
    } else if(typeof isKaggleConnected === 'function' && isKaggleConnected()){
      tuDongDongBoGiongLenKaggle();
    }
    GIONG.dir=d.dir||'voices/';
    GIONG.cached=d.cached||[];
    veThuVien();
  }catch(e){
    console.warn('Lỗi đọc thư viện từ máy chủ:', e);
    veThuVien();
  }
}

async function ngheThu(id,ten){
  if(!cfg.url){
    toast('Chưa kết nối máy chủ backend.',true);
    return;
  }
  const khoi=document.getElementById('thuvien');
  const btnNghe = document.querySelector('[data-vnghe="'+id+'"]');
  const nhanGoc = btnNghe ? btnNghe.innerHTML : '▶ Nghe';
  if(btnNghe) btnNghe.disabled = true;

  const fd=new FormData();
  fd.append('text','Xin chào, tôi là '+ten+'. Đây là giọng đọc mẫu của tôi trong dự án OmDiOm.');
  fd.append('voice_id',id);
  fd.append('num_step','16');fd.append('speed','1');fd.append('guidance_scale','2');
  toast('Đang tạo âm thanh nghe thử cho ' + ten + '…');

  const tienTrinh = batDauTienTrinh(khoi, btnNghe, 'Giọng đọc ' + ten, 8500);

  try{
    const d=await goiApi('/api/tts',fd);
    tienTrinh.hoanTat(function(){
      window.AudioManager.stopAll();
      ganAudio(khoi,d.blob,'NGHE THỬ · '+ten.toUpperCase());
      dienThongKe(khoi,d);
      const b=khoi.querySelector('[data-box]');
      if(b&&b._audio){
        window.AudioManager.play(b._audio);
      }
    });
    history.unshift({gio:new Date().toLocaleTimeString('vi-VN'),che:'Có sẵn',ts:id,dur:d.duration,url:URL.createObjectURL(d.blob)});
    if(history.length>12)history.pop();veLichSu();
    toast('Xong · '+d.genTime.toFixed(2)+'s · RTF '+d.rtf.toFixed(2));
  }catch(e){
    tienTrinh.thatBai(e.message);
    toast('Lỗi: '+e.message,true);
  }finally{
    if(btnNghe){
      btnNghe.disabled = false;
      btnNghe.innerHTML = nhanGoc;
    }
  }
}

async function xoaGiong(id,ten){
  if(!confirm('Xoá giọng "'+ten+'" khỏi thư viện?\nTệp .pt trên máy chủ sẽ bị xoá.'))return;
  if(!cfg.url){
    toast('Chưa kết nối máy chủ.',true);
    return;
  }
  const h={};if(cfg.key)h['X-API-Key']=cfg.key;
  try{
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/api/voices/'+encodeURIComponent(id),{method:'DELETE',headers:h});
    if(!r.ok)throw new Error('HTTP '+r.status);
    toast('Đã xoá '+ten);taiThuVien();
  }catch(e){toast('Không xoá được: '+e.message,true)}
}

// ───────────── LƯU GIỌNG VỪA NHÂN BẢN (CÓ TINH CHỈNH DSP) ─────────────
async function luuGiongClone(){
  const inp = $('#saveVoiceName');
  const ten = (inp ? inp.value : '').trim();
  const st = $('#saveVoiceStatus');
  const btn = $('#btnSaveVoice');
  if(!ten){
    toast('Vui lòng nhập tên gợi nhớ cho giọng cần lưu', true);
    if(inp) inp.focus();
    return;
  }
  if(!cfg.url){
    toast('Chưa kết nối máy chủ backend.', true);
    return;
  }

  // Thu thập thông số tinh chỉnh DSP
  const p = document.getElementById('tunePitch');
  const s = document.getElementById('tuneSpeed');
  const b = document.getElementById('tuneBass');
  const pitchVal = p ? parseInt(p.value) : 0;
  const speedVal = s ? parseFloat(s.value).toFixed(2) : '1.00';
  const bassVal = b ? parseInt(b.value) : 0;

  const dspNote = `Cao độ: ${pitchVal >= 0 ? '+' : ''}${pitchVal}st | Tốc độ: ${speedVal}x | Bass: +${bassVal}dB`;
  const noteInp = document.getElementById('saveVoiceNote');
  const userNote = (noteInp ? noteInp.value : '').trim();
  const fullNote = userNote ? `${userNote} (${dspNote})` : dspNote;
  const gender = document.getElementById('saveVoiceGender') ? document.getElementById('saveVoiceGender').value : '';

  btn.disabled = true;
  btn.innerHTML = '⏳ &nbsp;Đang lưu giọng vào thư viện...';
  if(st) st.textContent = 'Đang lưu giọng vào thư viện kèm thông số tinh chỉnh...';

  try{
    const fd = new FormData();
    fd.append('name', ten);
    fd.append('gender', gender);
    fd.append('note', fullNote);

    const h = {};
    if(cfg.key) h['X-API-Key'] = cfg.key;
    const r = await fetch(cfg.url.replace(/\/$/, '') + '/api/voices/save-clone', { method: 'POST', body: fd, headers: h });
    let j = {};
    try{ j = await r.json(); }catch(e){}
    if(!r.ok) throw new Error(j.error || j.detail || ('HTTP ' + r.status));

    // Lưu preset DSP vào localStorage để áp dụng khi dùng giọng này
    if(j.voice && j.voice.id){
      try{
        localStorage.setItem('omdiom_dsp_preset_' + j.voice.id, JSON.stringify({
          pitch: pitchVal,
          speed: parseFloat(speedVal),
          bass: bassVal
        }));
      }catch(_){}
    }

    toast('Đã lưu giọng "' + ten + '" vào thư viện thành công!');
    if(st) st.innerHTML = '<span style="color:#16a34a;font-weight:bold">✓ Đã lưu thành công! Thông số: ' + dspNote + '. Bạn có thể chọn giọng này ở tab Văn bản → Giọng hoặc Thư viện giọng.</span>';
    btn.innerHTML = '✓ &nbsp;Đã lưu vào thư viện';
    await taiThuVien();
  }catch(e){
    toast('Lỗi lưu giọng: ' + e.message, true);
    if(st) st.textContent = 'Lỗi: ' + e.message;
    btn.disabled = false;
    btn.innerHTML = '💾 &nbsp;Lưu vào thư viện giọng';
  }
}

let _dangDongBoGiong = false;
async function tuDongDongBoGiongLenKaggle(){
  if(_dangDongBoGiong) return;
  _dangDongBoGiong = true;
  try {
    toast('Đang tự động đồng bộ 7 giọng mẫu tiếng Việt lên máy chủ Kaggle...');
    const rLoc = await fetch('http://127.0.0.1:8000/api/voices/bundle');
    if(!rLoc.ok) return;
    const bData = await rLoc.json();
    if(!bData.voices || Object.keys(bData.voices).length === 0) return;

    const h = {'Content-Type': 'application/json'};
    if(cfg.key) h['X-API-Key'] = cfg.key;
    const rKag = await fetch(cfg.url.replace(/\/$/,'') + '/api/voices/sync', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({voices: bData.voices})
    });
    if(rKag.ok){
      const resKag = await rKag.json();
      toast('Đã đồng bộ thành công ' + (resKag.count || 7) + ' giọng mẫu tiếng Việt lên Kaggle!');
      const rNew = await fetch(cfg.url.replace(/\/$/,'') + '/api/voices', {headers: h});
      if(rNew.ok){
        const dNew = await rNew.json();
        if(dNew.voices && dNew.voices.length){
          GIONG.ds = dNew.voices;
          veThuVien();
        }
      }
    }
  } catch(e){
    console.warn('Lỗi khi tự động đồng bộ giọng sang Kaggle:', e);
  } finally {
    _dangDongBoGiong = false;
  }
}
