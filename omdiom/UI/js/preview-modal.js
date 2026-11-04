/**
 * preview-modal.js — Trình xem phóng to toàn màn hình cho Văn bản (.TXT) & Phụ đề (.SRT)
 * Giúp người dùng xem tổng quát và chi tiết hơn giống như modal Hướng dẫn.
 */
(function() {
  'use strict';

  const modal = document.getElementById('previewModal');
  if (!modal) return;

  const btnExpandTts = document.getElementById('btnExpandTtsPreview');
  const btnExpandDlg = document.getElementById('btnExpandDlgPreview');

  const modalTitle = document.getElementById('modalPreviewTitle');
  const modalSubtitle = document.getElementById('modalPreviewSubtitle');
  const modalStats = document.getElementById('modalPreviewStats');
  const modalBadge = document.getElementById('modalPreviewBadge');

  const btnTabTxt = document.getElementById('btnModalTabTxt');
  const btnTabSrt = document.getElementById('btnModalTabSrt');
  const boxTxt = document.getElementById('modalBoxTxt');
  const boxSrt = document.getElementById('modalBoxSrt');
  const areaTxt = document.getElementById('modalAreaTxt');
  const areaSrt = document.getElementById('modalAreaSrt');

  const btnCopy = document.getElementById('btnModalCopy');
  const btnDownload = document.getElementById('btnModalDownload');
  const btnClose1 = document.getElementById('btnModalClose');
  const btnClose2 = document.getElementById('btnModalClose2');

  let currentSource = 'tts'; // 'tts' hoặc 'dialogue'
  let currentTab = 'txt';    // 'txt' hoặc 'srt'

  function chuyenTabModal(tab) {
    currentTab = tab;
    if (tab === 'txt') {
      if (btnTabTxt) btnTabTxt.classList.add('selected');
      if (btnTabSrt) btnTabSrt.classList.remove('selected');
      if (boxTxt) boxTxt.style.display = 'block';
      if (boxSrt) boxSrt.style.display = 'none';
      if (modalBadge) {
        modalBadge.textContent = 'Đang xem: Văn bản (.TXT)';
        modalBadge.style.background = '#fef3c7';
        modalBadge.style.color = '#92400e';
      }
    } else {
      if (btnTabSrt) btnTabSrt.classList.add('selected');
      if (btnTabTxt) btnTabTxt.classList.remove('selected');
      if (boxTxt) boxTxt.style.display = 'none';
      if (boxSrt) boxSrt.style.display = 'block';
      if (modalBadge) {
        modalBadge.textContent = 'Đang xem: Phụ đề khớp thời gian (.SRT)';
        modalBadge.style.background = '#e0f2fe';
        modalBadge.style.color = '#0369a1';
      }
    }
  }

  function capNhatThongKe(txt, srt) {
    if (!modalStats) return;
    const lines = (txt || '').split('\n').filter(function(l) { return l.trim(); }).length;
    const chars = (txt || '').length;
    const srtMatches = (srt || '').match(/\d{2}:\d{2}:\d{2}/g);
    const srtCount = srtMatches ? Math.floor(srtMatches.length / 2) : 0;
    
    modalStats.innerHTML = '📊 <b>' + lines + '</b> dòng · <b>' + chars.toLocaleString('vi-VN') + '</b> ký tự' +
      (srtCount > 0 ? ' · <b>' + srtCount + '</b> câu phụ đề' : '');
  }

  function moModal(nguon) {
    currentSource = nguon;
    let txtVal = '';
    let srtVal = '';
    let initTab = 'txt';

    if (nguon === 'tts') {
      const origTxt = document.getElementById('txtPreviewArea');
      const origSrt = document.getElementById('srtPreviewArea');
      const origTabSrt = document.getElementById('btnTabSrt');
      txtVal = origTxt ? origTxt.value : '';
      srtVal = origSrt ? origSrt.value : '';
      if (origTabSrt && origTabSrt.classList.contains('selected')) {
        initTab = 'srt';
      }
      if (modalTitle) modalTitle.textContent = 'Xem Chi Tiết Văn Bản & Phụ Đề (.SRT)';
      if (modalSubtitle) modalSubtitle.textContent = 'Chế độ xem mở rộng tổng quát — Tab Văn bản → Giọng';
    } else {
      const origTxt = document.getElementById('dlgTxtPreviewArea');
      const origSrt = document.getElementById('dlgSrtPreviewArea');
      const origTabSrt = document.getElementById('btnTabDlgSrt');
      txtVal = origTxt ? origTxt.value : '';
      srtVal = origSrt ? origSrt.value : '';
      if (origTabSrt && origTabSrt.classList.contains('selected')) {
        initTab = 'srt';
      }
      if (modalTitle) modalTitle.textContent = 'Xem Chi Tiết Kịch Bản & Phụ Đề Phân Vai (.SRT)';
      if (modalSubtitle) modalSubtitle.textContent = 'Chế độ xem mở rộng tổng quát — Tab Studio phân vai';
    }

    if (areaTxt) areaTxt.value = txtVal;
    if (areaSrt) areaSrt.value = srtVal;

    capNhatThongKe(txtVal, srtVal);
    chuyenTabModal(initTab);

    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
    }
  }

  function dongModal() {
    try {
      modal.close();
    } catch (e) {
      modal.removeAttribute('open');
    }
  }

  // Lắng nghe nút mở rộng
  if (btnExpandTts) {
    btnExpandTts.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      moModal('tts');
    });
  }

  if (btnExpandDlg) {
    btnExpandDlg.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      moModal('dialogue');
    });
  }

  // Lắng nghe chuyển tab trong modal
  if (btnTabTxt) {
    btnTabTxt.addEventListener('click', function() {
      chuyenTabModal('txt');
    });
  }

  if (btnTabSrt) {
    btnTabSrt.addEventListener('click', function() {
      chuyenTabModal('srt');
    });
  }

  // Lắng nghe nút đóng
  if (btnClose1) btnClose1.addEventListener('click', dongModal);
  if (btnClose2) btnClose2.addEventListener('click', dongModal);

  // Click ra ngoài backdrop để đóng modal
  modal.addEventListener('click', function(e) {
    const rect = modal.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      dongModal();
    }
  });

  // Lắng nghe Sao chép
  if (btnCopy) {
    btnCopy.addEventListener('click', function() {
      const noiDung = (currentTab === 'txt') ? (areaTxt ? areaTxt.value : '') : (areaSrt ? areaSrt.value : '');
      if (!noiDung || !noiDung.trim()) {
        if (typeof toast === 'function') toast('Chưa có nội dung để sao chép', true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(noiDung).then(function() {
          if (typeof toast === 'function') {
            toast('Đã sao chép nội dung ' + (currentTab === 'txt' ? 'Văn bản (.TXT)' : 'Phụ đề (.SRT)') + ' vào bộ nhớ tạm!');
          }
        }).catch(function() {
          saoChepFallback(noiDung);
        });
      } else {
        saoChepFallback(noiDung);
      }
    });
  }

  function saoChepFallback(text) {
    const el = (currentTab === 'txt') ? areaTxt : areaSrt;
    if (el) {
      el.select();
      document.execCommand('copy');
      if (typeof toast === 'function') {
        toast('Đã sao chép nội dung ' + (currentTab === 'txt' ? 'Văn bản (.TXT)' : 'Phụ đề (.SRT)') + '!');
      }
    }
  }

  // Lắng nghe Tải về
  if (btnDownload) {
    btnDownload.addEventListener('click', function() {
      const noiDung = (currentTab === 'txt') ? (areaTxt ? areaTxt.value : '') : (areaSrt ? areaSrt.value : '');
      if (!noiDung || !noiDung.trim()) {
        if (typeof toast === 'function') toast('Chưa có nội dung để tải về', true);
        return;
      }
      const tenFile = (currentSource === 'tts' ? 'omdiom-tts-' : 'omdiom-kich-ban-') +
        (currentTab === 'txt' ? 'van-ban-' : 'phu-de-') + Date.now() + (currentTab === 'txt' ? '.txt' : '.srt');
      
      if (typeof taiTepChonThuMuc === 'function') {
        taiTepChonThuMuc(noiDung, tenFile, currentTab === 'txt' ? 'Tệp văn bản TXT' : 'Tệp phụ đề SRT', 'text/plain', currentTab);
      } else {
        const blob = new Blob([noiDung], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = tenFile;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
  }

  // Phơi API toàn cục nếu cần mở bằng mã lệnh
  window.moPreviewModal = moModal;
})();
