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
          <div class="payment-discount-line" id="paymentDiscountRow" style="display:none"><span>Giảm giá</span><strong id="paymentDiscount">-0đ</strong></div>
          <div><span>Số dư hiện tại</span><strong id="paymentBalance">Đang kiểm tra...</strong></div>
          <div class="payment-after"><span>Số dư sau khi mua</span><strong id="paymentAfter">--</strong></div>
        </div>
        <div class="payment-discount">
          <div class="discount-row">
            <input class="form-input discount-input" id="discountInput" type="text" placeholder="Nhập mã giảm giá" autocomplete="off" maxlength="32">
            <button class="discount-apply" type="button" id="applyDiscount">Áp dụng</button>
          </div>
          <p class="discount-note" id="discountNote"></p>
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
const paymentDiscountRow = document.getElementById('paymentDiscountRow');
const paymentDiscount = document.getElementById('paymentDiscount');
const paymentBalance = document.getElementById('paymentBalance');
const paymentAfter = document.getElementById('paymentAfter');
const paymentStatus = document.getElementById('paymentStatus');
const confirmPayment = document.getElementById('confirmPayment');
const discountInput = document.getElementById('discountInput');
const applyDiscount = document.getElementById('applyDiscount');
const discountNote = document.getElementById('discountNote');

let paymentBalanceValue = 0;
let appliedDiscount = null;

/* Số tiền phải trả sau khi áp mã giảm giá (không âm). */
function payableAmount(product) {
  const price = Number(product?.price) || 0;
  const cut = appliedDiscount ? Math.min(appliedDiscount.amount, price) : 0;
  return Math.max(0, price - cut);
}

/* Vẽ lại giá, giảm giá, số dư còn lại và trạng thái nút xác nhận. */
function syncPaymentTotals() {
  const product = purchaseProduct;
  if (!product) return;
  const price = Number(product.price) || 0;
  const final = payableAmount(product);

  paymentPrice.textContent = purchaseMoney(price);

  if (appliedDiscount && appliedDiscount.amount > 0) {
    paymentDiscountRow.style.display = '';
    paymentDiscount.textContent = `-${purchaseMoney(Math.min(appliedDiscount.amount, price))}`;
  } else {
    paymentDiscountRow.style.display = 'none';
  }

  const enough = paymentBalanceValue >= final;
  paymentAfter.textContent = enough ? purchaseMoney(paymentBalanceValue - final) : 'Không đủ số dư';
  confirmPayment.disabled = !enough;

  if (!enough) {
    paymentStatus.textContent = `Bạn cần nạp thêm ${purchaseMoney(final - paymentBalanceValue)} để mua file này.`;
    paymentStatus.className = 'payment-status err';
  } else if (appliedDiscount) {
    paymentStatus.textContent = `Đã áp dụng mã "${appliedDiscount.code}".`;
    paymentStatus.className = 'payment-status ok';
  } else {
    paymentStatus.textContent = '';
    paymentStatus.className = 'payment-status';
  }
}

/* Tìm mã giảm giá đang hoạt động trong Supabase. */
async function loadDiscountCode(code) {
  if (typeof supabase === 'undefined' || !supabase) return null;
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', code)
    .eq('active', true)
    .maybeSingle();
  return error ? null : (data || null);
}

async function applyDiscountCode() {
  const product = purchaseProduct;
  if (!product) return;
  const code = discountInput.value.trim().toUpperCase();
  discountNote.className = 'discount-note';

  if (!code) {
    appliedDiscount = null;
    discountNote.textContent = 'Vui lòng nhập mã giảm giá.';
    discountNote.classList.add('err');
    syncPaymentTotals();
    return;
  }

  const row = await loadDiscountCode(code);
  if (!row) {
    appliedDiscount = null;
    discountNote.textContent = 'Mã giảm giá không hợp lệ hoặc đã hết hiệu lực.';
    discountNote.classList.add('err');
    syncPaymentTotals();
    return;
  }

  const scope = row.product_ids;
  if (Array.isArray(scope) && scope.length && !scope.map(String).includes(String(product.id))) {
    appliedDiscount = null;
    discountNote.textContent = 'Mã này không áp dụng cho sản phẩm này.';
    discountNote.classList.add('err');
    syncPaymentTotals();
    return;
  }

  const price = Number(product.price) || 0;
  let amount = row.type === 'percent'
    ? Math.round(price * (Number(row.value) || 0) / 100)
    : Math.round(Number(row.value) || 0);
  amount = Math.min(Math.max(amount, 0), price);

  if (amount <= 0) {
    appliedDiscount = null;
    discountNote.textContent = 'Mã này không giảm được cho đơn hàng này.';
    discountNote.classList.add('err');
    syncPaymentTotals();
    return;
  }

  appliedDiscount = { code: row.code, amount, type: row.type, value: row.value };
  discountNote.textContent = `✓ Đã giảm ${purchaseMoney(amount)} cho đơn hàng.`;
  discountNote.classList.add('ok');
  syncPaymentTotals();
}

