/**
 * terminal-modal.js — Bảng Lệnh Quy Trình Xử Lý Chi Tiết (Full Terminal Log)
 * Mở rộng toàn màn hình giúp theo dõi từng bước tính toán AI, thời lượng, RTF theo thời gian thực.
 */
(function() {
  'use strict';

  const modal = document.getElementById('terminalModal');
  if (!modal) return;

  const btnExpandTts = document.getElementById('btnExpandTtsTerminal');
  const btnExpandDlg = document.getElementById('btnExpandDlgTerminal');

  const modalTitle = document.getElementById('terminalModalTitle');
  const modalSubtitle = document.getElementById('terminalModalSubtitle');
  const modalPanel = document.getElementById('modalTerminalPanel');

  const btnAutoScroll = document.getElementById('btnTerminalAutoScroll');
  const btnCopy = document.getElementById('btnTerminalCopy');
  const btnClear = document.getElementById('btnTerminalClear');
  const btnClose1 = document.getElementById('btnTerminalClose');
  const btnClose2 = document.getElementById('btnTerminalClose2');

  let currentSource = 'tts'; // 'tts' hoặc 'dialogue'
  let isAutoScroll = true;
  let observer = null;

  function dongBoLogs() {
    if (!modalPanel) return;
    const srcEl = (currentSource === 'tts') ?
      document.getElementById('ttsTerminal') :
      document.getElementById('dlgTerminal');
    
    if (srcEl) {
      modalPanel.innerHTML = srcEl.innerHTML;
      if (isAutoScroll) {
        modalPanel.scrollTop = modalPanel.scrollHeight;
      }
    }
  }

  function batDauTheoDoi(srcEl) {
    if (observer) observer.disconnect();
    if (!srcEl || !window.MutationObserver) return;

    observer = new MutationObserver(function() {
      dongBoLogs();
    });

    observer.observe(srcEl, { childList: true, subtree: true, characterData: true });
  }

  function moModal(nguon) {
    currentSource = nguon;

    if (nguon === 'tts') {
      if (modalTitle) modalTitle.textContent = 'Bảng Lệnh Quy Trình Xử Lý Chi Tiết (Tab Văn bản → Giọng)';
      if (modalSubtitle) modalSubtitle.textContent = 'Theo dõi thời gian thực từng bước tính toán AI, thời lượng, RTF và phản hồi máy chủ';
      batDauTheoDoi(document.getElementById('ttsTerminal'));
    } else {
      if (modalTitle) modalTitle.textContent = 'Bảng Lệnh Tiến Trình Phân Vai (Tab Studio phân vai)';
      if (modalSubtitle) modalSubtitle.textContent = 'Theo dõi chi tiết tiến trình nạp nhân vật, ghép nối thoại và tạo phụ đề phân vai';
      batDauTheoDoi(document.getElementById('dlgTerminal'));
    }

    dongBoLogs();

    try {
      modal.showModal();
    } catch (e) {
      modal.setAttribute('open', '');
    }
  }

  function dongModal() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    try {
      modal.close();
    } catch (e) {
      modal.removeAttribute('open');
    }
  }

  // Tự động cuộn
  if (btnAutoScroll) {
    btnAutoScroll.addEventListener('click', function() {
      isAutoScroll = !isAutoScroll;
      if (isAutoScroll) {
        btnAutoScroll.textContent = '⬇ Tự cuộn: BẬT';
        btnAutoScroll.style.background = '#e0f2fe';
        btnAutoScroll.style.color = '#0369a1';
        if (modalPanel) modalPanel.scrollTop = modalPanel.scrollHeight;
      } else {
        btnAutoScroll.textContent = '⏸ Tự cuộn: TẮT';
        btnAutoScroll.style.background = '#f4f4f5';
        btnAutoScroll.style.color = '#52525b';
      }
    });
  }

  // Sao chép toàn bộ logs
  if (btnCopy) {
    btnCopy.addEventListener('click', function() {
      if (!modalPanel) return;
      const text = modalPanel.innerText || modalPanel.textContent || '';
      if (!text.trim()) {
        if (typeof toast === 'function') toast('Chưa có nhật ký log để sao chép', true);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          if (typeof toast === 'function') toast('Đã sao chép toàn bộ nhật ký console log!');
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (typeof toast === 'function') toast('Đã sao chép nhật ký console log!');
      }
    });
  }

  // Xóa log
  if (btnClear) {
    btnClear.addEventListener('click', function() {
      if (confirm('Bạn có muốn xóa sạch màn hình console log này không?')) {
        const srcEl = (currentSource === 'tts') ?
          document.getElementById('ttsTerminal') :
          document.getElementById('dlgTerminal');
        if (srcEl) {
          srcEl.innerHTML = '<div class="term-line"><span class="term-dim">' +
            new Date().toTimeString().split(' ')[0] +
            '</span> <span class="term-tag">[HỆ THỐNG]</span> Đã xóa màn hình log. Sẵn sàng...</div>';
        }
        dongBoLogs();
      }
    });
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

  // Nút đóng
  if (btnClose1) btnClose1.addEventListener('click', dongModal);
  if (btnClose2) btnClose2.addEventListener('click', dongModal);

  // Click ra ngoài backdrop
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

  window.moTerminalModal = moModal;
})();

