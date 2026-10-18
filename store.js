/* ============================================================
   store.js — Product marketplace logic
   ============================================================ */

let customProducts = [];
const grid = document.getElementById('productGrid');
const statCount  = document.getElementById('statCount');
const resultCount= document.getElementById('resultCount');

/* Art cover themes dựa theo tên mặt hàng */

function productUrl(product) {
  return `product.html?id=${encodeURIComponent(product.id)}`;
}

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
    const theme = resolveProductTheme(product);
    const card  = document.createElement('article');
    card.className = 'product-card';
    card.dataset.category = product.category || 'web';
    card.style.animationDelay = (i * 0.07) + 's';
    card.innerHTML = `
      <div class="product-art" style="${productThemeStyle(theme)}">
        <div class="art-pattern"></div>
        <span class="art-badge">${productThemeIcon(theme)}</span>
        <span class="art-topic">${theme.label}</span>
      </div>
      <div class="product-meta">
        <span class="product-tag">${PRODUCT_CATEGORY_LABELS[product.category] || product.category || 'web'} · ${product.fileName || 'CODE FILE'}</span>
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
    card.addEventListener('click', () => {
      window.location.href = productUrl(product);
    });
    card.querySelector('.buy-btn').addEventListener('click', event => {
      event.stopPropagation();
      window.CodeNestPurchase.open(product);
    });
    grid.append(card);
  });
  window.refreshHoverTargets?.();
}

/* Filter tabs & Search */
const searchInput = document.getElementById('searchInput');

function applyFilters() {
  const activeTab = document.querySelector('.filter-tab.active');
  const cat = activeTab ? activeTab.dataset.filter : 'all';
  const query = (searchInput?.value || '').trim().toLowerCase();

  let filtered = cat === 'all' ? customProducts : customProducts.filter(p => p.category === cat);
  if (query) {
    filtered = filtered.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query) ||
      (p.category || '').toLowerCase().includes(query) ||
      (p.fileName || '').toLowerCase().includes(query)
    );
  }
  resultCount.textContent = String(filtered.length).padStart(2, '0');
  renderProducts(filtered);
}

searchInput?.addEventListener('input', applyFilters);

document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.filter-tab.active')?.classList.remove('active');
    btn.classList.add('active');
    applyFilters();
  });
});

async function loadProducts() {
  customProducts = await loadProductCatalog();
  const countStr = String(customProducts.length).padStart(2, '0');
  statCount.textContent = countStr;
  resultCount.textContent = countStr;
  applyFilters();
}

loadProducts();
