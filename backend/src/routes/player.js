const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getItemById } = require('../data/store');
const { loadScannerRoots } = require('../data/store');
const { AppError } = require('../utils/error');
const logger = require('../utils/logger');

const router = express.Router();
const DEFAULT_PLAYER_CACHE_ROOT = '/var/www/html/Extra_Storage/portal-media-cache';
const OPTIMIZED_CACHE_ROOT = process.env.PLAYER_CACHE_ROOT || DEFAULT_PLAYER_CACHE_ROOT;
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';
const activeCacheJobs = new Map();
const UNIVERSAL_TARGET = 'mp4-h264-aac-faststart';

const DIRECT_PLAY_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm']);
const CONTENT_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
};

const SUPPORTED_VIDEO_EXTENSIONS = new Set(Object.keys(CONTENT_TYPES));

function safeStat(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function toPositiveInt(value, fallback) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.floor(asNumber);
  }

  const match = String(value || '').match(/(\d+)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

async function findSelectedMedia(req) {
  const { id } = req.params;
  const requestedType = String(req.params.contentType || '').toLowerCase();
  const seasonNumber = toPositiveInt(req.query.season, 1);
  const episodeNumber = toPositiveInt(req.query.episode, 1);
  const item = await getItemById(id);

  if (!item) {
    return { error: { status: 404, message: 'Content not found' } };
  }

  if (requestedType && item.type !== requestedType) {
    return { error: { status: 404, message: 'Content not found' } };
  }

  const selectedSeason = item.type === 'series'
    ? (item.seasons || []).find((season, index) => toPositiveInt(season?.number ?? season?.id, index + 1) === seasonNumber)
    || item.seasons?.[0]
    : null;
  const selectedEpisode = item.type === 'series'
    ? (selectedSeason?.episodes || []).find((episode, index) => toPositiveInt(episode?.number ?? episode?.id, index + 1) === episodeNumber)
    || selectedSeason?.episodes?.[episodeNumber - 1]
    || selectedSeason?.episodes?.[0]
    : null;

  const videoUrl = item.type === 'movie' ? item.videoUrl : selectedEpisode?.videoUrl;
  const sourcePath = item.type === 'movie'
    ? item.sourcePath
    : selectedEpisode?.sourcePath || selectedSeason?.sourcePath || item.sourcePath;

  if (!videoUrl && !sourcePath) {
    return { error: { status: 404, message: 'No playable source found' } };
  }

  return {
    item,
    selectedSeason,
    selectedEpisode,
    videoUrl,
    sourcePath,
    seasonNumber,
    episodeNumber,
  };
}

function buildMetadata(selection) {
  const {
    item,
    selectedSeason,
    selectedEpisode,
    seasonNumber,
    episodeNumber,
  } = selection;

  return {
    title: item.title,
    type: item.type,
    contentId: item.id,
    durationSeconds: item.durationSeconds || 0,
    runtimeMinutes: item.runtimeMinutes || item.runtime || null,
    season: selectedSeason ? {
      id: selectedSeason.id || seasonNumber,
      number: selectedSeason.number || seasonNumber,
      title: selectedSeason.title || `Season ${seasonNumber}`,
    } : null,
    episode: selectedEpisode ? {
      id: selectedEpisode.id || episodeNumber,
      number: selectedEpisode.number || episodeNumber,
      title: selectedEpisode.title || `Episode ${episodeNumber}`,
      description: selectedEpisode.description || '',
      duration: selectedEpisode.duration || item.runtime || null,
      durationSeconds: selectedEpisode.durationSeconds || item.durationSeconds || 0,
      runtimeMinutes: selectedEpisode.runtimeMinutes || item.runtimeMinutes || item.runtime || null,
    } : null,
  };
}

function getCacheKey(selection) {
  const season = selection.selectedSeason?.number || selection.seasonNumber || 1;
  const episode = selection.selectedEpisode?.number || selection.episodeNumber || 1;
  return `${selection.item.type}-${selection.item.id}-s${season}-e${episode}`;
}

function getSourceExtension(sourcePath, videoUrl) {
  const candidate = sourcePath || videoUrl || '';
  const normalized = candidate.split('?')[0];
  return path.extname(normalized).toLowerCase();
}

function decodePublicPath(value) {
  return decodeURIComponent(String(value || '').split('?')[0]);
}

function isPathSafe(resolvedPath, allowedRoot) {
  const normalizedResolved = path.resolve(resolvedPath);
  const normalizedRoot = path.resolve(allowedRoot);
  return normalizedResolved.startsWith(normalizedRoot + path.sep) || normalizedResolved === normalizedRoot;
}

function resolveFilePathFromVideoUrl(videoUrl) {
  const decodedVideoUrl = decodePublicPath(videoUrl);
  if (!decodedVideoUrl) {
    return '';
  }

  const matchingRoot = loadScannerRoots()
    .filter((root) => root?.scanPath && root?.publicBaseUrl)
    .sort((left, right) => String(right.publicBaseUrl).length - String(left.publicBaseUrl).length)
    .find((root) => decodedVideoUrl === root.publicBaseUrl || decodedVideoUrl.startsWith(`${root.publicBaseUrl}/`));

  if (!matchingRoot) {
    return '';
  }

  const relativePath = decodedVideoUrl.slice(matchingRoot.publicBaseUrl.length).replace(/^\/+/, '');
  if (!relativePath) {
    return '';
  }

  const segments = relativePath.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments.some((seg) => seg === '..' || seg === '.')) {
    return '';
  }

  const absolutePath = path.join(matchingRoot.scanPath, ...segments);

  if (!isPathSafe(absolutePath, matchingRoot.scanPath)) {
    return '';
  }

  return fs.existsSync(absolutePath) ? absolutePath : '';
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
  const directVideoPath = resolveFilePathFromVideoUrl(videoUrl);
  if (directVideoPath) {
    const directStat = safeStat(directVideoPath);
    if (directStat?.isFile()) {
      return directVideoPath;
    }
  }

  if (!sourcePath) {
    return '';
  }

  if (!fs.existsSync(sourcePath)) {
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

  const decodedVideoUrl = decodePublicPath(videoUrl);
  const preferredName = path.basename(decodedVideoUrl);
  if (preferredName) {
    const preferredPath = path.join(sourcePath, preferredName);
    const preferredStat = fs.existsSync(preferredPath) ? safeStat(preferredPath) : null;
    if (preferredStat?.isFile()) {
      return preferredPath;
    }
  }

  return findFirstVideoFile(sourcePath);
}

function streamFileDirect(resolvedPath, req, res) {
  const stat = safeStat(resolvedPath);
  if (!stat?.isFile()) {
    throw new AppError('Source file is not available on the server', 404, 'NOT_FOUND');
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, no-store');

  if (!range) {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(resolvedPath).pipe(res);
    return;
  }

  const [startText, endText] = String(range).replace(/bytes=/, '').split('-');
  const start = Number.parseInt(startText, 10);
  const end = endText ? Number.parseInt(endText, 10) : stat.size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= stat.size || start > end) {
    res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
    return;
  }

  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  res.setHeader('Content-Length', end - start + 1);
  fs.createReadStream(resolvedPath, { start, end }).pipe(res);
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function getUniversalTranscodeArgs(outputTarget) {
  return [
    '-c:v', 'libx264',
    '-preset', process.env.PLAYER_TRANSCODE_PRESET || 'veryfast',
    '-crf', process.env.PLAYER_TRANSCODE_CRF || '23',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-level', '4.1',
    '-c:a', 'aac',
    '-b:a', process.env.PLAYER_AUDIO_BITRATE || '160k',
    ...outputTarget,
  ];
}

function transcodeToMp4(resolvedPath, res) {
  res.status(200);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Transfer-Encoding', 'chunked');

  const ffmpeg = spawn(FFMPEG_BIN, [
    '-v', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-err_detect', 'ignore_err',
    '-i', resolvedPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
    ...getUniversalTranscodeArgs([
      '-movflags', 'frag_keyframe+empty_moov+faststart',
      '-f', 'mp4',
      'pipe:1',
    ]),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (chunk) => {
    logger.warn('ffmpeg stderr: ' + chunk.toString('utf8').trim());
  });

  ffmpeg.on('error', (error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: `Transcoding failed: ${error.message}` });
      return;
    }

    res.destroy(error);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      res.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });

  res.on('close', () => {
    if (!ffmpeg.killed) {
      ffmpeg.kill('SIGKILL');
    }
  });
}

