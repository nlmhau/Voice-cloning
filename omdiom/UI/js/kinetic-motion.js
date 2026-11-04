/**
 * kinetic-motion.js — Hệ thống Hiệu Ứng Động Quán Tính & Chuyển Động Điện Ảnh
 * Mang lại trải nghiệm tương tác mượt mà, sống động 60FPS cho OmDiOm Studio.
 */
(function() {
  'use strict';

  // 1. THANH TRƯỢT CHUYỂN TAB CÓ QUÁN TÍNH (KINETIC SLIDING TAB INDICATOR)
  function khoiTaoTabIndicator() {
    const tabsContainer = document.querySelector('.tabs');
    if (!tabsContainer) return;

    let indicator = tabsContainer.querySelector('.tab-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'tab-indicator';
      tabsContainer.appendChild(indicator);
    }

    function capNhatViTriTab(activeTab, smooth) {
      if (!activeTab || !indicator) return;
      const left = activeTab.offsetLeft;
      const width = activeTab.offsetWidth;
      
      if (!smooth) {
        indicator.style.transition = 'none';
      } else {
        indicator.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), width 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
      }

      indicator.style.width = width + 'px';
      indicator.style.transform = 'translateX(' + left + 'px)';
    }

    const currentActive = tabsContainer.querySelector('.tab.active') || tabsContainer.querySelector('.tab');
    if (currentActive) {
      setTimeout(function() {
        capNhatViTriTab(currentActive, false);
      }, 50);
    }

    tabsContainer.addEventListener('click', function(e) {
      const tab = e.target.closest('.tab');
      if (tab) {
        capNhatViTriTab(tab, true);
      }
    });

    window.addEventListener('resize', function() {
      const act = tabsContainer.querySelector('.tab.active');
      if (act) capNhatViTriTab(act, false);
    });
  }

  // 2. HIỆU ỨNG NAM CHÂM KÉO NHẸ NÚT BẤM (MAGNETIC BUTTONS)
  function khoiTaoMagneticButtons() {
    const buttons = document.querySelectorAll('.btn.primary, .btn-rec, #btnSaveProj, .btn-emotion');
    
    buttons.forEach(function(btn) {
      btn.addEventListener('mousemove', function(e) {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        btn.style.transform = 'translate(' + (x * 0.16) + 'px, ' + (y * 0.16) + 'px)';
      });

      btn.addEventListener('mouseleave', function() {
        btn.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s';
        btn.style.transform = 'translate(0, 0)';
        setTimeout(function() {
          btn.style.transition = '';
        }, 300);
      });
    });
  }

  // 3. SÓNG ÂM SỐNG ĐỘNG HỮU CƠ (LIVING WAVE VISUALIZER SIMULATOR)
  function khoiTaoLivingWaves() {
    const waves = document.querySelectorAll('.wave');
    waves.forEach(function(wave) {
      // Đảm bảo đủ ít nhất 32 cột sóng nhỏ
      const currentBars = wave.querySelectorAll('i').length;
      if (currentBars < 36) {
        const needed = 36 - currentBars;
        for (let i = 0; i < needed; i++) {
          const bar = document.createElement('i');
          wave.appendChild(bar);
        }
      }
    });
  }

  // 4. CHUYỂN CẢNH KHÔNG GIAN KHI ĐỔI TAB (SPATIAL PAGE SLIDE)
  function khoiTaoSpatialTabTransitions() {
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const tabId = btn.getAttribute('data-tab');
        if (!tabId) return;

        const targetSection = document.getElementById(tabId);
        if (targetSection) {
          targetSection.classList.remove('tab-enter');
          void targetSection.offsetWidth; // Force reflow
          targetSection.classList.add('tab-enter');
        }
      });
    });
  }

  // Khởi động khi tài liệu đã nạp xong DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  function initAll() {
    khoiTaoTabIndicator();
    khoiTaoMagneticButtons();
    khoiTaoLivingWaves();
    khoiTaoSpatialTabTransitions();
  }

  window.capNhatTabIndicator = function() {
    const tabsContainer = document.querySelector('.tabs');
    if (!tabsContainer) return;
    const act = tabsContainer.querySelector('.tab.active');
    const indicator = tabsContainer.querySelector('.tab-indicator');
    if (act && indicator) {
      indicator.style.width = act.offsetWidth + 'px';
      indicator.style.transform = 'translateX(' + act.offsetLeft + 'px)';
    }
  };
})();

