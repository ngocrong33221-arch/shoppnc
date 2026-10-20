/* ============================================================
   CodeNest – shared.js (Luxury Gold & Obsidian Black Shared Engine)
   Golden Particles, Cursor Stardust, Click Bursts, Page Transitions & State
   ============================================================ */

/* ── 0. Load Background Music Player ── */
(function loadMusic() {
  const s = document.createElement('script');
  s.src = 'web-effects.js';
  document.body.append(s);
})();

/* ── 1. Session Guard ── */
const SESSION_KEY  = 'cn_session';

const _session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
if (!_session) {
  window.location.href = 'index.html';
}

/* ── 2. Cinematic Page Transition ── */
function navigate(url) {
  let sweep = document.querySelector('.page-sweep');
  if (!sweep) {
    sweep = document.createElement('div');
    sweep.className = 'page-sweep';
    document.body.appendChild(sweep);
  }
  document.body.classList.add('page-out');
  setTimeout(() => {
    window.location.href = url;
  }, 440);
}

/* ── 3. Golden Falling Particle Rain & Interactive Mouse Physics Engine ── */
(function initGoldenParticles() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Mức hiệu ứng do performance governor (theme.js) điều khiển:
     high = đầy đủ, low = bớt hiệu ứng, off = tắt hẳn. */
  let quality = (window.CN_PERF && window.CN_PERF.level) || (reduceMotion ? 'off' : 'high');
  let canvas = document.getElementById('bgParticles') || document.getElementById('particles');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'bgParticles';
    canvas.className = 'bg-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  const pts = [];
  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0 };

  /* Halo sáng được vẽ sẵn 1 lần cho mỗi màu rồi tái sử dụng bằng drawImage().
     Cách này thay cho shadowBlur từng hạt — phép toán canvas đắt nhất. */
  function makeGlowSprite(color) {
    const size = 64;
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = size;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.beginPath();
    sctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    sctx.fill();
    return sprite;
  }
  const GLOW_SPRITES = {
    '#38bdf8': makeGlowSprite('rgba(56, 189, 248, 0.9)'),
    '#ffffff': makeGlowSprite('rgba(255, 255, 255, 0.85)'),
    '#818cf8': makeGlowSprite('rgba(129, 140, 248, 0.9)')
  };

  /* Màn hình nhỏ dùng ít hạt hơn để giữ 60fps trên điện thoại. */
  function targetCount() {
    if (quality === 'off') return 0;
    const cap = window.innerWidth < 768 ? 34 : 68;
    const byArea = Math.round((window.innerWidth * window.innerHeight) / 26000);
    const base = Math.max(16, Math.min(cap, byArea));
    return quality === 'low' ? Math.max(12, Math.round(base * 0.5)) : base;
  }
  let COUNT = targetCount();

  function syncCount() {
    while (pts.length > COUNT) pts.pop();
    while (pts.length < COUNT) pts.push(createFallingParticle(false));
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    COUNT = targetCount();
    syncCount();
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    if (mouse.x === -9999) { mouse.x = e.clientX; mouse.y = e.clientY; }
    mouse.vx = e.clientX - mouse.x;
    mouse.vy = e.clientY - mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // On Click: Radial Shockwave Blast pushing particles outward
  window.addEventListener('mousedown', e => {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dx = p.x - e.clientX;
      const dy = p.y - e.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260 && dist > 0) {
        const force = (1 - dist / 260) * 18;
        p.extraVx += (dx / dist) * force;
        p.extraVy += (dy / dist) * force;
      }
    }
  });

  function createFallingParticle(fromTop = false) {
    const isStar = Math.random() < 0.28;
    const isEmber = Math.random() < 0.5;
    const isFast = Math.random() < 0.35;
    const fallSpeed = isFast ? (Math.random() * 2.5 + 2.2) : (Math.random() * 1.5 + 0.9);
    const roll = Math.random();
    const particleColor = roll > 0.62 ? '#38bdf8' : (roll > 0.35 ? '#ffffff' : '#818cf8');

    return {
      x: Math.random() * W,
      y: fromTop ? -15 - Math.random() * 45 : Math.random() * H,
      radius: isStar ? (Math.random() * 2.2 + 1.8) : (Math.random() * 2.2 + 0.6),
      isStar: isStar,
      isEmber: isEmber,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.05,
      fallSpeed: fallSpeed,
      swayAngle: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.03 + 0.015,
      swayRadius: Math.random() * 0.85 + 0.25,
      extraVx: 0,
      extraVy: 0,
      alpha: Math.random() * 0.65 + 0.35,
      color: particleColor,
      sprite: GLOW_SPRITES[particleColor],
      pulseSpeed: Math.random() * 0.03 + 0.015,
      pulseOffset: Math.random() * Math.PI * 2
    };
  }

  // Draw 4-pointed diamond star
  function drawStar(c, x, y, outerR, innerR, rot) {
    let r = rot;
    const step = Math.PI / 4;
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      c.lineTo(x + Math.cos(r) * outerR, y + Math.sin(r) * outerR);
      r += step;
      c.lineTo(x + Math.cos(r) * innerR, y + Math.sin(r) * innerR);
      r += step;
    }
    c.closePath();
    c.fill();
  }

  syncCount();

  let tick = 0;
  let running = false;
  let rafId = 0;
  function animate() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    tick++;

    // Mouse velocity decay
    mouse.vx *= 0.88;
    mouse.vy *= 0.88;

    // Update and draw falling particles
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];

      // Natural fall & gentle swaying motion
      p.swayAngle += p.swaySpeed;
      p.rotation += p.rotationSpeed;
      p.extraVx *= 0.93;
      p.extraVy *= 0.93;

      p.x += Math.sin(p.swayAngle) * p.swayRadius + p.extraVx;
      p.y += p.fallSpeed + p.extraVy;

      // Mouse continuous soft repulsion / force field
      const mdx = p.x - mouse.x;
      const mdy = p.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 115 && mDist > 0) {
        const repel = (1 - mDist / 115) * 1.6;
        p.extraVx += (mdx / mDist) * repel;
        p.extraVy += (mdy / mDist) * repel;
      }

      // Continuous Respawn at top when hitting bottom
      if (p.y > H + 30) {
        Object.assign(p, createFallingParticle(true));
      }
      if (p.x < -35) p.x = W + 25;
      if (p.x > W + 35) p.x = -25;

      // Pulse alpha + halo lớn hơn khi gần chuột
      let currentAlpha = Math.max(0.15, p.alpha + Math.sin(tick * p.pulseSpeed + p.pulseOffset) * 0.22);
      let scale = 1;
      if (mDist < 140) {
        const near = 1 - mDist / 140;
        currentAlpha = Math.min(1, currentAlpha + near * 0.5);
        scale = 1 + near * 0.9;
      }

      // Halo phát sáng được vẽ sẵn rồi drawImage — thay cho shadowBlur từng hạt (rất chậm).
      // Mức "low" bỏ halo để giảm tải cho máy yếu.
      if (quality === 'high') {
        const haloSize = p.radius * 7 * scale;
        ctx.globalAlpha = currentAlpha * 0.85;
        ctx.drawImage(p.sprite, p.x - haloSize / 2, p.y - haloSize / 2, haloSize, haloSize);
      }

      ctx.globalAlpha = currentAlpha;
      ctx.fillStyle = p.color;
      if (p.isStar) {
        drawStar(ctx, p.x, p.y, p.radius * 2 * scale, p.radius * 0.45, p.rotation);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * scale, 0, Math.PI * 2);
        ctx.fill();

        // Lõi sáng cho hạt than
        if (p.isEmber) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (running || quality === 'off') return;
    running = true;
    rafId = requestAnimationFrame(animate);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    ctx.clearRect(0, 0, W, H);
  }

  /* Nhận mức hiệu ứng từ performance governor (theme.js). */
  if (window.CN_PERF) {
    window.CN_PERF.onChange(level => {
      quality = level;
      COUNT = targetCount();
      syncCount();
      if (level === 'off') stop(); else start();
    });
  } else if (!reduceMotion) {
    start();
  }
})();

