const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
const DEFAULT_PLAYER_CACHE_ROOT = '/var/www/html/Extra_Storage/portal-media-cache';
const cacheRoot = process.env.PLAYER_CACHE_ROOT || DEFAULT_PLAYER_CACHE_ROOT;
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.avi', '.wmv', '.mpg', '.mpeg', '.ts', '.m2ts']);

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

function resolvePlayableFilePath(sourcePath, videoUrl) {
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

  const preferredName = path.basename(decodePublicPath(videoUrl));
  if (preferredName) {
    const preferredPath = path.join(sourcePath, preferredName);
    const preferredStat = fs.existsSync(preferredPath) ? safeStat(preferredPath) : null;
    if (preferredStat?.isFile()) {
      return preferredPath;
    }
  }

  return findFirstVideoFile(sourcePath);
}

function listEntries() {
  const catalogItems = readCatalog().filter((item) => item.status === 'published');
  const entries = [];

  for (const item of catalogItems) {
    if (item.type === 'series') {
      for (const season of item.seasons || []) {
        for (const episode of season.episodes || []) {
          entries.push({
            contentType: 'series',
            contentId: item.id,
            seasonNumber: Number(season.number || 1),
            episodeNumber: Number(episode.number || 1),
            title: `${item.title} S${season.number || 1}E${episode.number || 1}`,
            sourcePath: episode.sourcePath || season.sourcePath || item.sourcePath,
            videoUrl: episode.videoUrl || '',
          });
        }
      }
      continue;
    }

    entries.push({
      contentType: item.type || 'movie',
      contentId: item.id,
      seasonNumber: 1,
      episodeNumber: 1,
      title: item.title,
      sourcePath: item.sourcePath,
      videoUrl: item.videoUrl || '',
    });
  }

  return entries;
}

function runCommand(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    const timeoutMs = Number(options.timeoutMs || 0);
    let timer = null;
    let timedOut = false;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (timedOut) {
        reject(new Error(`${bin} timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `${bin} exited with code ${code}`));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

async function probeMedia(resolvedPath) {
  const raw = await runCommand('/usr/bin/ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    resolvedPath,
  ], { timeoutMs: Number(process.env.PLAYER_PREWARM_PROBE_TIMEOUT_MS || 45000) });
  return JSON.parse(raw);
}

function findPrimaryStream(streams, codecType) {
  const typed = (streams || []).filter((stream) => stream.codec_type === codecType);
  if (!typed.length) {
    return null;
  }
  return typed[0];
}

function chooseStrategy(probeData, extension) {
  const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
  const videoStream = findPrimaryStream(streams, 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const audioStream = findPrimaryStream(streams, 'audio');
  const videoCodec = String(videoStream?.codec_name || '').toLowerCase();
  const audioCodec = String(audioStream?.codec_name || '').toLowerCase();
  const pixelFormat = String(videoStream?.pix_fmt || '').toLowerCase();
  const bitDepth = Number(videoStream?.bits_per_raw_sample || videoStream?.bits_per_sample || 8);
  const isTenBit = bitDepth > 8 || pixelFormat.includes('10');
  const hasHdrSignal = ['smpte2084', 'arib-std-b67'].includes(String(videoStream?.color_transfer || '').toLowerCase());
  const mp4FriendlyVideo = ['h264', 'avc1'].includes(videoCodec) && !isTenBit && !hasHdrSignal && (!pixelFormat || pixelFormat === 'yuv420p');
  const mp4FriendlyAudio = ['aac', 'mp4a'].includes(audioCodec) || !audioCodec;

  if (['.mp4', '.m4v'].includes(extension) && mp4FriendlyVideo && mp4FriendlyAudio && audioStreams.length <= 1) {
    return 'direct';
  }

  if (mp4FriendlyVideo && mp4FriendlyAudio) {
    return 'remux-copy';
  }

  if (mp4FriendlyVideo) {
    return 'copy-video-transcode-audio';
  }

  return 'transcode';
}

function buildCachePath(entry) {
  return path.join(cacheRoot, `${entry.contentType}-${entry.contentId}-s${entry.seasonNumber}-e${entry.episodeNumber}.mp4`);
}

function buildFfmpegArgs(inputPath, outputPath, strategy) {
  const common = [
    '-y',
    '-v', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-err_detect', 'ignore_err',
    '-i', inputPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
  ];

  if (strategy === 'remux-copy') {
    return [...common, '-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', outputPath];
  }

  if (strategy === 'copy-video-transcode-audio') {
    return [...common, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outputPath];
  }

  return [
    ...common,
    '-c:v', 'libx264',
    '-preset', process.env.PLAYER_PREWARM_PRESET || 'veryfast',
    '-crf', process.env.PLAYER_PREWARM_CRF || '22',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.1',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath,
  ];
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('/usr/bin/ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr = [];
    const timeoutMs = Number(process.env.PLAYER_PREWARM_FFMPEG_TIMEOUT_MS || 0);
    let timer = null;
    let timedOut = false;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        ffmpeg.kill('SIGKILL');
      }, timeoutMs);
    }

    ffmpeg.stderr.on('data', (chunk) => {
      stderr.push(chunk);
      process.stderr.write(chunk);
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      if (timedOut) {
        reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString('utf8') || `ffmpeg exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function parseArgs(argv) {
  const options = {
    limit: 25,
    onlyProblematic: true,
    ids: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit' && argv[index + 1]) {
      options.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--all') {
      options.onlyProblematic = false;
    }
    if (arg === '--id' && argv[index + 1]) {
      options.ids.push(Number(argv[index + 1]));
      index += 1;
    }
  }

  options.ids = options.ids.filter(Number.isFinite);
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = listEntries();
  const filteredEntries = options.ids.length
    ? entries.filter((entry) => options.ids.includes(Number(entry.contentId)))
    : entries;
  fs.mkdirSync(cacheRoot, { recursive: true });
  let processed = 0;

  for (const entry of filteredEntries) {
    if (processed >= options.limit) {
      break;
    }

    const resolvedPath = resolvePlayableFilePath(entry.sourcePath, entry.videoUrl);
    if (!resolvedPath) {
      console.log(`skip ${entry.contentId} ${entry.title}: no source`);
      continue;
    }

    let probeData;
    try {
      probeData = await probeMedia(resolvedPath);
    } catch (error) {
      console.log(`skip ${entry.contentId} ${entry.title}: probe failed (${error.message.split('\n')[0]})`);
      continue;
    }

    const strategy = chooseStrategy(probeData, path.extname(resolvedPath).toLowerCase());
    if (options.onlyProblematic && strategy === 'direct') {
      continue;
    }

    const cachePath = buildCachePath(entry);
    if ((safeStat(cachePath)?.size || 0) > 1024 * 1024) {
      console.log(`ok ${entry.contentId} ${entry.title}: cache exists`);
      continue;
    }

    const tempPath = `${cachePath}.part.mp4`;
    console.log(`start ${entry.contentId} ${entry.title}: ${strategy}`);
    try {
      await runFfmpeg(buildFfmpegArgs(resolvedPath, tempPath, strategy));
      fs.renameSync(tempPath, cachePath);
      processed += 1;
      console.log(`done ${entry.contentId} ${entry.title}: ${strategy}`);
    } catch (error) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {}
      console.log(`fail ${entry.contentId} ${entry.title}: ${error.message.split('\n')[0]}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
