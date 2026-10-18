/* ============================================================
   admin.js — Admin page logic
   ============================================================ */

const session = JSON.parse(sessionStorage.getItem('cn_session') || 'null');
if (!session || session.role !== 'admin') navigate('store.html');

const form        = document.getElementById('productForm');
const fileInput   = document.getElementById('productFile');
const fileDrop    = document.getElementById('fileDrop');
const fileLabel   = document.getElementById('fileLabel');
const statusEl    = document.getElementById('formStatus');
const previewName = document.getElementById('previewName');
const previewDesc = document.getElementById('previewDescription');
const previewPrc  = document.getElementById('previewPrice');
const nameInput   = document.getElementById('productName');
const descInput   = document.getElementById('productDescription');
const priceInput  = document.getElementById('productPrice');
const productColor     = document.getElementById('productColor');
const productColorAuto = document.getElementById('productColorAuto');

/* Ô chọn màu chỉ bật khi Admin bỏ chọn "Theo màu theme" */
productColorAuto.addEventListener('change', () => {
  productColor.disabled = productColorAuto.checked;
});

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;
const STORAGE_BUCKET = 'products';
/* File được chia nhỏ khi tải lên để không đứt giữa đường. Phía trình duyệt không giới hạn dung lượng;
   giới hạn (nếu có) là do cấu hình bucket trên Supabase. */
const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;
const THEME_KEY = 'cn_theme';
const isStaticHost = window.location.protocol === 'file:' || 
                     window.location.hostname.includes('github.io') || 
                     window.location.hostname.includes('localhost') || 
                     window.location.hostname === '127.0.0.1';

/* ── File drop zone ── */
fileDrop.addEventListener('dragover',  e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault();
  fileDrop.classList.remove('dragover');
  fileInput.files = e.dataTransfer.files;
  fileInput.dispatchEvent(new Event('change'));
});
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) {
    fileLabel.textContent = 'Chọn hoặc kéo thả file vào đây';
    statusEl.textContent = '';
    return;
  }
  const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
  fileLabel.textContent = `${f.name} · đã nhận (${sizeMb}MB)`;
  statusEl.textContent = '';
});

/* ── Tải file lên Supabase Storage ──
   File lớn được đẩy theo từng phần (resumable) nên không bị giới hạn dung lượng ở phía
   trình duyệt và có thể tải lại phần còn thiếu nếu mạng chập chờn. */
function uploadFile(file, path) {
  if (typeof tus === 'undefined') {
    // Không có thư viện chia nhỏ thì đẩy nguyên file trong một lần
    return supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return data;
      });
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-upsert': 'false'
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: UPLOAD_CHUNK_SIZE,
      metadata: {
        bucketName: STORAGE_BUCKET,
        objectName: path,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600'
      },
      onProgress: (sent, total) => {
        const percent = total ? Math.round((sent / total) * 100) : 0;
        statusEl.textContent = `Đang tải file... ${percent}%`;
      },
      onSuccess: () => resolve({ path }),
      onError: reject
    });
    upload.start();
  });
}

/* ── Live preview ── */
nameInput.addEventListener('input',  () => { previewName.textContent = nameInput.value  || 'Tên sản phẩm của bạn'; });
descInput.addEventListener('input',  () => { previewDesc.textContent = descInput.value  || 'Mô tả ngắn sẽ xuất hiện ở đây.'; });
priceInput.addEventListener('input', () => { previewPrc.textContent  = `${Number(priceInput.value || 0).toLocaleString('vi-VN')}đ`; });

