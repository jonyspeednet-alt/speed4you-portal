const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
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

function getFreeDiskGb(targetPath) {
  const { statfsSync } = fs;
  if (typeof statfsSync !== 'function') {
    return null;
  }

  const stats = statfsSync(targetPath);
  return (stats.bavail * stats.bsize) / (1024 ** 3);
}

async function main() {
  const items = readCatalog().filter((item) => item.status === 'published');
  const summary = {
    totalPublished: items.length,
    direct: 0,
    remuxCopy: 0,
    copyVideoTranscodeAudio: 0,
    transcode: 0,
    missingSource: 0,
    corruptedSource: 0,
    totalSizeBytes: 0,
    remuxEligibleBytes: 0,
    audioOnlyBytes: 0,
    directBytes: 0,
    transcodeBytes: 0,
  };

  const samples = {
    remuxCopy: [],
    copyVideoTranscodeAudio: [],
    transcode: [],
    missingSource: [],
    corruptedSource: [],
  };

  for (const item of items) {
    const resolvedPath = resolvePlayableFilePath(item);
    if (!resolvedPath) {
      summary.missingSource += 1;
      if (samples.missingSource.length < 5) {
        samples.missingSource.push({ id: item.id, title: item.title, type: item.type });
      }
      continue;
    }

    const stat = safeStat(resolvedPath);
    if (!stat?.isFile()) {
      summary.missingSource += 1;
      if (samples.missingSource.length < 5) {
        samples.missingSource.push({ id: item.id, title: item.title, type: item.type });
      }
      continue;
    }
    summary.totalSizeBytes += stat.size;

    const extension = path.extname(resolvedPath).toLowerCase();
    let strategy;
    try {
      strategy = pickStrategy(await probeMedia(resolvedPath), extension);
    } catch (error) {
      summary.corruptedSource += 1;
      if (samples.corruptedSource.length < 5) {
        samples.corruptedSource.push({
          id: item.id,
          title: item.title,
          ext: extension,
          error: error.message.split('\n')[0],
        });
      }
      continue;
    }

    if (strategy.mode === 'direct') {
      summary.direct += 1;
      summary.directBytes += stat.size;
      continue;
    }

    if (strategy.mode === 'remux-copy') {
      summary.remuxCopy += 1;
      summary.remuxEligibleBytes += stat.size;
      if (samples.remuxCopy.length < 5) {
        samples.remuxCopy.push({ id: item.id, title: item.title, ext: extension, sizeGb: +(stat.size / (1024 ** 3)).toFixed(2) });
      }
      continue;
    }

    if (strategy.mode === 'copy-video-transcode-audio') {
      summary.copyVideoTranscodeAudio += 1;
      summary.audioOnlyBytes += stat.size;
      if (samples.copyVideoTranscodeAudio.length < 5) {
        samples.copyVideoTranscodeAudio.push({ id: item.id, title: item.title, ext: extension, sizeGb: +(stat.size / (1024 ** 3)).toFixed(2) });
      }
      continue;
    }

    summary.transcode += 1;
    summary.transcodeBytes += stat.size;
    if (samples.transcode.length < 5) {
      samples.transcode.push({ id: item.id, title: item.title, ext: extension, sizeGb: +(stat.size / (1024 ** 3)).toFixed(2) });
    }
  }

  const toGb = (bytes) => +(bytes / (1024 ** 3)).toFixed(2);
  const output = {
    targetRecommendation: 'MP4 container + H.264 video + AAC audio + faststart',
    freeDiskGb: getFreeDiskGb(path.dirname(catalogPath)),
    counts: {
      totalPublished: summary.totalPublished,
      missingSource: summary.missingSource,
      corruptedSource: summary.corruptedSource,
      direct: summary.direct,
      remuxCopy: summary.remuxCopy,
      copyVideoTranscodeAudio: summary.copyVideoTranscodeAudio,
      transcode: summary.transcode,
    },
    sizesGb: {
      totalLibrary: toGb(summary.totalSizeBytes),
      direct: toGb(summary.directBytes),
      remuxEligible: toGb(summary.remuxEligibleBytes),
      audioOnly: toGb(summary.audioOnlyBytes),
      transcode: toGb(summary.transcodeBytes),
    },
    samples,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
