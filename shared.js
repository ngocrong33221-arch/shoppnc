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
  const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, vx: 0, vy: 0 };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    if (mouse.prevX !== -9999) {
      mouse.vx = e.clientX - mouse.prevX;
      mouse.vy = e.clientY - mouse.prevY;
    }
    mouse.prevX = e.clientX;
    mouse.prevY = e.clientY;
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    // Apply wind turbulence to nearby particles
    const speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
    if (speed > 1.2) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          const wind = (1 - dist / 150) * Math.min(speed * 0.28, 7);
          p.extraVx += (mouse.vx / speed) * wind * 0.7 + (dx / dist) * wind * 0.3;
          p.extraVy += (mouse.vy / speed) * wind * 0.7 + (dy / dist) * wind * 0.3;
        }
      }
    }
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
      glow: Math.random() * 16 + 6,
      color: Math.random() > 0.35 ? '#ffd700' : (Math.random() > 0.5 ? '#fff3b0' : '#f59e0b'),
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

  // Populate 200 falling particles continuously
  for (let i = 0; i < 200; i++) {
    pts.push(createFallingParticle(false));
  }

  let tick = 0;
  function animate() {
    ctx.clearRect(0, 0, W, H);
    tick++;

    // Mouse velocity decay
    mouse.vx *= 0.88;
    mouse.vy *= 0.88;

    // Draw connecting gold laser/lightning beams to cursor when particles are near mouse
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const mdx = p.x - mouse.x;
      const mdy = p.y - mouse.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

      if (mDist < 140) {
        const beamAlpha = (1 - mDist / 140) * 0.48;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(255, 215, 0, ${beamAlpha})`;
        ctx.lineWidth = (1 - mDist / 140) * 1.6 + 0.5;
        ctx.stroke();
      }
    }

    // Connect close falling particles with subtle golden threads
    for (let i = 0; i < pts.length; i += 2) {
      for (let j = i + 1; j < pts.length; j += 2) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          const lineAlpha = (1 - dist / 80) * 0.12 * pts[i].alpha;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(212, 175, 55, ${lineAlpha})`;
          ctx.lineWidth = 0.65;
          ctx.stroke();
        }
      }
    }

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

      // Pulse alpha + enhanced glow when near mouse
      let currentAlpha = Math.max(0.15, p.alpha + Math.sin(tick * p.pulseSpeed + p.pulseOffset) * 0.22);
      let currentGlow = p.glow;
      if (mDist < 140) {
        currentAlpha = Math.min(1, currentAlpha + (1 - mDist / 140) * 0.5);
        currentGlow += (1 - mDist / 140) * 16;
      }

      ctx.save();

      // Draw luminous falling light streak/tail for fast moving particles
      if (p.fallSpeed > 1.8) {
        const tailLength = p.fallSpeed * 5.5;
        const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - tailLength);
        grad.addColorStop(0, `rgba(255, 215, 0, ${currentAlpha * 0.7})`);
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - tailLength);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.min(p.radius * 0.8, 2);
        ctx.stroke();
      }

      ctx.shadowBlur = currentGlow;
      ctx.shadowColor = '#ffd700';
      ctx.fillStyle = p.color;
      ctx.globalAlpha = currentAlpha;

      if (p.isStar) {
        drawStar(ctx, p.x, p.y, p.radius * 2, p.radius * 0.45, p.rotation);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Extra glowing center core for embers
        if (p.isEmber) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
      }
      ctx.restore();
    }

    requestAnimationFrame(animate);
  }
  animate();
})();

/* ── 4. Luxury Custom Cursor & Mouse Move Trail ── */
(function initLuxuryCursor() {
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
  const count = 14;
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

/* ── 11. Tải file sản phẩm đã lưu ── */
async function downloadProductFile(url, fileName) {
  if (!url) return false;
  const name = fileName || url.split('/').pop() || 'san-pham';

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

/* ── 12. Page In Animation ── */
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    document.body.style.opacity = '1';
  });
});
