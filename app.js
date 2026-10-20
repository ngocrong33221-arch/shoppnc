/* ============================================================
   CodeNest – app.js (Luxury Gold & Obsidian Black Auth Page)
   Particle System, Mouse Sparkle Trail, Click Bursts & Page Transitions
   ============================================================ */

/* ── 0. Load Background Music Player ── */
(function loadMusic() {
  const s = document.createElement('script');
  s.src = 'web-effects.js';
  document.body.append(s);
})();

/* ── Draggable Floating Code Snippets ── */
const floatingCodeItems = [...document.querySelectorAll('.code-float')];
const codeMotion = floatingCodeItems.map((snippet, index) => ({
  snippet,
  fractionX: [0.12, 0.52, 0.78][index],
  fractionY: [0.16, 0.53, 0.82][index],
  phaseX: 0,
  phaseY: 0,
  speedX: 0.22 + index * 0.035,
  speedY: 0.17 + index * 0.025,
  dragOffsetX: 0,
  dragOffsetY: 0,
  activePointerId: null
}));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function getCodeMotionPosition(motion, time) {
  const maxX = Math.max(0, window.innerWidth - motion.snippet.offsetWidth);
  const maxY = Math.max(0, window.innerHeight - motion.snippet.offsetHeight);
  return {
    x: maxX * (0.5 + Math.sin(time * motion.speedX + motion.phaseX) * 0.48),
    y: maxY * (0.5 + Math.sin(time * motion.speedY + motion.phaseY) * 0.48)
  };
}

function animateFloatingCode(time) {
  const motionTime = prefersReducedMotion.matches ? 0 : time / 1000;
  for (const motion of codeMotion) {
    if (motion.activePointerId !== null) continue;
    const { snippet } = motion;
    const position = getCodeMotionPosition(motion, motionTime);
    snippet.style.left = `${position.x}px`;
    snippet.style.top = `${position.y}px`;
  }
  window.requestAnimationFrame(animateFloatingCode);
}

for (const motion of codeMotion) {
  const { snippet } = motion;
  motion.phaseX = Math.asin((motion.fractionX - 0.5) / 0.48);
  motion.phaseY = Math.asin((motion.fractionY - 0.5) / 0.48);

  snippet.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    snippet.classList.add('is-dragging');

    const snippetRect = snippet.getBoundingClientRect();
    motion.dragOffsetX = event.clientX - snippetRect.left;
    motion.dragOffsetY = event.clientY - snippetRect.top;
    motion.activePointerId = event.pointerId;
    snippet.setPointerCapture(motion.activePointerId);
  });

  snippet.addEventListener('pointermove', event => {
    if (event.pointerId !== motion.activePointerId) return;
    const snippetRect = snippet.getBoundingClientRect();
    const left = Math.min(
      Math.max(0, event.clientX - motion.dragOffsetX),
      Math.max(0, window.innerWidth - snippetRect.width)
    );
    const top = Math.min(
      Math.max(0, event.clientY - motion.dragOffsetY),
      Math.max(0, window.innerHeight - snippetRect.height)
    );
    snippet.style.left = `${left}px`;
    snippet.style.top = `${top}px`;
    const time = performance.now() / 1000;
    const maxX = Math.max(1, window.innerWidth - snippet.offsetWidth);
    const maxY = Math.max(1, window.innerHeight - snippet.offsetHeight);
    const fractionX = Math.max(-1, Math.min(1, (left / maxX - 0.5) / 0.48));
    const fractionY = Math.max(-1, Math.min(1, (top / maxY - 0.5) / 0.48));
    motion.phaseX = Math.asin(fractionX) - time * motion.speedX;
    motion.phaseY = Math.asin(fractionY) - time * motion.speedY;
  });

  function stopDragging(event) {
    if (event.pointerId !== motion.activePointerId) return;
    motion.activePointerId = null;
    snippet.classList.remove('is-dragging');
    if (snippet.hasPointerCapture(event.pointerId)) {
      snippet.releasePointerCapture(event.pointerId);
    }
  }

  snippet.addEventListener('pointerup', stopDragging);
  snippet.addEventListener('pointercancel', stopDragging);
}

window.requestAnimationFrame(animateFloatingCode);

