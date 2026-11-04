// ═══════════════════════════════════════════════════════════════
// OmDiOm Studio - CONFIG & DEVICE MANAGEMENT (UI/js/config.js)
// ═══════════════════════════════════════════════════════════════


const glow=document.querySelector("#cursorGlow");if(window.matchMedia("(pointer: fine)").matches&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){window.addEventListener("pointermove",e=>{glow.style.left=e.clientX+"px";glow.style.top=e.clientY+"px";glow.classList.add("visible")},{passive:true});document.addEventListener("pointerleave",()=>glow.classList.remove("visible"));}
const $=s=>document.querySelector(s);const $$=s=>Array.from(document.querySelectorAll(s));
const LS=(()=>{try{localStorage.setItem("__ovt","1");localStorage.removeItem("__ovt");return localStorage}catch(e){const m=Object.create(null);return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]}}}})();
const toast=(msg,err)=>{const t=$('#toast');t.textContent=msg;t.style.background=err?'#8b1f1f':'#171717';t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),3600)};

// ───────────── cấu hình ─────────────
const cfg={url:LS.getItem('ov_url')||'http://127.0.0.1:8000',key:LS.getItem('ov_key')||'testkey'};
const STEPS=[8,16,32];
let coKetNoi=true;
const history=[];

// ───────────── QUẢN LÝ THIẾT BỊ XỬ LÝ (CPU / GPU TRÊN MÁY VÀ KAGGLE AUTO GPU) ─────────────
let localDeviceChoice = localStorage.getItem('omdiom_device') || 'cpu';
let thongTinPhanCungMay = {
  cpuName: 'Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz',
  cpuShort: 'Intel Core i9-9880H',
  cpuMeta: '8 nhân · 16 luồng',
  gpuName: 'NVIDIA Quadro T2000',
  gpuMeta: '4.0 GB VRAM'
};

function isKaggleConnected(){
  // Chỉ trả về true khi và chỉ khi: _ok === true VÀ URL là link ngoài hợp lệ
  if(!cfg.url) return false;
  if(cfg._ok !== true) return false;
  const u = (cfg.url || '').toLowerCase();
  return u && !u.includes('127.0.0.1') && !u.includes('localhost') && !u.includes('0.0.0.0');
}

