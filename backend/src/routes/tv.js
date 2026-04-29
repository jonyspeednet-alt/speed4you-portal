const express = require('express');
const http = require('http');
const https = require('https');

const router = express.Router();

const TV_PORTAL_BASE = process.env.TV_PORTAL_BASE_URL || 'http://10.45.45.254/';
const ALLOWED_HOSTS = new Set(
  String(process.env.TV_ALLOWED_HOSTS || '10.45.45.254,103.79.182.170')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
);
const ALLOWED_PORTS = new Set(
  String(process.env.TV_ALLOWED_PORTS || '80,8082,')
    .split(',')
    .map((p) => p.trim()),
);
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
};

function ensureAllowedUrl(input) {
  const targetUrl = new URL(input, TV_PORTAL_BASE);

  if (!ALLOWED_HOSTS.has(targetUrl.hostname) || !ALLOWED_PORTS.has(targetUrl.port || '')) {
    const error = new Error('TV source is not allowed');
    error.status = 400;
    throw error;
  }

  return targetUrl;
}

function requestUrl(targetUrl, redirectCount = 0, method = 'GET') {
  const safeUrl = ensureAllowedUrl(targetUrl);
  const transport = safeUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(safeUrl, { headers: DEFAULT_HEADERS, method }, (response) => {
      const location = response.headers.location;

      if (location && response.statusCode >= 300 && response.statusCode < 400 && redirectCount < 5) {
        response.resume();
        resolve(requestUrl(new URL(location, safeUrl), redirectCount + 1, method));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode || 500,
          headers: response.headers,
          body: Buffer.concat(chunks),
          url: safeUrl,
        });
      });
    });

    request.on('error', reject);
    request.end();
  });
}

function parseChannels(html) {
  const categoryMatches = Array.from(html.matchAll(/data-type="([^"]+)"/g));
  const categories = Array.from(new Set(
    categoryMatches
      .map((match) => match[1].trim())
      .filter((item) => item && item !== 'All'),
  ));

  const channels = Array.from(
    html.matchAll(/<li class="([^"]+)">\s*<a[^>]+player\.php\?stream=(\d+)'[^>]*>\s*<img src="([^"]+)" alt="([^"]+)"/g),
  ).map((match) => {
    const classes = String(match[1] || '').split(/\s+/).filter(Boolean);
    const category = classes.find((item) => item !== 'All') || 'Other';
    const streamId = String(match[2] || '');
    const imageUrl = new URL(match[3], TV_PORTAL_BASE).toString();
    const name = String(match[4] || '').trim();

    return {
      id: `${category.toLowerCase()}-${streamId}`,
      streamId,
      name,
      category,
      categories: classes.filter((item) => item !== 'All'),
      logoPath: `/api/tv/asset?url=${encodeURIComponent(imageUrl)}`,
      playerPath: `/api/tv/player/${streamId}`,
    };
  });

  return {
    categories,
    channels,
  };
}

function pickDefaultStreamId(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return '';
  }

  const preferredIds = ['80', '1', '2'];
  const preferredMatch = preferredIds.find((streamId) => channels.some((channel) => channel.streamId === streamId));
  if (preferredMatch) {
    return preferredMatch;
  }

  const fallback = channels.find((channel) => channel.streamId !== '104');
  return fallback?.streamId || channels[0]?.streamId || '';
}

function extractPrimarySource(html) {
  const match = html.match(/var primarySource = '([^']+)'/);
  if (!match?.[1]) {
    const error = new Error('TV stream source not found');
    error.status = 404;
    throw error;
  }

  return ensureAllowedUrl(match[1]).toString();
}

async function resolvePlayableSource(sourceUrl) {
  const current = ensureAllowedUrl(sourceUrl);
  const candidates = [current.toString()];

  if (current.pathname.endsWith('/index.m3u8')) {
    const fmp4Url = new URL(current.toString());
    fmp4Url.pathname = fmp4Url.pathname.replace(/\/index\.m3u8$/, '/index.fmp4.m3u8');
    candidates.unshift(fmp4Url.toString());
  }

  for (const candidate of candidates) {
    try {
      const upstream = await requestUrl(candidate, 0, 'HEAD');
      if (upstream.statusCode >= 200 && upstream.statusCode < 400) {
        return candidate;
      }
    } catch (error) {
      // Fall through to the next candidate.
    }
  }

  return current.toString();
}