/* ── Submit ── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) { statusEl.textContent = 'Hãy chọn file muốn đăng.'; statusEl.className = 'form-status err'; return; }

  const product = {
    id:          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name:        nameInput.value.trim(),
    description: descInput.value.trim(),
    price:       Number(priceInput.value),
    category:    document.getElementById('productCategory').value,
    fileName:    file.name,
    createdAt:   new Date().toISOString()
  };

  const btn = document.getElementById('uploadBtn');
  btn.disabled = true;
  statusEl.textContent = 'Đang tải file...';
  statusEl.className = 'form-status ok';

  try {
    if (typeof supabase !== 'undefined' && supabase && supabase.storage) {
      // 1. Tải file gốc (apk, zip, exe...) lên Supabase Storage — không giới hạn dung lượng
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${Date.now()}-${safeName}`;
      await uploadFile(file, path);

      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      // 2. Lưu thông tin sản phẩm kèm link file thật cho khách tải
      const { data: inserted, error } = await supabase
        .from('products')
        .insert([{
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          file_name: product.fileName,
          file_url: urlData?.publicUrl || null
        }])
        .select()
        .single();

      if (error) throw error;

      // 3. Nếu Admin đặt màu riêng cho ảnh sản phẩm thì lưu kèm vào file theme
      if (!productColorAuto.checked && inserted && inserted.id !== undefined) {
        await setProductArtColor(inserted.id, productColor.value);
      }

      statusEl.textContent = '✓ Đã đăng sản phẩm thành công!';
      statusEl.className = 'form-status ok';
      form.reset();
      productColor.disabled = true;
      fileLabel.textContent = 'Chọn hoặc kéo thả file vào đây';
      previewName.textContent = 'Tên sản phẩm của bạn';
      previewDesc.textContent = 'Mô tả ngắn sẽ xuất hiện ở đây.';
      previewPrc.textContent  = '0đ';
      showToast('Sản phẩm đã được đăng thành công!');
      renderInventory();
      btn.disabled = false;
      return;
    }
  } catch (error) {
    console.error('Upload error:', error);
    statusEl.textContent = `Lỗi đăng sản phẩm: ${error.message || error}`;
    statusEl.className = 'form-status err';
    btn.disabled = false;
    return;
  }

  // Local fallback (chỉ dùng khi chưa cấu hình Supabase)
  let localProducts = [];
  try {
    localProducts = JSON.parse(localStorage.getItem('cn_products')) || [];
  } catch {
    localProducts = [];
  }
  localProducts.unshift(product);
  localStorage.setItem('cn_products', JSON.stringify(localProducts));

  statusEl.textContent = '✓ Đã đăng sản phẩm thành công! (Lưu cục bộ — file không được tải lên)';
  statusEl.className = 'form-status ok';
  form.reset();
  fileLabel.textContent = 'Chọn hoặc kéo thả file vào đây';
  previewName.textContent = 'Tên sản phẩm của bạn';
  previewDesc.textContent = 'Mô tả ngắn sẽ xuất hiện ở đây.';
  previewPrc.textContent  = '0đ';
  showToast('Sản phẩm đã được đăng thành công!');
  renderInventory();
  btn.disabled = false;
});

/* ── Render inventory ── */
async function renderInventory() {
  let products = [];
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) products = data;
    }
  } catch (error) {
    console.warn('Could not fetch products from Supabase:', error);
  }

  // Fallback to local
  if (!products.length) {
    try {
      products = JSON.parse(localStorage.getItem('cn_products')) || [];
    } catch {
      products = [];
    }
  }

  const inv   = document.getElementById('productInventory');
  const count = document.getElementById('productCount');
  count.textContent = `${products.length} sản phẩm`;
  inv.innerHTML = '';

  if (!products.length) {
    inv.innerHTML = `
      <div class="empty-inventory">
        <span>&lt;/&gt;</span>
        <strong>Chưa có sản phẩm nào</strong>
        <p>Sản phẩm bạn đăng sẽ xuất hiện ở đây.</p>
      </div>`;
    return;
  }

  products.forEach((p, i) => {
    const item = document.createElement('article');
    item.className = 'inventory-item';
    item.style.animationDelay = (i * .06) + 's';
    item.innerHTML = `
      <div class="inv-item-info">
        <span class="inv-cat">${p.category || 'web'} · ${p.file_name || p.fileName || 'CODE'}</span>
        <h3 class="inv-name"></h3>
        <p class="inv-desc"></p>
      </div>
      <div class="inv-actions">
        <span class="inv-price">${Number(p.price).toLocaleString('vi-VN')}đ</span>
        <input class="inv-color" type="color" title="Màu ảnh sản phẩm"
               value="${readArtColors()[String(p.id)] || '#38bdf8'}">
        <button class="delete-btn" type="button">Xóa</button>
      </div>`;
    item.querySelector('.inv-name').textContent = p.name;
    item.querySelector('.inv-desc').textContent = p.description;

    item.querySelector('.inv-color').addEventListener('change', async event => {
      const result = await setProductArtColor(p.id, event.target.value);
      showToast(result && result.ok === false
        ? `Chưa phát được màu cho khách (${result.message})`
        : 'Đã đổi màu ảnh sản phẩm');
    });

    item.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`Xóa sản phẩm "${p.name}"?`)) return;
      
      try {
        if (typeof supabase !== 'undefined' && supabase) {
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', p.id);
          
          if (error) throw error;
          showToast(`Đã xóa "${p.name}"`);
          renderInventory();
          return;
        }
      } catch (error) {
        console.error('Delete error:', error);
      }

      // Local fallback
      let localProducts = JSON.parse(localStorage.getItem('cn_products') || '[]');
      localProducts = localProducts.filter(item => item.id !== p.id);
      localStorage.setItem('cn_products', JSON.stringify(localProducts));
      showToast(`Đã xóa "${p.name}"`);
      renderInventory();
    });
    inv.append(item);
  });
  window.refreshHoverTargets?.();
}

const userInventory = document.getElementById('userInventory');
const userCount = document.getElementById('userCount');
const userInput = document.getElementById('balanceUser');
const memberSuggestions = document.getElementById('memberAccountSuggestions');
const usersStatus = document.getElementById('usersStatus');
const managedAccount = document.getElementById('managedAccount');
const activityMember = document.getElementById('activityMember');
const activityStatus = document.getElementById('activityStatus');
const activityRows = document.getElementById('activityRows');
const managedUsername = document.getElementById('managedUsername');
const managedPassword = document.getElementById('managedPassword');
const accountManagementStatus = document.getElementById('accountManagementStatus');
let memberAccounts = [];

function formatAdminMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function clearMemberActivity() {
  activityStatus.textContent = activityMember.value
    ? 'Bấm “Xem lịch sử” để tải giao dịch của tài khoản này.'
    : 'Chọn một thành viên để xem toàn bộ giao dịch.';
  activityStatus.className = 'form-status';
  document.getElementById('activityTopups').textContent = '—';
  document.getElementById('activityPending').textContent = '—';
  document.getElementById('activityPurchases').textContent = '—';
  activityRows.replaceChildren();
  const emptyRow = document.createElement('tr');
  const emptyCell = document.createElement('td');
  emptyCell.className = 'activity-empty';
  emptyCell.colSpan = 5;
  emptyCell.textContent = 'Chưa chọn tài khoản thành viên.';
  emptyRow.append(emptyCell);
  activityRows.append(emptyRow);
}

