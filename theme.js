/* Applies the site-wide palette saved by an administrator. */
(function () {
  const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;

  function rgb(hex) {
    const value = hex.slice(1);
    return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  }

  function toHex(channels) {
    return `#${channels.map(channel => Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`;
  }

  function shade(hex, factor) {
    return toHex(rgb(hex).map(channel => channel * factor));
  }

  function mix(hex, target, weight) {
    const sourceChannels = rgb(hex);
    const targetChannels = rgb(target);
    return toHex(sourceChannels.map((channel, index) => channel * (1 - weight) + targetChannels[index] * weight));
  }

  function contrastRatio(first, second) {
    function luminance(hex) {
      const channels = rgb(hex).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }

    const luminances = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (luminances[0] + 0.05) / (luminances[1] + 0.05);
  }

  const CODE_NEST_PRESETS = [
    { id: 'obsidian', name: 'Obsidian Dark', background: '#080b11', accent: '#38bdf8', icon: '🌙' },
    { id: 'light',    name: 'Light Clean',  background: '#f8fafc', accent: '#0284c7', icon: '☀️' },
    { id: 'snow',     name: 'Snow White',   background: '#ffffff', accent: '#6366f1', icon: '⚪' },
    { id: 'ocean',    name: 'Ocean Cyan',   background: '#07131c', accent: '#06b6d4', icon: '🌊' },
    { id: 'violet',   name: 'Royal Violet', background: '#0f0b18', accent: '#a855f7', icon: '🔮' },
    { id: 'emerald',  name: 'Emerald Green',background: '#06140e', accent: '#10b981', icon: '🍃' },
    { id: 'sunset',   name: 'Sunset Rose',  background: '#180c10', accent: '#f43f5e', icon: '🌅' },
    { id: 'amber',    name: 'Amber Gold',   background: '#0f0c05', accent: '#f59e0b', icon: '⚡' },
  ];

  /* Màu ảnh do Admin đặt, gửi kèm trong file theme (không cần thêm cột Supabase):
     - artColors: màu riêng cho từng sản phẩm, dạng { "<id sản phẩm>": "#màu" }
     - artDefault: màu mặc định cho mọi sản phẩm không có màu riêng (rỗng = màu tự động) */
  const artState = { colors: {}, default: '' };

  /* Dải 7 màu cho ảnh trưng bày, chia theo phân loại sản phẩm (dò từ khoá tên/mô tả):
     - danger (DDoS, hack/crack, spam, bot, buff, proxy…): tông nóng, cảnh báo
     - safe (source code, APK, thiết kế, media, data…): tông lạnh, dịu mắt
     Màu chọn theo tên sản phẩm nên mỗi sản phẩm luôn giữ nguyên một màu. */
  const ART_AUTO_PALETTES = {
    danger: ['#dc2626', '#ea580c', '#d97706', '#db2777', '#c026d3', '#e11d48', '#f59e0b'],
    safe:   ['#0284c7', '#0d9488', '#16a34a', '#4f46e5', '#7c3aed', '#0891b2', '#2563eb'],
  };
  const ART_DANGER_KEYWORDS = [
    'ddos', 'flood', 'stress', 'attack', 'tan cong', 'nuke', 'crash', 'syn', 'lay ip',
    'hack', 'crack', 'bypass', 'keygen', 'cheat', 'aim', 'esp', 'unlock', 'vuot',
    'spam', 'bot', 'treo', 'farm', 'scrape', 'craw', 'mailer', 'sms', 'gui tin',
    'buff', 'boost', 'seeding', 'tuong tac', 'mat', 'proxy', 'vpn', 'socks', 'ssh',
    'tunnel', 'dcom', 'clone', 'via', 'acc', 'nick', 'brute', 'exploit',
  ];

  /* Bỏ dấu tiếng Việt để dò từ khoá đơn giản hơn */
  function artSlug(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  }

  /* Sản phẩm nguy hiểm hay an toàn, dựa vào tên + mô tả + tên file */
  function classifyArt(product) {
    const info = product || {};
    const text = artSlug([info.name, info.description, info.fileName || info.file_name].filter(Boolean).join(' '));
    const isDanger = ART_DANGER_KEYWORDS.some(word => (word.length <= 3
      ? new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text)
      : text.includes(word)));
    return isDanger ? 'danger' : 'safe';
  }

  /* Băm tên sản phẩm để chọn màu cố định trong dải 7 màu */
  function artSeed(product) {
    const info = product || {};
    const text = artSlug(info.name || info.fileName || info.file_name || info.id || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function autoArtColor(product) {
    if (!product) return '';
    const palette = ART_AUTO_PALETTES[classifyArt(product)];
    return palette[artSeed(product) % palette.length];
  }

  function applyCodeNestTheme(theme) {
    if (!theme || !/^#[0-9a-f]{6}$/i.test(theme.background) || !/^#[0-9a-f]{6}$/i.test(theme.accent)) return;
    if (theme.artColors && typeof theme.artColors === 'object') {
      artState.colors = theme.artColors;
    }
    artState.default = /^#[0-9a-f]{6}$/i.test(theme.artDefault || '') ? theme.artDefault : '';
    const root = document.documentElement;
    const background = theme.background.toLowerCase();
    const accent = theme.accent.toLowerCase();
    
    // Quyết định hướng pha màu cho bề mặt, viền và bóng đổ dựa trên độ tương phản
    const isLight = contrastRatio(background, '#0f172a') > contrastRatio(background, '#f8fafc');
    root.setAttribute('data-theme', isLight ? 'light' : 'dark');
    root.style.colorScheme = isLight ? 'light' : 'dark';

    const [red, green, blue] = rgb(accent);
    const ink = isLight ? '#0f172a' : '#f8fafc';
    const inkRgb = rgb(ink).join(', ');
    const shadowInk = isLight ? '15, 23, 42' : '0, 0, 0';

    const surface = isLight ? '#ffffff' : shade(background, 1.75);
    const surface2 = isLight ? mix(background, '#0f172a', 0.035) : shade(background, 2.35);
    const surfaceRgb = rgb(surface).join(', ');

    root.style.setProperty('--bg', background);
    root.style.setProperty('--bg-deep', isLight ? mix(background, '#0f172a', 0.05) : shade(background, 0.55));
    root.style.setProperty('--surface', surface);
    root.style.setProperty('--surface2', surface2);
    root.style.setProperty('--surface-card', isLight ? 'rgba(255, 255, 255, 0.90)' : `rgba(${surfaceRgb}, 0.72)`);
    root.style.setProperty('--glass-bg', isLight ? 'rgba(255, 255, 255, 0.86)' : `rgba(${surfaceRgb}, 0.82)`);
    root.style.setProperty('--glass-bg-soft', isLight ? 'rgba(255, 255, 255, 0.96)' : `rgba(${surfaceRgb}, 0.95)`);
    root.style.setProperty('--panel-soft', isLight ? 'rgba(15, 23, 42, 0.035)' : `rgba(${inkRgb}, 0.05)`);
    root.style.setProperty('--hairline', isLight ? 'rgba(15, 23, 42, 0.08)' : `rgba(${inkRgb}, 0.09)`);
    root.style.setProperty('--hairline-strong', isLight ? 'rgba(15, 23, 42, 0.13)' : `rgba(${inkRgb}, 0.16)`);
    root.style.setProperty('--border-subtle', isLight ? 'rgba(15, 23, 42, 0.09)' : `rgba(${inkRgb}, 0.10)`);
    root.style.setProperty('--border', `rgba(${red}, ${green}, ${blue}, ${isLight ? 0.24 : 0.28})`);
    root.style.setProperty('--shadow-soft', isLight ? '0 16px 40px -18px rgba(15, 23, 42, 0.14)' : '0 18px 44px -20px rgba(0, 0, 0, 0.65)');
    root.style.setProperty('--ink', ink);
    root.style.setProperty('--ink-dim', isLight ? '#334155' : '#94a3b8');
    root.style.setProperty('--muted', '#64748b');

    root.style.setProperty('--gold', accent);
    root.style.setProperty('--gold-rgb', `${red}, ${green}, ${blue}`);
    root.style.setProperty('--gold-light-rgb', `${rgb(mix(accent, '#ffffff', 0.52)).join(', ')}`);
    root.style.setProperty('--gold-light', isLight ? mix(accent, '#0284c7', 0.25) : mix(accent, '#ffffff', 0.52));
    root.style.setProperty('--gold-bright', accent);
    root.style.setProperty('--gold-warm', isLight ? shade(accent, 0.8) : shade(accent, 0.78));
    root.style.setProperty('--gold-deep', isLight ? shade(accent, 0.65) : shade(accent, 0.52));
    root.style.setProperty('--gold-glow', `rgba(${red}, ${green}, ${blue}, ${isLight ? 0.22 : 0.35})`);
    root.style.setProperty('--gold-subtle', `rgba(${red}, ${green}, ${blue}, ${isLight ? 0.08 : 0.10})`);
    root.style.setProperty('--gold-border', `rgba(${red}, ${green}, ${blue}, ${isLight ? 0.24 : 0.25})`);
    root.style.setProperty('--gold-border-focus', `rgba(${red}, ${green}, ${blue}, ${isLight ? 0.6 : 0.75})`);

    /* Màu vệt sáng chạy quanh viền sản phẩm (Admin đặt, mặc định trắng) */
    root.style.setProperty('--card-beam', /^#[0-9a-f]{6}$/i.test(theme.cardBeam || '') ? theme.cardBeam : '#ffffff');

    if (isLight) {
      root.style.setProperty('--gold-gradient', `linear-gradient(135deg, ${accent} 0%, ${shade(accent, 0.8)} 50%, ${shade(accent, 0.65)} 100%)`);
      root.style.setProperty('--gold-text-grad', `linear-gradient(135deg, ${shade(accent, 0.85)} 0%, ${accent} 50%, ${shade(accent, 0.65)} 100%)`);
      root.style.setProperty('--gold-btn', `linear-gradient(135deg, ${accent} 0%, ${mix(accent, '#38bdf8', 0.25)} 50%, ${shade(accent, 0.85)} 100%)`);
      root.style.setProperty('--gold-btn-hover', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.15)} 0%, ${accent} 55%, ${mix(accent, '#38bdf8', 0.35)} 100%)`);
    } else {
      root.style.setProperty('--gold-gradient', `linear-gradient(135deg, ${shade(accent, 0.72)} 0%, ${mix(accent, '#ffffff', 0.68)} 28%, ${accent} 55%, ${mix(accent, '#ffffff', 0.52)} 80%, ${shade(accent, 0.52)} 100%)`);
      root.style.setProperty('--gold-text-grad', `linear-gradient(135deg, #ffffff 0%, ${mix(accent, '#ffffff', 0.35)} 35%, ${accent} 70%, ${shade(accent, 0.65)} 100%)`);
      root.style.setProperty('--gold-btn', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.35)} 0%, ${accent} 55%, ${shade(accent, 0.78)} 100%)`);
      root.style.setProperty('--gold-btn-hover', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.55)} 0%, ${mix(accent, '#ffffff', 0.35)} 55%, ${accent} 100%)`);
    }

    try {
      window.dispatchEvent(new CustomEvent('codenest:themechange', { detail: { theme, isLight, artColors: artState.colors, artDefault: artState.default } }));
    } catch {
      // Ignored in non-DOM/older environments
    }
  }

  function getCurrentCodeNestTheme() {
    try {
      const saved = JSON.parse(localStorage.getItem('cn_theme') || 'null');
      if (saved && saved.background && saved.accent) return saved;
    } catch {}
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight 
      ? { background: '#f8fafc', accent: '#0284c7' }
      : { background: '#080b11', accent: '#38bdf8' };
  }

  function setCodeNestTheme(theme) {
    if (!theme || !theme.background || !theme.accent) return;
    localStorage.setItem('cn_theme', JSON.stringify(theme));
    applyCodeNestTheme(theme);
  }

  function toggleCodeNestThemeMode() {
    const current = getCurrentCodeNestTheme();
    const isLight = contrastRatio(current.background, '#0f172a') > contrastRatio(current.background, '#f8fafc');
    if (isLight) {
      setCodeNestTheme({ background: '#080b11', accent: '#38bdf8' });
    } else {
      setCodeNestTheme({ background: '#f8fafc', accent: '#0284c7' });
    }
  }

  /* Cho các trang đọc màu ảnh của sản phẩm (xem productThemeStyle trong shared.js). */
  window.CN_ART = {
    get colors() { return artState.colors; },
    get default() { return artState.default; },
    colorOf(id) {
      const value = artState.colors[String(id)];
      return /^#[0-9a-f]{6}$/i.test(value || '') ? value : '';
    },
    /* Phân loại sản phẩm: 'danger' (nguy hiểm) hoặc 'safe' (an toàn). */
    classify(product) {
      return classifyArt(product);
    },
    /* Màu tự động của sản phẩm theo phân loại an toàn / nguy hiểm. */
    autoColor(product) {
      return autoArtColor(product);
    },
    /* Màu ảnh dùng cho sản phẩm: ưu tiên màu riêng Admin đặt, rồi tới màu mặc định,
       rồi tới màu tự động theo phân loại; cuối cùng trả về rỗng để ảnh dùng màu nhấn theme. */
    resolve(id, product) {
      return this.colorOf(id) || artState.default || autoArtColor(product) || '';
    }
  };

  window.CODE_NEST_PRESETS = CODE_NEST_PRESETS;
  window.applyCodeNestTheme = applyCodeNestTheme;
  window.getCurrentCodeNestTheme = getCurrentCodeNestTheme;
  window.setCodeNestTheme = setCodeNestTheme;
  window.toggleCodeNestThemeMode = toggleCodeNestThemeMode;

  function loadSavedTheme() {
    try {
      const saved = JSON.parse(localStorage.getItem('cn_theme') || 'null');
      if (saved) {
        applyCodeNestTheme(saved);
      } else {
        // Default to Obsidian Dark if not previously set
        applyCodeNestTheme({ background: '#080b11', accent: '#38bdf8' });
      }
    } catch {
      // Bỏ qua nếu dữ liệu lưu không hợp lệ
    }
  }

  /* Trên host tĩnh (GitHub Pages) theme dùng chung được phát qua Supabase Storage */
  async function loadCloudTheme() {
    const client = window.supabase;
    if (!client || !client.storage) return;
    try {
      const { data: files, error } = await client.storage
        .from('products')
        .list('', { limit: 100, search: 'cn_theme-' });
      if (error || !Array.isArray(files) || !files.length) return;
      const latest = files
        .filter(file => file.name && file.name.startsWith('cn_theme-'))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!latest) return;
      const { data: publicUrl } = client.storage.from('products').getPublicUrl(latest.name);
      if (!publicUrl || !publicUrl.publicUrl) return;
      const response = await fetch(publicUrl.publicUrl, { cache: 'no-store' });
      if (!response.ok) return;
      const theme = await response.json();
      if (theme) {
        localStorage.setItem('cn_theme', JSON.stringify(theme));
        applyCodeNestTheme(theme);
      }
    } catch (error) {
      console.warn('Could not load the shared site theme:', error);
    }
  }

  const isStaticHost = window.location.protocol === 'file:' || 
                       window.location.hostname.includes('github.io') || 
                       window.location.hostname.includes('localhost') || 
                       window.location.hostname === '127.0.0.1';
  if (isStaticHost) {
    loadSavedTheme();
    loadCloudTheme();
    return;
  }
  fetch(`${apiBase}/api/site/theme`)
    .then(response => {
      if (!response.ok) throw new Error(`Theme request failed (${response.status}).`);
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return null;
    })
    .then(theme => {
      if (theme) applyCodeNestTheme(theme);
    })
    .catch(error => console.error('Could not load the saved site theme:', error));
})();