/* ── 4. Luxury Custom Cursor & Mouse Move Trail ── */
(function initLuxuryCursor() {
  /* Trên thiết bị cảm ứng, con trỏ tùy biến bị ẩn bằng CSS và không có chuột,
     nên bỏ hẳn engine để khỏi tốn một vòng requestAnimationFrame liên tục. */
  if (window.matchMedia('(pointer: coarse)').matches) return;

  let cursor = document.getElementById('cursor');
  let cursorDot = document.getElementById('cursorDot');

  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'cursor';
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
  }
  if (!cursorDot) {
    cursorDot = document.createElement('div');
    cursorDot.id = 'cursorDot';
    cursorDot.className = 'cursor-dot';
    cursorDot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursorDot);
  }

  let mx = -100, my = -100;
  let cx = -100, cy = -100;
  let lastTrail = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;

    // Track mouse coordinates over cards for dynamic spotlight
    document.querySelectorAll('.card, .product-card, .inventory-item').forEach(c => {
      const rect = c.getBoundingClientRect();
      if (mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom) {
        c.style.setProperty('--mouse-x', `${mx - rect.left}px`);
        c.style.setProperty('--mouse-y', `${my - rect.top}px`);
      }
    });

    // Golden spark trail
    const now = performance.now();
    if (now - lastTrail > 35) {
      createCursorSpark(mx, my);
      lastTrail = now;
    }
  });

  (function render() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursor.style.left = cx + 'px';
    cursor.style.top = cy + 'px';
    cursorDot.style.left = mx + 'px';
    cursorDot.style.top = my + 'px';
    requestAnimationFrame(render);
  })();

  function createCursorSpark(x, y) {
    const spark = document.createElement('div');
    spark.className = 'click-spark';
    const size = Math.random() * 3.5 + 2;
    spark.style.width = size + 'px';
    spark.style.height = size + 'px';
    spark.style.left = x + (Math.random() - 0.5) * 12 + 'px';
    spark.style.top = y + (Math.random() - 0.5) * 12 + 'px';
    spark.style.opacity = '0.85';
    spark.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
    document.body.appendChild(spark);

    requestAnimationFrame(() => {
      spark.style.transform = `translate(-50%, -50%) translateY(${Math.random() * 16 + 6}px) scale(0)`;
      spark.style.opacity = '0';
    });

    setTimeout(() => spark.remove(), 420);
  }

  // Hover states
  function refreshHover() {
    document.querySelectorAll('a, button, input, select, textarea, label, .filter-tab, .amount-btn, .product-card').forEach(el => {
      el.addEventListener('mouseenter', () => cursor?.classList.add('hovered'));
      el.addEventListener('mouseleave', () => cursor?.classList.remove('hovered'));
    });
  }
  refreshHover();
  window.refreshHoverTargets = refreshHover;
})();

