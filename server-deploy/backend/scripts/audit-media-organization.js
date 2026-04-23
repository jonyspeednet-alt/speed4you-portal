const fs = require('fs');
const path = require('path');
const {
  cleanSearchTitle,
  enrichItemWithMetadata,
  hasTmdbKey,
} = require('../src/services/metadata-enricher');
const { loadScannerRoots } = require('../src/data/store');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.mpg', '.mpeg', '.ts', '.m2ts', '.flv',
]);

const EPISODE_PATTERN = /\bS\d{1,2}E\d{1,3}\b|\bSeason\s*\d+\b|\bEpisode\s*\d+\b/i;
const YEAR_PATTERN = /\b(19|20)\d{2}\b/;
const DEFAULT_LIMIT = Number(process.env.MEDIA_ORGANIZATION_AUDIT_LIMIT || 200);
const reportPath = path.resolve(__dirname, '../src/data/media-organization-audit.json');

function extractYear(value) {
  const match = String(value || '').match(YEAR_PATTERN);
  return match ? Number(match[0]) : null;
}

function sanitizeFileBaseName(value) {
  const safe = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return safe || 'Untitled';
}

function normalizeConfidence(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function inferSeriesFromName(name) {
  return EPISODE_PATTERN.test(String(name || ''));
}

function detectLanguageBucket(filename, metadata) {
  const text = `${filename} ${metadata?.originalLanguage || ''} ${metadata?.genre || ''}`.toLowerCase();
  if (text.includes('bangla') || text.includes('bengali') || metadata?.originalLanguage === 'bn') {
    return 'Bengali';
  }
  if (text.includes('hindi') || text.includes('dual audio') || metadata?.originalLanguage === 'hi') {
    return 'Hindi';
  }
  if ((metadata?.genres || []).some((genre) => String(genre).toLowerCase() === 'animation')) {
    return 'Animation';
  }
  return 'English';
}

function sortRoots(roots) {
  return [...roots].sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
}

function pickMovieRoot(roots, filename, metadata) {
  const languageBucket = detectLanguageBucket(filename, metadata);
  const movieRoots = sortRoots(roots).filter((root) => root?.type === 'movie');

  if (languageBucket === 'Animation') {
    return movieRoots.find((root) => /animation/i.test(root.label || root.category || '')) || null;
  }
  if (languageBucket === 'Bengali') {
    return movieRoots.find((root) => /bangla/i.test(root.label || root.category || '')) || null;
  }
  if (languageBucket === 'Hindi') {
    return movieRoots.find((root) => /^hindi movies$/i.test(root.label || ''))
      || movieRoots.find((root) => /hindi/i.test(root.label || root.category || ''))
      || null;
  }

  return movieRoots.find((root) => /english/i.test(root.label || root.category || '')) || null;
}

function pickSeriesRoot(roots, title) {
  const seriesRoots = sortRoots(roots).filter((root) => root?.type === 'series');
  const firstChar = String(title || '').trim().charAt(0).toUpperCase();

  if (!firstChar) {
    return seriesRoots.find((root) => /english tv series/i.test(root.label || '')) || seriesRoots[0] || null;
  }

  const alphaBuckets = [
    { pattern: /^[0-9A-E]$/i, matcher: /0-9.*A-E/i },
    { pattern: /^[F-M]$/i, matcher: /F-M/i },
    { pattern: /^[N-S]$/i, matcher: /N-S/i },
    { pattern: /^T$/i, matcher: /(^|[^A-Z])T([^A-Z]|$)/i },
    { pattern: /^[U-Z]$/i, matcher: /U-Z/i },
  ];

  for (const bucket of alphaBuckets) {
    if (bucket.pattern.test(firstChar)) {
      return seriesRoots.find((root) => bucket.matcher.test(root.label || root.id || '')) || null;
    }
  }

  return seriesRoots.find((root) => /english tv series/i.test(root.label || '')) || seriesRoots[0] || null;
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
      if (VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        yield absolutePath;
      }
    }
  }
}

function resolveRootForPath(roots, filePath) {
  const absoluteFile = path.resolve(filePath);
  return roots
    .map((root) => ({ ...root, resolvedScanPath: path.resolve(root.scanPath) }))
    .filter((root) => absoluteFile === root.resolvedScanPath || absoluteFile.startsWith(`${root.resolvedScanPath}${path.sep}`))
    .sort((left, right) => right.resolvedScanPath.length - left.resolvedScanPath.length)[0] || null;
}

