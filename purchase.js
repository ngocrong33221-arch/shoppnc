/* ============================================================
   purchase.js — Luồng thanh toán dùng chung cho store.html và product.html
   ============================================================ */

const PURCHASE_API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

let purchaseProduct = null;

function purchaseMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

/* store.html đã có sẵn modal trong HTML, các trang khác thì tạo tại đây */
function ensurePaymentModal() {
  if (document.getElementById('paymentModal')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `
    <div class="payment-modal" id="paymentModal" aria-hidden="true">
      <div class="payment-backdrop" data-close-payment></div>
      <section class="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="paymentTitle">
        <button class="payment-close" type="button" id="closePayment" aria-label="Đóng">×</button>
        <span class="card-label">THANH TOÁN</span>
        <h2 id="paymentTitle">Xác nhận mua file</h2>
        <p class="payment-file" id="paymentFile"></p>
        <div class="payment-summary">
          <div><span>Giá sản phẩm</span><strong id="paymentPrice">0đ</strong></div>
          <div><span>Số dư hiện tại</span><strong id="paymentBalance">Đang kiểm tra...</strong></div>
          <div class="payment-after"><span>Số dư sau khi mua</span><strong id="paymentAfter">--</strong></div>
        </div>
        <p class="payment-status" id="paymentStatus" role="status"></p>
        <div class="payment-actions">
          <a class="payment-topup" id="topupLink" href="wallet.html">Nạp thêm tiền</a>
          <button class="btn-primary payment-confirm" type="button" id="confirmPayment">Xác nhận mua</button>
        </div>
      </section>
    </div>`;
  document.body.append(holder.firstElementChild);
}

ensurePaymentModal();

const paymentModal = document.getElementById('paymentModal');
const paymentFile = document.getElementById('paymentFile');
const paymentPrice = document.getElementById('paymentPrice');
const paymentBalance = document.getElementById('paymentBalance');
const paymentAfter = document.getElementById('paymentAfter');
const paymentStatus = document.getElementById('paymentStatus');
const confirmPayment = document.getElementById('confirmPayment');

async function openPayment(product) {
  const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
  if (!session?.username) { showToast('Vui lòng đăng nhập để mua file.'); return; }
  purchaseProduct = product;
  paymentFile.textContent = `${product.name} · ${product.fileName || product.file_name || 'file sản phẩm'}`;
  paymentPrice.textContent = purchaseMoney(product.price);
  paymentBalance.textContent = 'Đang kiểm tra...';
  paymentAfter.textContent = '--';
  paymentStatus.textContent = '';
  paymentStatus.className = 'payment-status';
  confirmPayment.disabled = true;
  paymentModal.classList.add('show');
  paymentModal.setAttribute('aria-hidden', 'false');

  try {
    const balance = await fetchBalance(session.username);
    paymentBalance.textContent = purchaseMoney(balance);
    paymentAfter.textContent = balance >= product.price ? purchaseMoney(balance - product.price) : 'Không đủ số dư';
    confirmPayment.disabled = balance < product.price;
    if (balance < product.price) {
      paymentStatus.textContent = `Bạn cần nạp thêm ${purchaseMoney(product.price - balance)} để mua file này.`;
      paymentStatus.classList.add('err');
    }
  } catch {
    paymentBalance.textContent = 'Không kiểm tra được';
    paymentStatus.textContent = 'Không thể kiểm tra số dư. Hãy thử lại.';
    paymentStatus.classList.add('err');
  }
}

function closePayment() {
  paymentModal.classList.remove('show');
  paymentModal.setAttribute('aria-hidden', 'true');
  purchaseProduct = null;
}

async function confirmSelectedPurchase() {
  const product = purchaseProduct;
  const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
  if (!product || !session?.username) return;
  confirmPayment.disabled = true;
  paymentStatus.textContent = 'Đang xác nhận thanh toán...';
  paymentStatus.className = 'payment-status';

  // Try backend first if not running on static host
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  if (!isStaticHost) {
    try {
      const response = await fetch(`${PURCHASE_API_BASE}/api/products/${encodeURIComponent(product.id)}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: session.username }),
      });
      if (response.ok) {
        closePayment();
        const link = document.createElement('a');
        link.href = `${PURCHASE_API_BASE}/api/products/${encodeURIComponent(product.id)}/download`;
        link.download = product.fileName || 'code-file.zip';
        document.body.append(link);
        link.click();
        link.remove();
        showToast(`✓ Đã mua và đang tải "${product.name}"...`);
        return;
      } else if (response.status === 402) {
        const data = await response.json();
        paymentStatus.textContent = `Số dư không đủ. Hãy nạp thêm ${purchaseMoney(Number(data.price) - Number(data.balance))}.`;
        paymentStatus.classList.add('err');
        confirmPayment.disabled = false;
        return;
      }
    } catch {
      // Fallback to local purchase
    }
  }

  // Local purchase fallback (GitHub Pages & Offline mode)
  const balance = await fetchBalance(session.username);
  if (balance < product.price) {
    paymentStatus.textContent = `Số dư không đủ. Hãy nạp thêm ${purchaseMoney(product.price - balance)}.`;
    paymentStatus.classList.add('err');
    confirmPayment.disabled = false;
    return;
  }

  const newBalance = balance - product.price;
  localStorage.setItem(`cn_balance_${session.username}`, newBalance);

  if (typeof supabase !== 'undefined' && supabase) {
    // Đồng bộ số dư lên Supabase, nếu không thì lần sau fetchBalance lại trả số dư cũ.
    // Bỏ qua ADM vì tài khoản này dùng số dư ảo (xem fetchBalance trong shared.js).
    if (session.username !== 'ADM') {
      try {
        const { error } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('username', session.username);
        if (error) console.error('Không cập nhật được số dư lên Supabase:', error);
      } catch (error) {
        console.error('Không cập nhật được số dư lên Supabase:', error);
      }
    }

    // Ghi lịch sử mua
    try {
      const { error } = await supabase.from('purchases').insert([{
        username: session.username,
        product_name: product.name,
        amount: product.price
      }]);
      if (error) console.error('Không ghi được lịch sử mua:', error);
    } catch (error) {
      console.error('Không ghi được lịch sử mua:', error);
    }
  }

  closePayment();

  const fileName = product.fileName || product.file_name || `${product.id}.zip`;

  // Sản phẩm đăng online: tải đúng file gốc (apk, zip, exe...) từ Supabase Storage
  if (product.file_url) {
    const link = document.createElement('a');
    link.href = product.file_url;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    showToast(`✓ Đã mua và đang tải "${product.name}"...`);
    return;
  }

  // Sản phẩm cũ (chưa có file thật): tạo file mẫu
  const codeContent = `/* ============================================================
   CodeNest Source Package: ${product.name}
   Category: ${product.category || 'Source Code'}
   Purchased by: ${session.username}
   Price: ${product.price.toLocaleString('vi-VN')} VND
   CodeNest Studio - Creative Developer Workspace
   ============================================================ */

console.log("Cảm ơn bạn đã mua ${product.name} tại CodeNest!");
// Mô tả: ${product.description}
`;
  const blob = new Blob([codeContent], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = product.fileName || `${product.id}.js`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(`✓ Đã mua và tải thành công "${product.name}"!`);
}

confirmPayment.addEventListener('click', () => {
  confirmSelectedPurchase().catch(() => {
    paymentStatus.textContent = 'Không thể kết nối máy chủ thanh toán.';
    paymentStatus.classList.add('err');
    confirmPayment.disabled = false;
  });
});
document.getElementById('closePayment').addEventListener('click', closePayment);
paymentModal.querySelector('[data-close-payment]').addEventListener('click', closePayment);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePayment(); });

window.CodeNestPurchase = { open: openPayment, close: closePayment };
