const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push('PAGE ' + msg.type() + ' ' + msg.text()));
  page.on('pageerror', err => logs.push('PAGEERROR ' + err.message));
  await page.goto('https://data.speed4you.net/portal/tv', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);
  const frame = page.frames().find(f => f.url().includes('/portal-api/api/tv/player/'));
  if (!frame) {
    console.log('NO_FRAME');
    await browser.close();
    return;
  }
  const data = await frame.evaluate(() => {
    const video = document.getElementById('video');
    const state = document.getElementById('state');
    return {
      frameUrl: location.href,
      state: state ? state.textContent : null,
      muted: video ? video.muted : null,
      paused: video ? video.paused : null,
      readyState: video ? video.readyState : null,
      currentSrc: video ? video.currentSrc : null,
      networkState: video ? video.networkState : null,
      error: video && video.error ? { code: video.error.code, message: video.error.message || '' } : null,
      hlsType: typeof window.Hls,
      hlsSupported: !!(window.Hls && window.Hls.isSupported && window.Hls.isSupported()),
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
