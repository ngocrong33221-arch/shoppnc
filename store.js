/* ============================================================
   store.js — Product marketplace logic
   ============================================================ */

let customProducts = [];
const grid = document.getElementById('productGrid');
const statCount  = document.getElementById('statCount');
const resultCount= document.getElementById('resultCount');

/* Art color themes */
const artThemes = ['art-lime', 'art-blue', 'art-purple', 'art-orange'];
const artIcons  = ['&lt;/&gt;', '{ }', '( )', '#[]'];

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

async function loadProducts() {
  customProducts = await loadProductCatalog();
  const countStr = String(customProducts.length).padStart(2, '0');
  statCount.textContent = countStr;
  resultCount.textContent = countStr;
  renderProducts(customProducts);
}

loadProducts();
