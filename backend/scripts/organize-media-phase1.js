const fs = require('fs');
const path = require('path');
const {
  loadScannerRoots,
  refreshCatalogReferencesForNormalizedFile,
} = require('../src/data/store');

const auditPath = path.resolve(__dirname, '../src/data/media-organization-audit.json');
const logPath = path.resolve(__dirname, '../src/data/media-organization-phase1.json');
const MIN_CONFIDENCE = Number(process.env.MEDIA_ORGANIZATION_MIN_CONFIDENCE || 80);

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildUniquePath(targetPath) {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let nextPath = targetPath;
  let index = 1;

  while (fs.existsSync(nextPath)) {
    nextPath = path.join(dir, `${base} (${index})${ext}`);
    index += 1;
  }

  return nextPath;
}

function toPublicUrl(root, absolutePath) {
  const relativePath = path.relative(root.scanPath, absolutePath).split(path.sep).join('/');
  return `${root.publicBaseUrl}/${relativePath.split('/').map(encodeURIComponent).join('/')}`.replace(/%2520/g, '%20');
}

function resolveRootForPath(roots, filePath) {
  const normalizedFilePath = path.resolve(filePath);
  return roots
    .filter((root) => root?.scanPath && root?.publicBaseUrl)
    .map((root) => ({ ...root, resolvedScanPath: path.resolve(root.scanPath) }))
    .filter((root) => normalizedFilePath === root.resolvedScanPath || normalizedFilePath.startsWith(`${root.resolvedScanPath}${path.sep}`))
    .sort((left, right) => right.resolvedScanPath.length - left.resolvedScanPath.length)[0] || null;
}

function isWithinScannerRoots(roots, filePath) {
  return Boolean(resolveRootForPath(roots, filePath));
}

function looksSafe(item) {
  if (!item) return false;
  if (item.metadataStatus !== 'matched') return false;
  if (Number(item.metadataConfidence || 0) < MIN_CONFIDENCE) return false;
  if (!item.renameNeeded && !item.moveNeeded) return false;
  if (!item.currentPath || !item.suggestedPath) return false;
  if (item.reviewNeeded) return false;

  const suggestedName = path.basename(item.suggestedPath);
  if (!suggestedName || /-\.[^.]+$/i.test(suggestedName)) return false;
  if (/\.normalizing\./i.test(item.currentPath)) return false;
  if (/[<>:"|?*\x00-\x1F]/.test(suggestedName)) return false;
  return true;
}

function moveFile(roots, item) {
  const sourcePath = path.resolve(item.currentPath);
  let targetPath = path.resolve(item.suggestedPath);

  if (!fs.existsSync(sourcePath)) {
    return { status: 'missing-source' };
  }

  if (!isWithinScannerRoots(roots, sourcePath) || !isWithinScannerRoots(roots, targetPath)) {
    return { status: 'outside-root' };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath) && sourcePath !== targetPath) {
    targetPath = buildUniquePath(targetPath);
  }

  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== 'EXDEV') {
      throw error;
    }

    fs.copyFileSync(sourcePath, targetPath);
    const sourceStat = fs.statSync(sourcePath);
    const targetStat = fs.statSync(targetPath);
    if (sourceStat.size !== targetStat.size) {
      try {
        fs.unlinkSync(targetPath);
      } catch {}
      throw new Error(`copy-size-mismatch source=${sourceStat.size} target=${targetStat.size}`);
    }
    fs.unlinkSync(sourcePath);
  }

  const previousRoot = resolveRootForPath(roots, sourcePath);
  const nextRoot = resolveRootForPath(roots, targetPath);
  const refreshResult = previousRoot && nextRoot
    ? refreshCatalogReferencesForNormalizedFile({
      previousSourcePath: sourcePath,
      nextSourcePath: targetPath,
      previousVideoUrl: toPublicUrl(previousRoot, sourcePath),
      nextVideoUrl: toPublicUrl(nextRoot, targetPath),
    })
    : { updatedItems: 0, updatedEpisodes: 0 };

  return {
    status: 'moved',
    targetPath,
    refreshResult,
  };
}

function main() {
  const roots = loadScannerRoots().filter((root) => root?.scanPath && root?.publicBaseUrl);
  const audit = readJson(auditPath, null);
  if (!audit || !Array.isArray(audit.items)) {
    throw new Error(`Audit file not found or invalid: ${auditPath}`);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    sourceAuditGeneratedAt: audit.generatedAt || null,
    minConfidence: MIN_CONFIDENCE,
    totals: {
      auditedItems: audit.items.length,
      eligible: 0,
      moved: 0,
      skipped: 0,
      failed: 0,
    },
    entries: [],
  };

  for (const item of audit.items) {
    if (!looksSafe(item)) {
      result.totals.skipped += 1;
      continue;
    }

    result.totals.eligible += 1;
    try {
      const action = moveFile(roots, item);
      result.entries.push({
        currentPath: item.currentPath,
        suggestedPath: item.suggestedPath,
        ...action,
      });
      if (action.status === 'moved') {
        result.totals.moved += 1;
        console.log(`[media-organize-phase1] moved ${item.currentPath} -> ${action.targetPath}`);
      } else {
        result.totals.failed += 1;
        console.log(`[media-organize-phase1] skipped-action ${item.currentPath} (${action.status})`);
      }
    } catch (error) {
      result.totals.failed += 1;
      result.entries.push({
        currentPath: item.currentPath,
        suggestedPath: item.suggestedPath,
        status: 'failed',
        error: error.message,
      });
      console.log(`[media-organize-phase1] failed ${item.currentPath} -> ${error.message}`);
    }
  }

  writeJson(logPath, result);
  console.log(`[media-organize-phase1] report written to ${logPath}`);
  console.log(JSON.stringify(result.totals));
}

main();