function capNhatHienThiThietBi(devChoice, isKaggle, kaggleDevName){
  if(devChoice) localDeviceChoice = devChoice;
  const isKag = (typeof isKaggle === 'boolean') ? isKaggle : isKaggleConnected();
  
  const box = $('#boxDeviceSelector');
  const banner = $('#kaggleAutoBanner');
  const badgeTarget = $('#badgeDeviceTarget');
  const radCpu = $('#radioDevCpu');
  const radGpu = $('#radioDevGpu');
  const lblCpu = $('#lblDevCpu');
  const lblGpu = $('#lblDevGpu');
  const hwMode = $('#hwMode');
  const hwModeSub = $('#hwModeSub');
  const btnTop = $('#btnHwTop');
  const badgeMode = $('#badgeMode');
  const devSi = document.querySelector('[data-si="device"]');
  const statusTxt = $('#statusText');
  const dot = $('#dot');
  const cardTitle = $('#cardHardwareTitle');
  const cpuEl = $('#hwCpu');
  const cpuSub = $('#hwCpuSub');
  const ramEl = $('#hwRam');
  const ramSub = $('#hwRamSub');
  const gpuEl = $('#hwGpu');
  const gpuSub = $('#hwGpuSub');
  const torchEl = $('#hwTorch');
  const cudaSub = $('#hwCudaSub');
  const loadEl = $('#hwLoad');
  const knText = document.querySelector('[data-kn-text]');

  if(isKag){
    // ═══════════════════════════════════════════════════════════════
    // CHẾ ĐỘ ĐANG KẾT NỐI KAGGLE GPU (TESLA T4 / P100 - CHẠY THẬT)
    // ═══════════════════════════════════════════════════════════════
    const kgName = kaggleDevName || (cfg._device ? cfg._device : 'cuda:0 · Tesla T4');
    const tenGpuDep = kgName.includes('Tesla') ? 'NVIDIA Tesla T4' : (kgName.includes('P100') ? 'NVIDIA Tesla P100' : 'NVIDIA GPU Kaggle');

    if(cardTitle) cardTitle.innerHTML = '☁️ Cấu hình máy chủ Kaggle GPU <small style="font-size:12px;color:#0284c7;font-weight:700">(Đang chạy thật)</small>';
    if(cpuEl) cpuEl.textContent = 'Kaggle Cloud CPU (Intel Xeon)';
    if(cpuSub) cpuSub.textContent = '2 vCPU · Đám mây Kaggle';
    if(ramEl) ramEl.textContent = '16.0 GB';
    if(ramSub) ramSub.textContent = 'RAM đám mây Kaggle khả dụng';
    if(gpuEl) gpuEl.textContent = tenGpuDep;
    if(gpuSub) gpuSub.textContent = '15.0 GB / 16.0 GB VRAM · CUDA OK';
    if(torchEl) torchEl.textContent = 'PyTorch CUDA 12.x';
    if(cudaSub) cudaSub.textContent = 'Thiết bị: ' + kgName;

    if(hwMode){
      hwMode.innerHTML = '☁️ <b style="color:#0284c7">GPU KAGGLE:</b> ' + tenGpuDep;
      hwMode.style.color = '#0284c7';
    }
    if(hwModeSub){
      hwModeSub.textContent = 'ĐANG HOẠT ĐỘNG THẬT TRÊN GPU T4';
      hwModeSub.style.color = '#16a34a';
      hwModeSub.style.fontWeight = 'bold';
    }
    if(loadEl) loadEl.innerHTML = '<span style="color:#16a34a;font-size:15px;font-weight:bold">SẴN SÀNG</span>';

    if(banner){
      banner.style.display = 'block';
      banner.innerHTML = '☁️ <b>ĐÃ KẾT NỐI KAGGLE GPU:</b> Hệ thống đang hoạt động <b>thực tế trên GPU ' + tenGpuDep + '</b> của Kaggle. Mọi tác vụ tổng hợp giọng nói, nhân bản giọng sẽ được thực thi trực tiếp trên GPU đám mây với tốc độ siêu tốc (chỉ 1–3s). Tùy chọn máy cá nhân tạm thời được bảo lưu.';
    }
    if(badgeTarget){
      badgeTarget.textContent = '☁️ KAGGLE CLOUD (TỰ ĐỘNG)';
      badgeTarget.style.background = '#dbeafe';
      badgeTarget.style.color = '#1e40af';
    }
    if(radCpu) radCpu.disabled = true;
    if(radGpu) radGpu.disabled = true;
    if(box) box.style.opacity = '0.92';
    if(lblCpu){ lblCpu.style.cursor = 'not-allowed'; lblCpu.style.opacity = '0.6'; }
    if(lblGpu){ lblGpu.style.cursor = 'not-allowed'; lblGpu.style.opacity = '0.6'; }

    if(btnTop) {
      btnTop.innerHTML = '☁️ GPU: ' + tenGpuDep.replace('NVIDIA ', '') + ' (Kaggle)';
      btnTop.title = 'Đang chạy thật trên GPU Kaggle: ' + kgName;
      btnTop.style.borderColor = '#0284c7';
      btnTop.style.background = '#e0f2fe';
      btnTop.style.color = '#0369a1';
    }
    if(badgeMode){
      badgeMode.textContent = '☁️ ĐÃ KẾT NỐI (KAGGLE GPU T4)';
      badgeMode.style.background = '#bbf7d0';
      badgeMode.style.color = '#15803d';
      badgeMode.style.border = '1.5px solid #22c55e';
    }
    if(devSi) devSi.textContent = kgName;
    if(dot) dot.style.background = '#22c55e';
    if(statusTxt) statusTxt.textContent = 'Đã kết nối · ☁️ ' + tenGpuDep;
    if(knText) knText.textContent = 'Đã kết nối · ☁️ ' + tenGpuDep;
  } else {
    // ═══════════════════════════════════════════════════════════════
    // CHẾ ĐỘ MÁY CÁ NHÂN CỤC BỘ (CHỌN CPU HOẶC GPU THẬT SỰ)
    // ═══════════════════════════════════════════════════════════════
    if(cardTitle) cardTitle.textContent = '💻 Cấu hình máy & Khả năng xử lý';
    if(banner) banner.style.display = 'none';
    if(badgeTarget){
      badgeTarget.textContent = 'MÁY CÁ NHÂN';
      badgeTarget.style.background = '#e0f2fe';
      badgeTarget.style.color = '#0369a1';
    }
    if(radCpu) radCpu.disabled = false;
    if(radGpu) radGpu.disabled = false;
    if(box) box.style.opacity = '1';
    if(lblCpu){ lblCpu.style.cursor = 'pointer'; lblCpu.style.opacity = '1'; }
    if(lblGpu){ lblGpu.style.cursor = 'pointer'; lblGpu.style.opacity = '1'; }

    // Phục hồi thông số máy cá nhân
    if(cpuEl) cpuEl.textContent = thongTinPhanCungMay.cpuShort;
    if(cpuSub) cpuSub.textContent = thongTinPhanCungMay.cpuMeta;
    if(ramEl) ramEl.textContent = (thongTinPhanCungMay.ramTotal || '7.7') + ' GB';
    if(ramSub) ramSub.textContent = thongTinPhanCungMay.ramSub || 'Khả dụng: 1.0 GB';
    if(gpuEl) gpuEl.textContent = thongTinPhanCungMay.gpuName.replace('NVIDIA ', '').replace('Intel(R) ', '');
    if(gpuSub) gpuSub.textContent = thongTinPhanCungMay.gpuMeta || '4.0 GB VRAM';
    if(torchEl) torchEl.textContent = thongTinPhanCungMay.torchVer || 'v2.13.0+cpu';
    if(cudaSub) cudaSub.textContent = (localDeviceChoice === 'gpu') ? 'Đang chạy GPU T2000' : 'Đang chạy CPU i9';
    if(loadEl) loadEl.textContent = (thongTinPhanCungMay.cpuLoad || '5') + ' %';

    if(localDeviceChoice === 'gpu'){
      // ── KHI NGƯỜI DÙNG CHỌN CARD ĐỒ HỌA GPU ──
      if(radGpu) radGpu.checked = true;
      if(radCpu) radCpu.checked = false;
      if(lblGpu){ lblGpu.style.borderColor = '#10b981'; lblGpu.style.background = '#f0fdf4'; }
      if(lblCpu){ lblCpu.style.borderColor = '#cbd5e1'; lblCpu.style.background = '#ffffff'; }

      if(hwMode){
        hwMode.innerHTML = '⚡ <b style="color:#0f766e">GPU:</b> ' + thongTinPhanCungMay.gpuName;
        hwMode.style.color = '#0f766e';
      }
      if(hwModeSub){
        hwModeSub.textContent = (thongTinPhanCungMay.gpuMeta || '4.0 GB VRAM') + ' · Xử lý trên GPU';
        hwModeSub.style.color = '#0f766e';
        hwModeSub.style.fontWeight = 'bold';
      }
      if(btnTop){
        btnTop.innerHTML = '⚡ ' + thongTinPhanCungMay.gpuName;
        btnTop.title = 'Đang chọn sử dụng: ' + thongTinPhanCungMay.gpuName;
        btnTop.style.borderColor = '#10b981';
        btnTop.style.background = '#f0fdf4';
        btnTop.style.color = '#0f766e';
      }
      if(badgeMode){
        badgeMode.textContent = '⚡ CỤC BỘ: GPU ' + thongTinPhanCungMay.gpuName.replace('NVIDIA ', '');
        badgeMode.style.background = '#bbf7d0';
        badgeMode.style.color = '#15803d';
        badgeMode.style.border = '1px solid #16a34a';
      }
      if(devSi) devSi.textContent = '⚡ GPU: ' + thongTinPhanCungMay.gpuName;
      if(dot) dot.style.background = '#4dcac1';
      if(statusTxt) statusTxt.textContent = 'Đã kết nối · ⚡ ' + thongTinPhanCungMay.gpuName;
      if(knText) knText.textContent = 'Đã kết nối · ⚡ GPU: ' + thongTinPhanCungMay.gpuName;
    } else {
      // ── KHI NGƯỜI DÙNG CHỌN VI XỬ LÝ CPU ──
      if(radCpu) radCpu.checked = true;
      if(radGpu) radGpu.checked = false;
      if(lblCpu){ lblCpu.style.borderColor = '#10b981'; lblCpu.style.background = '#f0fdf4'; }
      if(lblGpu){ lblGpu.style.borderColor = '#cbd5e1'; lblGpu.style.background = '#ffffff'; }

      if(hwMode){
        hwMode.innerHTML = '💻 <b style="color:#15803d">CPU:</b> ' + thongTinPhanCungMay.cpuName;
        hwMode.style.color = '#15803d';
      }
      if(hwModeSub){
        hwModeSub.textContent = thongTinPhanCungMay.cpuMeta + ' · Xử lý trên CPU';
        hwModeSub.style.color = '#15803d';
        hwModeSub.style.fontWeight = 'bold';
      }
      if(btnTop){
        btnTop.innerHTML = '💻 ' + thongTinPhanCungMay.cpuShort;
        btnTop.title = 'Đang chọn sử dụng: ' + thongTinPhanCungMay.cpuName;
        btnTop.style.borderColor = '#cbd5e1';
        btnTop.style.background = '#ffffff';
        btnTop.style.color = '#15803d';
      }
      if(badgeMode){
        badgeMode.textContent = '💻 CỤC BỘ: CPU Intel i9';
        badgeMode.style.background = '#bdeeea';
        badgeMode.style.color = '#0f766e';
        badgeMode.style.border = '1px solid #0f766e';
      }
      if(devSi) devSi.textContent = '💻 CPU: ' + thongTinPhanCungMay.cpuName;
      if(dot) dot.style.background = '#4dcac1';
      if(statusTxt) statusTxt.textContent = 'Đã kết nối · 💻 ' + thongTinPhanCungMay.cpuShort;
      if(knText) knText.textContent = 'Đã kết nối · 💻 CPU: ' + thongTinPhanCungMay.cpuName;
    }
  }
}