/* ── 5. Click Burst & Ripple Shockwave ── */
document.addEventListener('mousedown', e => {
  // Máy yếu ở mức "off" thì bỏ hẳn hiệu ứng click cho đỡ giật.
  if (window.CN_PERF && window.CN_PERF.level === 'off') return;
  const cursor = document.getElementById('cursor');
  cursor?.classList.add('clicking');
  createClickRipple(e.clientX, e.clientY);
  createClickBurst(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => {
  const cursor = document.getElementById('cursor');
  cursor?.classList.remove('clicking');
});

function createClickRipple(x, y) {
  const ripple = document.createElement('div');
  ripple.className = 'click-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.style.width = '24px';
  ripple.style.height = '24px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function createClickBurst(x, y) {
  // Mức "low" giảm số tia bắn ra để nhẹ hơn cho điện thoại.
  const count = window.CN_PERF && window.CN_PERF.level === 'low' ? 7 : 14;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'click-spark';
    const size = Math.random() * 4 + 2.5;
    spark.style.width = size + 'px';
    spark.style.height = size + 'px';
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = Math.random() * 55 + 25;
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance + 10;

    spark.style.transition = `transform ${Math.random() * 0.25 + 0.35}s cubic-bezier(0.12, 0.8, 0.35, 1), opacity ${Math.random() * 0.2 + 0.3}s ease-out`;
    document.body.appendChild(spark);

    requestAnimationFrame(() => {
      spark.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(0.2)`;
      spark.style.opacity = '0';
    });

    setTimeout(() => spark.remove(), 650);
  }
}

/* ── 6. Topbar Setup & Navigation ── */
(function setupTopbar() {
  if (!_session) return;
  const badge  = document.getElementById('userBadge');
  const avatar = document.getElementById('userAvatar');
  const admin  = document.getElementById('adminLink');
  const logout = document.getElementById('logoutButton');

  if (badge)  badge.textContent  = _session.username;
  if (avatar) avatar.textContent = _session.username.charAt(0).toUpperCase();
  if (admin)  admin.style.display = _session.role === 'admin' ? '' : 'none';

  if (logout) {
    logout.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(`Logout request failed (${response.status}).`);
      } catch (error) {
        console.error('Could not clear the server-side sign-in session:', error);
      }
      sessionStorage.removeItem(SESSION_KEY);
      navigate('index.html');
    });
  }

  // Intercept navigation links for smooth page transitions
  document.querySelectorAll('.topbar-nav a, .brand, .goto-wallet').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#') && !a.classList.contains('active')) {
        e.preventDefault();
        navigate(href);
      }
    });
  });
})();

/* ── 6b. Mobile Bottom Navigation (tự tạo cho mọi trang) ── */
(function setupMobileNav() {
  const nav = document.querySelector('.topbar-nav');
  if (!nav) return;

  const ICONS = {
    'store.html':   '<path d="M4 7.5h16l-1.2 11a2 2 0 0 1-2 1.75H7.2a2 2 0 0 1-2-1.75L4 7.5Z"/><path d="M9 7.5V5.8a3 3 0 0 1 6 0v1.7"/>',
    'wallet.html':  '<rect x="3" y="6" width="18" height="12.5" rx="2.6"/><path d="M3 10.2h18"/><path d="M16.2 14.2h1.6"/>',
    'account.html': '<circle cx="12" cy="8.4" r="3.4"/><path d="M5.2 19.6a6.8 6.8 0 0 1 13.6 0"/>',
    'support.html': '<circle cx="12" cy="12" r="8.4"/><path d="M9.7 9.6a2.5 2.5 0 1 1 3.4 2.3c-.8.4-1.1.9-1.1 1.7"/><path d="M12 16.4h.01"/>',
    'admin.html':   '<path d="M12 3.4 5.2 6.4v4.9c0 4.1 2.8 7.5 6.8 8.9 4-1.4 6.8-4.8 6.8-8.9V6.4L12 3.4Z"/><path d="m9.3 11.9 2 2 3.5-3.7"/>'
  };

  const bar = document.createElement('nav');
  bar.className = 'mobile-nav';
  bar.id = 'mobileNav';
  bar.setAttribute('aria-label', 'Điều hướng nhanh');

  nav.querySelectorAll('a[href]').forEach(link => {
    if (link.style.display === 'none') return;

    const href = link.getAttribute('href');
    const file = href.split('?')[0].split('/').pop();
    const icon = ICONS[file] || '<circle cx="12" cy="12" r="8"/>';

    const item = document.createElement('a');
    item.className = 'mobile-nav-item';
    item.href = href;
    if (link.classList.contains('active')) item.classList.add('active');
    item.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span></span>`;
    item.querySelector('span').textContent = link.textContent.trim();

    item.addEventListener('click', e => {
      if (item.classList.contains('active')) return;
      e.preventDefault();
      navigate(href);
    });

    bar.appendChild(item);
  });

  if (!bar.children.length) return;
  document.body.appendChild(bar);
})();

/* ── 7. Scroll Reveal ── */
(function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

/* ── 8. Toast Notifications ── */
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  if (!toast) return;
  if (msgEl) msgEl.textContent = msg;
  else toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ── 9. Balance Helper ── */
const BALANCE_API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

async function fetchBalance(username) {
  try {
    // Online check first
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('username', username)
        .maybeSingle();
      
      if (!error && data) {
        return Number(data.balance || 0);
      }
    }
  } catch (error) {
    console.warn('Could not fetch balance from Supabase:', error);
  }

  // Fallback to local (for development/legacy)
  const key = `cn_balance_${username}`;
  const saved = localStorage.getItem(key);
  if (saved !== null) return Number(saved);
  localStorage.setItem(key, 0);
  return 0;
}

/* ── 9b. Thưởng nạp tiền (dùng chung cho wallet.js và admin.js) ── */
/* Từ 200.000đ tặng thêm 20.000đ, từ 500.000đ tặng thêm 50.000đ.
   Dưới 200.000đ không thưởng. Xếp giảm dần để lấy mức cao nhất khớp trước. */
const TOPUP_BONUS_TIERS = [
  { min: 200000, bonus: 20000 },
  { min: 500000, bonus: 50000 },
].sort((a, b) => b.min - a.min);

function topupBonus(amount) {
  const value = Number(amount) || 0;
  const tier = TOPUP_BONUS_TIERS.find(item => value >= item.min);
  return tier ? tier.bonus : 0;
}

/* Số dư thực nhận khi nạp: tiền nạp + thưởng. */
function topupCredit(amount) {
  const value = Number(amount) || 0;
  return value + topupBonus(value);
}

/* ── 10. Product Catalog (dùng chung cho store.html và product.html) ── */
const PRODUCT_CATEGORY_LABELS = {
  web: 'Web template',
  ui: 'UI kit',
  motion: 'Motion / Hiệu ứng',
  apk: 'APK / Ứng dụng',
  other: 'File khác'
};

/* Sản phẩm mẫu khi chạy offline hoặc khi Supabase chưa có dữ liệu */
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

async function loadProductCatalog() {
  try {
    if (typeof supabase !== 'undefined' && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length) {
        return data.map(product => ({ ...product, fileName: product.file_name || product.fileName }));
      }
    }
  } catch (error) {
    console.warn('Could not fetch products from Supabase:', error);
  }
  return getLocalProducts();
}

