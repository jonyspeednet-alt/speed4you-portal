const path = require('path');
const { spawn } = require('child_process');
const {
  getMediaNormalizerLog,
  getMediaNormalizerState,
  saveMediaNormalizerState,
} = require('../data/store');

const scriptPath = path.resolve(__dirname, '../../scripts/normalize-media-library.js');

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getStatus() {
  const state = await getMediaNormalizerState();
  const lock = state?.lock || null;
  const running = Boolean(lock?.pid && isProcessAlive(Number(lock.pid)));

  return {
    running,
    lock,
    state,
    recentLogLines: getMediaNormalizerLog(25),
  };
}

async function start() {
  const current = await getStatus();
  if (current.running) {
    return { started: false, reason: 'already-running', status: current };
  }

  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: 'ignore',
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
  });
  child.unref();

  const state = await getMediaNormalizerState();
  await saveMediaNormalizerState({
    ...(state || {}),
    lock: {
      pid: child.pid,
      startedAt: new Date().toISOString(),
    },
  });

  return { started: true, status: await getStatus() };
}

async function stop() {
  const current = await getStatus();
  if (!current.running || !current.lock?.pid) {
    return { stopped: false, reason: 'not-running', status: current };
  }

  const pid = Number(current.lock.pid);
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }

  const nextState = await getMediaNormalizerState();
  await saveMediaNormalizerState({
    ...(nextState || {}),
    lock: null,
  });

  return { stopped: true, signaledPid: pid, status: await getStatus() };
}

module.exports = {
  getMediaNormalizerStatus: getStatus,
  startMediaNormalizer: start,
  stopMediaNormalizer: stop,
};