/* ── 1. Golden Falling Particle Rain & Interactive Mouse Physics Engine ── */
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
const pts = [];
const mousePos = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, vx: 0, vy: 0 };

/* Mức hiệu ứng do performance governor (theme.js) quyết định theo FPS thực tế:
   ultra = rải dày hơn cho máy khỏe, high = đầy đủ, low = bớt hiệu ứng nặng,
   off = tắt hẳn. */
let quality = (window.CN_PERF && window.CN_PERF.level) || 'high';

function particleCount() {
  if (quality === 'off') return 0;
  const mobile = window.innerWidth < 768;
  const area = window.innerWidth * window.innerHeight;
  if (quality === 'ultra') {
    const cap = mobile ? 110 : 250;
    const floor = mobile ? 56 : 105;
    return Math.max(floor, Math.min(cap, Math.round(area / 7000)));
  }
  const cap = mobile ? 60 : 145;
  const base = Math.max(30, Math.min(cap, Math.round(area / 12000)));
  return quality === 'low' ? Math.max(20, Math.round(base * 0.45)) : base;
}

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  syncCount();
}
resize();
window.addEventListener('resize', resize);

function createFallingParticle(fromTop = false) {
  const isStar = Math.random() < 0.25;
  const isEmber = Math.random() < 0.45;
  /* Mức "ultra" cho hạt to hơn để mật độ dày trông rõ. */
  const sizeBoost = quality === 'ultra' ? 1.22 : 1;
  return {
    x: Math.random() * W,
    y: fromTop ? -25 - Math.random() * 50 : Math.random() * H,
    radius: (isStar ? (Math.random() * 2.2 + 1.8) : (Math.random() * 2.0 + 0.6)) * sizeBoost,
    isStar: isStar,
    isEmber: isEmber,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.04,
    fallSpeed: Math.random() * 1.6 + 0.8,
    swayAngle: Math.random() * Math.PI * 2,
    swaySpeed: Math.random() * 0.025 + 0.015,
    swayRadius: Math.random() * 0.9 + 0.3,
    extraVx: 0,
    extraVy: 0,
    alpha: Math.random() * 0.65 + 0.3,
    glow: Math.random() * 16 + 6,
    color: Math.random() > 0.35 ? '#ffd700' : (Math.random() > 0.5 ? '#fff3b0' : '#f59e0b'),
    pulseSpeed: Math.random() * 0.03 + 0.015,
    pulseOffset: Math.random() * Math.PI * 2
  };
}

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

// Số hạt được tạo theo mức hiệu ứng hiện tại (xem syncCount bên dưới).

// On Click: Radial Shockwave Blast pushing falling particles
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

function syncCount() {
  const target = particleCount();
  while (pts.length > target) pts.pop();
  while (pts.length < target) pts.push(createFallingParticle(false));
}

