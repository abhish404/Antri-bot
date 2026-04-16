// ═══════════════════════════════════════════════════════════
// dashboard.js — Admin Queue Dashboard Logic
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────
  let waNumber = '';
  let queueData = [];
  let refreshInterval = null;

  // ─── Phone Formatter ────────────────────────────────────
  // Format: +[CC]-[XXX]-[XXX]-[XXXX]
  // Example: +91-987-654-3210, +1-212-555-1234
  function formatPhone(phone) {
    if (!phone) return '—';
    const p = phone.replace(/\D/g, '');

    // Indian: 91 + 10 digits → +91-987-654-3210
    if (p.length === 12 && p.startsWith('91')) {
      const n = p.slice(2);
      return `+91-${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
    }

    // US/Canada: 1 + 10 digits → +1-212-555-1234
    if (p.length === 11 && p.startsWith('1')) {
      const n = p.slice(1);
      return `+1-${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
    }

    // UK: 44 + 10 digits → +44-791-112-3456
    if (p.length === 12 && p.startsWith('44')) {
      const n = p.slice(2);
      return `+44-${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
    }

    // Generic international: +CC-XXX-XXX-XXXX
    if (p.length > 10) {
      const cc = p.slice(0, p.length - 10);
      const n = p.slice(-10);
      return `+${cc}-${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`;
    }

    // 10-digit local: XXX-XXX-XXXX
    if (p.length === 10) {
      return `${p.slice(0,3)}-${p.slice(3,6)}-${p.slice(6)}`;
    }

    return phone;
  }

  // ─── DOM References ──────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const dateDisplay = $('#dashDate');
  const statTotal = $('#statTotal');
  const statTreated = $('#statTreated');
  const statWaiting = $('#statWaiting');
  const qrCanvas = $('#dashQrCanvas');
  const qrCode = $('#dashQrCode');
  const qrLoading = $('#dashQrLoading');
  const queueBody = $('#dashQueueBody');
  const queueTable = $('#dashQueueTable');
  const queueEmpty = $('#dashQueueEmpty');
  const queueCountBadge = $('#dashQueueCount');
  const logoutBtn = $('#dashLogoutBtn');
  const resetBtn = $('#dashResetBtn');
  const copyBtn = $('#dashCopyBtn');
  const toast = $('#dashToast');
  const modalOverlay = $('#dashModalOverlay');
  const modalInput = $('#dashModalInput');
  const modalCancel = $('#dashModalCancel');
  const modalConfirm = $('#dashModalConfirm');
  const modalToken = $('#dashModalToken');

  // ─── Current modal target ────────────────────────────────
  let modalTargetPhone = null;

  // ─── Auth Guard ──────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (!data.authenticated || data.role !== 'dashboard') {
        window.location.href = '/login.html';
        return false;
      }
      return true;
    } catch (e) {
      window.location.href = '/login.html';
      return false;
    }
  }

  // ─── Initialize ──────────────────────────────────────────
  async function init() {
    const authed = await checkAuth();
    if (!authed) return;

    // Show today's date
    const now = new Date();
    const formatted = now.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    dateDisplay.textContent = formatted;

    // Load config and initial data
    await loadConfig();
    await loadTodayCode();
    await loadQueue();

    // Start 1-second refresh
    refreshInterval = setInterval(loadQueue, 1000);
  }

  // ─── Load Config ─────────────────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch('/api/code/config');
      const data = await res.json();
      if (data.success && data.waNumber) {
        waNumber = data.waNumber;
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  // ─── Load Today's Code + QR ──────────────────────────────
  async function loadTodayCode() {
    try {
      const res = await fetch('/api/code/today');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      if (data.success) {
        qrCode.textContent = data.code;

        // Generate small QR
        if (qrLoading) qrLoading.style.display = 'none';
        qrCanvas.style.display = 'block';

        const qrContent = waNumber
          ? `https://wa.me/${waNumber}?text=${encodeURIComponent(data.code)}`
          : data.code;

        if (typeof QRCode !== 'undefined') {
          QRCode.toCanvas(qrCanvas, qrContent, {
            width: 200,
            margin: 0,
            color: { dark: '#1a1a2e', light: '#ffffff' },
            errorCorrectionLevel: 'H',
          });
        }
      }
    } catch (err) {
      console.error('Failed to load code:', err);
    }
  }

  // ─── Load Queue ──────────────────────────────────────────
  async function loadQueue() {
    try {
      const res = await fetch('/api/code/queue');
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      if (!data.success) return;

      queueData = data.tokens || [];
      const total = queueData.length;
      const treatedCount = queueData.filter((t) => t.status === 'treated').length;
      const waitingCount = total - treatedCount;

      // Update stats
      statTotal.textContent = total;
      statTreated.textContent = treatedCount;
      statWaiting.textContent = waitingCount;
      queueCountBadge.textContent = `${total} tokens`;

      // Render table
      if (total === 0) {
        queueEmpty.style.display = 'flex';
        queueTable.style.display = 'none';
      } else {
        queueEmpty.style.display = 'none';
        queueTable.style.display = 'table';
        renderQueue(queueData);
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }

  // ─── Render Queue Table ──────────────────────────────────
  function renderQueue(tokens) {
    const fragment = document.createDocumentFragment();

    tokens.forEach((t) => {
      const tr = document.createElement('tr');
      const isTreated = t.status === 'treated';
      if (isTreated) tr.classList.add('row-treated');

      // Token number
      const tdToken = document.createElement('td');
      tdToken.innerHTML = `<span class="dash-token-num">${t.token}</span>`;

      // Name
      const tdName = document.createElement('td');
      tdName.innerHTML = t.name
        ? `<span class="dash-customer-name">${t.name}</span>`
        : `<span class="dash-no-name">—</span>`;

      // Phone number
      const tdPhone = document.createElement('td');
      tdPhone.innerHTML = `<span class="dash-phone">${formatPhone(t.phone)}</span>`;

      // Time
      const tdTime = document.createElement('td');
      if (t.issuedAt) {
        const d = new Date(t.issuedAt);
        tdTime.innerHTML = `<span class="dash-time">${d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        })}</span>`;
      } else {
        tdTime.innerHTML = '<span class="dash-time">—</span>';
      }

      // Status
      const tdStatus = document.createElement('td');
      const statusWrap = document.createElement('div');
      statusWrap.className = 'dash-status-cell';

      if (isTreated) {
        const treatedBtn = document.createElement('span');
        treatedBtn.className = 'dash-btn-treated';
        treatedBtn.textContent = 'Treated ✓';

        const undoBtn = document.createElement('button');
        undoBtn.className = 'dash-btn-undo';
        undoBtn.textContent = 'Undo';
        undoBtn.addEventListener('click', () => openRetrieveModal(t.phone, t.token));

        statusWrap.appendChild(treatedBtn);
        statusWrap.appendChild(undoBtn);
      } else {
        const treatBtn = document.createElement('button');
        treatBtn.className = 'dash-btn-treat';
        treatBtn.textContent = 'Mark Treated';
        treatBtn.addEventListener('click', () => handleTreat(t.phone));

        statusWrap.appendChild(treatBtn);
      }

      tdStatus.appendChild(statusWrap);

      tr.appendChild(tdToken);
      tr.appendChild(tdName);
      tr.appendChild(tdPhone);
      tr.appendChild(tdTime);
      tr.appendChild(tdStatus);
      fragment.appendChild(tr);
    });

    queueBody.innerHTML = '';
    queueBody.appendChild(fragment);
  }

  // ─── Treat Handler ───────────────────────────────────────
  async function handleTreat(phone) {
    try {
      const res = await fetch('/api/code/queue/treat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Token #${data.token} marked as treated`, 'success');
        await loadQueue();
      } else {
        showToast(data.error || 'Failed to treat token', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  }

  // ─── Retrieve Modal ──────────────────────────────────────
  function openRetrieveModal(phone, tokenNum) {
    modalTargetPhone = phone;
    modalToken.textContent = `#${tokenNum}`;
    modalInput.value = '';
    modalConfirm.disabled = true;
    modalOverlay.classList.add('show');
    setTimeout(() => modalInput.focus(), 200);
  }

  function closeModal() {
    modalOverlay.classList.remove('show');
    modalTargetPhone = null;
    modalInput.value = '';
  }

  modalCancel.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  modalInput.addEventListener('input', () => {
    modalConfirm.disabled = !modalInput.value.trim();
  });

  modalConfirm.addEventListener('click', async () => {
    const reason = modalInput.value.trim();
    if (!reason || !modalTargetPhone) return;

    modalConfirm.disabled = true;
    modalConfirm.textContent = 'Reverting...';

    try {
      const res = await fetch('/api/code/queue/untreat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: modalTargetPhone, reason }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Token #${data.token} reverted to waiting`, 'success');
        closeModal();
        await loadQueue();
      } else {
        showToast(data.error || 'Failed to revert token', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Confirm Retrieve';
    }
  });

  // ─── Copy Code ───────────────────────────────────────────
  copyBtn.addEventListener('click', () => {
    const code = qrCode.textContent;
    if (!code || code === '------') return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('Passcode copied', 'success');
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    } else {
      // Fallback: select text
      const range = document.createRange();
      range.selectNodeContents(qrCode);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      showToast('Text selected — copy manually', 'success');
    }
  });

  // ─── Reset Queue ─────────────────────────────────────────
  resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset the entire queue for today? This cannot be undone.')) return;

    resetBtn.disabled = true;
    try {
      const res = await fetch('/api/code/queue/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Queue reset', 'success');
        await loadQueue();
      } else {
        showToast('Failed to reset queue', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      resetBtn.disabled = false;
    }
  });

  // ─── Logout ──────────────────────────────────────────────
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    window.location.href = '/login.html';
  });

  // ─── Toast ───────────────────────────────────────────────
  let toastTimer = null;
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `dash-toast dash-toast-${type} show`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ─── Start ───────────────────────────────────────────────
  init();
})();
