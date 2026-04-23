const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
const DEFAULT_PLAYER_CACHE_ROOT = '/var/www/html/Extra_Storage/portal-media-cache';
const defaultOutputPath = path.resolve(__dirname, '../src/data/player-audit.json');
const cacheRoot = process.env.PLAYER_CACHE_ROOT || DEFAULT_PLAYER_CACHE_ROOT;
const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.avi', '.wmv', '.mpg', '.mpeg', '.ts', '.m2ts']);
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

function listPlayableEntries() {
  const catalogItems = readCatalog().filter((item) => item.status === 'published');
  const entries = [];

  for (const item of catalogItems) {
    if (item.type === 'series') {
      for (const season of item.seasons || []) {
        for (const episode of season.episodes || []) {
          entries.push({
            kind: 'episode',
            contentType: 'series',
            contentId: item.id,
            title: item.title,
            sourceTitle: `${item.title} - S${season.number || 1}E${episode.number || 1}`,
            seasonNumber: Number(season.number || 1),
            episodeNumber: Number(episode.number || 1),
            sourcePath: episode.sourcePath || season.sourcePath || item.sourcePath,
            videoUrl: episode.videoUrl || '',
          });
        }
      }
      continue;
    }

    entries.push({
      kind: 'movie',
      contentType: item.type || 'movie',
      contentId: item.id,
      title: item.title,
      sourceTitle: item.title,
      seasonNumber: 1,
      episodeNumber: 1,
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
  ], { timeoutMs: Number(process.env.PLAYER_AUDIT_PROBE_TIMEOUT_MS || 45000) });
  return JSON.parse(raw);
}

function findPrimaryStream(streams, codecType) {
  const typed = (streams || []).filter((stream) => stream.codec_type === codecType);
  if (!typed.length) {
    return null;
  }

  return [...typed].sort((left, right) => {
    const leftDefault = Number(left?.disposition?.default || 0);
    const rightDefault = Number(right?.disposition?.default || 0);
    if (leftDefault !== rightDefault) {
      return rightDefault - leftDefault;
    }

    return Number(left?.index || 0) - Number(right?.index || 0);
  })[0];
}

function collectProfile(probeData, extension) {
  const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
  const formatNames = String(probeData?.format?.format_name || '')
    .toLowerCase()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const videoStream = findPrimaryStream(streams, 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const audioStream = findPrimaryStream(streams, 'audio');
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
  const videoCodec = String(videoStream?.codec_name || '').toLowerCase();
  const audioCodec = String(audioStream?.codec_name || '').toLowerCase();
  const pixelFormat = String(videoStream?.pix_fmt || '').toLowerCase();
  const bitDepth = Number(videoStream?.bits_per_raw_sample || videoStream?.bits_per_sample || 8);
  const isTenBit = bitDepth > 8 || pixelFormat.includes('10');
  const hasHdrSignal = ['smpte2084', 'arib-std-b67'].includes(String(videoStream?.color_transfer || '').toLowerCase());
  const oddSubtitleCodecs = subtitleStreams
    .map((stream) => String(stream?.codec_name || '').toLowerCase())
    .filter((codec) => codec && !['mov_text', 'webvtt'].includes(codec));
  const isMp4Family = formatNames.some((value) => value === 'mp4' || value === 'mov');
  const isWebmFamily = formatNames.includes('webm');
  const mp4FriendlyVideo = ['h264', 'avc1'].includes(videoCodec) && !isTenBit && !hasHdrSignal && (!pixelFormat || pixelFormat === 'yuv420p');
  const mp4FriendlyAudio = ['aac', 'mp4a'].includes(audioCodec) || !audioCodec;
  const directPlayable = (
    (DIRECT_PLAY_EXTENSIONS.has(extension) && isMp4Family && mp4FriendlyVideo && mp4FriendlyAudio && audioStreams.length <= 1)
    || (extension === '.webm' && isWebmFamily && ['vp8', 'vp9', 'av1'].includes(videoCodec) && ['opus', 'vorbis'].includes(audioCodec) && audioStreams.length <= 1)
  );

  let strategy = 'transcode';
  if (!videoStream) {
    strategy = 'transcode';
  } else if (directPlayable) {
    strategy = 'direct';
  } else if (mp4FriendlyVideo && mp4FriendlyAudio) {
    strategy = 'remux-copy';
  } else if (mp4FriendlyVideo) {
    strategy = 'copy-video-transcode-audio';
  }

  const reasons = [];
  if (!videoStream) reasons.push('missing-video');
  if (!audioStream && audioStreams.length === 0) reasons.push('missing-audio');
  if (!directPlayable) {
    if (!isMp4Family && !isWebmFamily) reasons.push(`container:${extension || 'unknown'}`);
    if (!mp4FriendlyVideo) reasons.push(`video:${videoCodec || 'unknown'}${isTenBit ? '-10bit' : ''}${hasHdrSignal ? '-hdr' : ''}`);
    if (!mp4FriendlyAudio) reasons.push(`audio:${audioCodec || 'unknown'}`);
    if (audioStreams.length > 1) reasons.push(`multi-audio:${audioStreams.length}`);
    if (oddSubtitleCodecs.length) reasons.push(`subtitles:${oddSubtitleCodecs.join('+')}`);
  }

  return {
    strategy,
    extension,
    formatNames,
    videoCodec,
    audioCodec: audioCodec || '(none)',
    pixelFormat,
    bitDepth: Number.isFinite(bitDepth) ? bitDepth : 8,
    audioStreamCount: audioStreams.length,
    subtitleStreamCount: subtitleStreams.length,
    reasons,
    sizeBytes: Number(probeData?.format?.size || 0),
    durationSeconds: Number(probeData?.format?.duration || videoStream?.duration || audioStream?.duration || 0),
  };
}

function buildCachePath(entry) {
  return path.join(cacheRoot, `${entry.contentType}-${entry.contentId}-s${entry.seasonNumber}-e${entry.episodeNumber}.mp4`);
}

function incrementCounter(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function writeAuditSnapshot(outputPath, payload) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
}

function parseArgs(argv) {
  const options = {
    limit: 0,
    ids: [],
    outputPath: defaultOutputPath,
    checkpointEvery: 50,
    includeDirect: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit' && argv[index + 1]) {
      options.limit = Number(argv[index + 1]) || 0;
      index += 1;
      continue;
    }
    if (arg === '--id' && argv[index + 1]) {
      options.ids.push(Number(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--output' && argv[index + 1]) {
      options.outputPath = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--checkpoint-every' && argv[index + 1]) {
      options.checkpointEvery = Math.max(1, Number(argv[index + 1]) || 50);
      index += 1;
      continue;
    }
    if (arg === '--include-direct') {
      options.includeDirect = true;
    }
  }

  options.ids = options.ids.filter(Number.isFinite);
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const allEntries = listPlayableEntries();
  const entries = allEntries
    .filter((entry) => (options.ids.length ? options.ids.includes(Number(entry.contentId)) : true))
    .slice(0, options.limit > 0 ? options.limit : undefined);
  const summary = {
    totalEntries: entries.length,
    processedEntries: 0,
    direct: 0,
    remuxCopy: 0,
    copyVideoTranscodeAudio: 0,
    transcode: 0,
    missingSource: 0,
    probeFailed: 0,
    cachedReady: 0,
    reasons: {},
    extensions: {},
    videoCodecs: {},
    audioCodecs: {},
  };
  const problematic = [];
  const sampledPlayable = [];

  for (const entry of entries) {
    summary.processedEntries += 1;
    const resolvedPath = resolvePlayableFilePath(entry.sourcePath, entry.videoUrl);
    if (!resolvedPath) {
      summary.missingSource += 1;
      incrementCounter(summary.reasons, 'missing-source');
      problematic.push({
        ...entry,
        issue: 'missing-source',
      });
      continue;
    }

    try {
      const extension = path.extname(resolvedPath).toLowerCase();
      const probeData = await probeMedia(resolvedPath);
      const profile = collectProfile(probeData, extension);
      const cachePath = buildCachePath(entry);
      const cacheReady = (safeStat(cachePath)?.size || 0) > 1024 * 1024;

      incrementCounter(summary.extensions, extension || 'unknown');
      incrementCounter(summary.videoCodecs, profile.videoCodec || 'unknown');
      incrementCounter(summary.audioCodecs, profile.audioCodec || 'unknown');
      for (const reason of profile.reasons) {
        incrementCounter(summary.reasons, reason);
      }

      summary[profile.strategy === 'remux-copy' ? 'remuxCopy' : profile.strategy === 'copy-video-transcode-audio' ? 'copyVideoTranscodeAudio' : profile.strategy] += 1;
      if (cacheReady) {
        summary.cachedReady += 1;
      }

      const record = {
        ...entry,
        resolvedPath,
        cachePath,
        cacheReady,
        strategy: profile.strategy,
        reasons: profile.reasons,
        extension: profile.extension,
        videoCodec: profile.videoCodec,
        audioCodec: profile.audioCodec,
        audioStreamCount: profile.audioStreamCount,
        subtitleStreamCount: profile.subtitleStreamCount,
        bitDepth: profile.bitDepth,
        pixelFormat: profile.pixelFormat,
        durationSeconds: profile.durationSeconds,
        sizeGb: Number((profile.sizeBytes / (1024 ** 3)).toFixed(2)),
      };

      if (profile.strategy !== 'direct' || !cacheReady) {
        problematic.push(record);
      } else if (options.includeDirect && sampledPlayable.length < 100) {
        sampledPlayable.push(record);
      }
    } catch (error) {
      summary.probeFailed += 1;
      incrementCounter(summary.reasons, error.message.includes('timed out') ? 'probe-timeout' : 'probe-failed');
      problematic.push({
        ...entry,
        resolvedPath,
        issue: 'probe-failed',
        error: error.message.split('\n')[0],
      });
    }

    if (summary.processedEntries % options.checkpointEvery === 0) {
      writeAuditSnapshot(options.outputPath, {
        generatedAt: new Date().toISOString(),
        cacheRoot,
        progress: {
          processedEntries: summary.processedEntries,
          totalEntries: summary.totalEntries,
          percent: summary.totalEntries ? Number(((summary.processedEntries / summary.totalEntries) * 100).toFixed(2)) : 100,
        },
        summary,
        problematic,
        sampledPlayable,
      });
    }
  }

  writeAuditSnapshot(options.outputPath, {
    generatedAt: new Date().toISOString(),
    cacheRoot,
    progress: {
      processedEntries: summary.processedEntries,
      totalEntries: summary.totalEntries,
      percent: summary.totalEntries ? Number(((summary.processedEntries / summary.totalEntries) * 100).toFixed(2)) : 100,
    },
    summary,
    problematic,
    sampledPlayable,
  });

  console.log(`Wrote player audit to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