function buildCacheOutputPath(selection) {
  const key = getCacheKey(selection);
  return path.join(OPTIMIZED_CACHE_ROOT, `${key}.mp4`);
}

function probeMedia(resolvedPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(FFPROBE_BIN, [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      resolvedPath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

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

      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });
  });
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

    const leftDuration = Number(left?.duration || 0);
    const rightDuration = Number(right?.duration || 0);
    if (Number.isFinite(leftDuration) && Number.isFinite(rightDuration) && leftDuration !== rightDuration) {
      return rightDuration - leftDuration;
    }

    return Number(left?.index || 0) - Number(right?.index || 0);
  })[0];
}

function collectPlaybackProfile(probeData, extension) {
  const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
  const formatNames = String(probeData?.format?.format_name || '')
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const videoStream = findPrimaryStream(streams, 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const audioStream = findPrimaryStream(streams, 'audio');
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle');
  const videoCodec = String(videoStream?.codec_name || '').toLowerCase();
  const audioCodec = String(audioStream?.codec_name || '').toLowerCase();
  const pixelFormat = String(videoStream?.pix_fmt || '').toLowerCase();
  const videoProfile = String(videoStream?.profile || '').toLowerCase();
  const bitDepth = Number(videoStream?.bits_per_raw_sample || videoStream?.bits_per_sample || 8);
  const isTenBit = bitDepth > 8 || pixelFormat.includes('10');
  const hasHdrSignal = ['smpte2084', 'arib-std-b67'].includes(String(videoStream?.color_transfer || '').toLowerCase());
  const oddSubtitleCodecs = subtitleStreams
    .map((stream) => String(stream?.codec_name || '').toLowerCase())
    .filter((codec) => codec && !['mov_text', 'webvtt'].includes(codec));
  const hasOddSubtitleCodec = oddSubtitleCodecs.length > 0;
  const isMp4Family = formatNames.some((value) => value === 'mp4' || value === 'mov');
  const isWebmFamily = formatNames.includes('webm');
  const mp4FriendlyVideo = ['h264', 'avc1'].includes(videoCodec) && !isTenBit && !hasHdrSignal && (!pixelFormat || pixelFormat === 'yuv420p');
  const mp4FriendlyAudio = ['aac', 'mp4a'].includes(audioCodec) || !audioCodec;
  const canDirectPlayMp4 = DIRECT_PLAY_EXTENSIONS.has(extension) && isMp4Family && mp4FriendlyVideo && mp4FriendlyAudio && audioStreams.length <= 1;
  const canDirectPlayWebm = extension === '.webm'
    && isWebmFamily
    && ['vp8', 'vp9', 'av1'].includes(videoCodec)
    && ['opus', 'vorbis'].includes(audioCodec)
    && audioStreams.length <= 1;

  return {
    extension,
    formatNames,
    videoCodec,
    audioCodec: audioCodec || '(none)',
    pixelFormat,
    videoProfile,
    bitDepth: Number.isFinite(bitDepth) ? bitDepth : 8,
    audioStreamCount: audioStreams.length,
    subtitleStreamCount: subtitleStreams.length,
    hasOddSubtitleCodec,
    isTenBit,
    hasHdrSignal,
    canDirectPlayMp4,
    canDirectPlayWebm,
    mp4FriendlyVideo,
    mp4FriendlyAudio,
    oddSubtitleCodecs,
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
  };
}

function pickStreamingStrategy(probeData, extension) {
  const profile = collectPlaybackProfile(probeData, extension);

  if (!profile.hasVideo) {
    return {
      mode: 'transcode',
      videoCodec: profile.videoCodec,
      audioCodec: profile.audioCodec,
      reason: 'missing playable video stream',
      universalTarget: UNIVERSAL_TARGET,
      profile,
    };
  }

  if (profile.canDirectPlayMp4 || profile.canDirectPlayWebm) {
    return {
      mode: 'direct',
      videoCodec: profile.videoCodec,
      audioCodec: profile.audioCodec,
      reason: 'browser-safe direct play',
      universalTarget: UNIVERSAL_TARGET,
      profile,
    };
  }

  if (profile.mp4FriendlyVideo && profile.mp4FriendlyAudio) {
    return {
      mode: 'remux-copy',
      videoCodec: profile.videoCodec,
      audioCodec: profile.audioCodec,
      reason: 'container-only normalization',
      universalTarget: UNIVERSAL_TARGET,
      profile,
    };
  }

  if (profile.mp4FriendlyVideo) {
    return {
      mode: 'copy-video-transcode-audio',
      videoCodec: profile.videoCodec,
      audioCodec: profile.audioCodec,
      reason: 'audio normalization required',
      universalTarget: UNIVERSAL_TARGET,
      profile,
    };
  }

  return {
    mode: 'transcode',
    videoCodec: profile.videoCodec,
    audioCodec: profile.audioCodec,
    reason: 'universal compatibility fallback',
    universalTarget: UNIVERSAL_TARGET,
    profile,
  };
}

async function determineStreamingStrategy(resolvedPath, extension) {
  if (!resolvedPath) {
    return {
      mode: 'transcode',
      videoCodec: '',
      audioCodec: '',
      reason: 'missing source path',
      universalTarget: UNIVERSAL_TARGET,
      profile: null,
    };
  }

  try {
    return pickStreamingStrategy(await probeMedia(resolvedPath), extension);
  } catch (error) {
    logger.error('Player error: ' + (error?.message || error));
    return {
      mode: 'transcode',
      videoCodec: '',
      audioCodec: '',
      reason: 'probe failed, using universal fallback',
      universalTarget: UNIVERSAL_TARGET,
      profile: null,
    };
  }
}

function getFfmpegFileArgs(resolvedPath, outputPath, strategyMode) {
  const common = [
    '-y',
    '-v', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-err_detect', 'ignore_err',
    '-i', resolvedPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
  ];

  if (strategyMode === 'remux-copy') {
    return [
      ...common,
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ];
  }

  if (strategyMode === 'copy-video-transcode-audio') {
    return [
      ...common,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      outputPath,
    ];
  }

  return [
    ...common,
    ...getUniversalTranscodeArgs([
      '-movflags', '+faststart',
      outputPath,
    ]),
  ];
}

function ensureOptimizedCache(selection, resolvedPath, strategy) {
  const cachePath = buildCacheOutputPath(selection);
  const existingCacheStat = fs.existsSync(cachePath) ? safeStat(cachePath) : null;
  if (existingCacheStat?.size > 1024 * 1024) {
    return Promise.resolve({ status: 'ready', cachePath });
  }

  const cacheKey = getCacheKey(selection);
  if (activeCacheJobs.has(cacheKey)) {
    return activeCacheJobs.get(cacheKey);
  }

  ensureDirectory(path.dirname(cachePath));
  const tempPath = `${cachePath}.part.mp4`;
  const jobPromise = new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_BIN, getFfmpegFileArgs(resolvedPath, tempPath, strategy.mode), {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    ffmpeg.stderr.on('data', (chunk) => {
      logger.warn('ffmpeg-cache stderr: ' + chunk.toString('utf8').trim());
    });

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      activeCacheJobs.delete(cacheKey);

      if (code !== 0) {
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch { }
        reject(new Error(`ffmpeg cache exited with code ${code}`));
        return;
      }

      fs.renameSync(tempPath, cachePath);
      resolve({ status: 'ready', cachePath });
    });
  });

  activeCacheJobs.set(cacheKey, jobPromise);
  return jobPromise;
}

