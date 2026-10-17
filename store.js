/* ============================================================
   store.js — Product marketplace logic
   ============================================================ */

let customProducts = [];
const grid = document.getElementById('productGrid');
const statCount  = document.getElementById('statCount');
const resultCount= document.getElementById('resultCount');
const paymentModal = document.getElementById('paymentModal');
const paymentFile = document.getElementById('paymentFile');
const paymentPrice = document.getElementById('paymentPrice');
const paymentBalance = document.getElementById('paymentBalance');
const paymentAfter = document.getElementById('paymentAfter');
const paymentStatus = document.getElementById('paymentStatus');
const confirmPayment = document.getElementById('confirmPayment');
let selectedProduct = null;

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

/* Default seed products when running offline or on GitHub Pages */
const DEFAULT_PRODUCTS = [
  {
    id: 'prod-aurora-2026',
    name: 'Aurora Landing Page Luxury 2026',
    description: 'Template Landing Page phong cách Luxury Black & Gold, hiệu ứng ánh sáng hạt rơi, tối ưu responsive 100%.',
    price: 150000,
    category: 'web',
    fileName: 'aurora-landing-page.zip'
  },
  {
    id: 'prod-cyber-glass',
    name: 'Cyber Glass UI Kit Component',
    description: 'Bộ giao diện UI Kit thủy tinh hiện đại (Glassmorphism), hơn 40 component nút bấm, modal, form chuẩn.',
    price: 250000,
    category: 'ui',
    fileName: 'cyber-glass-ui.zip'
  },
  {
    id: 'prod-particles-core',
    name: 'Stardust Particle & Physics Engine',
    description: 'Engine hiệu ứng hạt rơi tương tác chuột, sóng chấn động shockwave khi click, tia laser kết nối chuột.',
    price: 99000,
    category: 'motion',
    fileName: 'stardust-particles.js'
  },
  {
    id: 'prod-neocommerce',
    name: 'NeoCommerce Full Source Code',
    description: 'Mẫu website bán hàng cao cấp tích hợp giỏ hàng, thanh toán QR MB Bank và quản trị sản phẩm trực quan.',
    price: 350000,
    category: 'web',
    fileName: 'neocommerce-template.zip'
  }
];

function getLocalProducts() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem('cn_products')) || [];
  } catch {
    list = [];
  }
  if (!list.length) {
    list = DEFAULT_PRODUCTS;
    localStorage.setItem('cn_products', JSON.stringify(list));
  }
  return list;
}

/* Art color themes */
const artThemes = ['art-lime', 'art-blue', 'art-purple', 'art-orange'];
const artIcons  = ['&lt;/&gt;', '{ }', '( )', '#[]'];

