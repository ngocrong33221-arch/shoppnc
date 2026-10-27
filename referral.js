/* ============================================================
   referral.js — Trang hoa hồng & mã giới thiệu
   ============================================================ */

const refSession = JSON.parse(sessionStorage.getItem('cn_session') || 'null');

const ROLE_FALLBACK = {
  user: 'Thành viên',
  ctv: 'CTV',
  partner: 'Đối tác',
  manager: 'Quản lí',
  admin: 'Quản trị viên',
};

function roleLabel(role) {
  if (typeof ROLE_LABELS !== 'undefined' && ROLE_LABELS[role]) return ROLE_LABELS[role];
  return ROLE_FALLBACK[role] || 'Thành viên';
}

function money(value) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ';
}

function pageBase() {
  if (window.location.protocol === 'file:') {
    return window.location.href.replace(/[^/\\]*$/, '');
  }
  return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;
}

async function copyText(text, label) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.append(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    showToast(`${label} đã được sao chép!`);
  } catch {
    showToast('Không sao chép được. Vui lòng copy thủ công.');
  }
}

async function loadReferralCode() {
  const codeEl = document.getElementById('referralCode');
  const linkEl = document.getElementById('inviteLink');
  if (!refSession) return;

  const code = await ensureReferralCode(refSession.username);
  if (!code) {
    codeEl.textContent = 'N/A';
    linkEl.value = 'Mã giới thiệu chưa khả dụng cho tài khoản này.';
    document.getElementById('copyCode').disabled = true;
    document.getElementById('copyLink').disabled = true;
    return;
  }

  codeEl.textContent = code;
  linkEl.value = `${pageBase()}index.html?ref=${encodeURIComponent(code)}`;
}

function bindCopyButtons() {
  document.getElementById('copyCode').addEventListener('click', () => {
    copyText(document.getElementById('referralCode').textContent.trim(), 'Mã giới thiệu');
  });
  document.getElementById('copyLink').addEventListener('click', () => {
    copyText(document.getElementById('inviteLink').value, 'Liên kết mời');
  });
}

async function loadSummary() {
  if (!refSession) return;

  document.getElementById('currentRole').textContent = roleLabel(refSession.role);

  document.getElementById('walletBalance').textContent = money(await fetchBalance(refSession.username));
  document.getElementById('referredCount').textContent = await countReferredUsers(refSession.username);

  const summary = await fetchCommissionSummary(refSession.username);
  document.getElementById('totalCommission').textContent = money(summary.total);
  document.getElementById('purchaseCommission').textContent = money(summary.purchase);
  document.getElementById('topupCommission').textContent = money(summary.topup);

  renderHistory(summary.entries);
}

function renderHistory(entries) {
  const statusEl = document.getElementById('commissionStatus');
  const listEl = document.getElementById('commissionList');
  if (!entries || !entries.length) {
    statusEl.textContent = 'Bạn chưa có khoản hoa hồng nào.';
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'profile-details';

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'detail-row';

    const left = document.createElement('span');
    const kind = entry.kind === 'topup' ? 'Nạp tiền' : 'Mua hàng';
    const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString('vi-VN') : '';
    left.textContent = `${kind} · ${entry.detail || ''}${date ? ` · ${date}` : ''}`;

    const amount = document.createElement('strong');
    amount.className = 'commission-val';
    amount.textContent = `+${money(entry.amount)}`;

    row.append(left, amount);
    wrap.append(row);
  });

  listEl.replaceChildren(wrap);
}

if (refSession) {
  bindCopyButtons();
  loadReferralCode();
  loadSummary();
}