function streamFfmpegMp4(resolvedPath, res, ffmpegArgs) {
  res.status(200);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Transfer-Encoding', 'chunked');

  const ffmpeg = spawn(FFMPEG_BIN, ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (chunk) => {
    logger.warn('ffmpeg stderr: ' + chunk.toString('utf8').trim());
  });

  ffmpeg.on('error', (error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: `Streaming failed: ${error.message}` });
      return;
    }

    res.destroy(error);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      res.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });

  res.on('close', () => {
    if (!ffmpeg.killed) {
      ffmpeg.kill('SIGKILL');
    }
  });
}

function remuxToMp4(resolvedPath, res) {
  streamFfmpegMp4(resolvedPath, res, [
    '-v', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-err_detect', 'ignore_err',
    '-i', resolvedPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-movflags', 'frag_keyframe+empty_moov+faststart',
    '-f', 'mp4',
    'pipe:1',
  ]);
}

function copyVideoTranscodeAudio(resolvedPath, res) {
  streamFfmpegMp4(resolvedPath, res, [
    '-v', 'error',
    '-fflags', '+discardcorrupt+genpts',
    '-err_detect', 'ignore_err',
    '-i', resolvedPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-sn',
    '-dn',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', 'frag_keyframe+empty_moov+faststart',
    '-f', 'mp4',
    'pipe:1',
  ]);
}

