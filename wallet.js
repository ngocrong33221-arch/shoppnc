/* ============================================================
   wallet.js — Wallet page logic
   ============================================================ */

const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

const balanceEl   = document.getElementById('balance');
const walletUser  = document.getElementById('walletUser');
const statusEl    = document.getElementById('walletStatus');
const transferCard= document.getElementById('transferCard');
const transferAmt = document.getElementById('transferAmount');
const transferCt  = document.getElementById('transferContent');
const bankQr      = document.getElementById('bankQr');
const countdownEl = document.getElementById('transferCountdown');
const refreshBtn  = document.getElementById('refreshBalance');

if (walletUser) walletUser.textContent = session?.username || 'USER';

let expiryTimer = null;
const selected = { amount: 0 };

/* ── Load balance ── */
async function loadBalance(animate = false) {
  if (refreshBtn) { refreshBtn.classList.add('spinning'); }
  let amt;
  try {
    amt = await fetchBalance(session.username);
  } catch {
    balanceEl.textContent = 'Không kết nối';
    if (refreshBtn) refreshBtn.classList.remove('spinning');
    return;
  }
  const formatted = amt.toLocaleString('vi-VN') + 'đ';
  if (animate && balanceEl.textContent !== formatted) {
    balanceEl.style.transition = 'opacity .2s';
    balanceEl.style.opacity = '0';
    setTimeout(() => { balanceEl.textContent = formatted; balanceEl.style.opacity = '1'; }, 200);
  } else {
    balanceEl.textContent = formatted;
  }
  if (refreshBtn) refreshBtn.classList.remove('spinning');
}

refreshBtn?.addEventListener('click', () => loadBalance(true));

/* ── Amount selection ── */
document.querySelectorAll('.amount-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.amount-btn.active')?.classList.remove('active');
    btn.classList.add('active');
    selected.amount = Number(btn.dataset.amount);
  });
});

/* ── Topup button ── */
document.getElementById('topupButton').addEventListener('click', async () => {
  if (!selected.amount) {
    statusEl.textContent = 'Hãy chọn một mệnh giá trước.';
    statusEl.className = 'form-status err';
    return;
  }
  statusEl.textContent = 'Đang tạo đơn nạp tiền...';
  statusEl.className = 'form-status ok';

  const expiresAt = Date.now() + 10 * 60 * 1000;
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const localContent = `CN ${session.username} ${randomSuffix}`;

  let orderContent = localContent;
  let backendOk = false;
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');

  if (!isStaticHost) {
    try {
      const res = await fetch(`${API_BASE}/api/topups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: session.username, amount: selected.amount })
      });
      if (res.ok) {
        const order = await res.json();
        orderContent = order.content || localContent;
        statusEl.textContent = order.telegram_sent ? 'Đã gửi đơn và thông báo admin.' : 'Đơn đã lưu, vui lòng quét mã QR để chuyển khoản.';
        backendOk = true;
      }
    } catch {
      // Fallback
    }
  }

  if (!backendOk) {
    statusEl.textContent = 'Đang gửi thông báo cho admin...';
    statusEl.className = 'form-status ok';
    const notified = await notifyAdminTelegram(
      `ĐƠN NẠP MỚI\nKhách hàng: ${session.username}\nSố tiền: ${selected.amount.toLocaleString('vi-VN')} VNĐ\nMã đơn: ${orderContent}`
    );
    statusEl.innerHTML = `${notified ? '✓ Đã gửi thông báo cho admin. ' : ''}✓ Đã tạo mã QR MB Bank thành công! <button id="demoApproveBtn" type="button" style="margin-left:8px;padding:4px 12px;border:1px solid var(--gold-bright);border-radius:6px;background:var(--gold-btn);color:#060608;font-size:11px;font-weight:700;cursor:pointer;">Duyệt nạp ngay (Demo)</button>`;
    statusEl.className = 'form-status ok';

    setTimeout(() => {
      document.getElementById('demoApproveBtn')?.addEventListener('click', () => {
        const current = Number(localStorage.getItem(`cn_balance_${session.username}`) || 0);
        const newBal = current + selected.amount;
        localStorage.setItem(`cn_balance_${session.username}`, newBal);
        loadBalance(true);
        showToast(`✓ Đã cộng ${selected.amount.toLocaleString('vi-VN')}đ vào ví thành công!`);
        statusEl.textContent = `✓ Đã duyệt cộng ${selected.amount.toLocaleString('vi-VN')}đ vào tài khoản!`;
      });
    }, 50);
  }

  displayOrder(selected.amount, orderContent, expiresAt);
  localStorage.setItem(`cn_pending_${session.username}`, JSON.stringify({
    amount: selected.amount,
    content: orderContent,
    expiresAt,
    status: 'pending'
  }));
});

function displayOrder(amount, content, expiresAt) {
  transferAmt.textContent = amount.toLocaleString('vi-VN') + 'đ';
  transferCt.textContent  = content;
  bankQr.src = `https://img.vietqr.io/image/MB-0832510710-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=DO%20THANH%20TRUNG`;
  transferCard.hidden = false;
  transferCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  clearInterval(expiryTimer);
  expiryTimer = setInterval(() => {
    const rem = expiresAt - Date.now();
    if (rem <= 0) {
      clearInterval(expiryTimer);
      countdownEl.textContent = 'HẾT HẠN';
      countdownEl.style.color = 'var(--err)';
      statusEl.textContent = 'Đơn đã hết hạn. Hãy tạo mã QR mới.';
      statusEl.className = 'form-status err';
      return;
    }
    const mm = String(Math.floor(rem / 60000)).padStart(2, '0');
    const ss = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');
    countdownEl.textContent = `${mm}:${ss}`;
  }, 1000);
}

loadBalance();
