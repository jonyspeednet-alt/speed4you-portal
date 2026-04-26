const { chromium } = require('playwright');

const TARGETS = [
  'https://data.speed4you.net/portal',
  'https://data.speed4you.net/portal/browse',
  'https://data.speed4you.net/portal/series/20594',
  'https://data.speed4you.net/portal/tv',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  for (const target of TARGETS) {
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    const counts = {};
    const portalApiResponses = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('request', (req) => {
      const url = req.url();
      counts[url] = (counts[url] || 0) + 1;
    });

    page.on('requestfailed', (req) => {
      failed.push(
        `${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'failed'}`,
      );
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/portal-api/')) {
        portalApiResponses.push({
          status: response.status(),
          url,
        });
      }
    });

    try {
      await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      const title = await page.title();
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const repeated = Object.entries(counts)
        .filter(([, count]) => count > 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log('PAGE', target);
      console.log('TITLE', title);
      console.log('ERROR_COUNT', errors.length);
      if (errors.length) {
        console.log('ERRORS', JSON.stringify(errors.slice(0, 10)));
      }
      console.log('FAILED_COUNT', failed.length);
      if (failed.length) {
        console.log('FAILED', JSON.stringify(failed.slice(0, 10)));
      }
      console.log('REPEATED', JSON.stringify(repeated));
      console.log(
        'API_STATUSES',
        JSON.stringify(portalApiResponses.map((entry) => [entry.status, entry.url])),
      );
      console.log('BODY_SNIPPET', JSON.stringify(bodyText.slice(0, 400)));
    } catch (error) {
      console.log('PAGE', target);
      console.log('NAV_ERROR', error.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
})();
