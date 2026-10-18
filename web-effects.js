/* ============================================================
   web-effects.js — shared SoundCloud playlist and music player
   ============================================================ */
(() => {
  if (document.querySelector('.music-player')) return;

  const PLAYLIST_KEY = 'cn_soundcloud_playlist';
  const MUSIC_PREFERENCE_KEY = 'cn_music_enabled';
  const MUSIC_SESSION_KEY = 'cn_music_session';
  const MUSIC_API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:5000'
    : window.location.origin;
  const DEFAULT_TRACKS = [
    'Mưa Rơi Vào Phòng',
    'Để Em Đốt Xa',
    'Tuyết Yêu Thương',
    'Khóu Xót Xa',
    'Mưa Vương Vấn',
    'Suy Nghĩ Trong Em',
    'Người Lạ lùng Qua',
    'Quên Một Người Từng Yêu',
    'Thủy Chung HSTAGS',
  ];

  const style = document.createElement('style');
  style.textContent = `
    .music-player {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 10000;
      width: min(370px, calc(100vw - 28px));
      padding: 12px 14px;
      border: 1px solid rgba(212, 175, 55, 0.28);
      border-radius: 14px;
      background: rgba(10, 10, 14, 0.96);
      color: #f7f7fa;
      font-family: 'Inter', sans-serif;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 0 24px rgba(212, 175, 55, 0.12);
      animation: musicIn 0.5s 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .music-aura-border {
      position: fixed;
      inset: 8px;
      z-index: 9998;
      border: 2px solid rgba(250, 227, 140, 0.9);
      border-radius: 18px;
      box-shadow: inset 0 0 18px rgba(212, 175, 55, 0.1), 0 0 14px rgba(212, 175, 55, 0.12);
      opacity: 0;
      pointer-events: none;
    }
    @keyframes musicIn {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .music-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .music-player.dragging .music-bar { cursor: grabbing; }
    .music-eq {
      display: flex;
      align-items: flex-end;
      gap: 2.5px;
      height: 24px;
      flex-shrink: 0;
    }
    .music-eq-bar {
      width: 3px;
      height: 6px;
      background: linear-gradient(180deg, #ffd700, #d4af37);
      border-radius: 2px;
    }
    .music-player.playing .music-eq-bar:nth-child(1) { animation: eqBounce 0.85s infinite ease-in-out alternate; }
    .music-player.playing .music-eq-bar:nth-child(2) { animation: eqBounce 1.1s infinite 0.2s ease-in-out alternate; }
    .music-player.playing .music-eq-bar:nth-child(3) { animation: eqBounce 0.75s infinite 0.4s ease-in-out alternate; }
    .music-player.playing .music-eq-bar:nth-child(4) { animation: eqBounce 0.95s infinite 0.1s ease-in-out alternate; }
    @keyframes eqBounce {
      0% { height: 4px; }
      50% { height: 20px; }
      100% { height: 10px; }
    }
    .music-info {
      flex: 1;
      min-width: 0;
    }
    .music-kicker {
      margin: 0 0 2px;
      color: #d4af37;
      font: 600 9px 'JetBrains Mono', monospace;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .music-title {
      display: block;
      overflow: hidden;
      color: #f7f7fa;
      font-size: 13px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .music-controls {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    .music-control {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(212, 175, 55, 0.35);
      border-radius: 9px;
      background: rgba(212, 175, 55, 0.08);
      color: #ffd700;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .music-control:hover {
      background: rgba(212, 175, 55, 0.2);
      transform: translateY(-1px);
    }
    .music-library {
      display: none;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(212, 175, 55, 0.18);
    }
    .music-player.library-open .music-library { display: block; }
    .music-library iframe {
      display: block;
      width: 100%;
      height: 166px;
      margin-bottom: 10px;
      border: 0;
      border-radius: 9px;
      background: #111;
    }
    .music-library iframe[hidden] { display: none; }
    .music-search-row,
    .music-save-row {
      display: flex;
      gap: 7px;
      margin: 8px 0;
    }
    .music-search-row input,
    .music-save-row input {
      min-width: 0;
      flex: 1;
      height: 36px;
      padding: 0 10px;
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 8px;
      outline: 0;
      background: rgba(255, 255, 255, 0.05);
      color: #f7f7fa;
      font: 12px 'Inter', sans-serif;
      user-select: text;
      -webkit-user-select: text;
    }
    .music-search-row input:focus,
    .music-save-row input:focus { border-color: rgba(250, 227, 140, 0.65); }
    .music-search-row button,
    .music-save-row button {
      flex-shrink: 0;
      padding: 0 10px;
      border: 1px solid rgba(212, 175, 55, 0.32);
      border-radius: 8px;
      background: rgba(212, 175, 55, 0.12);
      color: #fae38c;
      font: 600 11px 'Inter', sans-serif;
      cursor: pointer;
    }
    .music-help {
      margin: 0 0 8px;
      color: #9999a6;
      font-size: 10px;
      line-height: 1.5;
    }
    .music-status {
      min-height: 14px;
      margin: 4px 0 8px;
      color: #fae38c;
      font-size: 10px;
      line-height: 1.4;
    }
    .music-track-list {
      display: grid;
      gap: 5px;
      max-height: 176px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .music-track-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 7px 8px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.025);
    }
    .music-track-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: #e6e6ed;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .music-track-action {
      flex-shrink: 0;
      padding: 5px 7px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #fae38c;
      font: 600 10px 'Inter', sans-serif;
      cursor: pointer;
    }
    .music-track-action:disabled {
      color: #777782;
      cursor: default;
    }
    @media (max-width: 480px) {
      .music-player { right: 14px; bottom: 14px; }
      .music-aura-border { inset: 5px; border-radius: 13px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .music-player, .music-eq-bar { animation: none !important; }
    }
  `;
  document.head.append(style);

  const auraBorder = document.createElement('div');
  auraBorder.className = 'music-aura-border';
  auraBorder.setAttribute('aria-hidden', 'true');
  document.body.append(auraBorder);

  const player = document.createElement('section');
  player.className = 'music-player';
  player.setAttribute('aria-label', 'Trình phát nhạc');
  player.innerHTML = `
    <div class="music-bar">
      <div class="music-eq" aria-hidden="true">
        <span class="music-eq-bar"></span><span class="music-eq-bar"></span>
        <span class="music-eq-bar"></span><span class="music-eq-bar"></span>
      </div>
      <div class="music-info">
        <p class="music-kicker" id="musicKicker">NHẠC NỀN</p>
        <span class="music-title" id="musicTitle">Đang chọn nhạc...</span>
      </div>
      <div class="music-controls">
        <button class="music-control" id="musicToggle" type="button" aria-label="Phát nhạc" title="Phát hoặc tạm dừng">
          <svg id="iconPlay" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <svg id="iconPause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="music-control" id="musicLibraryToggle" type="button" aria-label="Mở danh sách nhạc" title="Danh sách và tìm nhạc">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="music-library" id="musicLibrary">
      <iframe id="soundcloudFrame" title="SoundCloud player" allow="autoplay" hidden></iframe>
      <p class="music-help">Tìm bài trên SoundCloud, mở kết quả phù hợp rồi dán link bài công khai để lưu và phát.</p>
      <form class="music-search-row" id="musicSearchForm">
        <input id="musicSearch" type="search" placeholder="Tìm bài hát trên SoundCloud..." aria-label="Tìm bài trên SoundCloud">
        <button type="submit">Tìm</button>
      </form>
      <form class="music-save-row" id="musicSaveForm">
        <input id="musicTrackTitle" type="text" placeholder="Tên bài hát" aria-label="Tên bài hát" required maxlength="120">
        <input id="musicTrackUrl" type="url" placeholder="Dán link bài SoundCloud" aria-label="Link bài SoundCloud" required>
        <button type="submit">Lưu</button>
      </form>
      <p class="music-status" id="musicStatus" role="status"></p>
      <div class="music-track-list" id="musicTrackList" aria-label="Danh sách bài hát"></div>
    </div>
    <audio id="localMusic" loop preload="metadata" style="display:none">
      <source src="${encodeURI('Tập Yêu Đi.mp3')}" type="audio/mpeg">
    </audio>
  `;
  document.body.append(player);

  /* ── Kéo thả khung nhạc đi bất kỳ đâu trên màn hình ── */
  const MUSIC_POS_KEY = 'cn_music_pos';
  const dragHandle = player.querySelector('.music-bar');

  function clampPosition(value, max) {
    return Math.min(Math.max(value, 0), Math.max(max, 0));
  }

  function placePlayer(left, top) {
    const rect = player.getBoundingClientRect();
    player.style.left = `${clampPosition(left, window.innerWidth - rect.width)}px`;
    player.style.top = `${clampPosition(top, window.innerHeight - rect.height)}px`;
    player.style.right = 'auto';
    player.style.bottom = 'auto';
  }

  function savePlayerPosition() {
    try {
      localStorage.setItem(MUSIC_POS_KEY, JSON.stringify({
        left: parseInt(player.style.left, 10) || 0,
        top: parseInt(player.style.top, 10) || 0,
      }));
    } catch (error) {
      console.warn('Không lưu được vị trí khung nhạc:', error);
    }
  }

  try {
    const savedPosition = JSON.parse(localStorage.getItem(MUSIC_POS_KEY) || 'null');
    if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
      placePlayer(savedPosition.left, savedPosition.top);
    }
  } catch (error) {
    console.warn('Không đọc được vị trí khung nhạc đã lưu:', error);
  }

  (function enablePlayerDragging() {
    let pointerId = null;
    let grabOffsetX = 0;
    let grabOffsetY = 0;

    dragHandle.addEventListener('pointerdown', event => {
      // Bỏ qua khi bấm vào nút điều khiển để không chặn phát nhạc.
      if (event.target.closest('button, a, input, select, textarea')) return;
      const rect = player.getBoundingClientRect();
      pointerId = event.pointerId;
      grabOffsetX = event.clientX - rect.left;
      grabOffsetY = event.clientY - rect.top;
      player.classList.add('dragging');
      dragHandle.setPointerCapture(pointerId);
      event.preventDefault();
    });

    dragHandle.addEventListener('pointermove', event => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      placePlayer(event.clientX - grabOffsetX, event.clientY - grabOffsetY);
    });

    function stopDragging(event) {
      if (pointerId === null || event.pointerId !== pointerId) return;
      pointerId = null;
      player.classList.remove('dragging');
      savePlayerPosition();
    }

    dragHandle.addEventListener('pointerup', stopDragging);
    dragHandle.addEventListener('pointercancel', stopDragging);

    window.addEventListener('resize', () => {
      if (!player.style.left) return;
      placePlayer(parseInt(player.style.left, 10) || 0, parseInt(player.style.top, 10) || 0);
      savePlayerPosition();
    });
  })();

  const audio = player.querySelector('#localMusic');
  const toggle = player.querySelector('#musicToggle');
  const libraryToggle = player.querySelector('#musicLibraryToggle');
  const frame = player.querySelector('#soundcloudFrame');
  const titleEl = player.querySelector('#musicTitle');
  const kicker = player.querySelector('#musicKicker');
  const playIcon = player.querySelector('#iconPlay');
  const pauseIcon = player.querySelector('#iconPause');
  const searchInput = player.querySelector('#musicSearch');
  const trackTitleInput = player.querySelector('#musicTrackTitle');
  const trackUrlInput = player.querySelector('#musicTrackUrl');
  const statusEl = player.querySelector('#musicStatus');
  const trackList = player.querySelector('#musicTrackList');
  let playlist = loadPlaylist();
  let widget = null;
  let widgetReady = null;
  let activeTrack = null;
  let activeSource = 'local';
  let isPlaying = false;
  let audioContext = null;
  let audioAnalyser = null;
  let audioFrequencyData = null;
  let bassAnimationFrame = 0;
  let smoothedBassLevel = 0;

  function loadPlaylist() {
    let saved = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      if (Array.isArray(parsed)) saved = parsed;
    } catch (error) {
      console.warn('Saved music playlist could not be read:', error);
    }

    const byTitle = new Map();
    saved.forEach(track => {
      if (track && typeof track.title === 'string' && track.title.trim()) {
        byTitle.set(track.title.trim().toLocaleLowerCase(), {
          title: track.title.trim(),
          url: isSoundCloudTrackUrl(track.url) ? normalizeTrackUrl(track.url) : '',
        });
      }
    });
    DEFAULT_TRACKS.forEach(name => {
      const key = name.toLocaleLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, { title: name, url: '' });
    });
    return [...byTitle.values()];
  }

  function persistPlaylist() {
    try {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
    } catch (error) {
      console.error('Could not save the SoundCloud playlist:', error);
      statusEl.textContent = 'Không thể lưu playlist trong trình duyệt này.';
    }
  }

  function mergePlaylistTracks(tracks) {
    const byTitle = new Map(playlist.map(track => [track.title.toLocaleLowerCase(), track]));
    tracks.forEach(track => {
      if (track && typeof track.title === 'string' && isSoundCloudTrackUrl(track.url)) {
        byTitle.set(track.title.trim().toLocaleLowerCase(), {
          title: track.title.trim(),
          url: normalizeTrackUrl(track.url),
        });
      }
    });
    playlist = [...byTitle.values()];
  }

  async function loadSharedPlaylist() {
    try {
      const response = await fetch(`${MUSIC_API_BASE}/api/music/tracks`);
      if (!response.ok) throw new Error(`Playlist request failed (${response.status}).`);
      const tracks = await response.json();
      if (!Array.isArray(tracks)) throw new Error('The shared playlist response is invalid.');
      mergePlaylistTracks(tracks);
      persistPlaylist();
    } catch (error) {
      console.error('Could not load the shared SoundCloud playlist:', error);
      statusEl.textContent = 'Không kết nối được playlist chung; đang dùng playlist đã lưu trên thiết bị này.';
    }
    renderPlaylist();
  }

  function normalizeTrackUrl(value) {
    const parsed = new URL(value.trim());
    parsed.search = '';
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  }

  function isSoundCloudTrackUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const parsed = new URL(value.trim());
      const parts = parsed.pathname.split('/').filter(Boolean);
      return parsed.protocol === 'https:'
        && ['soundcloud.com', 'www.soundcloud.com'].includes(parsed.hostname)
        && parts.length >= 2
        && parts[1] !== 'sets'
        && parts[0] !== 'search'
        && parts[0] !== 'you'
        && parts[0] !== 'discover';
    } catch {
      return false;
    }
  }

  function soundCloudEmbedUrl(trackUrl, autoplay = true) {
    const params = new URLSearchParams({
      url: trackUrl,
      auto_play: String(autoplay),
      hide_related: 'true',
      show_comments: 'false',
      show_user: 'true',
      visual: 'false',
    });
    return `https://w.soundcloud.com/player/?${params.toString()}`;
  }

  function syncUI(playing) {
    isPlaying = playing;
    playIcon.style.display = playing ? 'none' : '';
    pauseIcon.style.display = playing ? '' : 'none';
    toggle.setAttribute('aria-label', playing ? 'Tạm dừng nhạc' : 'Phát nhạc');
    player.classList.toggle('playing', playing);
    if (playing && activeSource === 'local') {
      startBassReactiveBorder();
    } else {
      stopBassReactiveBorder();
    }
    persistMusicSession(playing);
  }

  function readMusicSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(MUSIC_SESSION_KEY) || 'null');
      if (!saved || typeof saved !== 'object' || typeof saved.playing !== 'boolean') return null;
      return saved;
    } catch (error) {
      console.warn('Saved music session could not be read:', error);
      return null;
    }
  }

  function persistMusicSession(playing = isPlaying) {
    try {
      sessionStorage.setItem(MUSIC_SESSION_KEY, JSON.stringify({
        source: activeSource,
        track: activeTrack ? { title: activeTrack.title, url: activeTrack.url } : null,
        playing: Boolean(playing),
      }));
    } catch (error) {
      console.warn('Music session could not be saved for page navigation:', error);
    }
  }

  function startBassReactiveBorder() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!audioAnalyser) {
      if (!AudioContextConstructor) {
        console.warn('Web Audio API is unavailable; bass-reactive border cannot start.');
        return;
      }
      try {
        audioContext = new AudioContextConstructor();
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 2048;
        audioAnalyser.smoothingTimeConstant = 0.55;
        const source = audioContext.createMediaElementSource(audio);
        source.connect(audioAnalyser);
        audioAnalyser.connect(audioContext.destination);
        audioFrequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
      } catch (error) {
        console.error('Could not initialize bass analysis for local music:', error);
        audioAnalyser = null;
        audioContext = null;
        return;
      }
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(error => {
        console.warn('Could not resume audio analysis:', error);
      });
    }
    if (!bassAnimationFrame) bassAnimationFrame = requestAnimationFrame(updateBassReactiveBorder);
  }

  function updateBassReactiveBorder() {
    bassAnimationFrame = 0;
    if (!audioAnalyser || audio.paused || activeSource !== 'local') return;

    audioAnalyser.getByteFrequencyData(audioFrequencyData);
    const binWidth = audioContext.sampleRate / audioAnalyser.fftSize;
    const firstBassBin = Math.max(1, Math.floor(45 / binWidth));
    const lastBassBin = Math.min(
      audioFrequencyData.length - 1,
      Math.ceil(180 / binWidth),
    );
    let bassTotal = 0;
    for (let bin = firstBassBin; bin <= lastBassBin; bin += 1) {
      bassTotal += audioFrequencyData[bin];
    }
    const bassAverage = bassTotal / (lastBassBin - firstBassBin + 1);
    const targetLevel = Math.max(0, Math.min(1, (bassAverage - 38) / 100));
    const smoothing = targetLevel > smoothedBassLevel ? 0.55 : 0.18;
    smoothedBassLevel += (targetLevel - smoothedBassLevel) * smoothing;

    const opacity = 0.08 + smoothedBassLevel * 0.92;
    const glowSize = 8 + smoothedBassLevel * 34;
    const glowOpacity = 0.08 + smoothedBassLevel * 0.48;
    auraBorder.style.opacity = opacity.toFixed(2);
    auraBorder.style.borderColor = `rgba(250, 227, 140, ${opacity.toFixed(2)})`;
    auraBorder.style.boxShadow = `inset 0 0 ${Math.round(glowSize / 2)}px rgba(212, 175, 55, ${glowOpacity.toFixed(2)}), 0 0 ${Math.round(glowSize)}px rgba(255, 215, 0, ${glowOpacity.toFixed(2)})`;
    bassAnimationFrame = requestAnimationFrame(updateBassReactiveBorder);
  }

  function stopBassReactiveBorder() {
    if (bassAnimationFrame) {
      cancelAnimationFrame(bassAnimationFrame);
      bassAnimationFrame = 0;
    }
    smoothedBassLevel = 0;
    auraBorder.removeAttribute('style');
  }

  function renderPlaylist() {
    trackList.replaceChildren();
    playlist.forEach(track => {
      const row = document.createElement('div');
      row.className = 'music-track-row';
      const name = document.createElement('span');
      name.className = 'music-track-name';
      name.textContent = track.title;
      const searchButton = document.createElement('button');
      searchButton.className = 'music-track-action';
      searchButton.type = 'button';
      searchButton.textContent = 'Tìm';
      searchButton.setAttribute('aria-label', `Tìm ${track.title} trên SoundCloud`);
      searchButton.addEventListener('click', () => openSoundCloudSearch(track.title));
      row.append(name, searchButton);

      const playButton = document.createElement('button');
      playButton.className = 'music-track-action';
      playButton.type = 'button';
      playButton.textContent = track.url ? 'Phát' : 'Chưa có link';
      playButton.disabled = !track.url;
      playButton.setAttribute('aria-label', track.url ? `Phát ${track.title}` : `Chưa có link cho ${track.title}`);
      if (track.url) playButton.addEventListener('click', () => playSoundCloudTrack(track, true));
      row.append(playButton);
      trackList.append(row);
    });
  }

  function openSoundCloudSearch(query) {
    const text = query.trim();
    if (!text) {
      statusEl.textContent = 'Nhập tên bài muốn tìm trước.';
      return;
    }
    const searchUrl = `https://soundcloud.com/search/sounds?q=${encodeURIComponent(text)}`;
    const searchLink = document.createElement('a');
    searchLink.href = searchUrl;
    searchLink.target = '_blank';
    searchLink.rel = 'noopener noreferrer';
    searchLink.hidden = true;
    document.body.append(searchLink);
    searchLink.click();
    searchLink.remove();
    statusEl.textContent = `Đã mở kết quả tìm “${text}”. Dán link bài vào ô bên dưới để lưu.`;
    trackTitleInput.value = text;
  }

  function loadSoundCloudWidget() {
    if (widgetReady) return widgetReady;
    widgetReady = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('SoundCloud player timed out.')), 12000);
      const initialize = () => {
        if (!window.SC || !window.SC.Widget) {
          window.clearTimeout(timeout);
          reject(new Error('SoundCloud player is unavailable.'));
          return;
        }
        widget = window.SC.Widget(frame);
        widget.bind(window.SC.Widget.Events.PLAY, () => syncUI(true));
        widget.bind(window.SC.Widget.Events.PAUSE, () => syncUI(false));
        widget.bind(window.SC.Widget.Events.FINISH, () => {
          playRandomSoundCloudTrack(activeTrack?.url);
        });
        widget.bind(window.SC.Widget.Events.READY, () => {
          window.clearTimeout(timeout);
          resolve(widget);
        });
      };

      if (window.SC && window.SC.Widget) {
        initialize();
        return;
      }
      let script = document.querySelector('script[data-soundcloud-widget]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://w.soundcloud.com/player/api.js';
        script.async = true;
        script.dataset.soundcloudWidget = 'true';
        document.head.append(script);
      }
      script.addEventListener('load', initialize, { once: true });
      script.addEventListener('error', () => {
        window.clearTimeout(timeout);
        reject(new Error('SoundCloud player could not be loaded.'));
      }, { once: true });
    });
    return widgetReady;
  }

  async function playSoundCloudTrack(track, autoplay) {
    activeTrack = track;
    activeSource = 'soundcloud';
    titleEl.textContent = track.title;
    kicker.textContent = 'SOUNDCLOUD';
    persistMusicSession(autoplay);
    audio.pause();
    frame.hidden = false;
    statusEl.textContent = 'Đang tải bài từ SoundCloud...';
    if (!frame.src) frame.src = soundCloudEmbedUrl(track.url);

    try {
      const soundCloudWidget = await loadSoundCloudWidget();
      soundCloudWidget.load(track.url, {
        auto_play: autoplay,
        hide_related: true,
        show_comments: false,
        show_user: true,
        visual: false,
      });
      statusEl.textContent = autoplay
        ? 'Đang phát trên SoundCloud.'
        : 'Đã chọn bài trên SoundCloud.';
      if (autoplay) localStorage.setItem(MUSIC_PREFERENCE_KEY, 'true');
    } catch (error) {
      console.error('SoundCloud playback failed:', error);
      statusEl.textContent = 'Không tải được SoundCloud. Kiểm tra kết nối hoặc link bài.';
      syncUI(false);
    }
  }

  function playRandomSoundCloudTrack(excludeUrl) {
    const readyTracks = playlist.filter(track => track.url && track.url !== excludeUrl);
    const choices = readyTracks.length
      ? readyTracks
      : playlist.filter(track => track.url);
    if (!choices.length) return;
    const nextTrack = choices[Math.floor(Math.random() * choices.length)];
    playSoundCloudTrack(nextTrack, true);
  }

  player.querySelector('#musicSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    openSoundCloudSearch(searchInput.value);
  });

  player.querySelector('#musicSaveForm').addEventListener('submit', async event => {
    event.preventDefault();
    const title = trackTitleInput.value.trim();
    const url = trackUrlInput.value.trim();
    if (!title) {
      statusEl.textContent = 'Nhập tên bài hát để lưu.';
      return;
    }
    if (!isSoundCloudTrackUrl(url)) {
      statusEl.textContent = 'Link cần là bài công khai dạng https://soundcloud.com/ten-kenh/ten-bai.';
      return;
    }

    const normalizedUrl = normalizeTrackUrl(url);
    let savedTrack = { title, url: normalizedUrl };
    try {
      const response = await fetch(`${MUSIC_API_BASE}/api/music/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedTrack),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Could not save track (${response.status}).`);
      }
      if (!result.track || typeof result.track.title !== 'string' || !isSoundCloudTrackUrl(result.track.url)) {
        throw new Error('The server returned an invalid saved track.');
      }
      savedTrack = result.track;
      statusEl.textContent = `Đã lưu “${title}” cho playlist chung.`;
    } catch (error) {
      if (!(error instanceof TypeError)) {
        console.error('Could not save the shared SoundCloud track:', error);
        statusEl.textContent = error.message || 'Không thể lưu bài hát vào playlist chung.';
        return;
      }
      console.error('SoundCloud backend is unavailable; saving this track locally only:', error);
      statusEl.textContent = 'Backend không khả dụng; bài chỉ được lưu trên thiết bị này.';
    }

    mergePlaylistTracks([savedTrack]);
    persistPlaylist();
    renderPlaylist();
    trackUrlInput.value = '';
    searchInput.value = '';
    const saved = playlist.find(track => track.title.toLocaleLowerCase() === title.toLocaleLowerCase());
    playSoundCloudTrack(saved, true);
  });

  toggle.addEventListener('click', async () => {
    if (activeSource === 'soundcloud' && activeTrack) {
      if (!widget) {
        if (isPlaying) {
          localStorage.setItem(MUSIC_PREFERENCE_KEY, 'false');
          persistMusicSession(false);
          frame.src = soundCloudEmbedUrl(activeTrack.url, false);
          syncUI(false);
        } else {
          localStorage.setItem(MUSIC_PREFERENCE_KEY, 'true');
          playSoundCloudTrack(activeTrack, true);
        }
      } else if (isPlaying) {
        localStorage.setItem(MUSIC_PREFERENCE_KEY, 'false');
        persistMusicSession(false);
        widget.pause();
      }
      else {
        localStorage.setItem(MUSIC_PREFERENCE_KEY, 'true');
        persistMusicSession(true);
        widget.play();
      }
      return;
    }
    if (audio.paused) {
      localStorage.setItem(MUSIC_PREFERENCE_KEY, 'true');
      persistMusicSession(true);
      try {
        await audio.play();
      } catch (error) {
        console.warn('Local background music could not autoplay:', error);
        kicker.textContent = 'BẤM ĐỂ PHÁT';
        syncUI(false);
      }
    } else {
      localStorage.setItem(MUSIC_PREFERENCE_KEY, 'false');
      persistMusicSession(false);
      audio.pause();
    }
  });

  libraryToggle.addEventListener('click', () => {
    const expanded = player.classList.toggle('library-open');
    libraryToggle.setAttribute('aria-label', expanded ? 'Đóng danh sách nhạc' : 'Mở danh sách nhạc');
    if (expanded) searchInput.focus();
    // Khung nhạc cao lên khi mở danh sách nên cần đưa lại vào trong màn hình.
    if (player.style.left) {
      placePlayer(parseInt(player.style.left, 10) || 0, parseInt(player.style.top, 10) || 0);
      savePlayerPosition();
    }
  });

  audio.addEventListener('play', () => {
    activeSource = 'local';
    activeTrack = null;
    titleEl.textContent = 'Tập Yêu Đi';
    kicker.textContent = 'NHẠC NỀN';
    syncUI(true);
  });
  audio.addEventListener('pause', () => {
    if (activeSource === 'local') syncUI(false);
  });
  audio.addEventListener('ended', () => playRandomSoundCloudTrack());
  audio.addEventListener('error', () => {
    kicker.textContent = 'LỖI TẢI NHẠC';
    syncUI(false);
  });

  window.addEventListener('storage', event => {
    if (event.key !== PLAYLIST_KEY) return;
    playlist = loadPlaylist();
    renderPlaylist();
  });

  async function initializeMusic() {
    renderPlaylist();
    await loadSharedPlaylist();
    const savedTracks = playlist.filter(track => track.url);
    const musicEnabled = localStorage.getItem(MUSIC_PREFERENCE_KEY) !== 'false';
    const savedSession = readMusicSession();
    if (savedSession) {
      const shouldPlay = savedSession.playing;
      if (savedSession.source === 'soundcloud' && savedSession.track
        && isSoundCloudTrackUrl(savedSession.track.url)) {
        const savedTrack = playlist.find(track => track.url === savedSession.track.url)
          || { title: savedSession.track.title, url: normalizeTrackUrl(savedSession.track.url) };
        activeTrack = savedTrack;
        activeSource = 'soundcloud';
        titleEl.textContent = savedTrack.title;
        kicker.textContent = 'SOUNDCLOUD';
        frame.src = soundCloudEmbedUrl(savedTrack.url, shouldPlay);
        frame.hidden = false;
        if (shouldPlay && musicEnabled) {
          playSoundCloudTrack(savedTrack, true);
        } else {
          syncUI(false);
        }
        return;
      }
      if (savedSession.source === 'local') {
        activeTrack = null;
        activeSource = 'local';
        titleEl.textContent = 'Tập Yêu Đi';
        kicker.textContent = 'NHẠC NỀN';
        if (shouldPlay && musicEnabled) {
          audio.play().catch(error => {
            console.warn('Local background music could not resume:', error);
            kicker.textContent = 'BẤM ĐỂ PHÁT';
            syncUI(false);
          });
        } else {
          syncUI(false);
        }
        return;
      }
    }
    if (savedTracks.length) {
      const firstTrack = savedTracks[Math.floor(Math.random() * savedTracks.length)];
      activeTrack = firstTrack;
      activeSource = 'soundcloud';
      titleEl.textContent = firstTrack.title;
      if (musicEnabled) {
        playSoundCloudTrack(firstTrack, true);
      } else {
        frame.src = soundCloudEmbedUrl(firstTrack.url, false);
        frame.hidden = false;
        kicker.textContent = 'SOUNDCLOUD';
        syncUI(false);
      }
      return;
    }

    titleEl.textContent = 'Tập Yêu Đi';
    activeTrack = null;
    activeSource = 'local';
    persistMusicSession(musicEnabled);
    if (musicEnabled) {
      audio.play().catch(() => {
        kicker.textContent = 'BẤM ĐỂ PHÁT';
      });
    } else {
      syncUI(false);
    }
    statusEl.textContent = 'Thêm link SoundCloud cho danh sách để phát ngẫu nhiên các bài đã chọn.';
  }

  initializeMusic();
})();