async function inspectFile(filePath, roots) {
  const filename = path.basename(filePath);
  const extension = path.extname(filename);
  const root = resolveRootForPath(roots, filePath);
  const currentType = root?.type || (inferSeriesFromName(filename) ? 'series' : 'movie');
  const parsedTitle = cleanSearchTitle(path.basename(filename, extension));
  const year = extractYear(filename);

  const metadata = await enrichItemWithMetadata({
    title: parsedTitle || path.basename(filename, extension),
    year,
    type: currentType,
    language: root?.language || '',
    category: root?.category || '',
    sourceRootLabel: root?.label || '',
  });

  const standardTitle = metadata.title || parsedTitle || path.basename(filename, extension);
  const standardYear = Number.isFinite(Number(metadata.year)) ? Number(metadata.year) : year;
  const suggestedBaseName = sanitizeFileBaseName(
    standardYear ? `${standardTitle} (${standardYear})` : standardTitle,
  );
  const suggestedFilename = `${suggestedBaseName}${extension.toLowerCase()}`;
  const suggestedType = metadata.type || currentType;
  const targetRoot = suggestedType === 'series'
    ? pickSeriesRoot(roots, standardTitle)
    : pickMovieRoot(roots, filename, metadata);
  const suggestedPath = targetRoot ? path.join(targetRoot.scanPath, suggestedFilename) : filePath;
  const sameName = path.basename(filePath) === suggestedFilename;
  const sameRoot = root?.scanPath && targetRoot?.scanPath
    ? path.resolve(root.scanPath) === path.resolve(targetRoot.scanPath)
    : true;
  const confidence = normalizeConfidence(metadata.metadataConfidence);

  return {
    currentPath: filePath,
    currentRoot: root?.scanPath || '',
    currentRootLabel: root?.label || '',
    currentType,
    parsedTitle,
    year,
    metadataStatus: metadata.metadataStatus || 'unknown',
    metadataConfidence: confidence,
    matchedTitle: metadata.title || '',
    matchedYear: metadata.year || null,
    matchedType: metadata.type || '',
    suggestedType,
    suggestedFilename,
    suggestedRoot: targetRoot?.scanPath || '',
    suggestedRootLabel: targetRoot?.label || '',
    suggestedPath,
    renameNeeded: !sameName,
    moveNeeded: !sameRoot,
    reviewNeeded: confidence < 70 || metadata.metadataStatus !== 'matched',
    reason: !sameRoot ? 'move-root' : (!sameName ? 'rename-file' : 'already-standard'),
  };
}

async function main() {
  if (!hasTmdbKey()) {
    throw new Error('TMDB_API_KEY is not configured.');
  }

  const roots = loadScannerRoots().filter((root) => root?.scanPath && fs.existsSync(root.scanPath));
  if (!roots.length) {
    throw new Error('No existing scanner roots found on this machine.');
  }

  const maxItems = Number.isFinite(DEFAULT_LIMIT) && DEFAULT_LIMIT > 0 ? DEFAULT_LIMIT : 200;
  const candidates = [];

  for (const root of roots) {
    for (const filePath of walkVideoFiles(root.scanPath)) {
      candidates.push(filePath);
      if (candidates.length >= maxItems) {
        break;
      }
    }
    if (candidates.length >= maxItems) {
      break;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    roots: roots.map((root) => ({
      id: root.id,
      label: root.label,
      type: root.type,
      scanPath: root.scanPath,
    })),
    scannedFiles: candidates.length,
    items: [],
    summary: {
      renameNeeded: 0,
      moveNeeded: 0,
      reviewNeeded: 0,
    },
  };

  for (const filePath of candidates) {
    const item = await inspectFile(filePath, roots);
    report.items.push(item);
    if (item.renameNeeded) report.summary.renameNeeded += 1;
    if (item.moveNeeded) report.summary.moveNeeded += 1;
    if (item.reviewNeeded) report.summary.reviewNeeded += 1;
    console.log(`[media-organization-audit] ${item.reason} :: ${filePath}`);
  }

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[media-organization-audit] report written to ${reportPath}`);
  console.log(JSON.stringify(report.summary));
}

main().catch((error) => {
  console.error(`[media-organization-audit] fatal: ${error.message}`);
  process.exit(1);
});