router.get('/stream/:contentType/:id', async (req, res, next) => {
  try {
    const selection = await findSelectedMedia(req);

    if (selection.error) {
      throw new AppError(selection.error.message, selection.error.status, 'MEDIA_SELECTION_ERROR');
    }

    const { sourcePath, videoUrl } = selection;
    const resolvedPath = resolvePlayableFilePath(sourcePath, videoUrl);
    const ext = getSourceExtension(resolvedPath, videoUrl);

    if (!resolvedPath) {
      if (process.env.REMOTE_MEDIA_BASE_URL && videoUrl) {
        return res.redirect(`${process.env.REMOTE_MEDIA_BASE_URL}${videoUrl}`);
      }
      throw new AppError('Source file is not available on the server', 404, 'NOT_FOUND');
    }
    const strategy = await determineStreamingStrategy(resolvedPath, ext);

    if (strategy.mode === 'direct') {
      streamFileDirect(resolvedPath, req, res);
      return;
    }

    const cachePath = buildCacheOutputPath(selection);

    const cacheStat = fs.existsSync(cachePath) ? safeStat(cachePath) : null;
    if (cacheStat?.size > 1024 * 1024) {
      streamFileDirect(cachePath, req, res);
      return;
    }

    if (req.query.requireOptimized === '1') {
      throw new AppError('Optimized stream is still preparing', 425, 'TOO_EARLY');
    }

    if (strategy.mode === 'remux-copy') {
      remuxToMp4(resolvedPath, res);
      return;
    }

    if (strategy.mode === 'copy-video-transcode-audio') {
      copyVideoTranscodeAudio(resolvedPath, res);
      return;
    }

    transcodeToMp4(resolvedPath, res);
  } catch (error) {
    if (!res.headersSent) {
      next(error);
    }
  }
});

