const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
const DEFAULT_PLAYER_CACHE_ROOT = '/var/www/html/Extra_Storage/portal-media-cache';
const cacheRoot = process.env.PLAYER_CACHE_ROOT || DEFAULT_PLAYER_CACHE_ROOT;
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.avi', '.wmv']);
const DIRECT_PLAY_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm']);

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function readCatalog() {
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  return Array.isArray(raw) ? raw : (raw.items || []);
}

function decodePublicPath(value) {
  return decodeURIComponent(String(value || '').split('?')[0]);
}

function findFirstVideoFile(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && SUPPORTED_VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

  if (files.length > 0) {
    return path.join(directoryPath, files[0]);
  }

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));

  for (const directory of directories) {
    const nested = findFirstVideoFile(path.join(directoryPath, directory));
    if (nested) {
      return nested;
    }
  }

  return '';
}

function resolvePlayableFilePath(item) {
  const sourcePath = item.sourcePath;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return '';
  }

  const stat = safeStat(sourcePath);
  if (!stat) {
    return '';
  }

  if (stat.isFile()) {
    return sourcePath;
  }

  if (!stat.isDirectory()) {
    return '';
  }

  const preferredName = path.basename(decodePublicPath(item.videoUrl));
  if (preferredName) {
    const preferredPath = path.join(sourcePath, preferredName);
    const preferredStat = fs.existsSync(preferredPath) ? safeStat(preferredPath) : null;
    if (preferredStat?.isFile()) {
      return preferredPath;
    }
  }

  return findFirstVideoFile(sourcePath);
}

function getCacheKey(item) {
  return `${item.type || 'movie'}-${item.id}-s1-e1`;
}

function buildCachePath(item) {
  return path.join(cacheRoot, `${getCacheKey(item)}.mp4`);
}

function probeMedia(resolvedPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('/usr/bin/ffprobe', [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      resolvedPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdout = [];
    const stderr = [];

    ffprobe.stdout.on('data', (chunk) => stdout.push(chunk));
    ffprobe.stderr.on('data', (chunk) => stderr.push(chunk));
    ffprobe.on('error', reject);
    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `ffprobe exited with code ${code}`));
        return;
      }

      resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')));
    });
  });
}

function pickStrategy(probeData, extension) {
  const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStream = streams.find((stream) => stream.codec_type === 'audio');
  const videoCodec = String(videoStream?.codec_name || '').toLowerCase();
  const audioCodec = String(audioStream?.codec_name || '').toLowerCase();

  if (DIRECT_PLAY_EXTENSIONS.has(extension)) {
    return { mode: 'direct', videoCodec, audioCodec };
  }

  const mp4FriendlyVideo = ['h264', 'avc1'].includes(videoCodec);
  const mp4FriendlyAudio = ['aac', 'mp4a'].includes(audioCodec) || !audioCodec;

  if (mp4FriendlyVideo && mp4FriendlyAudio) {
    return { mode: 'remux-copy', videoCodec, audioCodec };
  }

  if (mp4FriendlyVideo) {
    return { mode: 'copy-video-transcode-audio', videoCodec, audioCodec };
  }

  return { mode: 'transcode', videoCodec, audioCodec };
}

function buildFfmpegArgs(inputPath, outputPath, mode) {
  const common = ['-y', '-v', 'error', '-i', inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn'];

  if (mode === 'remux-copy') {
    return [...common, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', outputPath];
  }

  if (mode === 'copy-video-transcode-audio') {
    return [...common, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outputPath];
  }

  return [
    ...common,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath,
  ];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('/usr/bin/ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    ffmpeg.stderr.on('data', (chunk) => process.stderr.write(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function parseArgs(argv) {
  const ids = [];
  let limit = 10;
  let strategy = 'any';
  let type = 'any';
  let minFreeGb = 8;
  let includeDirect = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--id' && argv[index + 1]) {
      ids.push(Number(argv[index + 1]));
      index += 1;
      continue;
    }

    if (arg === '--limit' && argv[index + 1]) {
      limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--strategy' && argv[index + 1]) {
      strategy = String(argv[index + 1]).toLowerCase();
      index += 1;
      continue;
    }

    if (arg === '--type' && argv[index + 1]) {
      type = String(argv[index + 1]).toLowerCase();
      index += 1;
      continue;
    }

    if (arg === '--min-free-gb' && argv[index + 1]) {
      minFreeGb = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--include-direct') {
      includeDirect = true;
    }
  }

  return {
    ids: ids.filter(Number.isFinite),
    limit: Number.isFinite(limit) ? limit : 10,
    strategy,
    type,
    minFreeGb: Number.isFinite(minFreeGb) ? minFreeGb : 8,
    includeDirect,
  };
}

function getFreeDiskGb(targetPath) {
  const { statfsSync } = fs;
  if (typeof statfsSync !== 'function') {
    return Number.POSITIVE_INFINITY;
  }

  const stats = statfsSync(targetPath);
  return (stats.bavail * stats.bsize) / (1024 ** 3);
}

async function main() {
  const {
    ids,
    limit,
    strategy: strategyFilter,
    type: typeFilter,
    minFreeGb,
    includeDirect,
  } = parseArgs(process.argv.slice(2));
  const sourceItems = readCatalog()
    .filter((item) => item.status === 'published')
    .filter((item) => (ids.length ? ids.includes(Number(item.id)) : true))
    .filter((item) => (typeFilter !== 'any' ? String(item.type || '').toLowerCase() === typeFilter : true));

  fs.mkdirSync(cacheRoot, { recursive: true });

  let processed = 0;
  for (const item of sourceItems) {
    if (processed >= limit) {
      break;
    }

    const freeGb = getFreeDiskGb(cacheRoot);
    if (freeGb < minFreeGb) {
      console.log(`stop: free disk ${freeGb.toFixed(2)} GB is below minimum ${minFreeGb} GB`);
      break;
    }

    const inputPath = resolvePlayableFilePath(item);
    if (!inputPath) {
      console.log(`skip ${item.id}: no input file`);
      continue;
    }

    const outputPath = buildCachePath(item);
    const cacheStat = fs.existsSync(outputPath) ? safeStat(outputPath) : null;
    if (cacheStat?.size > 1024 * 1024) {
      console.log(`ok ${item.id}: cache already exists`);
      continue;
    }

    const extension = path.extname(inputPath).toLowerCase();
    let strategy;
    try {
      strategy = pickStrategy(await probeMedia(inputPath), extension);
    } catch (error) {
      console.log(`skip ${item.id}: probe failed (${error.message.split('\n')[0]})`);
      continue;
    }

    if (strategy.mode === 'direct' && !includeDirect) {
      console.log(`skip ${item.id}: direct media does not need cache`);
      continue;
    }

    if (strategyFilter !== 'any' && strategy.mode !== strategyFilter) {
      console.log(`skip ${item.id}: strategy ${strategy.mode} does not match filter ${strategyFilter}`);
      continue;
    }

    const tempPath = `${outputPath}.part.mp4`;

    console.log(`start ${item.id}: ${strategy.mode} -> ${outputPath}`);
    await runFfmpeg(buildFfmpegArgs(inputPath, tempPath, strategy.mode));
    fs.renameSync(tempPath, outputPath);
    console.log(`done ${item.id}: ${strategy.mode}`);
    processed += 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
