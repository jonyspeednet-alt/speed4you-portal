require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { cleanSearchTitle, enrichItemWithMetadata, hasTmdbKey } = require('../src/services/metadata-enricher');
const {
  appendMediaNormalizerLog,
  getMediaNormalizerState,
  loadScannerRoots,
  refreshCatalogReferencesForNormalizedFile,
  saveMediaNormalizerState,
} = require('../src/data/store');

const dataDir = path.resolve(__dirname, '../src/data');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.mpg', '.mpeg', '.ts', '.m2ts', '.flv',
]);

const TARGET_CONTAINER = 'mp4';
const TARGET_VIDEO_CODECS = new Set(['h264', 'avc1']);
const TARGET_AUDIO_CODECS = new Set(['aac', 'mp4a']);
const DEFAULT_SCAN_INTERVAL_MS = Number(process.env.MEDIA_NORMALIZER_SCAN_INTERVAL_MS || 15000);
const DEFAULT_MIN_FREE_GB = Number(process.env.MEDIA_NORMALIZER_MIN_FREE_GB || 10);
const DEFAULT_CRF = Number(process.env.MEDIA_NORMALIZER_CRF || 19);
const DEFAULT_PRESET = process.env.MEDIA_NORMALIZER_PRESET || 'medium';
const DUPLICATE_HOLD_DIR_NAME = process.env.MEDIA_NORMALIZER_DUPLICATE_DIR || '_duplicate_hold';
let activeFfmpeg = null;
let isShuttingDown = false;

async function appendRuntimeLog(message) {
  await appendMediaNormalizerLog([message]);
}

async function logInfo(message) {
  console.log(message);
  await appendRuntimeLog(message);
}

async function logError(message) {
  console.error(message);
  await appendRuntimeLog(message);
}

async function persistState(state, extra = {}) {
  await saveMediaNormalizerState({
    ...state,
    ...extra,
    updatedAt: new Date().toISOString(),
    processed: trimMap(state.processed, 20000),
    failed: trimMap(state.failed, 5000),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(2)} GB`;
}

function buildSignature(filePath, stat) {
  return `${filePath}|${stat.size}|${Math.round(stat.mtimeMs)}`;
}

function resolveFfTool(name) {
  const override = process.env[name.toUpperCase()];
  if (override) {
    return override;
  }
  const linuxDefault = `/usr/bin/${name}`;
  return fs.existsSync(linuxDefault) ? linuxDefault : name;
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `${bin} exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

async function ffprobeJson(filePath) {
  const ffprobeBin = resolveFfTool('ffprobe');
  const output = await runCommand(ffprobeBin, [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    filePath,
  ]);
  return JSON.parse(output);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function extractYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function stripTransientSuffixes(stem) {
  return String(stem || '')
    .replace(/\.normalizing\.\d+\.[a-f0-9]+$/i, '')
    .replace(/\.pre-normalize\.\d+(?:\.bak)?$/i, '')
    .trim();
}

function isTransientWorkingFile(filePath) {
  const stem = path.basename(String(filePath || ''), path.extname(String(filePath || '')));
  return /\.normalizing\.\d+\.[a-f0-9]+$/i.test(stem) || /\.pre-normalize\.\d+(?:\.bak)?$/i.test(stem);
}

function inferMediaTypeFromPath(filePath) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.includes('/tv_series/') || lower.includes('\\tv_series\\') || lower.includes('series')) {
    return 'series';
  }
  return 'movie';
}

function sanitizeFileBaseName(value) {
  const safe = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return safe || 'Untitled';
}

function buildUniqueFilePath(dir, filename) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  let attempt = 0;
  let candidate = path.join(dir, filename);

  while (fs.existsSync(candidate)) {
    attempt += 1;
    candidate = path.join(dir, `${baseName} (${attempt})${extension}`);
  }

  return candidate;
}