function formatAdminDate(value) {
  if (!value) return 'Chưa đăng nhập';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Không xác định'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

async function renderUsers() {
  usersStatus.textContent = '';
  usersStatus.className = 'form-status';
  let users = [];

  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username', { ascending: true });
      
      if (!error) users = data;
    }
  } catch (error) {
    console.warn('Could not fetch users from Supabase:', error);
  }

  if (!users.length) {
    const localAccs = JSON.parse(localStorage.getItem('cn_accounts') || '[]');
    users = localAccs.map(a => ({
      username: a.username,
      displayName: a.displayName || a.username,
      role: a.role || 'user',
      balance: Number(localStorage.getItem(`cn_balance_${a.username}`) || 0),
      createdAt: a.createdAt || new Date().toISOString()
    }));
  }

  try {
    userCount.textContent = `${users.length} tài khoản`;
    userInventory.replaceChildren();
    memberSuggestions.replaceChildren();
    memberAccounts = users;
    const previousManagedUsername = managedAccount.value;
    const previousActivityUsername = activityMember.value;
    managedAccount.replaceChildren(new Option('Chọn thành viên', ''));
    activityMember.replaceChildren(new Option('Chọn thành viên', ''));
    memberAccounts.filter(user => user.role === 'user').forEach(user => {
      managedAccount.add(new Option(`${user.displayName || user.username} · ${user.username}`, user.username));
      activityMember.add(new Option(`${user.displayName || user.username} · ${user.username}`, user.username));
    });
    activityMember.value = memberAccounts.some(user =>
      user.username === previousActivityUsername && user.role === 'user'
    ) ? previousActivityUsername : '';
    if (!activityMember.value) clearMemberActivity();
    if (memberAccounts.some(user => user.username === previousManagedUsername && user.role === 'user')) {
      managedAccount.value = previousManagedUsername;
    } else {
      managedUsername.value = '';
      managedPassword.value = '';
    }
    memberAccounts.forEach(user => {
      const suggestion = new Option(user.username, user.username);
      suggestion.label = user.displayName || user.username;
      memberSuggestions.append(suggestion);
    });

    if (!users.length) {
      const empty = document.createElement('div');
      empty.className = 'member-empty';
      empty.textContent = 'Chưa có tài khoản thành viên nào.';
      userInventory.append(empty);
      return;
    }

    users.forEach(user => {
      const row = document.createElement('article');
      row.className = 'member-row';
      const primary = document.createElement('div');
      primary.className = 'member-primary';
      const name = document.createElement('strong');
      name.className = 'member-name';
      name.textContent = user.displayName || user.username;
      const selectMember = () => {
        userInput.value = user.username;
        usersStatus.textContent = `Đã chọn tài khoản ${user.username}.`;
        usersStatus.className = 'form-status ok';
        document.getElementById('balanceAmount').focus();
      };
      row.classList.add('member-row-selectable');
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `Chọn tài khoản ${user.username}`);
      row.addEventListener('click', selectMember);
      row.addEventListener('keydown', event => {
        if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          selectMember();
        }
      });
      const meta = document.createElement('span');
      meta.className = 'member-meta';
      meta.textContent = `${user.username} · ${user.role === 'admin' ? 'Quản trị viên' : user.authProvider || 'Thành viên'}`;
      primary.append(name, meta);
      if (user.role === 'user') {
        const manageButton = document.createElement('button');
        manageButton.className = 'member-manage-button';
        manageButton.type = 'button';
        manageButton.textContent = 'Quản lý TK';
        manageButton.addEventListener('click', event => {
          event.stopPropagation();
          managedAccount.value = user.username;
          managedUsername.value = user.username;
          managedPassword.value = '';
          accountManagementStatus.textContent = 'Mật khẩu cũ không thể xem lại; nhập mật khẩu mới nếu muốn đặt lại.';
          accountManagementStatus.className = 'form-status';
          managedUsername.focus();
        });
        primary.append(manageButton);
      }
      row.append(primary);

      [
        ['Ngày đăng ký', formatAdminDate(user.createdAt)],
        ['Đăng nhập gần nhất', formatAdminDate(user.lastLoginAt)],
        ['Số dư', `${Number(user.balance).toLocaleString('vi-VN')}đ`],
        ['Mật khẩu', 'Không thể xem'],
      ].forEach(([label, value]) => {
        const detail = document.createElement('div');
        detail.className = 'member-detail';
        const detailLabel = document.createElement('span');
        detailLabel.textContent = label;
        const detailValue = document.createElement('strong');
        detailValue.textContent = value;
        if (label === 'Số dư') detailValue.className = 'member-balance';
        detail.append(detailLabel, detailValue);
        row.append(detail);
      });
      userInventory.append(row);
    });
    window.refreshHoverTargets?.();
  } catch (error) {
    console.error('Could not load admin accounts:', error);
    usersStatus.textContent = error.message || 'Không kết nối được máy chủ.';
    usersStatus.className = 'form-status err';
  }
}

document.getElementById('refreshUsers').addEventListener('click', renderUsers);

activityMember.addEventListener('change', clearMemberActivity);

