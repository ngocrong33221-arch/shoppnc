/* ============================================================
   account.js — Account page logic
   ============================================================ */

const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

document.getElementById('avatar').textContent = (session?.username || '?').charAt(0).toUpperCase();
document.getElementById('accountName').textContent = session?.displayName || session?.username || 'Khách';
document.getElementById('accountEmail').textContent = session?.username || '—';
document.getElementById('accountRole').textContent = session?.role === 'admin' ? 'Quản trị viên' : 'Thành viên';

async function loadProfile() {
  if (!session) return;
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  let loaded = false;
  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'same-origin' });
      if (response.ok) {
        const profile = await response.json();
        const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
        document.getElementById('accountDate').textContent = createdAt
          ? createdAt.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—';
        document.getElementById('accountName').textContent = profile.displayName || session.username;
        loaded = true;
      }
    } catch {
      // Fallback
    }
  }

  if (!loaded) {
    const accounts = JSON.parse(localStorage.getItem('cn_accounts') || '[]');
    const acc = accounts.find(a => a.username.toLowerCase() === session.username.toLowerCase());
    const createdAt = acc?.createdAt ? new Date(acc.createdAt) : new Date();
    document.getElementById('accountDate').textContent = createdAt.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('accountName').textContent = session.displayName || session.username;
  }
}

async function loadBalance() {
  if (!session) return;
  try {
    const bal = await fetchBalance(session.username);
    document.getElementById('accountBalance').textContent = bal.toLocaleString('vi-VN') + 'đ';
  } catch {
    document.getElementById('accountBalance').textContent = '0đ';
  }
}
async function loadPurchases() {
  const statusEl = document.getElementById('purchaseStatus');
  const listEl = document.getElementById('purchaseList');
  if (!session) {
    statusEl.textContent = 'Bạn cần đăng nhập để xem lịch sử mua.';
    return;
  }

  let items = [];
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('username', session.username)
        .order('created_at', { ascending: false });
      if (!error && data) items = data;
    }
  } catch (error) {
    console.warn('Could not load purchases from Supabase:', error);
  }

  if (!items.length) {
    statusEl.textContent = 'Bạn chưa mua sản phẩm nào.';
    return;
  }

  // Ghép tên sản phẩm với file đã lưu trên Supabase để khách tải lại bất cứ lúc nào.
  const catalog = await loadProductCatalog();
  const filesByName = new Map();
  catalog.forEach(product => {
    if (product && product.name) filesByName.set(String(product.name).trim().toLowerCase(), product);
  });

  const wrap = document.createElement('div');
  wrap.className = 'profile-details';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const name = document.createElement('span');
    name.textContent = item.product_name;

    const right = document.createElement('div');
    right.className = 'detail-row-end';
    const meta = document.createElement('strong');
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '';
    meta.textContent = `${Number(item.amount || 0).toLocaleString('vi-VN')}đ${date ? ` · ${date}` : ''}`;
    right.append(meta);

    const product = filesByName.get(String(item.product_name || '').trim().toLowerCase());
    if (product && product.file_url) {
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'purchase-download';
      download.textContent = 'Tải file';
      download.addEventListener('click', async () => {
        download.disabled = true;
        download.textContent = 'Đang tải...';
        const ok = await downloadProductFile(product.file_url, product.fileName || product.file_name || 'san-pham');
        if (!ok) showToast('Không tải được file. Vui lòng thử lại.');
        download.disabled = false;
        download.textContent = 'Tải file';
      });
      right.append(download);
    }

    row.append(name, right);
    wrap.append(row);
  });
  listEl.replaceChildren(wrap);
}

loadProfile();
loadBalance();
loadPurchases();

document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    const show = target.type === 'password';
    target.type = show ? 'text' : 'password';
    btn.classList.toggle('is-visible', show);
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    btn.title = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
  });
});

document.getElementById('passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const statusEl = document.getElementById('passwordStatus');
  if (!session) {
    statusEl.textContent = 'Bạn cần đăng nhập lại để đổi mật khẩu.';
    statusEl.className = 'form-status err';
    return;
  }
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  statusEl.className = 'form-status';

  if (newPassword !== confirmPassword) {
    statusEl.textContent = 'Mật khẩu nhập lại chưa khớp.';
    statusEl.classList.add('err');
    return;
  }

  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  let changed = false;

  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (response.ok) {
        changed = true;
      } else {
        const result = await response.json();
        statusEl.textContent = result.error === 'current password is incorrect'
          ? 'Mật khẩu hiện tại không đúng.'
          : result.error === 'password changes are not available for this account'
            ? 'Tài khoản này không hỗ trợ đổi mật khẩu tại đây.'
            : 'Không thể đổi mật khẩu. Vui lòng thử lại.';
        statusEl.classList.add('err');
        return;
      }
    } catch {
      // Fallback
    }
  }

  // LocalStorage password change fallback
  if (!changed) {
    const accounts = JSON.parse(localStorage.getItem('cn_accounts') || '[]');
    let acc = accounts.find(a => a.username.toLowerCase() === session.username.toLowerCase());
    if (session.username.toLowerCase() === 'adm') {
      if (!acc) {
        acc = { username: 'ADM', password: 'CodeNest@2026', role: 'admin' };
        accounts.push(acc);
      }
    }

    if (acc) {
      if (acc.password !== currentPassword) {
        statusEl.textContent = 'Mật khẩu hiện tại không đúng.';
        statusEl.classList.add('err');
        return;
      }
      acc.password = newPassword;
      localStorage.setItem('cn_accounts', JSON.stringify(accounts));
    }
  }

  statusEl.textContent = '✓ Đã đổi mật khẩu thành công.';
  statusEl.classList.add('ok');
  event.target.reset();
  showToast('Mật khẩu đã được cập nhật thành công!');
});
