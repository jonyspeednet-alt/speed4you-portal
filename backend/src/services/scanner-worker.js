const { scanSelectedRoots } = require('./scanner');
const { ensureContentStore } = require('../data/store');

function loadRootIds() {
  try {
    return JSON.parse(process.env.SCANNER_ROOT_IDS || '[]');
  } catch {
    return [];
  }
}

async function run() {
  try {
    await ensureContentStore();
    const summary = await scanSelectedRoots(loadRootIds(), (progressSummary) => {
      if (process.send) {
        process.send({ type: 'progress', summary: progressSummary });
      }
    }, {
      runId: process.env.SCANNER_RUN_ID || '',
    });

    if (process.send) {
      process.send({ type: 'completed', summary });
    }
    process.exit(0);
  } catch (error) {
    if (process.send) {
      process.send({ type: 'failed', error: error.message });
    }
    process.exit(1);
  }
}

run();