// Dựng lịch sử giao dịch từ Supabase khi backend Python không chạy (GitHub Pages).
async function buildActivityFromSupabase(username) {
  const [ordersRes, purchasesRes] = await Promise.all([
    supabase.from('orders').select('*').eq('username', username).order('created_at', { ascending: false }),
    supabase.from('purchases').select('*').eq('username', username).order('created_at', { ascending: false }),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (purchasesRes.error) throw purchasesRes.error;

  const orders = ordersRes.data || [];
  const purchases = purchasesRes.data || [];

  const activity = [
    ...orders.map(order => ({
      eventAt: order.created_at,
      eventType: 'topup',
      description: `Nạp tiền · Mã đơn ${order.content || '—'}`,
      amount: Number(order.amount || 0),
      status: order.status || 'pending',
    })),
    ...purchases.map(item => ({
      eventAt: item.created_at,
      eventType: 'purchase',
      description: `Mua file: ${item.product_name}`,
      amount: -Number(item.amount || 0),
      status: 'completed',
    })),
  ].sort((a, b) => new Date(b.eventAt) - new Date(a.eventAt));

  return {
    username,
    summary: {
      approvedTopups: orders
        .filter(order => order.status === 'approved')
        .reduce((sum, order) => sum + Number(order.amount || 0), 0),
      pendingTopups: orders
        .filter(order => order.status !== 'approved' && order.status !== 'rejected')
        .reduce((sum, order) => sum + Number(order.amount || 0), 0),
      purchases: purchases.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    },
    activity,
  };
}

async function loadMemberActivity(username) {
  try {
    const response = await fetch(
      `${API_BASE}/api/admin/users/${encodeURIComponent(username)}/activity`,
      { credentials: 'same-origin' },
    );
    const data = await response.json();
    if (response.ok) return data;
  } catch {
    // Backend không phản hồi — dùng Supabase bên dưới
  }
  return buildActivityFromSupabase(username);
}

document.getElementById('activityForm').addEventListener('submit', async event => {
  event.preventDefault();
  const username = activityMember.value;
  if (!username) return;

  const submitButton = document.getElementById('activitySubmit');
  activityStatus.textContent = 'Đang tải lịch sử giao dịch...';
  activityStatus.className = 'form-status';
  submitButton.disabled = true;
  try {
    const result = await loadMemberActivity(username);

    document.getElementById('activityTopups').textContent = formatAdminMoney(result.summary.approvedTopups);
    document.getElementById('activityPending').textContent = formatAdminMoney(result.summary.pendingTopups);
    document.getElementById('activityPurchases').textContent = formatAdminMoney(result.summary.purchases);
    activityRows.replaceChildren();

    if (!result.activity.length) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.className = 'activity-empty';
      emptyCell.colSpan = 5;
      emptyCell.textContent = 'Tài khoản này chưa có giao dịch nào.';
      emptyRow.append(emptyCell);
      activityRows.append(emptyRow);
    } else {
      result.activity.forEach(item => {
        const row = document.createElement('tr');
        const date = document.createElement('td');
        date.textContent = formatAdminDate(item.eventAt);

        const type = document.createElement('td');
        type.textContent = item.eventType === 'topup'
          ? 'Nạp tiền'
          : item.eventType === 'purchase' ? 'Mua file' : 'Điều chỉnh số dư';

        const description = document.createElement('td');
        description.className = 'activity-description';
        description.textContent = item.bankReference
          ? `${item.description} · Mã ngân hàng: ${item.bankReference}`
          : item.description;
        if (item.eventType === 'topup' && item.completedAt) {
          description.append(document.createElement('br'));
          const completedAt = document.createElement('small');
          completedAt.textContent = `Duyệt lúc ${formatAdminDate(item.completedAt)}`;
          description.append(completedAt);
        }

        const amount = document.createElement('td');
        amount.className = item.amount >= 0 ? 'activity-amount-positive' : 'activity-amount-negative';
        amount.textContent = `${item.amount > 0 ? '+' : ''}${formatAdminMoney(item.amount)}`;

        const status = document.createElement('td');
        status.textContent = item.status === 'pending'
          ? 'Chờ duyệt'
          : item.status === 'approved' ? 'Đã duyệt'
            : item.status === 'rejected' ? 'Từ chối' : 'Hoàn tất';
        status.className = `activity-status activity-status-${item.status}`;
        row.append(date, type, description, amount, status);
        activityRows.append(row);
      });
    }
    activityStatus.textContent = `Đã tải ${result.activity.length} giao dịch của ${result.displayName || result.username}.`;
    activityStatus.className = 'form-status ok';
  } catch (error) {
    console.error('Could not load member activity:', error);
    activityStatus.textContent = error.message || 'Không kết nối được máy chủ.';
    activityStatus.className = 'form-status err';
  } finally {
    submitButton.disabled = false;
  }
});

managedAccount.addEventListener('change', () => {
  const account = memberAccounts.find(user => user.username === managedAccount.value && user.role === 'user');
  managedUsername.value = account?.username || '';
  managedPassword.value = '';
});

document.getElementById('accountManagementForm').addEventListener('submit', async event => {
  event.preventDefault();
  const account = memberAccounts.find(user => user.username === managedAccount.value && user.role === 'user');
  if (!account) {
    accountManagementStatus.textContent = 'Hãy chọn tài khoản thành viên cần quản lý.';
    accountManagementStatus.className = 'form-status err';
    return;
  }

  const submitButton = document.getElementById('accountManagementSubmit');
  accountManagementStatus.textContent = '';
  accountManagementStatus.className = 'form-status';
  submitButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(account.username)}/account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        newUsername: managedUsername.value.trim(),
        newPassword: managedPassword.value,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      accountManagementStatus.textContent = result.error === 'username already exists'
        ? 'Username này đã được sử dụng.'
        : result.error || 'Không thể cập nhật tài khoản.';
      accountManagementStatus.className = 'form-status err';
      return;
    }

    await renderUsers();
    managedAccount.value = result.username;
    managedUsername.value = result.username;
    managedPassword.value = '';
    accountManagementStatus.textContent = [
      result.usernameChanged ? `Đã đổi username thành ${result.username}.` : 'Username được giữ nguyên.',
      result.passwordChanged ? 'Đã đặt mật khẩu mới.' : 'Mật khẩu được giữ nguyên.',
      result.usernameChanged ? 'Thành viên cần đăng nhập lại bằng username mới.' : '',
    ].filter(Boolean).join(' ');
    accountManagementStatus.className = 'form-status ok';
  } catch (error) {
    console.error('Could not update member account:', error);
    accountManagementStatus.textContent = 'Không kết nối được máy chủ.';
    accountManagementStatus.className = 'form-status err';
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('balanceForm').addEventListener('submit', async event => {
  event.preventDefault();
  const amount = Number(document.getElementById('balanceAmount').value);
  const sign = document.getElementById('balanceDirection').value === 'subtract' ? -1 : 1;
  const enteredUsername = userInput.value.trim();
  const matchingMembers = memberAccounts.filter(account =>
    account.username.toLowerCase() === enteredUsername.toLowerCase()
    || (account.displayName || '').toLowerCase() === enteredUsername.toLowerCase()
  );
  const reason = sign < 0 ? 'Quản trị viên trừ tiền' : 'Quản trị viên cộng tiền';
  const submitButton = document.getElementById('balanceSubmit');
  usersStatus.className = 'form-status';
  usersStatus.textContent = '';
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000) {
    usersStatus.textContent = 'Số tiền phải là số nguyên VNĐ từ 1 đến 1.000.000.000.';
    usersStatus.className = 'form-status err';
    return;
  }
  if (matchingMembers.length !== 1) {
    usersStatus.textContent = matchingMembers.length > 1
      ? 'Tên hiển thị này trùng với nhiều tài khoản. Hãy nhập username hoặc bấm vào đúng hàng tài khoản.'
      : 'Không tìm thấy tài khoản. Hãy nhập đúng username hoặc bấm vào hàng tài khoản bên dưới.';
    usersStatus.className = 'form-status err';
    return;
  }
  const member = matchingMembers[0];
  submitButton.disabled = true;
  
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data: curUser } = await supabase
        .from('users')
        .select('balance')
        .eq('username', member.username)
        .maybeSingle();
      
      const newBal = (Number(curUser?.balance) || 0) + (amount * sign);
      if (newBal < 0) {
        usersStatus.textContent = 'Số dư không đủ để thực hiện thao tác trừ.';
        usersStatus.className = 'form-status err';
        submitButton.disabled = false;
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: newBal })
        .eq('username', member.username);
      
      if (updateError) throw updateError;

      event.target.reset();
      await renderUsers();
      usersStatus.textContent = `${member.username}: ${sign > 0 ? 'đã cộng' : 'đã trừ'} ${amount.toLocaleString('vi-VN')}đ; số dư mới ${newBal.toLocaleString('vi-VN')}đ.`;
      usersStatus.className = 'form-status ok';
      submitButton.disabled = false;
      return;
    }
  } catch (error) {
    console.error('Balance update error:', error);
  }

  // Local fallback
  const curBal = Number(localStorage.getItem(`cn_balance_${member.username}`) || 0);
  const newBal = curBal + (amount * sign);
  if (newBal < 0) {
    usersStatus.textContent = 'Số dư không đủ để thực hiện thao tác trừ.';
    usersStatus.className = 'form-status err';
    submitButton.disabled = false;
    return;
  }
  localStorage.setItem(`cn_balance_${member.username}`, newBal);
  event.target.reset();
  await renderUsers();
  usersStatus.textContent = `${member.username}: ${sign > 0 ? 'đã cộng' : 'đã trừ'} ${amount.toLocaleString('vi-VN')}đ; số dư mới ${newBal.toLocaleString('vi-VN')}đ. (Lưu cục bộ)`;
  usersStatus.className = 'form-status ok';
  submitButton.disabled = false;
});

function readLocalTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    return saved && saved.background && saved.accent ? saved : null;
  } catch {
    return null;
  }
}

async function loadThemeSettings() {
  if (isStaticHost) {
    const theme = readLocalTheme();
    if (theme) {
      document.getElementById('themeBackground').value = theme.background;
      document.getElementById('themeAccent').value = theme.accent;
    }
    const artDefault = readArtDefault();
    themeArtDefault.value = artDefault || '#38bdf8';
    themeArtAuto.checked = !artDefault;
    themeArtDefault.disabled = !artDefault;
    themeCardBeam.value = readCardBeam() || '#ffffff';
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/site/theme`);
    if (!response.ok) throw new Error('Không tải được giao diện đã lưu.');
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const theme = await response.json();
      document.getElementById('themeBackground').value = theme.background;
      document.getElementById('themeAccent').value = theme.accent;
    }
  } catch (error) {
    console.error('Could not load site theme:', error);
    const status = document.getElementById('themeStatus');
    status.textContent = 'Không tải được giao diện đã lưu.';
    status.className = 'form-status err';
  }
}

document.querySelectorAll('.theme-preset').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('themeBackground').value = button.dataset.background;
    document.getElementById('themeAccent').value = button.dataset.accent;
    // Live preview khi bấm preset
    previewTheme();
  });
});

/* Live preview khi admin kéo chọn màu nền / màu nhấn / màu ảnh sản phẩm mặc định */
const themeArtDefault = document.getElementById('themeArtDefault');
const themeArtAuto = document.getElementById('themeArtAuto');
const themeCardBeam = document.getElementById('themeCardBeam');

/* Rỗng nghĩa là ảnh sản phẩm dùng theo màu nhấn của theme. */
function readThemeArtDefault() {
  return themeArtAuto.checked ? '' : themeArtDefault.value;
}

function previewTheme() {
  window.applyCodeNestTheme?.({
    background: document.getElementById('themeBackground').value,
    accent: document.getElementById('themeAccent').value,
    artDefault: readThemeArtDefault(),
    artColors: readArtColors(),
    cardBeam: themeCardBeam.value,
  });
}

['themeBackground', 'themeAccent', 'themeCardBeam'].forEach(id => {
  document.getElementById(id).addEventListener('input', previewTheme);
});

themeArtAuto.addEventListener('change', () => {
  themeArtDefault.disabled = themeArtAuto.checked;
  previewTheme();
});
themeArtDefault.addEventListener('input', previewTheme);

/* ── Màu ảnh riêng cho từng sản phẩm ──
   Không cần thêm cột vào bảng Supabase: màu lưu trong file theme trên Storage
   dưới dạng { "<id sản phẩm>": "#màu" } nên tự phát cho khách cùng lúc với theme. */
function readArtColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    return saved && saved.artColors && typeof saved.artColors === 'object' ? saved.artColors : {};
  } catch {
    return {};
  }
}

/* Màu ảnh mặc định Admin đặt (rỗng = ảnh sản phẩm theo màu nhấn của theme). */
function readArtDefault() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    const value = (saved && saved.artDefault) || '';
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
  } catch {
    return '';
  }
}

/* Màu vệt sáng chạy quanh viền sản phẩm (rỗng = dùng màu trắng mặc định). */
function readCardBeam() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    const value = (saved && saved.cardBeam) || '';
    return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
  } catch {
    return '';
  }
}

async function setProductArtColor(productId, color) {
  const colors = readArtColors();
  const key = String(productId);
  if (color) colors[key] = color;
  else delete colors[key];

  const base = readLocalTheme() || window.getCurrentCodeNestTheme?.() || { background: '#080b11', accent: '#38bdf8' };
  const theme = {
    background: base.background,
    accent: base.accent,
    artColors: colors,
    artDefault: readArtDefault(),
    cardBeam: readCardBeam()
  };
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  window.applyCodeNestTheme?.(theme);
  return isStaticHost ? publishThemeToCloud(theme) : { ok: true };
}

/* Phát theme dùng chung cho mọi khách hàng qua Supabase Storage (host tĩnh).
   Bucket chặn ghi đè nên mỗi lần lưu tạo 1 file mới "cn_theme-<thời gian>.json";
   theme.js ở phía khách sẽ tự đọc file mới nhất. */
async function publishThemeToCloud(theme) {
  const client = window.supabase;
  if (!client || !client.storage) return { ok: false, message: 'Supabase chưa sẵn sàng.' };
  const name = `cn_theme-${Date.now()}.json`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(
    name,
    new Blob([JSON.stringify(theme)], { type: 'application/json' }),
    { contentType: 'application/json', upsert: false }
  );
  return error ? { ok: false, message: error.message } : { ok: true };
}

document.getElementById('themeForm').addEventListener('submit', async event => {
  event.preventDefault();
  const background = document.getElementById('themeBackground').value;
  const accent = document.getElementById('themeAccent').value;
  const status = document.getElementById('themeStatus');
  status.className = 'form-status';
  status.textContent = '';

  const submitButton = document.getElementById('themeSubmit');
  submitButton.disabled = true;
  try {
    if (isStaticHost) {
      // Giữ nguyên màu ảnh riêng của từng sản phẩm khi đổi giao diện
      const theme = {
        background,
        accent,
        artColors: readArtColors(),
        artDefault: readThemeArtDefault(),
        cardBeam: themeCardBeam.value
      };
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
      window.applyCodeNestTheme?.(theme);
      const publish = await publishThemeToCloud(theme);
      status.textContent = publish.ok
        ? 'Đã cập nhật giao diện và phát cho tất cả khách hàng.'
        : `Đã đổi giao diện trên máy này, nhưng chưa phát được cho khách (${publish.message}).`;
      status.className = publish.ok ? 'form-status ok' : 'form-status err';
      return;
    }
    const response = await fetch(`${API_BASE}/api/admin/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ background, accent }),
    });
    
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
      const errorText = contentType && contentType.includes('application/json') 
        ? (await response.json()).error 
        : 'Lỗi máy chủ (không nhận được JSON).';
      throw new Error(errorText || 'Không thể lưu giao diện.');
    }

    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      window.applyCodeNestTheme?.(result);
    }
    
    status.textContent = 'Đã cập nhật giao diện cho toàn trang.';
    status.className = 'form-status ok';
  } catch (error) {
    console.error('Could not save site theme:', error);
    status.textContent = error.message || 'Không kết nối được máy chủ.';
    status.className = 'form-status err';
  } finally {
    submitButton.disabled = false;
  }
});

