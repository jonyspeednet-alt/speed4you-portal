require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { enrichItemWithMetadata, hasTmdbKey } = require('../src/services/metadata-enricher');

const catalogPath = path.resolve(__dirname, '../src/data/catalog.json');
const progressPath = path.resolve(__dirname, '../src/data/bulk-enrich-progress.json');
const SAVE_EVERY = Number(process.env.BULK_ENRICH_SAVE_EVERY || 25);
const DELAY_MS = Number(process.env.BULK_ENRICH_DELAY_MS || 150);

function readCatalog() {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw);
}

function writeCatalog(catalog) {
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeProgress(progress) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

async function main() {
  if (!hasTmdbKey()) {
    throw new Error('TMDB_API_KEY is not configured.');
  }

  const catalog = readCatalog();
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  const summary = {
    startedAt: new Date().toISOString(),
    completedAt: '',
    totalItems: items.length,
    processed: 0,
    published: 0,
    matched: 0,
    needsReview: 0,
    notFound: 0,
    failed: 0,
    skipped: 0,
    lastItemId: null,
    lastTitle: '',
  };

  writeProgress(summary);

  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    const enriched = await enrichItemWithMetadata(current);

    const nextItem = {
      ...current,
      ...enriched,
      status: 'published',
      updatedAt: new Date().toISOString(),
    };

    items[index] = nextItem;
    summary.processed += 1;
    summary.published += 1;
    summary.lastItemId = nextItem.id || null;
    summary.lastTitle = nextItem.title || '';

    switch (nextItem.metadataStatus) {
      case 'matched':
        summary.matched += 1;
        break;
      case 'needs_review':
        summary.needsReview += 1;
        break;
      case 'not_found':
        summary.notFound += 1;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      default:
        summary.skipped += 1;
        break;
    }

    if (summary.processed % SAVE_EVERY === 0 || index === items.length - 1) {
      catalog.items = items;
      writeCatalog(catalog);
      writeProgress(summary);
      console.log(`[bulk-enrich] ${summary.processed}/${summary.totalItems} processed; matched=${summary.matched}; failed=${summary.failed}`);
    }

    if (DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  summary.completedAt = new Date().toISOString();
  writeCatalog(catalog);
  writeProgress(summary);
  console.log('[bulk-enrich] completed', JSON.stringify(summary));
}

main().catch((error) => {
  const failure = {
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    failed: true,
    error: error.message || String(error),
  };
  writeProgress(failure);
  console.error('[bulk-enrich] failed', error);
  process.exit(1);
});