async function openPayment(product) {
  const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
  if (!session?.username) { showToast('Vui lòng đăng nhập để mua file.'); return; }
  purchaseProduct = product;
  appliedDiscount = null;
  paymentBalanceValue = 0;
  paymentFile.textContent = `${product.name} · ${product.fileName || product.file_name || 'file sản phẩm'}`;
  paymentPrice.textContent = purchaseMoney(product.price);
  paymentDiscountRow.style.display = 'none';
  paymentBalance.textContent = 'Đang kiểm tra...';
  paymentAfter.textContent = '--';
  paymentStatus.textContent = '';
  paymentStatus.className = 'payment-status';
  if (discountInput) discountInput.value = '';
  if (discountNote) { discountNote.textContent = ''; discountNote.className = 'discount-note'; }
  confirmPayment.disabled = true;
  paymentModal.classList.add('show');
  paymentModal.setAttribute('aria-hidden', 'false');

  try {
    paymentBalanceValue = await fetchBalance(session.username);
    paymentBalance.textContent = purchaseMoney(paymentBalanceValue);
    syncPaymentTotals();
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
  const amount = payableAmount(product);
  const discountAmount = Math.max(0, (Number(product.price) || 0) - amount);
  const usedCode = appliedDiscount ? appliedDiscount.code : null;

  const balance = await fetchBalance(session.username);
  if (balance < amount) {
    paymentStatus.textContent = `Số dư không đủ. Hãy nạp thêm ${purchaseMoney(amount - balance)}.`;
    paymentStatus.classList.add('err');
    confirmPayment.disabled = false;
    return;
  }

  const newBalance = balance - amount;
  localStorage.setItem(`cn_balance_${session.username}`, newBalance);

  if (typeof supabase !== 'undefined' && supabase) {
    // Đồng bộ số dư lên Supabase, nếu không thì lần sau fetchBalance lại trả số dư cũ.
    try {
      const { error } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('username', session.username);
      if (error) console.error('Không cập nhật được số dư lên Supabase:', error);
    } catch (error) {
      console.error('Không cập nhật được số dư lên Supabase:', error);
    }

    // Ghi lịch sử mua (kèm mã giảm giá nếu có)
    try {
      const { error } = await supabase.from('purchases').insert([{
        username: session.username,
        product_name: product.name,
        amount,
        discount_code: usedCode,
        discount_amount: discountAmount
      }]);
      if (error) console.error('Không ghi được lịch sử mua:', error);
    } catch (error) {
      console.error('Không ghi được lịch sử mua:', error);
    }

    // Chia hoa hồng cho tuyến người giới thiệu của người mua
    try {
      await payoutPurchaseCommission({
        buyer: session.username,
        baseAmount: amount,
        productName: product.name
      });
    } catch (error) {
      console.warn('Không chia được hoa hồng:', error);
    }
  }

  closePayment();

  const fileName = product.fileName || product.file_name || `${product.id}.zip`;

  // Sản phẩm đăng online: tải đúng file gốc (apk, zip, exe...) từ Supabase Storage
  if (product.file_url) {
    showToast(`✓ Đã mua "${product.name}", đang tải file...`);
    const downloaded = await downloadProductFile(product.file_url, fileName);
    if (!downloaded) {
      paymentStatus.textContent = 'Đã trừ tiền nhưng chưa tải được file. Vào Tài khoản > Lịch sử mua để tải lại.';
      paymentStatus.classList.add('err');
    }
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
if (applyDiscount) {
  applyDiscount.addEventListener('click', () => { applyDiscountCode(); });
}
if (discountInput) {
  discountInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); applyDiscountCode(); }
  });
}
document.getElementById('closePayment').addEventListener('click', closePayment);
paymentModal.querySelector('[data-close-payment]').addEventListener('click', closePayment);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePayment(); });

window.CodeNestPurchase = { open: openPayment, close: closePayment };