/* ── 11. Ảnh trưng bày riêng cho từng mặt hàng (dựa vào tên) ── */

/* Hoạ tiết nền dùng chung, mỗi chủ đề chọn một kiểu */
const ART_PATTERNS = {
  diag:   { image: 'repeating-linear-gradient(48deg, currentColor 0 1px, transparent 1px 11px)', size: 'auto' },
  diag2:  { image: 'repeating-linear-gradient(-48deg, currentColor 0 1px, transparent 1px 14px)', size: 'auto' },
  grid:   { image: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', size: '22px 22px' },
  gridLg: { image: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', size: '32px 32px' },
  dots:   { image: 'radial-gradient(currentColor 1.5px, transparent 1.6px)', size: '18px 18px' },
  dotsLg: { image: 'radial-gradient(currentColor 2px, transparent 2.1px)', size: '28px 28px' },
  scan:   { image: 'repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 9px)', size: 'auto' },
  scanV:  { image: 'repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 12px)', size: 'auto' },
};

/* Mỗi chủ đề là một bộ giao diện trưng bày: màu, hoạ tiết, hình minh hoạ, nhãn */
const PRODUCT_THEMES = [
  {
    key: 'ddos', label: 'DDoS / Attack',
    keywords: ['ddos', 'flood', 'stress', 'tan cong', 'attack', 'packet', 'boot', 'nuke', 'crash', 'lay ip', 'cc', 'syn'],
    accent: '#dc2626', soft: 'rgba(220, 38, 38, 0.14)', glow: 'rgba(220, 38, 38, 0.22)',
    bg: 'linear-gradient(135deg, #fef2f2 0%, #ffe4e6 48%, #fef2f2 100%)', pattern: 'diag',
    icon: '<path d="M12 2.8l6.6 2.7v5.3c0 4.2-2.8 7.4-6.6 8.7-3.8-1.3-6.6-4.5-6.6-8.7V5.5z"/><path d="M1.4 8.2h2.4M1.4 12h2.4M1.4 15.8h2.4"/><path d="M12 9v3.2"/><path d="M12 15.7h.01"/>',
  },
  {
    key: 'buff', label: 'Buff / Tăng tương tác',
    keywords: ['buff', 'boost', 'like', 'follow', 'view', 'sub', 'share', 'seeding', 'tuong tac', 'mat', 'tang', 'record', 'live'],
    accent: '#15803d', soft: 'rgba(21, 128, 61, 0.14)', glow: 'rgba(21, 128, 61, 0.22)',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 48%, #ecfdf5 100%)', pattern: 'dots',
    icon: '<polyline points="22 7.4 13.6 15.8 8.6 10.8 2 17.4"/><polyline points="15.8 7.4 22 7.4 22 13.6"/>',
  },
  {
    key: 'bot', label: 'Bot / Tool tự động',
    keywords: ['bot', 'auto', 'treo', 'tool', 'farm', 'craw', 'scrape', 'spam tool', 'tu dong'],
    accent: '#7c3aed', soft: 'rgba(124, 58, 237, 0.14)', glow: 'rgba(124, 58, 237, 0.22)',
    bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 48%, #f5f3ff 100%)', pattern: 'grid',
    icon: '<rect x="4" y="7.6" width="16" height="12.2" rx="3"/><path d="M12 3.4v4.2"/><circle cx="12" cy="2.6" r="1.1"/><path d="M9.2 12.4v1.8M14.8 12.4v1.8"/><path d="M9.8 16.8h4.4"/>',
  },
  {
    key: 'hack', label: 'Hack / Cheat',
    keywords: ['hack', 'crack', 'bypass', 'ban quyen', 'license', 'keygen', 'cheat', 'mod', 'menu', 'aim', 'esp', 'unlock', 'vuot'],
    accent: '#b45309', soft: 'rgba(180, 83, 9, 0.14)', glow: 'rgba(180, 83, 9, 0.22)',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 48%, #fffbeb 100%)', pattern: 'scan',
    icon: '<rect x="4.2" y="10.8" width="15.6" height="10" rx="2.6"/><path d="M8.2 10.8V7.6a4 4 0 0 1 7.7-1.5"/><circle cx="12" cy="15.9" r="1.3"/>',
  },
  {
    key: 'acc', label: 'Tài khoản / Nick',
    keywords: ['acc', 'account', 'nick', 'tai khoan', 'mail', 'email', 'clone', 'via', 'reg', 'gmail', 'outlook'],
    accent: '#1d4ed8', soft: 'rgba(29, 78, 216, 0.14)', glow: 'rgba(29, 78, 216, 0.22)',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 48%, #eff6ff 100%)', pattern: 'gridLg',
    categories: ['account'],
    icon: '<rect x="2.8" y="4.6" width="18.4" height="14.8" rx="3"/><circle cx="9" cy="10.6" r="2.3"/><path d="M5.2 16.8c.8-1.9 2-2.8 3.8-2.8s3 .9 3.8 2.8"/><path d="M15.2 9.8h3.6M15.2 13.4h2.4"/>',
  },
  {
    key: 'proxy', label: 'Proxy / VPN / IP',
    keywords: ['proxy', 'vpn', 'socks', 'ssh', 'tunnel', '4g', 'dcom', 'ip', 'ip tinh', 'ip sach', 'dns', 'mac'],
    accent: '#0d9488', soft: 'rgba(13, 148, 136, 0.14)', glow: 'rgba(13, 148, 136, 0.22)',
    bg: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 48%, #f0fdfa 100%)', pattern: 'dotsLg',
    icon: '<circle cx="12" cy="12" r="8.8"/><path d="M3.4 9.4h17.2M3.4 14.6h17.2"/><path d="M12 3.2c2.3 2.5 3.5 5.4 3.5 8.8s-1.2 6.3-3.5 8.8c-2.3-2.5-3.5-5.4-3.5-8.8S9.7 5.7 12 3.2z"/>',
  },
  {
    key: 'spam', label: 'Spam / Gửi tin',
    keywords: ['spam', 'gui tin', 'send', 'sms', 'mess', 'inbox', 'mailer', 'zalo', 'tele', 'telegram', 'messen'],
    accent: '#db2777', soft: 'rgba(219, 39, 119, 0.14)', glow: 'rgba(219, 39, 119, 0.22)',
    bg: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 48%, #fdf2f8 100%)', pattern: 'scanV',
    icon: '<path d="M21.4 2.8L10.8 13.4"/><path d="M21.4 2.8l-6.9 18.4-3.7-7.8-7.8-3.7z"/>',
  },
  {
    key: 'apk', label: 'APK / Ứng dụng',
    keywords: ['apk', 'android', 'ios', 'ipa', 'ung dung', 'app mod', 'gioi han'],
    accent: '#16a34a', soft: 'rgba(22, 163, 74, 0.14)', glow: 'rgba(22, 163, 74, 0.22)',
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 48%, #f0fdf4 100%)', pattern: 'dots',
    extensions: ['apk', 'ipa'], categories: ['apk', 'app', 'mobile'],
    icon: '<rect x="6" y="4.4" width="12" height="17" rx="3"/><path d="M9.3 4.4l.9-1.7M14.7 4.4l-.9-1.7"/><path d="M10.2 9.6v1.4M13.8 9.6v1.4"/><path d="M10.4 18h3.2"/>',
  },
  {
    key: 'source', label: 'Source code / Web',
    keywords: ['web', 'html', 'css', 'js', 'javascript', 'source', 'code', 'giao dien', 'source code', 'landing', 'wordpress', 'laravel', 'php', 'react', 'node', 'api', 'script'],
    accent: '#ca8a04', soft: 'rgba(202, 138, 4, 0.14)', glow: 'rgba(202, 138, 4, 0.22)',
    bg: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 48%, #fefce8 100%)', pattern: 'grid',
    extensions: ['html', 'css', 'js', 'ts', 'php', 'py', 'sh'], categories: ['web', 'code', 'source', 'frontend', 'backend'],
    icon: '<polyline points="15.8 18 21.6 12 15.8 6"/><polyline points="8.2 6 2.4 12 8.2 18"/><line x1="13.8" y1="4.6" x2="10.2" y2="19.4"/>',
  },
  {
    key: 'ai', label: 'AI / GPT',
    keywords: ['ai', 'gpt', 'chatgpt', 'prompt', 'midjourney', 'gemini', 'claude', 'tool ai'],
    accent: '#4f46e5', soft: 'rgba(79, 70, 229, 0.14)', glow: 'rgba(79, 70, 229, 0.22)',
    bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 48%, #eef2ff 100%)', pattern: 'dotsLg',
    icon: '<path d="M10.6 3.2l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/><path d="M18.4 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
  },
  {
    key: 'seo', label: 'SEO / Quảng cáo',
    keywords: ['seo', 'backlink', 'google', 'index', 'traffic', 'ads', 'quang cao', 'marketing', 'pages', 'dieu huong'],
    accent: '#ea580c', soft: 'rgba(234, 88, 12, 0.14)', glow: 'rgba(234, 88, 12, 0.22)',
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 48%, #fff7ed 100%)', pattern: 'diag2',
    icon: '<circle cx="10.6" cy="10.6" r="6.6"/><path d="M15.5 15.5L21 21"/><path d="M8.4 12.8V9.6M10.6 12.8V7.4M12.8 12.8v-2.4"/>',
  },
  {
    key: 'game', label: 'Game / Mod game',
    keywords: ['game', 'lien quan', 'free fire', 'gunny', 'pubg', 'roblox', 'minecraft', 'mod game', 'acc game', 'pixel', 'au mobile'],
    accent: '#ea580c', soft: 'rgba(234, 88, 12, 0.14)', glow: 'rgba(234, 88, 12, 0.22)',
    bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 48%, #fff7ed 100%)', pattern: 'gridLg',
    categories: ['game'], extensions: ['unity', 'pak', 'obb'],
    icon: '<path d="M7.8 7.4h8.4a5 5 0 0 1 4.9 4.1l.5 3.4a2.7 2.7 0 0 1-4.9 1.9l-.9-1.3H8.2l-.9 1.3A2.7 2.7 0 0 1 2.4 15l.5-3.4a5 5 0 0 1 4.9-4.2z"/><path d="M8.6 10.4v2.6M7.3 11.7h2.6"/><circle cx="15.6" cy="11.7" r="1"/><circle cx="17.9" cy="13.9" r="1"/>',
  },
  {
    key: 'design', label: 'Thiết kế / Đồ hoạ',
    keywords: ['design', 'thiet ke', 'psd', 'figma', 'logo', 'font', 'mockup', 'canva', 'banner', 'template mo', 'anh'],
    accent: '#a855f7', soft: 'rgba(168, 85, 247, 0.14)', glow: 'rgba(168, 85, 247, 0.22)',
    bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 48%, #faf5ff 100%)', pattern: 'grid',
    extensions: ['psd', 'ai', 'fig', 'sketch', 'svg'], categories: ['design', 'ui', 'graphic'],
    icon: '<path d="M12 3.2c-4.9 0-8.8 3.6-8.8 8.1a3.7 3.7 0 0 0 3.7 3.7h1.6c1.1 0 1.9.8 1.9 1.7 0 .8-.6 1.4-.6 2.2 0 1 .7 1.9 2.2 1.9 4.9 0 8.8-3.9 8.8-8.8S16.9 3.2 12 3.2z"/><circle cx="8.4" cy="10.6" r="1.2"/><circle cx="12" cy="7.8" r="1.2"/><circle cx="15.6" cy="10.6" r="1.2"/>',
  },
  {
    key: 'media', label: 'Nhạc / Video',
    keywords: ['mp3', 'mp4', 'nhac', 'video', 'edit', 'capcut', 'render', 'phim', 'tiktok', 'youtube', 'gif'],
    accent: '#0284c7', soft: 'rgba(2, 132, 199, 0.14)', glow: 'rgba(2, 132, 199, 0.22)',
    bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 48%, #f0f9ff 100%)', pattern: 'scan',
    extensions: ['mp3', 'wav', 'm4a', 'flac', 'mp4', 'avi', 'mkv', 'gif', 'mov'], categories: ['audio', 'video', 'media'],
    icon: '<circle cx="12" cy="12" r="8.8"/><polygon points="10.1 8.5 16.6 12 10.1 15.5"/>',
  },
  {
    key: 'data', label: 'Data / Danh sách',
    keywords: ['data', 'database', 'dump', 'list', 'danh sach', 'excel', 'csv', 'json', 'thong tin', 'leads', 'backup'],
    accent: '#15803d', soft: 'rgba(21, 128, 61, 0.14)', glow: 'rgba(21, 128, 61, 0.22)',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 48%, #ecfdf5 100%)', pattern: 'gridLg',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'xz', 'sql', 'csv', 'xlsx', 'json', 'txt'], categories: ['other', 'data'],
    icon: '<ellipse cx="12" cy="6" rx="7.4" ry="3.1"/><path d="M4.6 6v5.6c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1V6"/><path d="M4.6 11.6v6c0 1.7 3.3 3.1 7.4 3.1s7.4-1.4 7.4-3.1v-6"/>',
  },
  {
    key: 'tool', label: 'Công cụ',
    keywords: [],
    accent: '#ca8a04', soft: 'rgba(202, 138, 4, 0.14)', glow: 'rgba(202, 138, 4, 0.22)',
    bg: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 48%, #fefce8 100%)', pattern: 'diag',
    extensions: ['exe', 'msi', 'dmg', 'bat'],
    icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  },
];

/* Bỏ dấu tiếng Việt để so khớp từ khoá dễ hơn */
function artKey(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

/* Từ khoá ngắn (≤ 3 ký tự) phải khớp theo cả từ để tránh dính vào từ khác */
function themeHasKeyword(theme, text) {
  return theme.keywords.some(word => (word.length <= 3
    ? new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text)
    : text.includes(word)));
}

/* Chọn bộ giao diện trưng bày: tên sản phẩm trước, rồi loại file/danh mục, cuối cùng là mô tả */
function resolveProductTheme(product) {
  const info = product || {};
  const matchTheme = text => PRODUCT_THEMES.find(theme => themeHasKeyword(theme, text));

  const byName = matchTheme(artKey(info.name));
  if (byName) return byName;

  const fileName = artKey(info.fileName || info.file_name);
  const extension = (fileName.match(/\.([a-z0-9]+)$/) || [])[1];
  const byFile = PRODUCT_THEMES.find(theme => theme.extensions && theme.extensions.includes(extension));
  if (byFile) return byFile;

  const category = artKey(info.category).trim();
  const byCategory = PRODUCT_THEMES.find(theme => theme.categories && theme.categories.includes(category));
  if (byCategory) return byCategory;

  return matchTheme(artKey(info.description)) || PRODUCT_THEMES[PRODUCT_THEMES.length - 1];
}

/* Đổ hoạ tiết + màu vào style inline của khung trưng bày.
   Mặc định màu lấy từ theme hiện tại (store.css dùng --gold, --surface2, --bg-deep).
   Nếu Admin đặt màu riêng (hoặc màu mặc định) thì ảnh sản phẩm đổi hẳn sang màu đó. */
function productThemeStyle(theme, product) {
  const pattern = ART_PATTERNS[theme.pattern] || ART_PATTERNS.grid;
  let style = `--art-pattern:${pattern.image};--art-pattern-size:${pattern.size}`;
  const color = productArtColor(product);
  if (color) {
    const [red, green, blue] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
    const tint = alpha => `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    style += `;--art-accent:${color};--art-soft:${tint(0.32)};--art-glow:${tint(0.3)}`
      + `;--art-bg:linear-gradient(135deg, ${tint(0.5)} 0%, ${tint(0.16)} 50%, ${tint(0.42)} 100%),`
      + 'linear-gradient(135deg, var(--surface2) 0%, var(--bg-deep) 50%, var(--surface2) 100%)';
  }
  return style;
}

/* Màu ảnh của sản phẩm (gửi kèm file theme qua window.CN_ART):
   ưu tiên màu riêng Admin đặt cho sản phẩm, rồi tới màu mặc định Admin đặt,
   rồi tới màu tự động theo phân loại an toàn / nguy hiểm.
   Không có gì thì trả về rỗng để ảnh dùng màu nhấn của theme hiện tại. */
function productArtColor(product) {
  if (!product || !window.CN_ART) return '';
  return window.CN_ART.resolve(product.id, product);
}

function productThemeIcon(theme) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"`
    + ` stroke-linecap="round" stroke-linejoin="round">${theme.icon}</svg>`;
}

/* ── 12. Tải file sản phẩm đã lưu ── */
async function downloadProductFile(url, fileName) {
  if (!url) return false;
  const name = fileName || url.split('/').pop() || 'san-pham';

  // File lớn lưu ở GoFile: url là trang tải chứ không phải file trực tiếp → mở tab mới
  if (/gofile\.io/i.test(url)) {
    if (!window.open(url, '_blank', 'noopener')) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
    }
    return true;
  }

  // File trên Supabase Storage là khác miền nên thuộc tính download của thẻ <a>
  // bị trình duyệt bỏ qua. Tải về dạng blob để giữ đúng tên file gốc.
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    return true;
  } catch (error) {
    console.warn('Không tải được file dạng blob, chuyển sang mở trực tiếp:', error);
  }

  const fallback = document.createElement('a');
  fallback.href = url;
  fallback.download = name;
  fallback.target = '_blank';
  fallback.rel = 'noopener';
  document.body.append(fallback);
  fallback.click();
  fallback.remove();
  return true;
}

/* ── 13. Page In Animation ── */
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    document.body.style.opacity = '1';
  });
});