router.get('/:contentType/:id', async (req, res, next) => {
  try {
    const selection = await findSelectedMedia(req);

    if (selection.error) {
      throw new AppError(selection.error.message, selection.error.status, 'MEDIA_SELECTION_ERROR');
    }

    const { videoUrl, sourcePath } = selection;
    const resolvedPath = resolvePlayableFilePath(sourcePath, videoUrl);
    const ext = getSourceExtension(resolvedPath, videoUrl);
    const strategy = resolvedPath
      ? await determineStreamingStrategy(resolvedPath, ext)
      : { mode: 'transcode' };

    const cachePath = resolvedPath && strategy.mode !== 'direct'
      ? buildCacheOutputPath(selection)
      : '';
    const optimizedReady = cachePath
      ? ((fs.existsSync(cachePath) ? safeStat(cachePath) : null)?.size > 1024 * 1024)
      : true;
    const streamUrl = `/api/player/stream/${encodeURIComponent(req.params.contentType)}/${encodeURIComponent(req.params.id)}?${new URLSearchParams({
      season: String(req.query.season || 1),
      episode: String(req.query.episode || 1),
    }).toString()}`;

    res.json({
      sources: [
        {
          url: streamUrl,
          quality: selection.item.quality || 'auto',
          label: selection.item.quality || 'Auto',
          delivery: strategy.mode,
          originalExtension: ext || 'unknown',
          available: Boolean(resolvedPath),
          optimizedReady,
        },
      ],
      subtitles: [],
      preparePath: `/api/player/prepare/${encodeURIComponent(req.params.contentType)}/${encodeURIComponent(req.params.id)}?${new URLSearchParams({
        season: String(req.query.season || 1),
        episode: String(req.query.episode || 1),
      }).toString()}`,
      ...buildMetadata(selection),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/prepare/:contentType/:id', async (req, res, next) => {
  try {
    const selection = await findSelectedMedia(req);

    if (selection.error) {
      throw new AppError(selection.error.message, selection.error.status, 'MEDIA_SELECTION_ERROR');
    }

    const { sourcePath, videoUrl } = selection;
    const resolvedPath = resolvePlayableFilePath(sourcePath, videoUrl);
    const ext = getSourceExtension(resolvedPath, videoUrl);

    if (!resolvedPath) {
      throw new AppError('Source file is not available on the server', 404, 'NOT_FOUND');
    }

    const strategy = await determineStreamingStrategy(resolvedPath, ext);

    if (strategy.mode === 'direct') {
      return res.json({ ready: true, strategy: 'direct' });
    }

    const cachePath = buildCacheOutputPath(selection);
    const cacheStat = fs.existsSync(cachePath) ? safeStat(cachePath) : null;
    if (cacheStat?.size > 1024 * 1024) {
      return res.json({ ready: true, strategy: strategy.mode, cachePath });
    }

    ensureOptimizedCache(selection, resolvedPath, strategy).catch((error) => {
      logger.error('Player error: ' + (error?.message || error));
    });

    res.json({ ready: false, strategy: strategy.mode });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.__test__ = {
  collectPlaybackProfile,
  pickStreamingStrategy,
  determineStreamingStrategy,
};
