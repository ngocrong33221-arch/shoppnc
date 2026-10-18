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
     - artDefault: màu mặc định cho mọi sản phẩm không có màu riêng (rỗng = theo màu nhấn) */
  const artState = { colors: {}, default: '' };

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
    /* Màu ảnh dùng cho sản phẩm: ưu tiên màu riêng, rồi tới màu mặc định Admin đặt,
       cuối cùng trả về rỗng để ảnh dùng màu nhấn của theme. */
    resolve(id) {
      return this.colorOf(id) || artState.default || '';
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

/* Đo FPS thực tế trên thiết bị nhỏ / cảm ứng. Nếu máy bị lag, tự hạ mức hiệu ứng
   để giao diện mượt lại: "low" giảm hiệu ứng nặng, "off" tắt hẳn hiệu ứng nền.
   Mức hiện tại nằm ở thuộc tính html[data-perf] và window.CN_PERF. */
(function performanceGovernor() {
  const root = document.documentElement;
  const listeners = [];
  const state = { level: 'high', fps: 60, mobile: false };

  let prefersReduced = false;
  try {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.mobile = window.matchMedia('(max-width: 900px)').matches ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 1100);
  } catch { /* môi trường không hỗ trợ matchMedia */ }

  function setLevel(level) {
    if (state.level === level) return;
    state.level = level;
    root.setAttribute('data-perf', level);
    listeners.forEach(fn => {
      try { fn(level, state); } catch { /* bỏ qua lỗi từ bên đăng ký */ }
    });
  }

  state.level = prefersReduced ? 'off' : 'high';
  root.setAttribute('data-perf', state.level);

  window.CN_PERF = {
    get level() { return state.level; },
    get mobile() { return state.mobile; },
    get fps() { return state.fps; },
    onChange(fn) {
      listeners.push(fn);
      try { fn(state.level, state); } catch { /* bỏ qua */ }
    }
  };

  // Chỉ đo trên thiết bị nhỏ / cảm ứng; máy để bàn gần như không lag.
  if (prefersReduced || !state.mobile) return;

  const history = [];
  let frames = 0;
  let windowStart = 0;

  // Khi ẩn tab, requestAnimationFrame dừng nên số liệu sẽ sai — bỏ qua nhịp đó.
  document.addEventListener('visibilitychange', () => {
    frames = 0;
    windowStart = 0;
  });

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
    if (history.length > 8) history.shift();

    // Bỏ 2 mẫu đầu vì trang còn đang dựng layout / tải dữ liệu.
    if (history.length < 3) return requestAnimationFrame(sample);

    const recent = history.slice(-4);
    const avg = recent.reduce((sum, value) => sum + value, 0) / recent.length;

    if (avg < 28) { setLevel('off'); return; }
    if (avg < 42) { setLevel('low'); return; }
    // Vẫn tiếp tục đo để xử lý trường hợp máy lag về sau (cuộn trang, dữ liệu nặng).
    requestAnimationFrame(sample);
  }

  requestAnimationFrame(sample);
})();