/* ====== Bộ điều phối hiệu ứng theo sức máy ======
   Đo FPS thật của từng thiết bị (cả máy tính lẫn điện thoại) rồi tự chọn mức
   đồ họa phù hợp và điều chỉnh được cả hai chiều:
     ultra -> máy khỏe: hiệu ứng đầy đủ, thêm lớp ánh sáng
     high  -> mức tiêu chuẩn
     low   -> đã giảm bớt hiệu ứng nặng
     off   -> tắt hẳn hiệu ứng nền để máy yếu chạy mượt
   Mức hiện tại nằm ở thuộc tính html[data-perf] và window.CN_PERF. */
(function performanceGovernor() {
  const root = document.documentElement;
  const listeners = [];
  const LEVELS = ['off', 'low', 'high', 'ultra'];
  const state = { level: 'high', ceiling: 'ultra', fps: 60, mobile: false, cores: 4, memory: 4 };

  let prefersReduced = false;
  try {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.mobile = window.matchMedia('(max-width: 900px)').matches ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 1100);
    state.cores = navigator.hardwareConcurrency || 4;
    /* Safari/iOS không cung cấp deviceMemory nên mặc định 4GB. */
    state.memory = navigator.deviceMemory || 4;
  } catch { /* môi trường không hỗ trợ matchMedia */ }

  /* Máy 2GB RAM (hoặc máy cảm ứng 2 lõi) bị chặn trần ở mức "high" — vẫn cho
     chạy thử mức cao, nếu không giữ nổi khung hình thì bộ đo FPS tự hạ xuống. */
  const weakDevice = state.memory <= 2 || (state.mobile && state.cores <= 2);
  state.ceiling = prefersReduced ? 'off' : (weakDevice ? 'high' : 'ultra');

  /* Ép mức bằng tay khi muốn xem bản đầy đủ:
     localStorage.setItem('cn_perf', 'ultra') rồi tải lại trang.
     Khi đã ép thì bộ đo FPS ngừng tự đổi mức. */
  let forced = null;
  try {
    const saved = localStorage.getItem('cn_perf');
    if (LEVELS.includes(saved)) forced = saved;
  } catch { /* chế độ riêng tư chặn localStorage */ }
  if (forced) state.ceiling = forced;

  /* Lớp cực quang xoay chậm phía sau nội dung — điểm nhấn rõ nhất của mức cao.
     Máy tính dựng ở cả mức "high" lẫn "ultra"; thiết bị cảm ứng chỉ dựng ở mức
     "ultra" để không kéo tụt khung hình của điện thoại. */
  const AURORA_STYLE = `
.cn-aurora {
  position: fixed;
  left: -15%;
  top: -15%;
  width: 130%;
  height: 130%;
  z-index: -2;
  pointer-events: none;
  opacity: 0;
  background:
    conic-gradient(from 0deg,
      transparent 0deg,
      rgba(var(--gold-light-rgb, 14, 165, 233), 0.34) 52deg,
      transparent 132deg,
      rgba(var(--gold-rgb, 2, 132, 199), 0.26) 208deg,
      transparent 274deg,
      rgba(129, 140, 248, 0.24) 332deg,
      transparent 360deg),
    radial-gradient(circle at 28% 30%, rgba(var(--gold-light-rgb, 14, 165, 233), 0.2), transparent 62%),
    radial-gradient(circle at 74% 72%, rgba(129, 140, 248, 0.18), transparent 64%);
  will-change: transform;
  animation: cnAuroraSpin 40s linear infinite;
  transition: opacity 1.4s ease;
}
@keyframes cnAuroraSpin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  .cn-aurora { animation: none; }
}`;
  let aurora = null;

  function syncAurora() {
    const wanted = state.level === 'ultra' ||
      (state.level === 'high' && (!state.mobile || forced));
    if (!wanted) {
      if (aurora) {
        aurora.remove();
        aurora = null;
      }
      return;
    }
    if (!aurora) {
      if (!document.getElementById('cn-aurora-style')) {
        const style = document.createElement('style');
        style.id = 'cn-aurora-style';
        style.textContent = AURORA_STYLE;
        document.head.appendChild(style);
      }
      aurora = document.createElement('div');
      aurora.className = 'cn-aurora';
      aurora.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(aurora);
    }
    aurora.style.opacity = state.level === 'ultra' ? '0.85' : '0.45';
  }

  function setLevel(level) {
    if (state.level === level) return;
    state.level = level;
    root.setAttribute('data-perf', level);
    syncAurora();
    listeners.forEach(fn => {
      try { fn(level, state); } catch { /* bỏ qua lỗi từ bên đăng ký */ }
    });
  }

  /* Mọi máy bắt đầu ở mức "high" (trừ khi hệ điều hành bật "giảm chuyển động"),
     rồi bộ đo FPS mới hạ xuống nếu thiết bị thật sự không giữ nổi khung hình.
     Nhờ vậy máy tầm trung vẫn được thấy đầy đủ hiệu ứng ngay từ đầu. */
  state.level = forced || (prefersReduced ? 'off' : 'high');
  root.setAttribute('data-perf', state.level);
  syncAurora();

  window.CN_PERF = {
    get level() { return state.level; },
    get mobile() { return state.mobile; },
    get fps() { return state.fps; },
    get ceiling() { return state.ceiling; },
    onChange(fn) {
      listeners.push(fn);
      try { fn(state.level, state); } catch { /* bỏ qua */ }
    }
  };

  /* Người dùng đã ép mức bằng tay thì bộ đo FPS không được tự đổi nữa. */
  if (forced) return;

  let history = [];
  let goodStreak = 0;
  /* Số nhịp đo đủ mượt liên tiếp mới được nâng một bậc. Mỗi lần phải hạ mức,
     ngưỡng này tăng lên để tránh nâng/hạ qua lại liên tục. */
  let requiredGood = 2;
  let cooldownUntil = 0;
  let lastDowngrade = 0;
  let frames = 0;
  let windowStart = 0;

  // Khi ẩn tab, requestAnimationFrame dừng nên số liệu sẽ sai — bỏ qua nhịp đó.
  document.addEventListener('visibilitychange', () => {
    frames = 0;
    windowStart = 0;
  });

  /* Người dùng đổi thiết lập "giảm chuyển động" trong lúc đang mở trang. */
  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      if (!event.matches) return;
      state.ceiling = 'off';
      setLevel('off');
    });
  } catch { /* trình duyệt cũ chưa hỗ trợ addEventListener trên MediaQueryList */ }

  /* Đổi mức và tạm ngưng đo ít giây để giao diện ổn định rồi mới đánh giá lại. */
  function settle(level, cooldown) {
    setLevel(level);
    history = [];
    goodStreak = 0;
    cooldownUntil = performance.now() + cooldown;
  }

  function sample(now) {
    if (document.hidden) {
      frames = 0;
      windowStart = 0;
      return requestAnimationFrame(sample);
    }
    if (!windowStart) {
      windowStart = now;
      return requestAnimationFrame(sample);
    }
    frames++;
    const elapsed = now - windowStart;
    if (elapsed < 1000) return requestAnimationFrame(sample);

    const fps = (frames * 1000) / elapsed;
    frames = 0;
    windowStart = now;
    state.fps = Math.round(fps);
    history.push(fps);
    if (history.length > 6) history.shift();

    // Bỏ 2 mẫu đầu vì trang còn đang dựng layout / tải dữ liệu.
    if (history.length >= 3 && now >= cooldownUntil) {
      const recent = history.slice(-4);
      const avg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
      const index = LEVELS.indexOf(state.level);

      /* Mức mục tiêu khi máy không giữ nổi khung hình: càng lag càng lùi sâu.
         Khoảng 40-52fps vẫn coi là dùng được nên giữ nguyên mức hiện tại —
         tránh chuyện máy tầm trung bị kẹt vĩnh viễn ở mức thấp. null nghĩa là
         mức hiện tại đã phù hợp, không cần đổi. */
      let target = null;
      if (avg < 24) target = 'off';
      else if (avg < 40) target = 'low';
      else if (state.level === 'ultra' && avg < 52) target = 'high';

      if (target !== null && target !== state.level) {
        /* Mỗi lần phải hạ mức, siết thêm điều kiện nâng lại để tránh dao động. */
        requiredGood = Math.min(requiredGood + 1, 8);
        lastDowngrade = now;
        settle(target, target === 'off' ? 12000 : 8000);
      } else if (target === null) {
        goodStreak = avg >= 54 ? goodStreak + 1 : 0;

        if (goodStreak >= requiredGood && index < LEVELS.indexOf(state.ceiling)) {
          settle(LEVELS[index + 1], 6000);
        } else if (now - lastDowngrade > 20000 && requiredGood > 2) {
          /* Giữ mức mượt lâu dài thì nới dần điều kiện để dễ nâng lại. */
          requiredGood -= 1;
        }
      }
    }

    // Vẫn tiếp tục đo để xử lý trường hợp máy lag về sau (cuộn trang, dữ liệu nặng).
    requestAnimationFrame(sample);
  }

  requestAnimationFrame(sample);
})();