renderInventory();
renderUsers();
loadThemeSettings();

/* ── Top-up order approval ── */
const ORDERS_KEY = 'cn_orders';
const ordersStatus = document.getElementById('ordersStatus');
const orderRows = document.getElementById('orderRows');
const orderCount = document.getElementById('orderCount');

function readLocalOrders() {
  try {
    const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocalOrders(list) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(0, 500)));
}

function formatOrderTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

async function fetchBackendOrders() {
  if (isStaticHost) return null;
  try {
    const response = await fetch(`${API_BASE}/api/admin/topups`, { credentials: 'same-origin' });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return data.map(item => ({
      id: item.id,
      username: item.username,
      amount: Number(item.amount) || 0,
      content: item.content,
      createdAt: item.created_at || item.createdAt,
      status: item.status || 'pending'
    }));
  } catch {
    return null;
  }
}

function renderOrders(serverOrders) {
  const merged = new Map();
  (serverOrders || []).forEach(order => merged.set(order.content, order));
  readLocalOrders().forEach(order => {
    const existing = merged.get(order.content);
    if (!existing || (existing.status !== 'approved' && order.status === 'approved')) {
      merged.set(order.content, order);
    }
  });
  const orders = [...merged.values()]
    .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));

  orderCount.textContent = `${orders.length} đơn`;
  orderRows.replaceChildren();

  if (!orders.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'activity-empty';
    cell.colSpan = 5;
    cell.textContent = 'Chưa có đơn nạp nào.';
    row.append(cell);
    orderRows.append(row);
    return;
  }

  orders.forEach(order => {
    const row = document.createElement('tr');

    const time = document.createElement('td');
    time.textContent = formatOrderTime(order.createdAt || order.created_at);

    const user = document.createElement('td');
    user.textContent = order.username || '—';

    const code = document.createElement('td');
    code.className = 'activity-description';
    code.textContent = order.content || '—';

    const amount = document.createElement('td');
    amount.className = 'activity-amount-positive';
    amount.textContent = `+${formatAdminMoney(order.amount)}`;

    const approved = order.status === 'approved';
    const status = document.createElement('td');
    status.textContent = approved ? 'Đã duyệt' : 'Chờ duyệt';
    status.className = `activity-status activity-status-${approved ? 'approved' : 'pending'}`;

    row.append(time, user, code, amount, status);
    orderRows.append(row);
  });
}