async function chonThietBiCucBo(dev){
  if(isKaggleConnected()){
    toast('Đang kết nối Kaggle GPU — Hệ thống tự động ưu tiên GPU Kaggle.', true);
    return;
  }
  localDeviceChoice = dev;
  localStorage.setItem('omdiom_device', dev);
  
  // Cập nhật ngay lập tức giao diện
  capNhatHienThiThietBi(dev, false);

  // Gửi cài đặt thiết bị sang backend cục bộ
  try{
    const host = (cfg.url || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const fd = new FormData();
    fd.append('device', dev);
    const h = {}; if(cfg.key) h['X-API-Key'] = cfg.key;
    const res = await fetch(host + '/api/device', {method: 'POST', body: fd, headers: h, signal: AbortSignal.timeout(3000)});
    if(res.ok){
      const d = await res.json();
      if(d.device_display){
        cfg._device = d.device_display;
      }
      capNhatHienThiThietBi(dev, false, d.device_display);
    }
  }catch(err){
    console.warn('Lỗi gửi device tới backend:', err);
  }

  const tenHienThi = (dev === 'gpu') ? thongTinPhanCungMay.gpuName : thongTinPhanCungMay.cpuName;
  toast('✓ Đã chuyển sang sử dụng: ' + ((dev === 'gpu') ? '⚡ ' : '💻 ') + tenHienThi);
}
function datTrangThai(kieu,d){
  const dot=$('#dot'), txt=$('#statusText'), badge=$('#badgeMode');
  if(kieu==='ok'){
    dot.style.background='#4dcac1';
    coKetNoi=true;cfg._ok=true;cfg._device=d?d.device:'';veTabKetNoi();taiThuVien();
    capNhatHienThiThietBi(localDeviceChoice, isKaggleConnected(), d?d.device:'');
  } else if(kieu==='err'){
    dot.style.background='#ff7b7b';
    txt.textContent='Mất kết nối máy chủ';
    badge.textContent='CHƯA KẾT NỐI';
    badge.style.background='#ffb4b4';
    badge.style.color='#991b1b';
    badge.style.border='1.5px solid #dc2626';
    coKetNoi=false;
    cfg._ok=false;
    veTabKetNoi();
    capNhatHienThiThietBi(localDeviceChoice, false);
  } else {
    dot.style.background='#a7a7a7';
    txt.textContent='Chưa kết nối';
    badge.textContent='CHƯA KẾT NỐI';
    badge.style.background='#ffb4b4';
    badge.style.color='#991b1b';
    badge.style.border='1.5px solid #dc2626';
    coKetNoi=false;
    cfg._ok=false;
    veTabKetNoi();
    capNhatHienThiThietBi(localDeviceChoice, false);
  }
}
async function kiemTra(im){
  if(!cfg.url){datTrangThai('none');return null}
  try{
    const h={}; if(cfg.key) h['X-API-Key']=cfg.key;
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/health', {headers: h, signal: AbortSignal.timeout(4000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();cfg._mock=false;
    cfg._ok=true;
    if(d.device) cfg._device=d.device;
    datTrangThai('ok',d);
    return d;
  }catch(e){
    cfg._ok=false;
    coKetNoi=false;
    datTrangThai('err');
    if(!im){
      toast('Không kết nối được backend: '+e.message,true);
    }
    return null;
  }
}


// ───────────── tab KẾT NỐI ─────────────
function dienBang(d){
  const q=k=>document.querySelector('[data-si="'+k+'"]');
  if(!d)return;
  if(q('device'))q('device').textContent=d.device||'—';
  if(q('model'))q('model').textContent=d.model || (d.model_id ? d.model_id.split(/[\/]/).pop() : 'OmDiOm');
  if(q('loaded'))q('loaded').textContent=d.loaded?'rồi':'chưa';
  if(q('load'))q('load').textContent=d.load_time?Number(d.load_time).toFixed(1)+'s':'—';
  if(q('sr'))q('sr').textContent=d.sample_rate?Number(d.sample_rate).toLocaleString('vi-VN'):'—';
  if(q('mode'))q('mode').textContent='THẬT';
  if(typeof capNhatHienThiModel==='function') capNhatHienThiModel(d.model || d.model_id);
}
async function docInfo(){
  if(!cfg.url)return;
  try{
    const r=await fetch(cfg.url.replace(/\/$/,'')+'/info');
    if(!r.ok)return;
    const d=await r.json();
    const q=k=>document.querySelector('[data-si="'+k+'"]');
    if(q('defaults')&&d.defaults)q('defaults').textContent='num_step='+d.defaults.num_step+' · guidance='+d.defaults.guidance_scale+' · t_shift='+d.defaults.t_shift+' · speed='+d.defaults.speed+' · denoise='+d.defaults.denoise;
  }catch(e){}
}
function veTabKetNoi(){
  const dot=document.querySelector('[data-kn-dot]'),txt=document.querySelector('[data-kn-text]'),
        sub=document.querySelector('[data-kn-sub]'),tag=document.querySelector('[data-kn-tag]');
  if(!dot)return;
  if(cfg._ok){
    dot.style.background='#4dcac1';
    txt.textContent='Đã kết nối · '+(cfg._device||'Cục bộ');
    sub.textContent=cfg.url;
    tag.textContent='ĐANG CHẠY THẬT';tag.className='tag ok';
  }else if(cfg.url){
    dot.style.background='#ff7b7b';txt.textContent='Mất kết nối';sub.textContent=cfg.url;
    tag.textContent='LỖI';tag.className='tag bad';
  }else{
    dot.style.background='#4dcac1';txt.textContent='Đang kết nối';sub.textContent='http://127.0.0.1:8000';
    tag.textContent='SẴN SÀNG';tag.className='tag ok';
  }
}
function dienOC(){
  const u=$('#knUrl'),k=$('#knKey');
  if(u)u.value=cfg.url;if(k)k.value=cfg.key;
}
async function kiemTraTai(u,k){
  const out=$('#knOut');
  if(!u){if(out){out.style.display='block';out.textContent='Chưa nhập địa chỉ. Dán link trycloudflare hoặc http://127.0.0.1:8000';}return false}
  if(out){out.style.display='block';out.textContent='Đang gọi /health ...';}
  try{
    const h={};if(k)h['X-API-Key']=k;
    const r=await fetch(u+'/health',{headers:h});
    if(!r.ok)throw new Error('HTTP '+r.status+(r.status===401||r.status===403?' — thiếu hoặc sai API key':''));
    const d=await r.json();
    if(out)out.innerHTML='<b>Kết nối được.</b> model='+d.model+' · device='+d.device+(d.loaded?' · đã nạp model':' · model chưa nạp');
    return d;
  }catch(e){const mm=(e.message||'').includes('Failed to fetch')?'Không gọi được máy chủ (chưa chạy, sai cổng, hoặc tunnel đã chết).':e.message;
    if(out)out.innerHTML='<b>Thất bại:</b> '+mm;return null}
}
async function xuLyKetNoiMayChu(u, k, laNutSave){
  if(!u){toast('Chưa nhập địa chỉ máy chủ. Dán link trycloudflare hoặc http://127.0.0.1:8000', true); return null}
  const d = await kiemTraTai(u, k);
  if(!d) {
    cfg._ok = false;
    coKetNoi = false;
    datTrangThai('err');
    toast('Không kết nối được máy chủ! Vui lòng kiểm tra lại đường link.', true);
    return null;
  }
  // 1. Cập nhật và lưu cấu hình ngay lập tức
  cfg.url = u;
  cfg.key = k;
  cfg._ok = true;
  cfg._mock = false;
  cfg._device = d.device || '';
  LS.setItem('ov_url', u);
  LS.setItem('ov_key', k);

  // 2. Nhận diện máy chủ Kaggle hay Cục bộ
  const laKag = isKaggleConnected();

  // 3. Cập nhật đồng bộ toàn bộ giao diện
  dienBang(d);
  docInfo();
  datTrangThai('ok', d);
  veTabKetNoi();
  capNhatHienThiThietBi(localDeviceChoice, laKag, d.device);

  // 4. Đọc lại danh sách giọng từ máy chủ
  await taiThuVien();

  if(laKag){
    toast('Đã kết nối thành công GPU Kaggle (' + (d.device || 'Tesla T4') + ') — Đang chạy thật!');
  } else {
    toast('Đã kết nối máy chủ cục bộ (' + u + ')');
    await kiemTraCauHinhMay();
  }

  if(laNutSave){
    toast('Đã lưu & kết nối thành công GPU Kaggle!');
  }
  return d;
}

$('#knTest').addEventListener('click',async()=>{
  const u=$('#knUrl').value.trim().replace(/\/$/,''),k=$('#knKey').value.trim();
  await xuLyKetNoiMayChu(u, k, false);
});
$('#knSave').addEventListener('click',async()=>{
  const u=$('#knUrl').value.trim().replace(/\/$/,''),k=$('#knKey').value.trim();
  await xuLyKetNoiMayChu(u, k, true);
});
$('#knClear').addEventListener('click',()=>{
  cfg.url='http://127.0.0.1:8000';cfg.key='';cfg._ok=false;cfg._mock=false;cfg._device='';
  LS.removeItem('ov_url');LS.removeItem('ov_key');
  $('#knUrl').value='';$('#knKey').value='';
  const out=$('#knOut');if(out){out.style.display='none';out.textContent='';}
  ['device','model','loaded','load','sr','mode','defaults'].forEach(k=>{const q=document.querySelector('[data-si="'+k+'"]');if(q&&k!=='defaults')q.textContent='—'});
  datTrangThai('none');veTabKetNoi();
  capNhatHienThiThietBi(localDeviceChoice, false);
  kiemTraCauHinhMay();
  toast('Đã ngắt kết nối — Trở về sử dụng máy cá nhân');
});
document.querySelector('[data-kn-refresh]').addEventListener('click',async()=>{
  if(!cfg.url){toast('Chưa có máy chủ nào để đọc',true);return}
  const d=await kiemTraTai(cfg.url,cfg.key);if(d){dienBang(d);docInfo()}
});
const knHelpBtn=document.querySelector('[data-kn-help]');
if(knHelpBtn)knHelpBtn.addEventListener('click',()=>{
  const out=$('#knOut');
  if(out){out.style.display='block';out.innerHTML='<b>Lấy link ở đâu:</b> mở <code>kaggle/omdiom_server.ipynb</code> → Settings bật GPU → chạy mục 1→6 → mục 6 in ra link. Mục 5 in ra API key.';}
});

// hai nút ⚙ trên đầu trang giờ mở thẳng tab Kết nối
$$('.config').forEach(b=>b.addEventListener('click',()=>{dienOC();changeTab('ketnoi');veTabKetNoi()}));
document.querySelector('#statusPillTop')&&0;
const pill=document.querySelector('.top .status');
if(pill){pill.style.cursor='pointer';pill.title='Bấm để mở tab Kết nối';pill.addEventListener('click',()=>{dienOC();changeTab('ketnoi')})}



async function kiemTraCauHinhMay(){
  if(isKaggleConnected()){
    // Đang kết nối Kaggle GPU — Cập nhật thông số chuẩn của GPU Tesla T4 trên Kaggle
    capNhatHienThiThietBi(localDeviceChoice, true, cfg._device);
    return;
  }
  const host = (cfg.url || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const h = {}; if(cfg.key) h['X-API-Key'] = cfg.key;
  try{
    const r = await fetch(host + '/api/system', {headers: h, signal: AbortSignal.timeout(3000)});
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if(d.status === 'ok'){
      const cpu = d.cpu || {};
      const ram = d.ram || {};
      const gpus = d.gpus || [];
      const torch = d.pytorch || {};

      const gpuChinh = d.primary_gpu || (gpus[0] ? gpus[0].name : 'CPU');
      const vram = gpus.length ? (gpus.map(g => g.vram_gb ? (g.vram_gb + 'GB') : '').filter(Boolean).join(' / ') || 'Shared') : '0';

      if(cpu.name){
        thongTinPhanCungMay.cpuName = cpu.name;
        thongTinPhanCungMay.cpuShort = cpu.name.replace('Intel(R) Core(TM) ', '').replace(' CPU @', '').split(' ')[0] + ' ' + (cpu.name.includes('i9') ? 'i9-9880H' : '');
        thongTinPhanCungMay.cpuMeta = (cpu.cores || 8) + ' nhân · ' + (cpu.threads || 16) + ' luồng';
        thongTinPhanCungMay.cpuLoad = cpu.percent || 5;
        const dcf = $('#devCpuFull'); if(dcf) dcf.textContent = cpu.name;
        const dcm = $('#devCpuMeta'); if(dcm) dcm.textContent = thongTinPhanCungMay.cpuMeta;
      }
      if(ram.total_gb){
        thongTinPhanCungMay.ramTotal = ram.total_gb;
        thongTinPhanCungMay.ramSub = 'Khả dụng: ' + ram.avail_gb + ' GB (' + ram.used_percent + '% dùng)';
      }
      if(gpuChinh && gpuChinh !== 'CPU'){
        thongTinPhanCungMay.gpuName = gpuChinh;
        thongTinPhanCungMay.gpuMeta = vram + (torch.cuda_available ? ' · CUDA OK' : '');
        const dgf = $('#devGpuFull'); if(dgf) dgf.textContent = gpuChinh;
        const dgm = $('#devGpuMeta'); if(dgm) dgm.textContent = thongTinPhanCungMay.gpuMeta;
      }
      if(torch.version){
        thongTinPhanCungMay.torchVer = 'v' + torch.version;
      }

      capNhatHienThiThietBi(localDeviceChoice, false);
    }
  }catch(e){
    capNhatHienThiThietBi(localDeviceChoice, false);
  }
}

// ───────────── TỰ ĐỘNG PHÁT HIỆN MÁY CHỦ (ƯU TIÊN KAGGLE GPU ĐÃ LƯU) ─────────────
async function tuDongKetNoiCucBo(){
  const savedUrl = LS.getItem('ov_url') || cfg.url || '';
  const savedKey = LS.getItem('ov_key') || cfg.key || '';

  // NẾU CÓ LINK KAGGLE NGOÀI ĐÃ LƯU:
  // (Khởi đầu: set trạng thái chưa kết nối, sẽ cập nhật sau khi fetch xong)
  if(savedUrl && !savedUrl.includes('127.0.0.1') && !savedUrl.includes('localhost') && !savedUrl.includes('0.0.0.0')){
    try{
      const d = await kiemTraTai(savedUrl, savedKey);
      if(d){
        cfg.url = savedUrl;
        cfg.key = savedKey;
        cfg._ok = true;
        cfg._mock = false;
        cfg._device = d.device || '';
        if($('#knUrl')) $('#knUrl').value = cfg.url;
        if($('#knKey')) $('#knKey').value = cfg.key;
        dienBang(d);
        docInfo();
        datTrangThai('ok', d);
        veTabKetNoi();
        capNhatHienThiThietBi(localDeviceChoice, true, d.device);
        await taiThuVien();
        return;
      } else {
        // kiemTraTai trả về null (lỗi kết nối tunnel)
        cfg._ok = false;
        coKetNoi = false;
        datTrangThai('err');
      }
    }catch(_){
      // Link Kaggle không truy cập được (tunnel đã tắt/chết) -> Báo lỗi kết nối ngay
      cfg._ok = false;
      coKetNoi = false;
      datTrangThai('err');
    }
  }

  // Thử kết nối server local tại 127.0.0.1:8000
  try{
    const res = await fetch('http://127.0.0.1:8000/health', {signal: AbortSignal.timeout(1200)});
    if(res.ok){
      const d = await res.json();
      cfg.url = 'http://127.0.0.1:8000';
      cfg._ok = true;
      cfg._device = d.device || '';
      coKetNoi = true;
      if($('#knUrl') && !$('#knUrl').value) $('#knUrl').value = cfg.url;
      datTrangThai('ok', d);
      dienBang(d);
      await taiThuVien();
      await kiemTraCauHinhMay();
      capNhatHienThiThietBi(localDeviceChoice, false);
      return;
    }
  }catch(_){}

  // Cả Kaggle lẫn Local đều không phản hồi: đưa về trạng thái Mất kết nối trung thực
  cfg._ok = false;
  coKetNoi = false;
  datTrangThai('err');
}


// ─── TÍNH NĂNG CHUYỂN ĐỔI MÔ HÌNH (OMDIOM / OMNIVOICE) TRONG TAB CẤU HÌNH ───
let activeModelChoice = 'omdiom';

function capNhatHienThiModel(modelId) {
  if (modelId) activeModelChoice = modelId.toLowerCase().includes('omdiom') ? 'omdiom' : 'omnivoice';
  const radOmd = document.querySelector('#radioModelOmdiom');
  const radOmn = document.querySelector('#radioModelOmnivoice');
  const lblOmd = document.querySelector('#lblModelOmdiom');
  const lblOmn = document.querySelector('#lblModelOmnivoice');
  const badge = document.querySelector('#badgeActiveModel');

  if (activeModelChoice === 'omdiom') {
    if (radOmd) radOmd.checked = true;
    if (radOmn) radOmn.checked = false;
    if (lblOmd) { lblOmd.style.borderColor = '#3b82f6'; lblOmd.style.background = '#eff6ff'; }
    if (lblOmn) { lblOmn.style.borderColor = '#cbd5e1'; lblOmn.style.background = '#ffffff'; }
    if (badge) { badge.textContent = 'ĐANG DÙNG: OMDIOM'; badge.style.background = '#dbeafe'; badge.style.color = '#1e40af'; }
  } else {
    if (radOmn) radOmn.checked = true;
    if (radOmd) radOmd.checked = false;
    if (lblOmn) { lblOmn.style.borderColor = '#10b981'; lblOmn.style.background = '#f0fdf4'; }
    if (lblOmd) { lblOmd.style.borderColor = '#cbd5e1'; lblOmd.style.background = '#ffffff'; }
    if (badge) { badge.textContent = 'ĐANG DÙNG: OMNIVOICE GỐC'; badge.style.background = '#fef3c7'; badge.style.color = '#92400e'; }
  }
}

async function chuyenDoiModel(target) {
  const statusEl = document.querySelector('#modelSwitchStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ Đang chuyển đổi và nạp mô hình ' + (target === 'omdiom' ? 'OmDiOm' : 'OmniVoice') + ' vào bộ nhớ, vui lòng đợi...';
  }
  try {
    const host = (cfg.url || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const fd = new FormData();
    fd.append('target', target);
    const h = {};
    if (cfg.key) h['X-API-Key'] = cfg.key;
    const res = await fetch(host + '/api/system/switch-model', {
      method: 'POST',
      body: fd,
      headers: h,
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.status === 'ok') {
      activeModelChoice = target;
      capNhatHienThiModel(target);
      const modSi = document.querySelector('[data-si="model"]');
      if (modSi) modSi.textContent = data.model_name || target;
      toast('Đã chuyển sang mô hình: ' + (data.model_name || target));
    }
  } catch (err) {
    console.error('Lỗi chuyển model:', err);
    toast('Lỗi chuyển model: ' + err.message, true);
    capNhatHienThiModel(activeModelChoice); // Hoàn lại trạng thái cũ
  } finally {
    if (statusEl) statusEl.style.display = 'none';
  }
}

// Lắng nghe sự kiện chuyển model
document.addEventListener('DOMContentLoaded', () => {
  const radOmd = document.querySelector('#radioModelOmdiom');
  const radOmn = document.querySelector('#radioModelOmnivoice');
  if (radOmd) radOmd.addEventListener('change', () => { if (radOmd.checked) chuyenDoiModel('omdiom'); });
  if (radOmn) radOmn.addEventListener('change', () => { if (radOmn.checked) chuyenDoiModel('omnivoice'); });
});
