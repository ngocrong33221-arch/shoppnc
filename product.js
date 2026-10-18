/* ============================================================
   product.js — Trang chi tiết sản phẩm
   ============================================================ */

const detailId = new URLSearchParams(window.location.search).get('id');

function detailText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function detailDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}

function detailExtension(fileName) {
  const match = String(fileName || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : '—';
}

function detailCategoryLabel(category) {
  return PRODUCT_CATEGORY_LABELS[category] || category || 'Khác';
}

function renderDetailSpecs(product) {
  const specs = document.getElementById('detailSpecs');
  const fileName = product.fileName || product.file_name || '—';
  [
    ['Danh mục', detailCategoryLabel(product.category)],
    ['Tệp bàn giao', fileName],
    ['Định dạng', detailExtension(fileName)],
    ['Ngày đăng', detailDate(product.created_at)],
    ['Mã sản phẩm', String(product.id)],
  ].forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    specs.append(dt, dd);
  });
}

function renderDetail(product) {
  const theme = resolveProductTheme(product);
  const art = document.getElementById('detailArt');
  if (art) art.setAttribute('style', productThemeStyle(theme));

  const extension = detailExtension(product.fileName || product.file_name);
  const iconEl = document.getElementById('detailIcon');
  if (iconEl) iconEl.innerHTML = productThemeIcon(theme);
  detailText('detailTopic', theme.label);
  detailText('detailTag', `${detailCategoryLabel(product.category)} · ${extension}`);
  detailText('detailName', product.name || 'Sản phẩm');
  detailText('detailDesc', product.description || 'Sản phẩm này chưa có mô tả.');
  detailText('detailPrice', `${Number(product.price || 0).toLocaleString('vi-VN')}đ`);
  detailText('crumbCategory', detailCategoryLabel(product.category));
  detailText('crumbName', product.name || 'Chi tiết');
  renderDetailSpecs(product);

  document.title = `${product.name || 'Sản phẩm'} | CodeNest`;
  document.getElementById('detailBuy').addEventListener('click', () => window.CodeNestPurchase.open(product));
}

function showMissingProduct() {
  document.getElementById('detailGrid').hidden = true;
  document.getElementById('detailMissing').hidden = false;
}

async function initProductDetail() {
  if (!detailId) { showMissingProduct(); return; }

  const catalog = await loadProductCatalog();
  const index = catalog.findIndex(product => String(product.id) === String(detailId));
  if (index === -1) { showMissingProduct(); return; }

  renderDetail(catalog[index]);
}

initProductDetail();