function moveToDuplicateHold(sourcePath, reason = 'duplicate') {
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  const parentDir = path.dirname(sourcePath);
  const holdDir = path.join(parentDir, DUPLICATE_HOLD_DIR_NAME);
  fs.mkdirSync(holdDir, { recursive: true });

  const parsed = path.parse(sourcePath);
  const targetName = `${parsed.name}.${reason}${parsed.ext}`;
  const targetPath = buildUniqueFilePath(holdDir, targetName);
  fs.renameSync(sourcePath, targetPath);
  return targetPath;
}

function restoreFromDuplicateHold(heldPath, targetPath) {
  if (!heldPath || !targetPath) {
    return false;
  }
  if (!fs.existsSync(heldPath) || fs.existsSync(targetPath)) {
    return false;
  }
  fs.renameSync(heldPath, targetPath);
  return true;
}

function cleanupTransientArtifacts(rootPath) {
  const queue = [rootPath];
  let removed = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === DUPLICATE_HOLD_DIR_NAME) {
          continue;
        }
        queue.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isTransientWorkingFile(absolutePath)) {
        continue;
      }

      try {
        fs.unlinkSync(absolutePath);
        removed += 1;
      } catch {}
    }
  }

  return removed;
}

function recoverInterruptedOperation(state) {
  const op = state.currentOperation;
  if (!op) {
    return;
  }

  let restoredBackup = false;
  let restoredHeldTarget = false;
  let removedTemp = false;

  try {
    if (op.tempOutput && fs.existsSync(op.tempOutput)) {
      fs.unlinkSync(op.tempOutput);
      removedTemp = true;
    }
  } catch {}

  try {
    if (op.backupPath && fs.existsSync(op.backupPath) && op.inputPath && !fs.existsSync(op.inputPath)) {
      fs.renameSync(op.backupPath, op.inputPath);
      restoredBackup = true;
    }
  } catch {}

  try {
    if (op.heldTargetPath && op.finalOutputPath) {
      restoredHeldTarget = restoreFromDuplicateHold(op.heldTargetPath, op.finalOutputPath);
    }
  } catch {}

  void logInfo(
    `[media-normalizer] recovered interrupted operation input=${op.inputPath || 'unknown'} tempRemoved=${removedTemp} backupRestored=${restoredBackup} targetRestored=${restoredHeldTarget}`,
  );
  state.currentOperation = null;
  state.currentFileProgress = null;
  void persistState(state);
}

async function resolveFinalBaseName(filePath) {
  const currentStemRaw = path.basename(filePath, path.extname(filePath));
  const currentStem = stripTransientSuffixes(currentStemRaw);
  const fallbackYear = extractYear(currentStem);
  const fallbackTitle = cleanSearchTitle(currentStem) || sanitizeFileBaseName(currentStem).replace(/\s+/g, ' ').trim();

  if (hasTmdbKey()) {
    const metadata = await enrichItemWithMetadata({
      title: fallbackTitle,
      year: fallbackYear,
      type: inferMediaTypeFromPath(filePath),
    });

    if ((metadata.metadataStatus === 'matched' || metadata.metadataStatus === 'needs_review') && metadata.title) {
      const metaYear = Number.isFinite(Number(metadata.year)) ? Number(metadata.year) : fallbackYear;
      return sanitizeFileBaseName(metaYear ? `${metadata.title} (${metaYear})` : metadata.title);
    }
  }

  return sanitizeFileBaseName(fallbackYear ? `${fallbackTitle} (${fallbackYear})` : fallbackTitle);
}

function pickPrimaryStreamIndex(streams, type) {
  const typed = streams
    .map((stream, index) => ({ stream, index }))
    .filter((item) => item.stream?.codec_type === type);

  if (!typed.length) {
    return -1;
  }

  // Prefer default disposition first, then longer duration.
  typed.sort((left, right) => {
    const leftDefault = Number(left.stream?.disposition?.default || 0);
    const rightDefault = Number(right.stream?.disposition?.default || 0);
    if (leftDefault !== rightDefault) {
      return rightDefault - leftDefault;
    }
    const leftDuration = toNumber(left.stream?.duration);
    const rightDuration = toNumber(right.stream?.duration);
    if (leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }
    return left.index - right.index;
  });

  return typed[0].index;
}