let tickCount = 0;
let running = false;
let rafId = 0;
function animateParticles() {
  if (!running) return;
  ctx.clearRect(0, 0, W, H);
  tickCount++;

  mousePos.vx *= 0.88;
  mousePos.vy *= 0.88;

  // Tia nối tới con trỏ và chỉ nối giữa các hạt: chỉ vẽ từ mức "high" trở lên
  // vì đây là phần tốn kém nhất (đặc biệt vòng lặp nối hạt O(n²)).
  if (quality === 'high' || quality === 'ultra') {
    // Draw connecting gold laser/lightning beams to cursor when particles are near mouse
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const mdx = p.x - mousePos.x;
      const mdy = p.y - mousePos.y;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

      if (mDist < 135) {
        const beamAlpha = (1 - mDist / 135) * 0.45;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = `rgba(255, 215, 0, ${beamAlpha})`;
        ctx.lineWidth = (1 - mDist / 135) * 1.5 + 0.5;
        ctx.stroke();
      }
    }

    // Draw connecting gold threads between close particles
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 85) {
          const lineAlpha = (1 - dist / 85) * 0.1 * pts[i].alpha;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(212, 175, 55, ${lineAlpha})`;
          ctx.lineWidth = 0.65;
          ctx.stroke();
        }
      }
    }
  }

  // Update and draw falling particles
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];

    p.swayAngle += p.swaySpeed;
    p.rotation += p.rotationSpeed;
    p.extraVx *= 0.93;
    p.extraVy *= 0.93;

    p.x += Math.sin(p.swayAngle) * p.swayRadius + p.extraVx;
    p.y += p.fallSpeed + p.extraVy;

    // Mouse continuous soft repulsion / force field
    const mdx = p.x - mousePos.x;
    const mdy = p.y - mousePos.y;
    const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (mDist < 110 && mDist > 0) {
      const repel = (1 - mDist / 110) * 1.6;
      p.extraVx += (mdx / mDist) * repel;
      p.extraVy += (mdy / mDist) * repel;
    }

    // Boundaries wrap & respawn at top
    if (p.y > H + 25) {
      Object.assign(p, createFallingParticle(true));
    }
    if (p.x < -30) p.x = W + 20;
    if (p.x > W + 30) p.x = -20;

    let currentAlpha = Math.max(0.12, p.alpha + Math.sin(tickCount * p.pulseSpeed + p.pulseOffset) * 0.22);
    let currentGlow = p.glow;
    if (mDist < 135) {
      currentAlpha = Math.min(1, currentAlpha + (1 - mDist / 135) * 0.5);
      currentGlow += (1 - mDist / 135) * 14;
    }

    // Ở mức "high" trở lên mới dùng shadowBlur (rất tốn GPU) cho hiệu ứng phát sáng.
    ctx.save();
    if (quality === 'high' || quality === 'ultra') {
      ctx.shadowBlur = quality === 'ultra' ? currentGlow * 1.4 : currentGlow;
      ctx.shadowColor = '#ffd700';
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = currentAlpha;

    if (p.isStar) {
      drawStar(ctx, p.x, p.y, p.radius * 2, p.radius * 0.45, p.rotation);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.isEmber) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  rafId = requestAnimationFrame(animateParticles);
}

function startParticles() {
  if (running || quality === 'off') return;
  running = true;
  rafId = requestAnimationFrame(animateParticles);
}
function stopParticles() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  ctx.clearRect(0, 0, W, H);
}

/* Nhận mức hiệu ứng từ performance governor (theme.js). */
if (window.CN_PERF) {
  window.CN_PERF.onChange(level => {
    quality = level;
    syncCount();
    if (level === 'off') stopParticles(); else startParticles();
  });
} else {
  syncCount();
  startParticles();
}

/* ── 2. Luxury Custom Cursor & Mouse Move Trail ── */
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');
let cx = -100, cy = -100;
let mx = -100, my = -100;
let lastTrailTime = 0;

document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;

  mx = e.clientX;
  my = e.clientY;

  if (mousePos.prevX !== -9999) {
    mousePos.vx = e.clientX - mousePos.prevX;
    mousePos.vy = e.clientY - mousePos.prevY;
  }
  mousePos.prevX = e.clientX;
  mousePos.prevY = e.clientY;
  mousePos.x = mx;
  mousePos.y = my;

  // Apply wind turbulence to nearby falling particles
  const speed = Math.sqrt(mousePos.vx * mousePos.vx + mousePos.vy * mousePos.vy);
  if (speed > 1.2) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150 && dist > 0) {
        const wind = (1 - dist / 150) * Math.min(speed * 0.28, 7);
        p.extraVx += (mousePos.vx / speed) * wind * 0.7 + (dx / dist) * wind * 0.3;
        p.extraVy += (mousePos.vy / speed) * wind * 0.7 + (dy / dist) * wind * 0.3;
      }
    }
  }

  // Track mouse coordinates for dynamic card lighting
  const card = document.getElementById('authCard');
  if (card) {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${mx - rect.left}px`);
    card.style.setProperty('--mouse-y', `${my - rect.top}px`);
  }

  // Golden stardust spark trail
  const now = performance.now();
  if (now - lastTrailTime > 35) {
    createCursorSpark(mx, my);
    lastTrailTime = now;
  }
});

/* Trên thiết bị cảm ứng, con trỏ tùy biến bị ẩn bằng CSS nên không cần vòng lặp vẽ. */
const hasPointerCursor = !window.matchMedia('(pointer: coarse)').matches;
(function renderCursor() {
  if (!hasPointerCursor) return;
  cx += (mx - cx) * 0.18;
  cy += (my - cy) * 0.18;
  if (cursor) {
    cursor.style.left = cx + 'px';
    cursor.style.top = cy + 'px';
  }
  if (cursorDot) {
    cursorDot.style.left = mx + 'px';
    cursorDot.style.top = my + 'px';
  }
  requestAnimationFrame(renderCursor);
})();