async function applyOrderApproval(order) {
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      // 1. Get current balance
      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('username', order.username)
        .maybeSingle();
      
      const newBalance = (Number(user?.balance) || 0) + Number(order.amount || 0);

      // 2. Update balance
      await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('username', order.username);
      
      // 3. Update order status
      await supabase
        .from('orders')
        .update({ status: 'approved' })
        .eq('id', order.id);
      
      return newBalance;
    }
  } catch (error) {
    console.error('Order approval error:', error);
  }

  // Local fallback
  const balanceKey = `cn_balance_${order.username}`;
  const current = Number(localStorage.getItem(balanceKey) || 0);
  const newBalance = current + Number(order.amount || 0);
  localStorage.setItem(balanceKey, newBalance);

  const list = readLocalOrders();
  const existing = list.find(item => item.content === order.content);
  if (existing) {
    existing.status = 'approved';
    existing.approvedAt = new Date().toISOString();
  } else {
    list.unshift({ ...order, status: 'approved', approvedAt: new Date().toISOString() });
  }
  writeLocalOrders(list);
  return newBalance;
}

async function loadOrders() {
  ordersStatus.textContent = 'Đang tải danh sách đơn nạp...';
  ordersStatus.className = 'form-status';
  
  let orders = [];
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error) orders = data;
    }
  } catch (error) {
    console.warn('Could not fetch orders from Supabase:', error);
  }

  renderOrders(orders);
  if (!orderRows.querySelector('.activity-empty')) {
    ordersStatus.textContent = 'Gửi lệnh “/duyet <mã đơn>” cho bot Telegram để duyệt đơn.';
    ordersStatus.className = 'form-status';
  }
}

document.getElementById('refreshOrders').addEventListener('click', loadOrders);
loadOrders();

/* ── Duyệt đơn bằng lệnh Telegram /duyet ── */
const TG_HANDLED_KEY = 'cn_tg_handled';
const TG_HANDLED_MAX = 300;

function readHandledUpdates() {
  try {
    const list = JSON.parse(localStorage.getItem(TG_HANDLED_KEY) || '[]');
    return Array.isArray(list) ? list.map(Number) : [];
  } catch {
    return [];
  }
}

function markUpdateHandled(updateId) {
  const list = readHandledUpdates();
  if (!list.includes(updateId)) list.push(updateId);
  localStorage.setItem(TG_HANDLED_KEY, JSON.stringify(list.slice(-TG_HANDLED_MAX)));
}
const telegramStatus = document.getElementById('telegramStatus');