function isFaststartMp4(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    let offset = 0n;
    let moovOffset = null;
    let mdatOffset = null;

    while (offset + 8n <= BigInt(stat.size)) {
      const header = Buffer.alloc(16);
      const bytesRead = fs.readSync(fd, header, 0, 16, Number(offset));
      if (bytesRead < 8) {
        break;
      }

      const size32 = header.readUInt32BE(0);
      const type = header.subarray(4, 8).toString('ascii');
      let atomSize = BigInt(size32);
      let headerSize = 8n;

      if (size32 === 1 && bytesRead >= 16) {
        atomSize = header.readBigUInt64BE(8);
        headerSize = 16n;
      } else if (size32 === 0) {
        atomSize = BigInt(stat.size) - offset;
      }

      if (atomSize < headerSize || atomSize <= 0n) {
        break;
      }

      if (type === 'moov' && moovOffset === null) {
        moovOffset = offset;
      }
      if (type === 'mdat' && mdatOffset === null) {
        mdatOffset = offset;
      }

      if (moovOffset !== null && mdatOffset !== null) {
        return moovOffset < mdatOffset;
      }

      offset += atomSize;
    }
  } finally {
    fs.closeSync(fd);
  }

  return false;
}

function pickMediaRoots() {
  const roots = loadScannerRoots();
  if (!Array.isArray(roots)) {
    return [];
  }
  return roots
    .map((root) => root?.scanPath)
    .filter((scanPath) => typeof scanPath === 'string' && scanPath.trim().length > 0)
    .filter((scanPath, index, arr) => arr.indexOf(scanPath) === index);
}

function toPublicUrl(root, absolutePath) {
  const relativePath = path.relative(root.scanPath, absolutePath).split(path.sep).join('/');
  return `${root.publicBaseUrl}/${relativePath.split('/').map(encodeURIComponent).join('/')}`.replace(/%2520/g, '%20');
}

function resolveScannerRootForPath(filePath) {
  const roots = loadScannerRoots();
  if (!Array.isArray(roots)) {
    return null;
  }

  const normalizedFilePath = path.resolve(filePath);
  const match = roots
    .filter((root) => root?.scanPath && root?.publicBaseUrl)
    .map((root) => ({ root, resolvedScanPath: path.resolve(root.scanPath) }))
    .filter(({ resolvedScanPath }) => normalizedFilePath === resolvedScanPath || normalizedFilePath.startsWith(`${resolvedScanPath}${path.sep}`))
    .sort((left, right) => right.resolvedScanPath.length - left.resolvedScanPath.length)[0];

  return match?.root || null;
}

function refreshCatalogAfterNormalization(previousPath, nextPath) {
  const root = resolveScannerRootForPath(previousPath) || resolveScannerRootForPath(nextPath);
  if (!root) {
    return { updatedItems: 0, updatedEpisodes: 0 };
  }

  const previousVideoUrl = toPublicUrl(root, previousPath);
  const nextVideoUrl = toPublicUrl(root, nextPath);
  return refreshCatalogReferencesForNormalizedFile({
    previousSourcePath: previousPath,
    nextSourcePath: nextPath,
    previousVideoUrl,
    nextVideoUrl,
  });
}

function* walkVideoFiles(rootPath) {
  const queue = [rootPath];
  while (queue.length > 0) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(extension) && !isTransientWorkingFile(absolutePath)) {
        yield absolutePath;
      }
    }
  }
}

function getFreeDiskGb(targetPath) {
  if (typeof fs.statfsSync !== 'function') {
    return Number.POSITIVE_INFINITY;
  }
  const s = fs.statfsSync(targetPath);
  return (s.bavail * s.bsize) / (1024 ** 3);
}

