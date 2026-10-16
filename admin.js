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

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

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
  if (f) {
    if (f.size > MAX_FILE_SIZE) {
      statusEl.textContent = 'Dung lượng file vượt quá giới hạn 25MB. Vui lòng chọn file nhỏ hơn.';
      statusEl.className = 'form-status err';
      fileInput.value = '';
      fileLabel.textContent = 'Chọn hoặc kéo thả file code vào đây';
      return;
    }
    const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
    fileLabel.textContent = `${f.name} · đã nhận (${sizeMb}MB)`;
    statusEl.textContent = '';
  } else {
    fileLabel.textContent = 'Chọn hoặc kéo thả file code vào đây';
  }
});

/* ── Live preview ── */
nameInput.addEventListener('input',  () => { previewName.textContent = nameInput.value  || 'Tên sản phẩm của bạn'; });
descInput.addEventListener('input',  () => { previewDesc.textContent = descInput.value  || 'Mô tả ngắn sẽ xuất hiện ở đây.'; });
priceInput.addEventListener('input', () => { previewPrc.textContent  = `${Number(priceInput.value || 0).toLocaleString('vi-VN')}đ`; });

/* ── Submit ── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) { statusEl.textContent = 'Hãy chọn file muốn đăng.'; statusEl.className = 'form-status err'; return; }
  if (file.size > MAX_FILE_SIZE) {
    statusEl.textContent = 'Dung lượng file vượt quá giới hạn 25MB. Vui lòng chọn file nhỏ hơn.';
    statusEl.className = 'form-status err';
    return;
  }

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

  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  let uploaded = false;

  if (!isStaticHost) {
    try {
      const body = new FormData();
      body.append('name', product.name);
      body.append('description', product.description);
      body.append('price', String(product.price));
      body.append('category', product.category);
      body.append('file', file, file.name);
      const response = await fetch(`${API_BASE}/api/products`, { method: 'POST', body });
      if (response.ok) {
        uploaded = true;
      }
    } catch {
      // Fallback
    }
  }

  if (!uploaded) {
    let localProducts = [];
    try {
      localProducts = JSON.parse(localStorage.getItem('cn_products')) || [];
    } catch {
      localProducts = [];
    }
    localProducts.unshift(product);
    localStorage.setItem('cn_products', JSON.stringify(localProducts));
  }

  statusEl.textContent = '✓ Đã đăng sản phẩm thành công!';
  statusEl.className = 'form-status ok';
  form.reset();
  fileLabel.textContent = 'Chọn hoặc kéo thả file code vào đây';
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
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');

  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (response.ok) products = await response.json();
    } catch {
      // Fallback
    }
  }

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
        <span class="inv-cat">${p.category || 'web'} · ${p.fileName || 'CODE'}</span>
        <h3 class="inv-name"></h3>
        <p class="inv-desc"></p>
      </div>
      <div class="inv-actions">
        <span class="inv-price">${Number(p.price).toLocaleString('vi-VN')}đ</span>
        <button class="delete-btn" type="button">Xóa</button>
      </div>`;
    item.querySelector('.inv-name').textContent = p.name;
    item.querySelector('.inv-desc').textContent = p.description;
    item.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`Xóa sản phẩm "${p.name}"?`)) return;
      let deleted = false;
      if (!isStaticHost) {
        try {
          const response = await fetch(`${API_BASE}/api/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
          if (response.ok) deleted = true;
        } catch {
          // Fallback
        }
      }
      if (!deleted) {
        let localProducts = JSON.parse(localStorage.getItem('cn_products') || '[]');
        localProducts = localProducts.filter(item => item.id !== p.id);
        localStorage.setItem('cn_products', JSON.stringify(localProducts));
      }
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
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');

  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users`, { credentials: 'same-origin' });
      if (response.ok) users = await response.json();
    } catch {
      // Fallback
    }
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

document.getElementById('activityForm').addEventListener('submit', async event => {
  event.preventDefault();
  const username = activityMember.value;
  if (!username) return;

  const submitButton = document.getElementById('activitySubmit');
  activityStatus.textContent = 'Đang tải lịch sử giao dịch...';
  activityStatus.className = 'form-status';
  submitButton.disabled = true;
  try {
    const response = await fetch(
      `${API_BASE}/api/admin/users/${encodeURIComponent(username)}/activity`,
      { credentials: 'same-origin' },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể tải lịch sử giao dịch.');

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
          : item.status === 'approved' ? 'Đã duyệt' : 'Hoàn tất';
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
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  let adjusted = false;

  if (!isStaticHost) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/users/${encodeURIComponent(member.username)}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ amount: amount * sign, reason }),
      });
      if (response.ok) {
        const result = await response.json();
        const changeLabel = sign > 0 ? 'đã cộng' : 'đã trừ';
        const successMessage = `${result.username}: ${changeLabel} ${amount.toLocaleString('vi-VN')}đ; số dư mới ${Number(result.balance).toLocaleString('vi-VN')}đ.`;
        event.target.reset();
        await renderUsers();
        usersStatus.textContent = successMessage;
        usersStatus.className = 'form-status ok';
        adjusted = true;
      } else {
        const result = await response.json();
        usersStatus.textContent = result.error === 'adjustment would make the balance negative'
          ? 'Số dư không đủ để thực hiện thao tác trừ.'
          : result.error || 'Không thể cập nhật số dư.';
        usersStatus.className = 'form-status err';
        submitButton.disabled = false;
        return;
      }
    } catch {
      // Fallback
    }
  }

  if (!adjusted) {
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
    usersStatus.textContent = `${member.username}: ${sign > 0 ? 'đã cộng' : 'đã trừ'} ${amount.toLocaleString('vi-VN')}đ; số dư mới ${newBal.toLocaleString('vi-VN')}đ.`;
    usersStatus.className = 'form-status ok';
  }
  submitButton.disabled = false;
});

async function loadThemeSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/site/theme`);
    if (!response.ok) throw new Error('Không tải được giao diện đã lưu.');
    const theme = await response.json();
    document.getElementById('themeBackground').value = theme.background;
    document.getElementById('themeAccent').value = theme.accent;
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
  });
});

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
    const response = await fetch(`${API_BASE}/api/admin/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ background, accent }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không thể lưu giao diện.');
    window.applyCodeNestTheme?.(result);
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