function rewritePlaylist(text, baseUrl) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (match, uri) => {
          const nextUrl = new URL(uri, baseUrl).toString();
          return `URI="?url=${encodeURIComponent(nextUrl)}"`;
        });
      }

      const nextUrl = new URL(trimmed, baseUrl).toString();
      return `?url=${encodeURIComponent(nextUrl)}`;
    })
    .join('\n');
}

function toSiblingAssetPath(targetUrl) {
  return `../asset?url=${encodeURIComponent(targetUrl)}`;
}

async function proxyRemoteUrl(targetUrl, res) {
  const upstream = await requestUrl(targetUrl);

  if (upstream.statusCode >= 400) {
    res.status(upstream.statusCode).send(upstream.body);
    return;
  }

  const contentType = String(upstream.headers['content-type'] || '');
  const isPlaylist = contentType.includes('mpegurl') || upstream.url.pathname.endsWith('.m3u8');

  if (isPlaylist) {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritePlaylist(upstream.body.toString('utf8'), upstream.url));
    return;
  }

  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  const cacheControl = contentType.startsWith('image/')
    ? 'public, max-age=300'
    : 'private, no-store';
  res.setHeader('Cache-Control', cacheControl);
  res.send(upstream.body);
}

router.get('/channels', async (req, res, next) => {
  try {
    const upstream = await requestUrl(TV_PORTAL_BASE);
    const html = upstream.body.toString('utf8');
    const parsed = parseChannels(html);

    res.json({
      ...parsed,
      defaultStreamId: pickDefaultStreamId(parsed.channels),
      source: TV_PORTAL_BASE,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stream/:streamId', async (req, res, next) => {
  try {
    const upstream = await requestUrl(`${TV_PORTAL_BASE}player.php?stream=${encodeURIComponent(req.params.streamId)}`);
    const sourceUrl = await resolvePlayableSource(extractPrimarySource(upstream.body.toString('utf8')));

    res.json({
      streamId: String(req.params.streamId || ''),
      sourcePath: toSiblingAssetPath(sourceUrl),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/asset', async (req, res, next) => {
  try {
    const targetUrl = ensureAllowedUrl(String(req.query.url || ''));
    await proxyRemoteUrl(targetUrl, res);
  } catch (error) {
    next(error);
  }
});

router.get('/player/:streamId', async (req, res, next) => {
  try {
    const upstream = await requestUrl(`${TV_PORTAL_BASE}player.php?stream=${encodeURIComponent(req.params.streamId)}`);
    const sourceUrl = await resolvePlayableSource(extractPrimarySource(upstream.body.toString('utf8')));
    const proxiedStreamUrl = toSiblingAssetPath(sourceUrl);
    const hlsScriptUrl = toSiblingAssetPath(new URL('js/hls.js?v=5', TV_PORTAL_BASE).toString());
    const channelName = String(req.query.name || `Channel ${req.params.streamId}`);
    const channelCategory = String(req.query.category || 'Live TV');

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; frame-ancestors 'self'; img-src 'self' data: https:; media-src 'self' blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; connect-src 'self'; worker-src 'self' blob:;",
    );

    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TV Player</title>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at top, rgba(49, 84, 135, 0.18), transparent 38%),
        linear-gradient(180deg, #02060c, #030913 48%, #02050b);
      overflow: hidden;
      font-family: "Segoe UI", Arial, sans-serif;
    }
    body {
      display: grid;
      place-items: center;
    }
    video {
      width: 100%;
      height: 100%;
      background: #000;
      object-fit: contain;
    }
    .chrome {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(3, 9, 19, 0.88) 0%, rgba(3, 9, 19, 0.14) 24%, rgba(3, 9, 19, 0) 55%, rgba(3, 9, 19, 0.88) 100%);
    }
    .topbar {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      z-index: 12;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      pointer-events: none;
    }
    .info-card {
      max-width: min(520px, calc(100vw - 180px));
      padding: 18px 20px;
      border-radius: 24px;
      background: rgba(7, 17, 31, 0.44);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(14px);
      box-shadow: 0 16px 38px rgba(0,0,0,0.24);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      color: #6fd5ff;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 11px;
      font-weight: 700;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #ff624d;
      box-shadow: 0 0 0 6px rgba(255,98,77,0.16);
    }
    .channel-title {
      margin: 0 0 6px;
      color: #fff;
      font-size: clamp(1.2rem, 2.6vw, 2rem);
      line-height: 1.15;
    }
    .channel-meta {
      color: rgba(255,255,255,0.76);
      font-size: 14px;
      line-height: 1.5;
    }
    .meta-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      pointer-events: auto;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(7, 17, 31, 0.56);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(12px);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
    }
    .status-bar {
      position: absolute;
      left: 20px;
      right: 20px;
      bottom: 20px;
      z-index: 12;
      display: grid;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 28px;
      background: rgba(7, 17, 31, 0.62);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(16px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.26);
      pointer-events: auto;
    }
    .status-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .state {
      color: #fff;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .control-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .actions,
    .utility {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .action {
      appearance: none;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.08);
      color: #fff;
      padding: 11px 14px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 700;
      transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
    }
    .action:hover {
      transform: translateY(-1px);
      background: rgba(255,255,255,0.14);
      border-color: rgba(255,255,255,0.22);
    }
    .action-primary {
      background: linear-gradient(135deg, #ffffff, #d8ecff);
      color: #07111f;
      border-color: transparent;
    }
    .debug {
      position: absolute;
      inset: 108px 20px auto auto;
      z-index: 10;
      max-width: min(520px, calc(100vw - 32px));
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(7,12,20,0.78);
      border: 1px solid rgba(255,255,255,0.12);
      color: #d9e6ff;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .debug.hidden {
      display: none;
    }
    @media (max-width: 720px) {
      .topbar {
        flex-direction: column;
      }
      .info-card {
        max-width: none;
      }
      .debug {
        inset: auto 20px 136px 20px;
        max-width: none;
      }
      .status-bar {
        bottom: 12px;
        left: 12px;
        right: 12px;
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <video id="video" controls autoplay muted playsinline></video>
  <div class="chrome"></div>
  <div class="topbar">
    <div class="info-card">
      <div class="eyebrow"><span class="live-dot"></span>Live Broadcast</div>
      <h1 class="channel-title">${channelName.replace(/</g, '&lt;')}</h1>
      <div class="channel-meta">${channelCategory.replace(/</g, '&lt;')} channel stream</div>
    </div>
    <div class="meta-badges">
      <div class="badge" id="liveClock">--:--:--</div>
      <div class="badge">Stream ${String(req.params.streamId || '')}</div>
    </div>
  </div>
  <div class="debug hidden" id="debugPanel">Preparing player diagnostics...</div>
  <div class="status-bar">
    <div class="status-head">
      <div class="state" id="state">Connecting to live TV...</div>
      <div class="utility">
        <button class="action" id="debugToggle" type="button">Show Debug</button>
        <button class="action" id="openTabButton" type="button">Open Tab</button>
      </div>
    </div>
    <div class="control-row">
      <div class="actions">
        <button class="action action-primary" id="playPauseButton" type="button">Pause</button>
        <button class="action" id="muteButton" type="button">Unmute</button>
        <button class="action" id="retryButton" type="button">Retry</button>
      </div>
      <div class="utility">
        <button class="action" id="pipButton" type="button">PiP</button>
        <button class="action" id="fullscreenButton" type="button">Fullscreen</button>
      </div>
    </div>
  </div>
  <script src="${hlsScriptUrl}"></script>
  <script>
    const video = document.getElementById('video');
    const state = document.getElementById('state');
    const debugPanel = document.getElementById('debugPanel');
    const playPauseButton = document.getElementById('playPauseButton');
    const muteButton = document.getElementById('muteButton');
    const retryButton = document.getElementById('retryButton');
    const pipButton = document.getElementById('pipButton');
    const fullscreenButton = document.getElementById('fullscreenButton');
    const openTabButton = document.getElementById('openTabButton');
    const debugToggle = document.getElementById('debugToggle');
    const liveClock = document.getElementById('liveClock');
    const source = ${JSON.stringify(proxiedStreamUrl)};
    let hls;
    const debugLines = [];

    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;

    function updateClock() {
      liveClock.textContent = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    function updateButtons() {
      playPauseButton.textContent = video.paused ? 'Play' : 'Pause';
      muteButton.textContent = video.muted ? 'Unmute' : 'Mute';
      fullscreenButton.textContent = document.fullscreenElement ? 'Windowed' : 'Fullscreen';
      pipButton.textContent = document.pictureInPictureElement ? 'Exit PiP' : 'PiP';
    }

    function pushDebug(message) {
      const stamp = new Date().toLocaleTimeString();
      debugLines.unshift('[' + stamp + '] ' + message);
      if (debugLines.length > 8) {
        debugLines.length = 8;
      }
      debugPanel.textContent = debugLines.join('\\n');
      try {
        window.parent.postMessage({
          type: 'tv-player-debug',
          streamId: ${JSON.stringify(String(req.params.streamId || ''))},
          lines: debugLines.slice(),
          state: state.textContent,
          source: source,
        }, '*');
      } catch (error) {
        // Ignore parent messaging failures.
      }
    }

    function setState(message) {
      state.textContent = message;
      pushDebug('State: ' + message);
    }

    function destroyHls() {
      if (hls) {
        pushDebug('Destroying HLS instance');
        hls.destroy();
        hls = null;
      }
    }

    function playNative() {
      destroyHls();
      video.src = source;
      video.load();
      setState('Opening live stream...');
      pushDebug('Using native HLS playback');
      video.play().catch(function () {
        setState('Tap play to start the live channel');
      });
    }

    async function togglePlayback() {
      if (video.paused) {
        await video.play().catch(function () {
          setState('Tap play to start the live channel');
        });
      } else {
        video.pause();
      }
      updateButtons();
    }

    async function togglePictureInPicture() {
      if (!document.pictureInPictureEnabled) {
        setState('Picture in Picture is not available');
        return;
      }

      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (error) {
        pushDebug('PiP error: ' + error.message);
      }
      updateButtons();
    }

    async function toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await video.requestFullscreen();
        }
      } catch (error) {
        pushDebug('Fullscreen error: ' + error.message);
      }
      updateButtons();
    }

    function attachHls() {
      destroyHls();
      hls = new window.Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      pushDebug('Using HLS.js playback');

      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        setState('Live channel ready');
        video.play().catch(function () {
          setState('Tap play to start the live channel');
        });
      });

      hls.on(window.Hls.Events.LEVEL_LOADED, function (event, data) {
        pushDebug('Level loaded: fragments=' + (data?.details?.fragments?.length || 0));
      });

      hls.on(window.Hls.Events.ERROR, function (event, data) {
        pushDebug('HLS error: type=' + (data?.type || 'unknown') + ', details=' + (data?.details || 'n/a') + ', fatal=' + Boolean(data?.fatal));
        if (!data || !data.fatal) {
          return;
        }

        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          setState('Reconnecting to live stream...');
          hls.startLoad();
          return;
        }

        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          setState('Recovering stream playback...');
          hls.recoverMediaError();
          return;
        }

        setState('Live stream is temporarily unavailable');
      });

      hls.loadSource(source);
      hls.attachMedia(video);
    }

    video.addEventListener('loadedmetadata', function () {
      setState('Live channel ready');
      pushDebug('Video metadata loaded: readyState=' + video.readyState);
      video.play().catch(function () {
        setState('Tap play to start the live channel');
      });
    });

    video.addEventListener('error', function () {
      const mediaError = video.error;
      pushDebug('Video element error: code=' + (mediaError?.code || 'unknown'));
      setState('Player could not load the live stream');
    });

    video.addEventListener('playing', function () {
      pushDebug('Video playing');
      updateButtons();
    });

    video.addEventListener('waiting', function () {
      pushDebug('Video waiting for more data');
    });

    video.addEventListener('pause', updateButtons);
    video.addEventListener('volumechange', updateButtons);
    document.addEventListener('fullscreenchange', updateButtons);
    document.addEventListener('enterpictureinpicture', updateButtons);
    document.addEventListener('leavepictureinpicture', updateButtons);

    playPauseButton.addEventListener('click', togglePlayback);
    muteButton.addEventListener('click', function () {
      video.muted = !video.muted;
      updateButtons();
    });

    video.addEventListener('stalled', function () {
      pushDebug('Video stalled');
    });

    retryButton.addEventListener('click', function () {
      setState('Retrying live stream...');
      pushDebug('Manual retry requested');
      if (window.Hls && window.Hls.isSupported()) {
        attachHls();
        return;
      }

      playNative();
    });

    pipButton.addEventListener('click', togglePictureInPicture);
    fullscreenButton.addEventListener('click', toggleFullscreen);
    openTabButton.addEventListener('click', function () {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    });
    debugToggle.addEventListener('click', function () {
      debugPanel.classList.toggle('hidden');
      debugToggle.textContent = debugPanel.classList.contains('hidden') ? 'Show Debug' : 'Hide Debug';
    });

    pushDebug('Source: ' + source);
    pushDebug('Hls supported=' + Boolean(window.Hls && window.Hls.isSupported()) + ', native=' + Boolean(video.canPlayType('application/vnd.apple.mpegurl')));
    updateClock();
    setInterval(updateClock, 1000);
    updateButtons();

    if (window.Hls && window.Hls.isSupported()) {
      attachHls();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      playNative();
    } else {
      setState('This browser cannot play the live TV stream');
    }
  </script>
</body>
</html>`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