function renderProducts(list) {
  grid.innerHTML = '';
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-store">
        <div class="empty-icon">&lt;/&gt;</div>
        <h2>Chưa có sản phẩm</h2>
        <p>Admin đang chuẩn bị những bộ code đầu tiên.</p>
      </div>`;
    return;
  }
  list.forEach((product, i) => {
    const theme = artThemes[i % artThemes.length];
    const icon  = artIcons[i % artIcons.length];
    const card  = document.createElement('article');
    card.className = 'product-card';
    card.dataset.category = product.category || 'web';
    card.style.animationDelay = (i * 0.07) + 's';
    card.innerHTML = `
      <div class="product-art ${theme}">
        <div class="art-pattern"></div>
        <span class="art-code">${icon}</span>
      </div>
      <div class="product-meta">
        <span class="product-tag">${product.category || 'web'} · ${product.fileName || 'CODE FILE'}</span>
        <h2 class="product-name"></h2>
        <p class="product-desc"></p>
        <div class="product-bottom">
          <span class="product-price">${Number(product.price).toLocaleString('vi-VN')}đ</span>
          <button class="buy-btn" type="button" data-id="${product.id}">
            Mua
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          </button>
        </div>
      </div>`;
    card.querySelector('.product-name').textContent = product.name;
    card.querySelector('.product-desc').textContent = product.description;
    card.querySelector('.buy-btn').addEventListener('click', () => openPayment(product));
    grid.append(card);
  });
  window.refreshHoverTargets?.();
}

/* Filter tabs */
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filter-tab.active').classList.remove('active');
    btn.classList.add('active');
    const cat = btn.dataset.filter;
    const filtered = cat === 'all' ? customProducts : customProducts.filter(p => p.category === cat);
    resultCount.textContent = String(filtered.length).padStart(2, '0');
    renderProducts(filtered);
  });
});

function money(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

async function openPayment(product) {
  const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
  if (!session?.username) { showToast('Vui lòng đăng nhập để mua file.'); return; }
  selectedProduct = product;
  paymentFile.textContent = `${product.name} · ${product.fileName || 'file sản phẩm'}`;
  paymentPrice.textContent = money(product.price);
  paymentBalance.textContent = 'Đang kiểm tra...';
  paymentAfter.textContent = '--';
  paymentStatus.textContent = '';
  paymentStatus.className = 'payment-status';
  confirmPayment.disabled = true;
  paymentModal.classList.add('show');
  paymentModal.setAttribute('aria-hidden', 'false');

  try {
    const balance = await fetchBalance(session.username);
    paymentBalance.textContent = money(balance);
    paymentAfter.textContent = balance >= product.price ? money(balance - product.price) : 'Không đủ số dư';
    confirmPayment.disabled = balance < product.price;
    if (balance < product.price) {
      paymentStatus.textContent = `Bạn cần nạp thêm ${money(product.price - balance)} để mua file này.`;
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
  selectedProduct = null;
}

async function confirmSelectedPurchase() {
  const product = selectedProduct;
  const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
  if (!product || !session?.username) return;
  confirmPayment.disabled = true;
  paymentStatus.textContent = 'Đang xác nhận thanh toán...';
  paymentStatus.className = 'payment-status';

  // Try backend first if not running on static host
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/products/${encodeURIComponent(product.id)}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: session.username }),
      });
      if (response.ok) {
        closePayment();
        const link = document.createElement('a');
        link.href = `${API_BASE}/api/products/${encodeURIComponent(product.id)}/download`;
        link.download = product.fileName || 'code-file.zip';
        document.body.append(link);
        link.click();
        link.remove();
        showToast(`✓ Đã mua và đang tải "${product.name}"...`);
        return;
      } else if (response.status === 402) {
        const data = await response.json();
        paymentStatus.textContent = `Số dư không đủ. Hãy nạp thêm ${money(Number(data.price) - Number(data.balance))}.`;
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
    paymentStatus.textContent = `Số dư không đủ. Hãy nạp thêm ${money(product.price - balance)}.`;
    paymentStatus.classList.add('err');
    confirmPayment.disabled = false;
    return;
  }

  const newBalance = balance - product.price;
  localStorage.setItem(`cn_balance_${session.username}`, newBalance);

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

document.getElementById('confirmPayment').addEventListener('click', () => {
  confirmSelectedPurchase().catch(() => {
    paymentStatus.textContent = 'Không thể kết nối máy chủ thanh toán.';
    paymentStatus.classList.add('err');
    confirmPayment.disabled = false;
  });
});
document.getElementById('closePayment').addEventListener('click', closePayment);
document.querySelector('[data-close-payment]').addEventListener('click', closePayment);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePayment(); });

async function loadProducts() {
  let loaded = false;
  
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        customProducts = data.map(p => ({ ...p, fileName: p.file_name || p.fileName }));
        loaded = true;
      }
    }
  } catch (error) {
    console.warn('Could not fetch products from Supabase:', error);
  }

  if (!loaded || !customProducts.length) {
    customProducts = getLocalProducts();
  }

  const countStr = String(customProducts.length).padStart(2, '0');
  statCount.textContent = countStr;
  resultCount.textContent = countStr;
  renderProducts(customProducts);
}

loadProducts();