function normalizeOrderCode(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

async function findOrderByCode(code) {
  const target = normalizeOrderCode(code);
  if (!target) return null;

  // Đơn nạp được tạo trên Supabase (wallet.js), nên phải tìm ở đó trước.
  if (typeof supabase !== 'undefined' && supabase) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (!error && data) {
        const found = data.find(order => normalizeOrderCode(order.content) === target);
        if (found) return found;
      }
    } catch (error) {
      console.warn('Không tìm được đơn trên Supabase:', error);
    }
  }

  return readLocalOrders().find(order => normalizeOrderCode(order.content) === target) || null;
}

async function handleTelegramUpdate(update) {
  const message = update.message || {};
  const chatId = String((message.chat || {}).id || '');
  const senderId = String((message.from || {}).id || '');
  // Chỉ chấp nhận lệnh từ đúng chat và đúng tài khoản admin.
  if (chatId !== String(TELEGRAM_ADMIN_CHAT_ID) || senderId !== String(TELEGRAM_ADMIN_CHAT_ID)) return;

  const text = String(message.text || '').trim();
  const command = (text.split(/\s+/)[0] || '').split('@')[0].toLowerCase();

  if (command === '/start' || command === '/help' || command === '/trogiup') {
    await notifyAdminTelegram('Lệnh quản trị CodeNest:\n/duyet <mã đơn> - duyệt đơn nạp và cộng tiền vào ví\n/help - xem hướng dẫn này');
    return;
  }

  if (command !== '/duyet') return;

  const code = text.replace(/^\/duyet(@[A-Za-z0-9_]+)?/i, '').trim();
  if (!code) {
    await notifyAdminTelegram('Cú pháp đúng: /duyet <mã đơn>\nVí dụ: /duyet CN-1A2B3C');
    return;
  }

  const order = await findOrderByCode(code);
  if (!order) {
    await notifyAdminTelegram(`Không tìm thấy đơn ${code}.\nKiểm tra lại mã đơn trên trang Ví tiền của khách.`);
    return;
  }
  if (order.status === 'approved') {
    await notifyAdminTelegram(`Đơn ${order.content} đã được duyệt trước đó.`);
    return;
  }

  const newBalance = await applyOrderApproval(order);
  await loadOrders();
  await renderUsers();
  await notifyAdminTelegram(
    `Đã duyệt đơn ${order.content}\nKhách hàng: ${order.username}\nSố tiền: ${formatAdminMoney(order.amount)}\nSố dư mới: ${formatAdminMoney(newBalance)}`
  );
}

async function telegramGetUpdates(offset) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`
    + `?timeout=25&allowed_updates=${encodeURIComponent('["message"]')}`
    + (offset ? `&offset=${offset}` : '');
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram trả về mã ${response.status}`);
  }
  return data.result || [];
}

async function telegramPollLoop() {
  if (typeof TELEGRAM_BOT_TOKEN === 'undefined' || !TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
    telegramStatus.textContent = 'Telegram: chưa cấu hình token, không nhận được lệnh /duyet.';
    telegramStatus.className = 'form-status err';
    return;
  }
  telegramStatus.textContent = 'Telegram: đang lắng nghe lệnh /duyet...';
  telegramStatus.className = 'form-status ok';

  // Nếu bot đã gắn webhook (Supabase Edge Function) thì bot tự chạy 24/7.
  // Telegram không cho dùng getUpdates song song với webhook (lỗi 409), nên dừng polling.
  try {
    const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`, { cache: 'no-store' });
    const info = await infoResponse.json();
    if (info && info.ok && info.result && info.result.url) {
      telegramStatus.textContent = 'Telegram: bot đang chạy 24/7 qua webhook, bạn không cần mở trang này.';
      telegramStatus.className = 'form-status ok';
      return;
    }
  } catch (error) {
    console.warn('Không kiểm tra được webhook Telegram:', error);
  }

  // Không lưu offset vào localStorage: mỗi lần mở trang sẽ đọc lại toàn bộ tin
  // nhắn Telegram còn chờ (gồm cả lệnh gửi lúc trang Quản trị chưa mở).
  // Tin nào đã xử lý thì bỏ qua để không duyệt trùng.
  let offset;
  const handledUpdates = new Set(readHandledUpdates());
  while (true) {
    try {
      const updates = await telegramGetUpdates(offset);
      telegramStatus.textContent = 'Telegram: đang lắng nghe lệnh /duyet...';
      telegramStatus.className = 'form-status ok';
      for (const update of updates) {
        offset = update.update_id + 1;
        if (handledUpdates.has(update.update_id)) continue;
        handledUpdates.add(update.update_id);
        markUpdateHandled(update.update_id);
        try {
          await handleTelegramUpdate(update);
        } catch (error) {
          console.warn('Không xử lý được lệnh Telegram:', error);
        }
      }
    } catch (error) {
      const message = String(error && error.message ? error.message : '');
      if (/webhook/i.test(message)) {
        telegramStatus.textContent = 'Telegram: bot đang chạy 24/7 qua webhook, bạn không cần mở trang này.';
        telegramStatus.className = 'form-status ok';
        return;
      }
      telegramStatus.textContent = `Telegram: ${message || 'không kết nối được'}. Đang thử lại...`;
      telegramStatus.className = 'form-status err';
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }
}

telegramPollLoop();
