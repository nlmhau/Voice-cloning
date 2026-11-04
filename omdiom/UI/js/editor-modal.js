/**
 * editor-modal.js — Trình Soạn Thảo Toàn Màn Hình (Focus Zen Editor)
 * Giúp người dùng dễ dàng nhìn rõ, duyệt đọc và chỉnh sửa văn bản/kịch bản chi tiết nhất.
 */
(function() {
  'use strict';

  const modal = document.getElementById('editorModal');
  if (!modal) return;

  const btnExpandTts = document.getElementById('btnExpandTtsEditor');
  const btnExpandDlg = document.getElementById('btnExpandDlgEditor');

  const modalTitle = document.getElementById('editorModalTitle');
  const modalSubtitle = document.getElementById('editorModalSubtitle');
  const modalArea = document.getElementById('editorModalTextarea');
  const modalStats = document.getElementById('editorModalStats');

  const btnFontDec = document.getElementById('btnEditorFontDec');
  const btnFontInc = document.getElementById('btnEditorFontInc');
  const fontLabel = document.getElementById('editorFontSizeLabel');

  const btnCopy = document.getElementById('btnEditorCopy');
  const btnClear = document.getElementById('btnEditorClear');
  const btnClose = document.getElementById('btnEditorClose');
  const btnApply = document.getElementById('btnEditorApply');

  const emotionTags = document.getElementById('editorEmotionTags');

  let currentSource = 'tts'; // 'tts' hoặc 'dialogue'
  let currentFontSize = 15;

  function capNhatThongKe(text) {
    if (!modalStats) return;
    const str = text || '';
    const chars = str.length;
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    // Tốc độ đọc tiếng Việt trung bình: ~180-200 từ / phút (~3 từ / giây)
    const estSeconds = Math.round(words / 3.2);
    const estMin = Math.floor(estSeconds / 60);
    const estSec = estSeconds % 60;
    const timeStr = estMin > 0 ? (estMin + 'm ' + estSec + 's') : (estSeconds + 's');

    modalStats.innerHTML = '📊 <b>' + words.toLocaleString('vi-VN') + '</b> từ · <b>' +
      chars.toLocaleString('vi-VN') + '</b> ký tự · ⏱️ ước tính đọc: <b>~' + timeStr + '</b>';
  }

  function dongBoXuongNguon() {
    const val = modalArea ? modalArea.value : '';
    if (currentSource === 'tts') {
      const orig = document.querySelector('#tts textarea[data-text]');
      if (orig) {
        orig.value = val;
        orig.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      const orig = document.getElementById('dialogueScriptText');
      if (orig) {
        orig.value = val;
        orig.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    capNhatThongKe(val);
  }

  function moModal(nguon) {
    currentSource = nguon;
    let initialVal = '';

    if (nguon === 'tts') {
      const orig = document.querySelector('#tts textarea[data-text]');
      initialVal = orig ? orig.value : '';
      if (modalTitle) modalTitle.textContent = 'Trình Soạn Thảo Văn Bản Toàn Màn Hình';
      if (modalSubtitle) modalSubtitle.textContent = 'Chế độ soạn thảo tập trung — Dễ dàng theo dõi câu từ, chèn cảm xúc và ngắt nghỉ';
    } else {
      const orig = document.getElementById('dialogueScriptText');
      initialVal = orig ? orig.value : '';
      if (modalTitle) modalTitle.textContent = 'Trình Soạn Thảo Kịch Bản Đối Thoại Toàn Màn Hình';
      if (modalSubtitle) modalSubtitle.textContent = 'Chế độ kịch bản phân vai — Dễ dàng bao quát toàn bộ lời thoại và tuyến nhân vật';
    }

    if (modalArea) {
      modalArea.value = initialVal;
      modalArea.style.fontSize = currentFontSize + 'px';
    }

    capNhatThongKe(initialVal);

    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
    }

    if (modalArea) {
      setTimeout(function() {
        modalArea.focus();
      }, 100);
    }
  }

  function dongModal() {
    dongBoXuongNguon();
    try {
      modal.close();
    } catch (e) {
      modal.removeAttribute('open');
    }
  }

  // Lắng nghe sự kiện gõ trong modal
  if (modalArea) {
    modalArea.addEventListener('input', function() {
      dongBoXuongNguon();
    });
  }

  // Chèn thẻ cảm xúc & khoảng nghỉ
  if (emotionTags) {
    emotionTags.addEventListener('click', function(e) {
      const btn = e.target.closest('button[data-tag]');
      if (!btn || !modalArea) return;
      const tag = btn.getAttribute('data-tag');
      if (!tag) return;

      const start = modalArea.selectionStart;
      const end = modalArea.selectionEnd;
      const val = modalArea.value;

      modalArea.value = val.substring(0, start) + ' ' + tag + ' ' + val.substring(end);
      const newPos = start + tag.length + 2;
      modalArea.selectionStart = newPos;
      modalArea.selectionEnd = newPos;
      modalArea.focus();

      dongBoXuongNguon();
    });
  }

  // Điều chỉnh phông chữ
  if (btnFontInc) {
    btnFontInc.addEventListener('click', function() {
      if (currentFontSize < 24) {
        currentFontSize += 1.5;
        if (modalArea) modalArea.style.fontSize = currentFontSize + 'px';
        if (fontLabel) fontLabel.textContent = Math.round(currentFontSize) + 'px';
      }
    });
  }

  if (btnFontDec) {
    btnFontDec.addEventListener('click', function() {
      if (currentFontSize > 12) {
        currentFontSize -= 1.5;
        if (modalArea) modalArea.style.fontSize = currentFontSize + 'px';
        if (fontLabel) fontLabel.textContent = Math.round(currentFontSize) + 'px';
      }
    });
  }

  // Sao chép
  if (btnCopy) {
    btnCopy.addEventListener('click', function() {
      const val = modalArea ? modalArea.value : '';
      if (!val || !val.trim()) {
        if (typeof toast === 'function') toast('Chưa có nội dung để sao chép', true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(function() {
          if (typeof toast === 'function') toast('Đã sao chép toàn bộ văn bản vào bộ nhớ tạm!');
        });
      } else {
        modalArea.select();
        document.execCommand('copy');
        if (typeof toast === 'function') toast('Đã sao chép văn bản!');
      }
    });
  }

  // Xóa sạch
  if (btnClear) {
    btnClear.addEventListener('click', function() {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ văn bản đang soạn thảo không?')) {
        if (modalArea) {
          modalArea.value = '';
          dongBoXuongNguon();
          modalArea.focus();
        }
      }
    });
  }

  // Nút mở rộng
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

  // Đóng modal
  if (btnClose) btnClose.addEventListener('click', dongModal);
  if (btnApply) btnApply.addEventListener('click', function() {
    dongModal();
    if (typeof toast === 'function') toast('Đã áp dụng văn bản vào hệ thống!');
  });

  // Click ra ngoài backdrop để đóng
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

  window.moEditorModal = moModal;
})();