function createCursorSpark(x, y) {
  const spark = document.createElement('div');
  spark.className = 'click-spark';
  const size = Math.random() * 4 + 2;
  spark.style.width = size + 'px';
  spark.style.height = size + 'px';
  spark.style.left = x + (Math.random() - 0.5) * 12 + 'px';
  spark.style.top = y + (Math.random() - 0.5) * 12 + 'px';
  spark.style.opacity = '0.85';
  spark.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
  document.body.appendChild(spark);

  requestAnimationFrame(() => {
    spark.style.transform = `translate(-50%, -50%) translateY(${Math.random() * 18 + 6}px) scale(0)`;
    spark.style.opacity = '0';
  });

  setTimeout(() => spark.remove(), 420);
}

// Hover states for cursor
function updateHoverTargets() {
  document.querySelectorAll('a, button, input, label, .social-btn').forEach(el => {
    el.addEventListener('mouseenter', () => cursor?.classList.add('hovered'));
    el.addEventListener('mouseleave', () => cursor?.classList.remove('hovered'));
  });
}
updateHoverTargets();

/* ── 3. Click Burst Effect & Ripple Wave ── */
document.addEventListener('mousedown', e => {
  // Máy yếu ở mức "off" thì bỏ hẳn hiệu ứng click cho đỡ giật.
  if (window.CN_PERF && window.CN_PERF.level === 'off') return;
  cursor?.classList.add('clicking');
  createClickRipple(e.clientX, e.clientY);
  createClickBurst(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => {
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

  /* Máy khỏe: bắn thêm vòng sóng thứ hai lan xa hơn cho hiệu ứng dày hơn. */
  if (window.CN_PERF && window.CN_PERF.level === 'ultra') {
    const echo = ripple.cloneNode();
    echo.className = 'click-ripple click-ripple-echo';
    document.body.appendChild(echo);
    setTimeout(() => echo.remove(), 900);
  }
}

function createClickBurst(x, y) {
  // Máy yếu bắn ít tia hơn, máy khỏe bắn dày hơn.
  const level = window.CN_PERF && window.CN_PERF.level;
  const count = level === 'low' ? 7 : (level === 'ultra' ? 22 : 14);
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
    const targetY = Math.sin(angle) * distance + 10; // slight gravity

    spark.style.transition = `transform ${Math.random() * 0.25 + 0.35}s cubic-bezier(0.12, 0.8, 0.35, 1), opacity ${Math.random() * 0.2 + 0.3}s ease-out`;
    document.body.appendChild(spark);

    requestAnimationFrame(() => {
      spark.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(0.2)`;
      spark.style.opacity = '0';
    });

    setTimeout(() => spark.remove(), 650);
  }
}

/* ── 4. Cinematic Page Transition ── */
function navigate(url) {
  // Add sweep element if missing
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

/* ── 5. Authentication & Form Management ── */
const SESSION_KEY = 'cn_session';
const ACCOUNTS_KEY = 'cn_accounts';
const ADMIN = { username: 'ADM', password: 'CodeNest@2026', role: 'admin' };

function loadLocalAccounts() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
  } catch {
    list = [];
  }
  const existing = list.find(a => a.username.toLowerCase() === ADMIN.username.toLowerCase());
  if (!existing) {
    list.unshift(ADMIN);
    saveLocalAccounts(list);
  } else if (existing.password !== ADMIN.password || existing.role !== ADMIN.role) {
    // Keep the built-in admin account in sync with the credentials in this file.
    existing.password = ADMIN.password;
    existing.role = ADMIN.role;
    saveLocalAccounts(list);
  }
  return list;
}

function saveLocalAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

// DOM Elements
const cardModeTag  = document.getElementById('cardModeTag');
const cardTitle    = document.getElementById('cardTitle');
const cardSub      = document.getElementById('cardSub');
const emailLabel   = document.getElementById('emailLabel');
const fieldConfirm = document.getElementById('fieldConfirm');
const rememberRow  = document.getElementById('rememberRow');
const submitLabel  = document.getElementById('submitLabel');
const toggleMode   = document.getElementById('toggleMode');
const toggleLink   = document.getElementById('toggleLink');
const forgotLink   = document.getElementById('forgotLink');
const submitBtn    = document.getElementById('submitBtn');
const formStatus   = document.getElementById('formStatus');

const emailInput    = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const confirmInput  = document.getElementById('confirmInput');
const rememberCheck = document.getElementById('rememberCheck');
const togglePw      = document.getElementById('togglePw');
const toggleConfirmPw = document.getElementById('toggleConfirmPw');

const emailErr    = document.getElementById('emailErr');
const passwordErr = document.getElementById('passwordErr');
const confirmErr  = document.getElementById('confirmErr');

/* Social sign-in needs the backend, so hide it when the site runs as static files. */
(function hideOAuthOnStaticHost() {
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  if (!isStaticHost) return;
  document.querySelectorAll('.social-btn').forEach(btn => { btn.style.display = 'none'; });
  document.querySelectorAll('.card-divider').forEach(divider => { divider.style.display = 'none'; });
})();

let isSignup = false;

function createPasswordParticles(fieldWrap, visible) {
  const bounds = fieldWrap.getBoundingClientRect();
  const originX = bounds.width * 0.76;
  const originY = bounds.height / 2;
  const colors = ['#67e8f9', '#dff8ff', '#c4b5fd', '#ffffff'];

  for (let index = 0; index < 12; index++) {
    const particle = document.createElement('span');
    const angle = (Math.PI * 2 * index) / 12 + (Math.random() - 0.5) * 0.45;
    const distance = 14 + Math.random() * 28;
    particle.className = 'password-particle';
    particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
    particle.style.setProperty('--particle-size', `${2 + Math.random() * 3}px`);
    particle.style.setProperty('--particle-delay', `${Math.random() * 90}ms`);
    particle.style.setProperty('--particle-color', colors[index % colors.length]);
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    fieldWrap.append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}

function setPasswordVisibility(input, button, visible, animate = true) {
  input.type = visible ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', `${visible ? 'Ẩn' : 'Hiện'} ${input === confirmInput ? 'mật khẩu xác nhận' : 'mật khẩu'}`);
  button.title = visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
  button.classList.toggle('is-visible', visible);
  button.classList.remove('eye-opening', 'eye-closing');
  button.classList.add(visible ? 'eye-closing' : 'eye-opening');
  window.setTimeout(() => button.classList.remove('eye-opening', 'eye-closing'), 440);
  const fieldWrap = input.closest('.field-wrap');
  fieldWrap.classList.remove('password-reveal', 'password-conceal');
  void fieldWrap.offsetWidth;
  fieldWrap.classList.add(visible ? 'password-reveal' : 'password-conceal');
  if (animate) createPasswordParticles(fieldWrap, visible);
}

function resetPasswordVisibility() {
  setPasswordVisibility(passwordInput, togglePw, false, false);
  setPasswordVisibility(confirmInput, toggleConfirmPw, false, false);
}

togglePw.addEventListener('click', () => {
  setPasswordVisibility(passwordInput, togglePw, passwordInput.type === 'password');
});

toggleConfirmPw.addEventListener('click', () => {
  setPasswordVisibility(confirmInput, toggleConfirmPw, confirmInput.type === 'password');
});

// Flip between Login and Signup mode
function setMode(signup) {
  isSignup = signup;
  const card = document.getElementById('authCard');
  card.classList.add('flip-out');

  setTimeout(() => {
    cardModeTag.textContent = 'CODENEST';
    cardTitle.innerHTML     = (signup ? 'Tạo tài khoản' : 'Đăng nhập') + '<span class="accent">.</span>';
    cardSub.textContent     = signup ? 'Bắt đầu hành trình sáng tạo của bạn.' : 'Tiếp tục hành trình của bạn.';
    emailLabel.textContent  = signup ? 'Email' : 'Email hoặc tên đăng nhập';
    emailInput.type         = signup ? 'email' : 'text';
    emailInput.placeholder  = signup ? 'you@example.com' : 'you@example.com';
    fieldConfirm.style.display = signup ? '' : 'none';
    rememberRow.style.display  = signup ? 'none' : '';
    submitLabel.textContent = signup ? 'Tạo tài khoản' : 'Đăng nhập';
    toggleMode.innerHTML = signup
      ? 'Đã có tài khoản? <a href="#" id="toggleLink">Đăng nhập →</a>'
      : 'Chưa có tài khoản? <a href="#" id="toggleLink">Tạo tài khoản →</a>';

    document.getElementById('toggleLink').addEventListener('click', e => {
      e.preventDefault();
      setMode(!isSignup);
    });

    clearErrors();
    emailInput.value = '';
    passwordInput.value = '';
    confirmInput.value = '';
    resetPasswordVisibility();
    card.classList.remove('flip-out');
    card.classList.add('flip-in');
    setTimeout(() => card.classList.remove('flip-in'), 300);
    updateHoverTargets();
  }, 240);
}

toggleLink.addEventListener('click', e => {
  e.preventDefault();
  setMode(!isSignup);
});

forgotLink.addEventListener('click', e => {
  e.preventDefault();
  showStatus('Vui lòng liên hệ Admin để khôi phục mật khẩu.', false);
});

function clearErrors() {
  emailErr.textContent = '';
  passwordErr.textContent = '';
  confirmErr.textContent = '';
  formStatus.textContent = '';
  formStatus.className = 'form-status';
  document.querySelectorAll('.field-wrap.error').forEach(el => el.classList.remove('error'));
}

function showStatus(msg, ok = true) {
  formStatus.textContent = msg;
  formStatus.className = 'form-status ' + (ok ? 'ok' : 'err');
}

const oauthParams = new URLSearchParams(window.location.search);
const oauthErrorMessages = {
  google_not_configured: 'Đăng nhập Google chưa được cấu hình trên máy chủ.',
  github_not_configured: 'Đăng nhập GitHub chưa được cấu hình trên máy chủ.',
  invalid_state: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.',
  cancelled: 'Bạn đã hủy đăng nhập.',
  provider_error: 'Không thể đăng nhập với nhà cung cấp này. Vui lòng thử lại.',
};

if (oauthParams.has('oauth_error')) {
  showStatus(
    oauthErrorMessages[oauthParams.get('oauth_error')] || 'Đăng nhập thất bại. Vui lòng thử lại.',
    false
  );
  window.history.replaceState({}, document.title, window.location.pathname);
} else if (oauthParams.get('oauth') === 'complete') {
  showStatus('Đang hoàn tất đăng nhập...', true);
  window.history.replaceState({}, document.title, window.location.pathname);
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(response => {
      if (!response.ok) throw new Error('OAuth session could not be loaded.');
      return response.json();
    })
    .then(user => {
      if (!user.username || user.role !== 'user') {
        throw new Error('OAuth profile is incomplete.');
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        provider: user.provider,
      }));
      showStatus('Đăng nhập thành công! Đang vào CodeNest...', true);
      setTimeout(() => navigate('store.html'), 650);
    })
    .catch(error => {
      console.error('OAuth sign-in could not be completed:', error);
      showStatus('Không thể hoàn tất đăng nhập. Vui lòng tải lại trang và thử lại.', false);
    });
}

function shakeField(input) {
  const wrap = input.closest('.field-wrap');
  if (!wrap) return;
  wrap.classList.add('error');
  wrap.addEventListener('animationend', () => wrap.classList.remove('error'), { once: true });
}

// Restore saved username if Remember Me was selected
const savedUsername = localStorage.getItem('cn_remember');
if (savedUsername) {
  emailInput.value = savedUsername;
  rememberCheck.checked = true;
}

// Form Submit
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();

  const user = emailInput.value.trim();
  const pass = passwordInput.value;
  const conf = confirmInput.value;

  let valid = true;

  if (!user) {
    emailErr.textContent = 'Vui lòng nhập tài khoản hoặc email.';
    shakeField(emailInput);
    valid = false;
  } else if (isSignup && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    emailErr.textContent = 'Vui lòng nhập định dạng email hợp lệ.';
    shakeField(emailInput);
    valid = false;
  }

  if (pass.length < 6) {
    passwordErr.textContent = 'Mật khẩu cần tối thiểu 6 ký tự.';
    shakeField(passwordInput);
    valid = false;
  }

  if (isSignup && pass !== conf) {
    confirmErr.textContent = 'Mật khẩu xác nhận chưa khớp.';
    shakeField(confirmInput);
    valid = false;
  }

  if (!valid) return;

  submitBtn.classList.add('loading');
  const arrowSvg = submitBtn.querySelector('svg');
  if (arrowSvg) arrowSvg.style.display = 'none';

  // Check if running on static hosting (like GitHub Pages) or local file
  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');

  if (!isStaticHost) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(`/api/auth/${isSignup ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: user, password: pass }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // If server does not have API (404/405), fallback to LocalStorage
      if (response.status === 404 || response.status === 405) {
        throw new Error('API not available on static host');
      }

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 && isSignup) {
          emailErr.textContent = 'Tài khoản này đã tồn tại trong hệ thống.';
          shakeField(emailInput);
        } else if (result.error === 'admin login is not configured on the server') {
          showStatus('Chưa đặt ADMIN_PASSWORD trong .env. Hãy đặt mật khẩu admin rồi khởi động lại backend.', false);
        } else {
          showStatus(isSignup ? 'Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.' : 'Tài khoản hoặc mật khẩu không chính xác.', false);
          if (!isSignup) {
            shakeField(emailInput);
            shakeField(passwordInput);
          }
        }
        submitBtn.classList.remove('loading');
        if (arrowSvg) arrowSvg.style.display = '';
        return;
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        username: result.username,
        role: result.role,
        displayName: result.displayName,
        provider: result.provider,
      }));
      if (!isSignup) {
        if (rememberCheck.checked) localStorage.setItem('cn_remember', user);
        else localStorage.removeItem('cn_remember');
      }
      showStatus(isSignup ? '✨ Tạo tài khoản thành công! Đang chuyển vào hệ thống...' : '✨ Đăng nhập thành công! Đang vào CodeNest...', true);
      setTimeout(() => navigate('store.html'), isSignup ? 750 : 650);
      return;
    } catch (error) {
      console.warn('Backend unavailable, falling back to LocalStorage authentication:', error);
    }
  }

  // Supabase Online Authentication
  try {
    await new Promise(r => setTimeout(r, 400));
    
    if (isSignup) {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', user)
        .maybeSingle();

      if (existingUser) {
        emailErr.textContent = 'Tài khoản này đã tồn tại trong hệ thống.';
        shakeField(emailInput);
        submitBtn.classList.remove('loading');
        if (arrowSvg) arrowSvg.style.display = '';
        return;
      }

      // Create new user
      const { error: signupError } = await supabase
        .from('users')
        .insert([{ username: user, password: pass, role: 'user', balance: 0 }]);

      if (signupError) throw signupError;

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user, role: 'user' }));
      showStatus('✨ Tạo tài khoản thành công! Đang chuyển vào hệ thống...', true);
      setTimeout(() => navigate('store.html'), 750);
    } else {
      // Admin bypass or check DB
      let acc = null;
      if (user.toLowerCase() === ADMIN.username.toLowerCase() && pass === ADMIN.password) {
        acc = ADMIN;
      } else {
        const { data: dbUser, error: loginError } = await supabase
          .from('users')
          .select('*')
          .eq('username', user)
          .eq('password', pass)
          .maybeSingle();
        
        if (loginError) throw loginError;
        acc = dbUser;
      }

      if (!acc) {
        showStatus('Tài khoản hoặc mật khẩu không chính xác.', false);
        shakeField(emailInput);
        shakeField(passwordInput);
        submitBtn.classList.remove('loading');
        if (arrowSvg) arrowSvg.style.display = '';
        return;
      }

      if (rememberCheck.checked) {
        localStorage.setItem('cn_remember', user);
      } else {
        localStorage.removeItem('cn_remember');
      }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: acc.username, role: acc.role }));
      showStatus('✨ Đăng nhập thành công! Đang vào CodeNest...', true);
      setTimeout(() => navigate('store.html'), 650);
    }
  } catch (error) {
    console.error('Supabase Error:', error);
    showStatus('Lỗi kết nối Database online. Hãy thử lại sau.', false);
  } finally {
    submitBtn.classList.remove('loading');
    if (arrowSvg) arrowSvg.style.display = '';
  }
});

[emailInput, passwordInput, confirmInput].forEach(inp => {
  inp.addEventListener('input', () => {
    inp.closest('.field-wrap')?.classList.remove('error');
    formStatus.textContent = '';
  });
});
