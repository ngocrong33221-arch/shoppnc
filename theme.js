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

  function applyCodeNestTheme(theme) {
    if (!theme || !/^#[0-9a-f]{6}$/i.test(theme.background) || !/^#[0-9a-f]{6}$/i.test(theme.accent)) return;
    const root = document.documentElement;
    const background = theme.background.toLowerCase();
    const accent = theme.accent.toLowerCase();
    const ink = contrastRatio(background, '#edf6ff') >= contrastRatio(background, '#10131a')
      ? '#edf6ff'
      : '#10131a';
    const [red, green, blue] = rgb(accent);
    root.style.setProperty('--bg', background);
    root.style.setProperty('--bg-deep', shade(background, 0.55));
    root.style.setProperty('--surface', shade(background, 1.35));
    root.style.setProperty('--surface2', shade(background, 1.8));
    root.style.setProperty('--surface-card', `rgba(${rgb(shade(background, 1.4)).join(', ')}, 0.88)`);
    root.style.setProperty('--ink', ink);
    root.style.setProperty('--ink-dim', mix(ink, background, 0.18));
    root.style.setProperty('--muted', mix(ink, background, 0.38));
    root.style.setProperty('--gold', accent);
    root.style.setProperty('--gold-light', mix(accent, '#ffffff', 0.52));
    root.style.setProperty('--gold-bright', mix(accent, '#ffffff', 0.18));
    root.style.setProperty('--gold-warm', shade(accent, 0.78));
    root.style.setProperty('--gold-deep', shade(accent, 0.52));
    root.style.setProperty('--gold-glow', `rgba(${red}, ${green}, ${blue}, 0.35)`);
    root.style.setProperty('--gold-subtle', `rgba(${red}, ${green}, ${blue}, 0.08)`);
    root.style.setProperty('--gold-border', `rgba(${red}, ${green}, ${blue}, 0.22)`);
    root.style.setProperty('--gold-border-focus', `rgba(${rgb(mix(accent, '#ffffff', 0.52)).join(', ')}, 0.65)`);
    root.style.setProperty('--gold-gradient', `linear-gradient(135deg, ${shade(accent, 0.72)} 0%, ${mix(accent, '#ffffff', 0.68)} 28%, ${accent} 55%, ${mix(accent, '#ffffff', 0.52)} 80%, ${shade(accent, 0.52)} 100%)`);
    root.style.setProperty('--gold-text-grad', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.76)} 0%, ${mix(accent, '#ffffff', 0.18)} 35%, ${accent} 70%, ${shade(accent, 0.65)} 100%)`);
    root.style.setProperty('--gold-btn', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.42)} 0%, ${accent} 55%, ${shade(accent, 0.78)} 100%)`);
    root.style.setProperty('--gold-btn-hover', `linear-gradient(135deg, ${mix(accent, '#ffffff', 0.62)} 0%, ${mix(accent, '#ffffff', 0.38)} 55%, ${accent} 100%)`);
  }

  window.applyCodeNestTheme = applyCodeNestTheme;

  function loadSavedTheme() {
    try {
      const saved = JSON.parse(localStorage.getItem('cn_theme') || 'null');
      if (saved) applyCodeNestTheme(saved);
    } catch {
      // Bỏ qua nếu dữ liệu lưu không hợp lệ
    }
  }

  const isStaticHost = window.location.protocol === 'file:' || window.location.hostname.endsWith('github.io');
  if (isStaticHost) {
    loadSavedTheme();
    return;
  }
  fetch(`${apiBase}/api/site/theme`)
    .then(response => {
      if (!response.ok) throw new Error(`Theme request failed (${response.status}).`);
      return response.json();
    })
    .then(applyCodeNestTheme)
    .catch(error => console.error('Could not load the saved site theme:', error));
})();