async function needsNormalization(filePath) {
  const probe = await ffprobeJson(filePath);
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const format = probe.format || {};

  const primaryVideoIndex = pickPrimaryStreamIndex(streams, 'video');
  const primaryAudioIndex = pickPrimaryStreamIndex(streams, 'audio');
  const video = primaryVideoIndex >= 0 ? streams[primaryVideoIndex] : null;
  if (!video) {
    return { normalize: false, reason: 'no-video-stream' };
  }
  const audio = primaryAudioIndex >= 0 ? streams[primaryAudioIndex] : null;
  const videoCodec = String(video.codec_name || '').toLowerCase();
  const audioCodec = String(audio?.codec_name || '').toLowerCase();
  const formatNames = String(format.format_name || '').toLowerCase().split(',');
  const isMp4Container = formatNames.some((item) => item.trim() === 'mov' || item.trim() === 'mp4');
  const hasH264 = TARGET_VIDEO_CODECS.has(videoCodec);
  const hasAacOrNoAudio = !audio || TARGET_AUDIO_CODECS.has(audioCodec);
  const hasFaststart = isMp4Container ? isFaststartMp4(filePath) : false;

  const normalize = !(isMp4Container && hasH264 && hasAacOrNoAudio && hasFaststart);

  return {
    normalize,
    meta: {
      primaryVideoIndex,
      primaryAudioIndex,
      videoCodec,
      audioCodec: audioCodec || '(none)',
      isMp4Container,
      hasFaststart,
      duration: Math.max(toNumber(video.duration), toNumber(format.duration)),
      bitRate: Number(format.bit_rate || 0),
    },
  };
}

function buildEncodeArgs(inputPath, outputPath, streamMap) {
  const videoMap = Number.isFinite(streamMap?.videoIndex) && streamMap.videoIndex >= 0
    ? `0:${streamMap.videoIndex}`
    : '0:v:0';
  const audioMap = Number.isFinite(streamMap?.audioIndex) && streamMap.audioIndex >= 0
    ? `0:${streamMap.audioIndex}`
    : '0:a:0?';

  const args = [
    '-y',
    '-v', 'error',
    '-progress', 'pipe:1',
    '-nostats',
    '-i', inputPath,
    '-map', videoMap,
    '-map', audioMap,
    '-sn',
    '-dn',
    '-c:v', 'libx264',
    '-preset', DEFAULT_PRESET,
    '-crf', String(DEFAULT_CRF),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath,
  ];

  return args;
}

async function transcodeToTarget(inputPath, outputPath, durationSeconds, onProgress, streamMap) {
  const ffmpegBin = resolveFfTool('ffmpeg');
  const args = buildEncodeArgs(inputPath, outputPath, streamMap);
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    activeFfmpeg = ffmpeg;
    const stderr = [];
    let progressBuffer = '';
    let lastEmitAt = 0;

    ffmpeg.stdout.on('data', (chunk) => {
      progressBuffer += chunk.toString('utf8');
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() || '';

      const frame = {};
      for (const line of lines) {
        const separator = line.indexOf('=');
        if (separator > 0) {
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim();
          frame[key] = value;
        }
      }

      if (!Object.keys(frame).length) {
        return;
      }

      const outTimeMs = Number(frame.out_time_ms || 0);
      const speed = frame.speed || '';
      const fps = frame.fps || '';
      const now = Date.now();
      if (onProgress && (now - lastEmitAt >= 1000 || frame.progress === 'end')) {
        const progressSeconds = outTimeMs > 0 ? outTimeMs / 1_000_000 : 0;
        const rawPercent = durationSeconds > 0 ? (progressSeconds / durationSeconds) * 100 : 0;
        const percent = Math.max(0, Math.min(100, Number.isFinite(rawPercent) ? rawPercent : 0));
        onProgress({
          percent: Number(percent.toFixed(2)),
          progressSeconds: Number(progressSeconds.toFixed(2)),
          durationSeconds: Number(durationSeconds.toFixed(2)),
          speed,
          fps,
          phase: frame.progress === 'end' ? 'finalizing' : 'encoding',
        });
        lastEmitAt = now;
      }
    });

    ffmpeg.stderr.on('data', (chunk) => stderr.push(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      activeFfmpeg = null;
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `ffmpeg exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function assertOutputLooksValid(inputPath, outputPath, expectedDurationSeconds) {
  const [before, after] = await Promise.all([ffprobeJson(inputPath), ffprobeJson(outputPath)]);
  const inputStreams = Array.isArray(before?.streams) ? before.streams : [];
  const outputStreams = Array.isArray(after?.streams) ? after.streams : [];
  const inputVideoIndex = pickPrimaryStreamIndex(inputStreams, 'video');
  const outputVideoIndex = pickPrimaryStreamIndex(outputStreams, 'video');
  const inputVideoDuration = inputVideoIndex >= 0 ? toNumber(inputStreams[inputVideoIndex]?.duration) : 0;
  const outputVideoDuration = outputVideoIndex >= 0 ? toNumber(outputStreams[outputVideoIndex]?.duration) : 0;

  const baselineDuration = Math.max(toNumber(expectedDurationSeconds), inputVideoDuration, toNumber(before?.format?.duration));
  const afterDuration = Math.max(outputVideoDuration, toNumber(after?.format?.duration));
  const diff = Math.abs(baselineDuration - afterDuration);
  const tolerance = Math.max(4, baselineDuration * 0.02);
  const inputSize = toNumber(before?.format?.size);
  const outputSize = toNumber(after?.format?.size);

  if (baselineDuration > 0 && diff > tolerance) {
    throw new Error(`duration mismatch too high: before=${baselineDuration}s after=${afterDuration}s`);
  }

  if (!outputSize || outputSize < 1024 * 1024) {
    throw new Error(`output file too small: ${outputSize} bytes`);
  }

  if (inputSize > 0 && outputSize < Math.min(25 * 1024 * 1024, inputSize * 0.02)) {
    throw new Error(`output suspiciously small: input=${inputSize} output=${outputSize}`);
  }

  const target = await needsNormalization(outputPath);
  if (target.normalize) {
    throw new Error('transcoded output still not in target format');
  }
}

async function acquireLockOrExit() {
  const state = await getMediaNormalizerState();
  const existingPid = Number(state?.lock?.pid || 0);
  if (existingPid > 0) {
    try {
      process.kill(existingPid, 0);
      await logError(`[media-normalizer] another worker seems active. pid=${existingPid}`);
      process.exit(1);
    } catch {}
  }

  await saveMediaNormalizerState({
    ...(state || {}),
    lock: {
      pid: process.pid,
      startedAt: new Date().toISOString(),
    },
  });
}

async function releaseLock() {
  const state = await getMediaNormalizerState();
  if (!state) {
    return;
  }
  await saveMediaNormalizerState({
    ...state,
    lock: null,
  });
}

async function loadState() {
  const fallback = {
    updatedAt: null,
    lastScanStartedAt: null,
    processed: {},
    failed: {},
    stats: {
      converted: 0,
      skippedAlreadyOk: 0,
      failed: 0,
    },
    currentFileProgress: null,
    currentOperation: null,
  };
  const state = await getMediaNormalizerState();
  return state || fallback;
}

function trimMap(obj, maxEntries) {
  const entries = Object.entries(obj || {});
  if (entries.length <= maxEntries) {
    return obj;
  }
  entries.sort((a, b) => Number(b[1]?.timestamp || 0) - Number(a[1]?.timestamp || 0));
  return Object.fromEntries(entries.slice(0, maxEntries));
}

async function processOneFile(state, roots) {
  for (const root of roots) {
    for (const filePath of walkVideoFiles(root)) {
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      const signature = buildSignature(filePath, stat);
      const processedEntry = state.processed[filePath];
      if (processedEntry?.signature === signature) {
        continue;
      }

      const freeGb = getFreeDiskGb(path.dirname(filePath));
      if (freeGb < DEFAULT_MIN_FREE_GB) {
        await logInfo(`[media-normalizer] pause low disk (${freeGb.toFixed(2)} GB) near ${filePath}`);
        return { worked: false, reason: 'low-disk' };
      }

      let status;
      try {
        status = await needsNormalization(filePath);
      } catch (error) {
        state.failed[filePath] = {
          signature,
          message: error.message.split('\n')[0],
          timestamp: Date.now(),
        };
        state.stats.failed += 1;
        await persistState(state, { currentFileProgress: null });
        await logInfo(`[media-normalizer] probe-failed ${filePath} -> ${error.message.split('\n')[0]}`);
        return { worked: true, reason: 'probe-failed' };
      }

      if (!status.normalize) {
        state.processed[filePath] = {
          signature,
          normalized: true,
          note: 'already-target-format',
          timestamp: Date.now(),
        };
        state.stats.skippedAlreadyOk += 1;
        await persistState(state, { currentFileProgress: null });
        await logInfo(`[media-normalizer] skip-ok ${filePath}`);
        return { worked: true, reason: 'already-ok' };
      }

      const dir = path.dirname(filePath);
      const finalBaseName = await resolveFinalBaseName(filePath);
      const finalOutputPath = path.join(dir, `${finalBaseName}.mp4`);
      const randomPart = crypto.randomBytes(4).toString('hex');
      const tempOutput = path.join(dir, `${finalBaseName}.normalizing.${process.pid}.${randomPart}.mp4`);
      const backupPath = path.join(dir, `${path.basename(filePath)}.pre-normalize.${Date.now()}.bak`);

      // Require free space >= input-size + safety margin before starting conversion.
      const availableBytes = Math.max(0, getFreeDiskGb(dir) * (1024 ** 3));
      const requiredBytes = Math.max(stat.size * 1.15, stat.size + (512 * 1024 * 1024));
      if (availableBytes < requiredBytes) {
        await logInfo(`[media-normalizer] pause low disk for safe convert near ${filePath}; need=${formatBytes(requiredBytes)} free=${formatBytes(availableBytes)}`);
        return { worked: false, reason: 'low-disk-for-file' };
      }

      try {
        await logInfo(`[media-normalizer] start ${filePath} strategy=full-transcode`);
        state.currentOperation = {
          inputPath: filePath,
          finalOutputPath,
          tempOutput,
          backupPath,
          heldTargetPath: null,
          startedAt: new Date().toISOString(),
        };
        state.currentFileProgress = {
          filePath,
          phase: 'preparing',
          percent: 0,
          progressSeconds: 0,
          durationSeconds: Number(status.meta?.duration || 0),
          speed: '',
          fps: '',
          strategy: 'full-transcode',
          startedAt: new Date().toISOString(),
        };
        await persistState(state);

        await transcodeToTarget(
          filePath,
          tempOutput,
          Number(status.meta?.duration || 0),
          (progress) => {
            state.currentFileProgress = {
              ...state.currentFileProgress,
              ...progress,
              filePath,
              strategy: 'full-transcode',
              updatedAt: new Date().toISOString(),
            };
            void persistState(state);
          },
          {
            videoIndex: Number(status.meta?.primaryVideoIndex),
            audioIndex: Number(status.meta?.primaryAudioIndex),
          },
        );
        state.currentFileProgress = {
          ...state.currentFileProgress,
          phase: 'validating',
          percent: 99.5,
          updatedAt: new Date().toISOString(),
        };
        await persistState(state);
        await assertOutputLooksValid(filePath, tempOutput, Number(status.meta?.duration || 0));

        if (fs.existsSync(finalOutputPath) && path.resolve(finalOutputPath) !== path.resolve(filePath)) {
          const existingStat = fs.statSync(finalOutputPath);
          if (existingStat.isFile() && existingStat.size > 0) {
            const heldPath = moveToDuplicateHold(finalOutputPath, 'preexisting-duplicate');
            state.currentOperation.heldTargetPath = heldPath;
            await persistState(state);
            await logInfo(`[media-normalizer] moved existing target to duplicate hold: ${heldPath}`);
          }
        }

        fs.renameSync(filePath, backupPath);
        fs.renameSync(tempOutput, finalOutputPath);

        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }

        const finalStat = fs.statSync(finalOutputPath);
        state.processed[finalOutputPath] = {
          signature: buildSignature(finalOutputPath, fs.statSync(finalOutputPath)),
          normalized: true,
          note: 'converted-and-replaced (full-transcode)',
          timestamp: Date.now(),
        };
        delete state.processed[filePath];
        delete state.failed[filePath];
        state.stats.converted += 1;
        const refreshResult = refreshCatalogAfterNormalization(filePath, finalOutputPath);
        await persistState(state, { currentFileProgress: null, currentOperation: null });
        await logInfo(
          `[media-normalizer] done ${filePath} catalogItemsUpdated=${refreshResult.updatedItems} catalogEpisodesUpdated=${refreshResult.updatedEpisodes}`,
        );
        return { worked: true, reason: 'converted' };
      } catch (error) {
        if (fs.existsSync(tempOutput)) {
          try { fs.unlinkSync(tempOutput); } catch {}
        }
        if (fs.existsSync(backupPath) && !fs.existsSync(filePath)) {
          try { fs.renameSync(backupPath, filePath); } catch {}
        }
        if (state.currentOperation?.heldTargetPath && state.currentOperation.finalOutputPath) {
          try { restoreFromDuplicateHold(state.currentOperation.heldTargetPath, state.currentOperation.finalOutputPath); } catch {}
        }
        state.failed[filePath] = {
          signature,
          message: error.message.split('\n')[0],
          timestamp: Date.now(),
        };
        state.stats.failed += 1;
        await persistState(state, { currentFileProgress: null, currentOperation: null });
        await logInfo(`[media-normalizer] failed ${filePath} -> ${error.message.split('\n')[0]}`);
        return { worked: true, reason: 'failed' };
      }
    }
  }
  return { worked: false, reason: 'no-candidate' };
}

async function main() {
  await acquireLockOrExit();
  process.on('exit', () => {
    void releaseLock();
  });

  const roots = pickMediaRoots();
  if (!roots.length) {
    throw new Error('No scanPath roots found in DB-backed scanner roots');
  }

  await logInfo('[media-normalizer] started');
  await logInfo(`[media-normalizer] roots=${roots.length}, interval=${DEFAULT_SCAN_INTERVAL_MS}ms, minFree=${DEFAULT_MIN_FREE_GB}GB`);

  const state = await loadState();
  recoverInterruptedOperation(state);
  const removedTransientFiles = roots.reduce((sum, rootPath) => sum + cleanupTransientArtifacts(rootPath), 0);
  if (removedTransientFiles > 0) {
    await logInfo(`[media-normalizer] cleaned stale transient files: ${removedTransientFiles}`);
  }

  const gracefulShutdown = () => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    if (activeFfmpeg && !activeFfmpeg.killed) {
      try { activeFfmpeg.kill('SIGKILL'); } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  while (true) {
    state.lastScanStartedAt = new Date().toISOString();
    await persistState(state);

    const cycle = await processOneFile(state, roots);
    if (cycle.reason === 'no-candidate') {
      await sleep(DEFAULT_SCAN_INTERVAL_MS);
      continue;
    }
    await sleep(1000);
  }
}

main().catch(async (error) => {
  await logError(`[media-normalizer] fatal: ${error.message}`);
  await releaseLock();
  process.exit(1);
});
