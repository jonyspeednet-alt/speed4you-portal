import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminService } from '../../services';
import ConfirmDialog from '../../components/overlays/ConfirmDialog';
import ProgressBar from '../../components/ui/ProgressBar';
import { useBreakpoint } from '../../hooks';

function formatWhen(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getMetadataTone(item) {
  if (item.metadataStatus === 'matched') {
    return styles.toneSuccess;
  }

  if (item.metadataStatus === 'needs_review') {
    return styles.toneWarning;
  }

  if (item.metadataStatus === 'not_found') {
    return styles.toneDanger;
  }

  return styles.toneNeutral;
}

function getHealthSummary(health) {
  const roots = health?.roots || [];
  const healthyRoots = roots.filter((root) => root.checkable !== false && root.exists).length;
  const brokenRoots = roots.filter((root) => root.checkable !== false && !root.exists).length;
  const remoteRoots = roots.filter((root) => root.checkable === false).length;
  return { healthyRoots, brokenRoots, remoteRoots };
}

function mergeContentItem(items, nextItem) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

function StatCard({ label, value, hint, accent = false }) {
  return (
    <div style={accent ? styles.metricCardAccent : styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricHint}>{hint}</span>
    </div>
  );
}

function ContentPoster({ src, alt, style, variant = 'table', fallbackText = 'No Art' }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div style={variant === 'preview' ? styles.posterPlaceholder : styles.tablePosterFallback}>{fallbackText}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  );
}

function resolvePosterSource(item) {
  return item?.poster || item?.backdrop || '';
}

function toTagString(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return 'just now';
  }

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getScannerProgress(job) {
  const summary = job?.summary;
  const rootResults = Array.isArray(summary?.rootResults) ? summary.rootResults : [];
  const totalCandidates = rootResults.reduce((sum, root) => sum + Number(root.totalCandidates || 0), 0);
  const processed = rootResults.reduce((sum, root) => sum + Number(root.processed || 0), 0);
  const created = Number(summary?.created || 0);
  const updated = Number(summary?.updated || 0);
  const unchanged = Number(summary?.unchanged || 0);
  const deleted = Number(summary?.deleted || 0);
  const duplicateDrafts = Number(summary?.duplicateDrafts || 0);
  const rootsScanned = Number(summary?.rootsScanned || 0);
  const rootsRequested = Number(summary?.rootsRequested || rootResults.length || 0);
  const activeRoot = rootResults.find((root) => root.id === summary?.activeRootId)
    || rootResults.find((root) => root.status === 'running')
    || null;
  const startedAtMs = Date.parse(job?.startedAt || summary?.startedAt || '');
  const completedAtMs = Date.parse(job?.completedAt || summary?.completedAt || '');
  const endMs = Number.isFinite(completedAtMs) ? completedAtMs : Date.now();
  const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, endMs - startedAtMs) : 0;
  const percent = totalCandidates > 0
    ? Math.max(0, Math.min(100, (processed / totalCandidates) * 100))
    : (job?.status === 'completed' ? 100 : 0);
  const scanVelocity = elapsedMs > 0 && processed > 0 ? processed / (elapsedMs / 1000) : 0;
  const remainingCandidates = Math.max(totalCandidates - processed, 0);
  const etaMs = scanVelocity > 0 ? (remainingCandidates / scanVelocity) * 1000 : null;

  return {
    rootResults,
    totalCandidates,
    processed,
    created,
    updated,
    unchanged,
    deleted,
    duplicateDrafts,
    rootsScanned,
    rootsRequested,
    activeRoot,
    elapsedMs,
    etaMs,
    percent,
    remainingCandidates,
  };
}

function ContentLibraryPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const sectionType = location.pathname === '/admin/movies'
    ? 'movie'
    : location.pathname === '/admin/series'
      ? 'series'
      : 'all';

  const [loading, setLoading] = useState(true);
  const [auxLoading, setAuxLoading] = useState(true);
  const [contentRefreshing, setContentRefreshing] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanStateLabel, setScanStateLabel] = useState('');
  const [currentJob, setCurrentJob] = useState(null);
  const [error, setError] = useState('');
  const [roots, setRoots] = useState([]);
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [duplicateReview, setDuplicateReview] = useState(null);
  const [duplicateCleanupLoading, setDuplicateCleanupLoading] = useState(false);
  const [pruneLoading, setPruneLoading] = useState(false);
  const [vacuumLoading, setVacuumLoading] = useState(false);
  const [selectedRootIds, setSelectedRootIds] = useState([]);
  const [selectedContentIds, setSelectedContentIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    metadata: true,
    source: true,
    actions: true,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    source: '',
    language: '',
    category: '',
    collection: '',
    tag: '',
    sourceRootId: '',
    duplicatesOnly: false,
  });
  const [searchInput, setSearchInput] = useState('');
  const [bulkEditor, setBulkEditor] = useState({
    collection: '',
    tags: '',
    adminNotes: '',
    featuredOrder: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
  });
  const [pageInput, setPageInput] = useState('1');
  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      status: '',
    }));
    setSelectedContentIds([]);
  }, [sectionType]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  const pageTitle = sectionType === 'movie'
    ? 'Movie Content Management'
    : sectionType === 'series'
      ? 'Series Content Management'
      : 'Content Management';

  const pageSubtitle = sectionType === 'movie'
    ? 'Scan movie folders, review imported titles, and publish the right releases.'
    : sectionType === 'series'
      ? 'Manage episodic media, review metadata quality, and publish clean entries.'
      : 'Scan server media, review duplicates, filter the library, and control what goes live.';

  useEffect(() => {
    try {
      const rawPresets = localStorage.getItem(`admin-content-presets-${sectionType}`);
      const rawColumns = localStorage.getItem(`admin-content-columns-${sectionType}`);
      setSavedPresets(rawPresets ? JSON.parse(rawPresets) : []);
      setVisibleColumns(rawColumns ? JSON.parse(rawColumns) : {
        status: true,
        metadata: true,
        source: true,
        actions: true,
      });
    } catch {
      setSavedPresets([]);
      setVisibleColumns({
        status: true,
        metadata: true,
        source: true,
        actions: true,
      });
    }
  }, [sectionType]);

  useEffect(() => {
    localStorage.setItem(`admin-content-presets-${sectionType}`, JSON.stringify(savedPresets));
  }, [savedPresets, sectionType]);

  useEffect(() => {
    localStorage.setItem(`admin-content-columns-${sectionType}`, JSON.stringify(visibleColumns));
  }, [sectionType, visibleColumns]);

  const apiParams = useMemo(() => ({
    ...(sectionType === 'movie' ? { type: 'movie' } : {}),
    ...(sectionType === 'series' ? { type: 'series' } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.collection ? { collection: filters.collection } : {}),
    ...(filters.tag ? { tag: filters.tag } : {}),
    ...(filters.sourceRootId ? { sourceRootId: filters.sourceRootId } : {}),
    ...(filters.duplicatesOnly ? { duplicatesOnly: 'true' } : {}),
    page: pagination.page,
    limit: pagination.limit,
  }), [
    sectionType,
    filters.search,
    filters.status,
    filters.source,
    filters.language,
    filters.category,
    filters.collection,
    filters.tag,
    filters.sourceRootId,
    filters.duplicatesOnly,
    pagination.page,
    pagination.limit,
  ]);

  const loadContentData = useCallback(async () => {
    try {
      setContentRefreshing(true);
      setError('');
      const contentResponse = await (sectionType === 'movie'
        ? adminService.getMovies(apiParams)
        : sectionType === 'series'
          ? adminService.getSeries(apiParams)
          : adminService.getContent(apiParams));
      const nextContent = contentResponse?.items || [];

      setAllContent(nextContent);
      setPagination((current) => ({ ...current, total: contentResponse?.total || 0 }));
      setSelectedContentIds((current) => current.filter((contentId) => nextContent.some((item) => item.id === contentId)));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load content library.');
    } finally {
      setLoading(false);
      setContentRefreshing(false);
    }
  }, [apiParams, sectionType]);

  useEffect(() => {
    loadContentData();
  }, [loadContentData]);

  const loadAuxiliaryData = useCallback(async () => {
    setAuxLoading(true);

    const fetchRoots = async () => {
      try {
        const [rootsRes, healthRes] = await Promise.all([
          adminService.getScannerRoots(),
          adminService.getScannerHealth(),
        ]);
        const baseRoots = rootsRes?.items || [];
        const healthRoots = healthRes?.roots || [];
        const nextRoots = baseRoots.map((root) => {
          const healthRoot = healthRoots.find((entry) => entry.id === root.id);
          return healthRoot ? { ...root, ...healthRoot } : root;
        });
        setRoots(nextRoots);
        setHealth(healthRes || {});
        setSelectedRootIds((current) => (current.length ? current : nextRoots.map((root) => root.id)));
      } catch (e) {
        console.error('Failed to load roots/health', e);
      }
    };

    const fetchDrafts = async () => {
      try {
        const res = await adminService.getScannerDrafts();
        setDrafts(res?.items || []);
      } catch (e) {
        console.error('Failed to load drafts', e);
      }
    };

    const fetchDuplicates = async () => {
      try {
        const res = await adminService.getDuplicateReview();
        setDuplicateReview(res || {});
      } catch (e) {
        console.error('Failed to load duplicates', e);
      }
    };

    const fetchOrganization = async () => {
      try {
        const res = await adminService.getContentOrganization(sectionType === 'movie' ? { type: 'movie' } : sectionType === 'series' ? { type: 'series' } : {});
        setOrganization(res || {});
      } catch (e) {
        console.error('Failed to load organization', e);
      }
    };

    const fetchLogs = async () => {
      try {
        const res = await adminService.getScannerLogs(8);
        setLogs(res?.items || []);
      } catch (e) {
        console.error('Failed to load logs', e);
      }
    };

    const fetchJob = async () => {
      try {
        const res = await adminService.getCurrentScannerJob();
        setCurrentJob(res?.job || {});
      } catch (e) {
        console.error('Failed to load current job', e);
      }
    };

    const fetchDbHealth = async () => {
      try {
        const res = await adminService.getDbHealth();
        setDbHealth(res || null);
      } catch (e) {
        console.error('Failed to load DB health', e);
      }
    };

    await Promise.allSettled([
      fetchRoots(),
      fetchDrafts(),
      fetchDuplicates(),
      fetchOrganization(),
      fetchLogs(),
      fetchJob(),
      fetchDbHealth(),
    ]);

    setAuxLoading(false);
  }, [sectionType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAuxiliaryData();
    }, 50);

    return () => clearTimeout(timer);
  }, [loadAuxiliaryData]);

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }));
  }, [
    filters.search,
    filters.status,
    filters.source,
    filters.language,
    filters.category,
    filters.collection,
    filters.tag,
    filters.sourceRootId,
    filters.duplicatesOnly,
  ]);

  useEffect(() => {
    if (currentJob?.status !== 'running') {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        const response = await adminService.getCurrentScannerJob();
        const job = response?.job || {};
        setCurrentJob(job);

        if (job.status === 'completed') {
          setScanStateLabel('Scanner run completed.');
          await Promise.all([loadContentData(), loadAuxiliaryData()]);
        }
      } catch (refreshError) {
        setError(refreshError.message || 'Failed to refresh scanner job status.');
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentJob?.status, loadAuxiliaryData, loadContentData]);

  const healthSummary = useMemo(() => getHealthSummary(health), [health]);
  const filterOptions = useMemo(() => ({
    languages: Array.from(new Set(allContent.map((item) => item.language).filter(Boolean))).sort(),
    categories: Array.from(new Set(allContent.map((item) => item.category).filter(Boolean))).sort(),
    collections: Array.from(new Set(allContent.map((item) => item.collection).filter(Boolean))).sort(),
    tags: Array.from(new Set(allContent.flatMap((item) => item.tags || []).filter(Boolean))).sort(),
  }), [allContent]);

  const contentMetrics = useMemo(() => ({
    total: pagination.total,
    visible: allContent.length,
    published: allContent.filter((item) => item.status === 'published').length,
    drafts: allContent.filter((item) => item.status === 'draft').length,
    scanner: allContent.filter((item) => item.sourceType === 'scanner').length,
    manual: allContent.filter((item) => item.sourceType === 'manual').length,
    needsReview: allContent.filter((item) => item.metadataStatus === 'needs_review').length,
    duplicateRisk: allContent.filter((item) => Number(item.duplicateCount || 0) > 0).length,
  }), [allContent, pagination.total]);

  const spotlightDrafts = useMemo(() => (
    [...drafts]
      .sort((a, b) => {
        const duplicateDelta = Number(b.duplicateCount || 0) - Number(a.duplicateCount || 0);
        if (duplicateDelta !== 0) {
          return duplicateDelta;
        }

        return Number(b.metadataConfidence || 0) - Number(a.metadataConfidence || 0);
      })
      .slice(0, 6)
  ), [drafts]);

  const duplicateHighlights = useMemo(() => {
    const reportItems = duplicateReview?.items || duplicateReview?.groups || [];
    return reportItems.slice(0, 6);
  }, [duplicateReview]);

  const duplicateStats = useMemo(() => ({
    totalItems: duplicateReview?.totalItems || duplicateReview?.totalGroups || duplicateHighlights.length || 0,
    exactDuplicates: duplicateReview?.exactDuplicates || 0,
    pendingReview: duplicateReview?.pendingReview || 0,
  }), [duplicateHighlights.length, duplicateReview]);
  const scannerProgress = useMemo(() => getScannerProgress(currentJob), [currentJob]);

  const allVisibleIds = useMemo(() => allContent.map((item) => item.id), [allContent]);
  const allVisibleSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedContentIds.includes(id));

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      source: '',
      language: '',
      category: '',
      collection: '',
      tag: '',
      sourceRootId: '',
      duplicatesOnly: false,
    });
  };

  const selectAllRoots = () => {
    setSelectedRootIds(roots.map((root) => root.id));
  };

  const clearRootSelection = () => {
    setSelectedRootIds([]);
  };

  const toggleRoot = (rootId) => {
    setSelectedRootIds((current) => (
      current.includes(rootId)
        ? current.filter((id) => id !== rootId)
        : [...current, rootId]
    ));
  };

  const toggleContentSelection = (id) => {
    setSelectedContentIds((current) => (
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id]
    ));
  };

  const toggleSelectAllVisible = () => {
    setSelectedContentIds((current) => (
      allVisibleSelected
        ? current.filter((id) => !allVisibleIds.includes(id))
        : Array.from(new Set([...current, ...allVisibleIds]))
    ));
  };

  const handleRunScanner = async () => {
    try {
      setScanLoading(true);
      setError('');
      setScanStateLabel('Starting scanner...');
      const shouldScanAllRoots = !selectedRootIds.length || selectedRootIds.length === roots.length;
      await adminService.runScanner(shouldScanAllRoots ? [] : selectedRootIds);

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const response = await adminService.getCurrentScannerJob();
        const job = response?.job || {};
        setCurrentJob(job);

        if (!job.status) {
          setScanStateLabel('');
          break;
        }

        if (job.status === 'running') {
          const nextProgress = getScannerProgress(job);
          const progressText = nextProgress.totalCandidates
            ? `${nextProgress.processed}/${nextProgress.totalCandidates} folders checked`
            : 'collecting progress';
          setScanStateLabel(`Scanner is running on the server... ${progressText}.`);
          continue;
        }

        if (job.status === 'completed') {
          setScanStateLabel('Scanner run completed.');
          await Promise.all([loadContentData(), loadAuxiliaryData()]);
          break;
        }

        if (job.status === 'failed') {
          throw new Error(job.error || 'Scanner job failed.');
        }
      }
    } catch (runError) {
      setError(runError.message || 'Scanner run failed.');
    } finally {
      setScanLoading(false);
      setTimeout(() => setScanStateLabel(''), 4000);
    }
  };

  const handleStopScanner = async () => {
    try {
      setScanLoading(true);
      setError('');
      await adminService.stopScanner();
      setScanStateLabel('Scanner stopped.');
      await Promise.all([loadAuxiliaryData(), loadContentData()]);
    } catch (stopError) {
      setError(stopError.message || 'Failed to stop scanner.');
    } finally {
      setScanLoading(false);
      setTimeout(() => setScanStateLabel(''), 3500);
    }
  };

  const handlePublish = useCallback(async (id) => {
    const item = await adminService.publishContent(id);
    setAllContent((current) => mergeContentItem(current, item));
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);

  const handleUnpublish = useCallback(async (id) => {
    const item = await adminService.unpublishContent(id);
    setAllContent((current) => mergeContentItem(current, item));
    loadAuxiliaryData();
  }, [loadAuxiliaryData]);

  const flushDelete = useCallback(async (id) => {
    try {
      setError('');
      await adminService.deleteContent(id);
      setScanStateLabel('Content deleted.');
      setAllContent((current) => current.filter((item) => item.id !== Number(id)));
      setPagination((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      loadAuxiliaryData();
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete content.');
    }
  }, [loadAuxiliaryData]);

  const handleDelete = (id) => {
    const target = allContent.find((item) => item.id === Number(id));
    if (!target) {
      return;
    }
    if (pendingDelete?.timer) {
      clearTimeout(pendingDelete.timer);
    }
    setPendingDelete({
      id: target.id,
      title: target.title,
      timer: setTimeout(() => {
        flushDelete(target.id);
        setPendingDelete(null);
      }, 5000),
    });
    setDeleteTarget(null);
    setScanStateLabel(`"${target.title}" will be deleted in 5s.`);
  };

  const handleBulkDelete = async () => {
    if (!selectedContentIds.length) {
      return;
    }

    try {
      setBulkDeleteLoading(true);
      setError('');
      const deletedIds = [...selectedContentIds];
      await Promise.all(deletedIds.map((id) => adminService.deleteContent(id)));
      setSelectedContentIds([]);
      setScanStateLabel(`Deleted ${deletedIds.length} content item${deletedIds.length > 1 ? 's' : ''}.`);
      setAllContent((current) => current.filter((item) => !deletedIds.includes(item.id)));
      setPagination((current) => ({ ...current, total: Math.max(0, current.total - deletedIds.length) }));
      loadAuxiliaryData();
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete selected content.');
    } finally {
      setBulkDeleteLoading(false);
      setDeleteTarget(null);
      setTimeout(() => setScanStateLabel(''), 4000);
    }
  };

  const undoPendingDelete = () => {
    if (!pendingDelete) {
      return;
    }
    clearTimeout(pendingDelete.timer);
    setPendingDelete(null);
    setScanStateLabel('Delete cancelled.');
  };

  useEffect(() => () => {
    if (pendingDelete?.timer) {
      clearTimeout(pendingDelete.timer);
    }
  }, [pendingDelete]);

  const handleDuplicateCleanup = async () => {
    try {
      setDuplicateCleanupLoading(true);
      setError('');
      const response = await adminService.runDuplicateCleanup();
      setScanStateLabel(`Duplicate cleanup finished. Deleted ${response?.deletedCount || 0} exact duplicates.`);
      await Promise.all([loadContentData(), loadAuxiliaryData()]);
    } catch (cleanupError) {
      setError(cleanupError.message || 'Duplicate cleanup failed.');
    } finally {
      setDuplicateCleanupLoading(false);
      setTimeout(() => setScanStateLabel(''), 5000);
    }
  };


  const handleVacuumDatabase = async () => {
    try {
      setVacuumLoading(true);
      setError('');
      setScanStateLabel('Running database maintenance...');
      const res = await adminService.runVacuum();
      setScanStateLabel(res?.success ? 'Database maintenance completed successfully.' : 'Maintenance failed.');
      await loadAuxiliaryData();
    } catch (e) {
      setError(e.message || 'Failed to run database maintenance.');
      setScanStateLabel('');
    } finally {
      setVacuumLoading(false);
      setTimeout(() => setScanStateLabel(''), 4000);
    }
  };

  const handlePruneCatalog = async () => {
    try {
      setPruneLoading(true);
      setError('');
      const response = await adminService.pruneCatalog();
      setScanStateLabel(`Catalog pruned. Removed ${response?.deletedCount || 0} garbage/missing items.`);
      await Promise.all([loadContentData(), loadAuxiliaryData()]);
    } catch (pruneError) {
      setError(pruneError.message || 'Pruning failed.');
    } finally {
      setPruneLoading(false);
      setTimeout(() => setScanStateLabel(''), 5000);
    }
  };

  const handleBulkOrganize = async () => {
    if (!selectedContentIds.length) {
      return;
    }

    try {
      setBulkUpdateLoading(true);
      setError('');
      const changes = {};

      if (bulkEditor.collection.trim()) {
        changes.collection = bulkEditor.collection.trim();
      }
      if (bulkEditor.tags.trim()) {
        changes.tags = bulkEditor.tags;
      }
      if (bulkEditor.adminNotes.trim()) {
        changes.adminNotes = bulkEditor.adminNotes.trim();
      }
      if (bulkEditor.featuredOrder !== '') {
        changes.featuredOrder = Number(bulkEditor.featuredOrder) || 0;
      }

      if (!Object.keys(changes).length) {
        setError('Add at least one bulk organization value.');
        return;
      }

      const response = await adminService.bulkUpdateContent(selectedContentIds, changes);
      setScanStateLabel(`Organized ${response?.updatedCount || selectedContentIds.length} items.`);
      setBulkEditor({ collection: '', tags: '', adminNotes: '', featuredOrder: '' });
      if (Array.isArray(response?.items) && response.items.length) {
        setAllContent((current) => current.map((item) => (
          response.items.find((updatedItem) => updatedItem.id === item.id) || item
        )));
      }
      await loadAuxiliaryData();
    } catch (bulkError) {
      setError(bulkError.message || 'Bulk organize failed.');
    } finally {
      setBulkUpdateLoading(false);
      setTimeout(() => setScanStateLabel(''), 4000);
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (!selectedContentIds.length) {
      return;
    }

    try {
      setBulkStatusLoading(true);
      setError('');
      const action = status === 'published' ? adminService.publishContent : adminService.unpublishContent;
      const updatedItems = await Promise.all(selectedContentIds.map((id) => action(id)));
      setAllContent((current) => current.map((item) => (
        updatedItems.find((updatedItem) => updatedItem.id === item.id) || item
      )));
      setScanStateLabel(`${status === 'published' ? 'Published' : 'Unpublished'} ${updatedItems.length} selected items.`);
      await loadAuxiliaryData();
    } catch (bulkError) {
      setError(bulkError.message || 'Bulk status update failed.');
    } finally {
      setBulkStatusLoading(false);
      setTimeout(() => setScanStateLabel(''), 4000);
    }
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim() || `Preset ${savedPresets.length + 1}`;
    const nextPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      filters,
    };
    setSavedPresets((current) => [nextPreset, ...current].slice(0, 12));
    setPresetName('');
  };

  const applyPreset = (preset) => {
    setFilters({ ...preset.filters });
    setSearchInput(preset.filters.search || '');
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const removePreset = (presetId) => {
    setSavedPresets((current) => current.filter((preset) => preset.id !== presetId));
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns((current) => ({ ...current, [columnKey]: !current[columnKey] }));
  };

  const exportVisibleContentCsv = () => {
    if (!allContent.length) {
      setError('No visible content to export.');
      return;
    }

    const header = ['id', 'title', 'type', 'status', 'sourceType', 'language', 'category', 'collection', 'year', 'metadataStatus', 'metadataConfidence', 'duplicateCount'];
    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const rows = allContent.map((item) => ([
      item.id,
      item.title,
      item.type,
      item.status,
      item.sourceType,
      item.language,
      item.category,
      item.collection,
      item.year,
      item.metadataStatus,
      item.metadataConfidence,
      item.duplicateCount,
    ].map(escapeCsv).join(',')));
    const csv = `${header.join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-library-${sectionType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit));
  const pageWindow = useMemo(() => {
    const start = Math.max(1, pagination.page - 2);
    const end = Math.min(totalPages, start + 4);
    const normalizedStart = Math.max(1, end - 4);
    return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index);
  }, [pagination.page, totalPages]);

  useEffect(() => {
    setPageInput(String(pagination.page));
  }, [pagination.page]);

  const goToPage = (page) => {
    const nextPage = Math.min(totalPages, Math.max(1, Number(page) || 1));
    startTransition(() => {
      setPagination((current) => ({ ...current, page: nextPage }));
    });
  };

  useEffect(() => {
    function onKeyDown(event) {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
        return;
      }
      if (selectedContentIds.length !== 1) {
        return;
      }
      const selectedId = selectedContentIds[0];
      const selectedItem = allContent.find((item) => item.id === selectedId);
      if (!selectedItem) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'p') {
        event.preventDefault();
        handlePublish(selectedId);
      } else if (key === 'u') {
        event.preventDefault();
        handleUnpublish(selectedId);
      } else if (key === 'e') {
        event.preventDefault();
        navigate(`/admin/content/${selectedId}/edit`);
      } else if (event.key === 'Delete') {
        event.preventDefault();
        setDeleteTarget({ mode: 'single', id: selectedId, title: selectedItem.title });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allContent, handlePublish, handleUnpublish, navigate, selectedContentIds]);

  return (
    <div style={styles.page}>
      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle2}>{pageTitle}</h2>
          <div style={styles.pageHeaderMeta}>
            <span>{pagination.total} total</span>
            <span style={styles.metaDot}>·</span>
            <span>{contentMetrics.published} published</span>
            <span style={styles.metaDot}>·</span>
            <span>{contentMetrics.drafts} drafts</span>
            {contentMetrics.duplicateRisk > 0 && (
              <><span style={styles.metaDot}>·</span><span style={styles.warnText}>{contentMetrics.duplicateRisk} duplicates</span></>
            )}
            {currentJob?.status === 'running' && (
              <><span style={styles.metaDot}>·</span><span style={styles.scanningLabel}>● Scanning...</span></>
            )}
          </div>
        </div>
        <div style={styles.pageHeaderActions}>
          <Link to="/admin/content/new" style={styles.addBtn2}>+ Add Content</Link>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {scanStateLabel ? <div style={styles.infoBox}>{scanStateLabel}</div> : null}
      {pendingDelete ? (
        <div style={styles.undoToast}>
          <span>Deleting "{pendingDelete.title}"...</span>
          <button type="button" onClick={undoPendingDelete} style={styles.undoBtn}>Undo</button>
        </div>
      ) : null}

      {/* ── Tab bar ── */}
      <div style={styles.tabBar}>
        <button type="button" onClick={() => setActiveTab('content')} style={{ ...styles.tabBtn, ...(activeTab === 'content' ? styles.tabBtnActive : {}) }}>
          Content
          <span style={{ ...styles.tabCount, ...(activeTab === 'content' ? styles.tabCountActive : {}) }}>{pagination.total}</span>
        </button>
        <button type="button" onClick={() => setActiveTab('scanner')} style={{ ...styles.tabBtn, ...(activeTab === 'scanner' ? styles.tabBtnActive : {}) }}>
          Scanner
          {drafts.length > 0 && <span style={{ ...styles.tabCount, ...(activeTab === 'scanner' ? styles.tabCountActive : {}) }}>{drafts.length}</span>}
        </button>
        <button type="button" onClick={() => setActiveTab('tools')} style={{ ...styles.tabBtn, ...(activeTab === 'tools' ? styles.tabBtnActive : {}) }}>
          Tools
        </button>
      </div>

      {/* ══ SCANNER TAB ══════════════════════════════════════════════════════ */}
      {activeTab === 'scanner' && (
        <>
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <span style={styles.sectionEyebrow}>Live Scan</span>
                <h3 style={styles.sectionTitle}>Scanner Progress</h3>
              </div>
              <div style={styles.catalogTools}>
                <span style={styles.summaryPill}>{currentJob?.status || 'idle'}</span>
                <span style={styles.summaryPill}>Roots {scannerProgress.rootsScanned}/{scannerProgress.rootsRequested}</span>
                <span style={styles.summaryPill}>Added {scannerProgress.created}</span>
              </div>
            </div>

            {currentJob?.status ? (
              <div style={{ ...styles.liveScanLayout, ...(isMobile || isTablet ? styles.topologyGridMobile : {}) }}>
                <div style={styles.liveScanCard}>
                  <div style={styles.healthRow}>
                    <strong style={styles.rootName}>
                      {currentJob?.status === 'running' ? 'Scan in progress' : `Scan ${currentJob?.status}`}
                    </strong>
                    <span style={styles.metaInline}>{Math.round(scannerProgress.percent)}%</span>
                  </div>
                  <ProgressBar value={scannerProgress.percent} max={100} size="large" color="#38bdf8" />
                  <div style={styles.liveStatsGrid}>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Checked</span>
                      <strong style={styles.metricValue}>{scannerProgress.processed}/{scannerProgress.totalCandidates || '-'}</strong>
                    </div>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Added</span>
                      <strong style={styles.metricValue}>{scannerProgress.created}</strong>
                    </div>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Updated</span>
                      <strong style={styles.metricValue}>{scannerProgress.updated}</strong>
                    </div>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Unchanged</span>
                      <strong style={styles.metricValue}>{scannerProgress.unchanged}</strong>
                    </div>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Deleted</span>
                      <strong style={styles.metricValue}>{scannerProgress.deleted}</strong>
                    </div>
                    <div style={styles.liveStatBox}>
                      <span style={styles.metricLabel}>Duplicates</span>
                      <strong style={styles.metricValue}>{scannerProgress.duplicateDrafts}</strong>
                    </div>
                  </div>
                  <div style={styles.heroMeta}>
                    <span>Active root: {scannerProgress.activeRoot?.label || 'Waiting for next root'}</span>
                    <span>
                      Wait guidance: {currentJob?.status === 'running'
                        ? (scannerProgress.etaMs
                          ? `around ${formatDuration(scannerProgress.etaMs)} left`
                          : 'still estimating, wait 1-2 more minutes for a stable ETA')
                        : 'scanner is not running'}
                    </span>
                    <span>
                      Elapsed: {formatDuration(scannerProgress.elapsedMs)} | Last activity: {formatWhen(currentJob?.updatedAt || currentJob?.startedAt)}
                    </span>
                  </div>
                </div>

                <div style={styles.liveRootList}>
                  {scannerProgress.rootResults.map((root) => {
                    const rootPercent = Number(root.totalCandidates || 0) > 0
                      ? Math.min(100, Math.max(0, (Number(root.processed || 0) / Number(root.totalCandidates || 1)) * 100))
                      : (root.status === 'completed' ? 100 : 0);

                    return (
                      <div key={root.id} style={styles.liveRootCard}>
                        <div style={styles.healthRow}>
                          <strong style={styles.rootName}>{root.label || root.id}</strong>
                          <span style={styles.metaInline}>{root.status || 'pending'}</span>
                        </div>
                        <ProgressBar value={rootPercent} max={100} size="small" color="#22c55e" />
                        <span style={styles.metaLine}>
                          {root.processed || 0}/{root.totalCandidates || 0} folders | +{root.created || 0} added | {root.updated || 0} updated
                        </span>
                        <span style={styles.metaLine}>
                          {root.unchanged || 0} unchanged | {root.deleted || 0} deleted | {root.duplicateDrafts || 0} dup draft
                        </span>
                        {Array.isArray(root.errors) && root.errors.length ? (
                          <span style={styles.warnText}>{root.errors[0]}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={styles.empty}>
                No active scanner job. Start a scan to see live progress, added items, and remaining work.
              </div>
            )}
          </section>

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <span style={styles.sectionEyebrow}>Scanner</span>
                <h3 style={styles.sectionTitle}>Source Roots</h3>
              </div>
              <div style={styles.catalogTools}>
                <span style={styles.summaryPill}>Select folders before scanning</span>
                <button type="button" onClick={selectAllRoots} style={styles.secondaryMiniBtn}>Select All</button>
                <button type="button" onClick={clearRootSelection} style={styles.secondaryMiniBtn}>Clear</button>
              </div>
            </div>
            <div style={styles.rootGrid}>
              {auxLoading && !roots.length ? (
                <div style={styles.empty}>Loading scanner roots...</div>
              ) : null}
              {roots.map((root) => {
                const active = selectedRootIds.includes(root.id);
                return (
                  <button
                    key={root.id}
                    type="button"
                    onClick={() => toggleRoot(root.id)}
                    style={{
                      ...styles.rootCard,
                      ...(active ? styles.rootCardActive : {}),
                      ...((root.checkable !== false && !root.exists) ? styles.rootCardBroken : {}),
                    }}
                  >
                    <div style={styles.rootHeader}>
                      <strong style={styles.rootName}>{root.label || root.id}</strong>
                      <span style={{ ...styles.statusDot, ...(active ? styles.statusDotActive : {}) }} />
                    </div>
                    <span style={styles.pathCell}>{root.scanPath || root.path}</span>
                    <span style={styles.metaLine}>
                      {root.type || 'media'} | {root.language || 'Unknown'} | {root.category || 'Uncategorized'}
                    </span>
                    <span style={styles.metaLine}>
                      Depth {root.maxDepth ?? '-'} | Batch {root.batchSize ?? '-'} | Candidates {root.estimatedCandidates ?? '-'}
                    </span>
                    <div style={styles.rootFooter}>
                      <span style={(root.checkable === false || root.exists) ? styles.okText : styles.warnText}>
                        {root.pathStatusLabel || (root.exists ? 'Available' : 'Missing')}
                      </span>
                      <span style={styles.rootToggle}>{active ? 'Selected' : 'Click to select'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div style={{ ...styles.topologyGrid, ...(isMobile || isTablet ? styles.topologyGridMobile : {}) }}>
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <span style={styles.sectionEyebrow}>Review Queue</span>
                  <h3 style={styles.sectionTitle}>Scanner Drafts</h3>
                </div>
                <span style={styles.summaryPill}>{drafts.length} draft items</span>
              </div>
              <div style={styles.draftGrid}>
                {auxLoading && !drafts.length ? (
                  <div style={styles.empty}>Loading scanner drafts...</div>
                ) : null}
                {spotlightDrafts.length ? spotlightDrafts.map((item) => (
                  <article key={item.id} style={{ ...styles.draftCard, ...(isMobile ? styles.draftCardMobile : {}) }}>
                    <div style={styles.draftVisual}>
                      <ContentPoster
                        src={resolvePosterSource(item)}
                        alt={item.title}
                        style={styles.posterPreview}
                        variant="preview"
                        fallbackText="No Poster"
                      />
                    </div>
                    <div style={styles.draftBody}>
                      <div style={styles.draftTop}>
                        <strong style={styles.itemTitle}>{item.title}</strong>
                        {Number(item.duplicateCount || 0) > 0 ? (
                          <span style={styles.duplicateBadge}>{item.duplicateCount} dup</span>
                        ) : null}
                      </div>
                      <span style={styles.metaLine}>{item.type} | {item.category || '-'} | {item.year || 'N/A'}</span>
                      <span style={styles.metaLine}>{item.language || 'Unknown'} | {item.sourceType}</span>
                      <span style={styles.metaLine}>Metadata: {item.metadataStatus || 'pending'} ({item.metadataConfidence || 0}%)</span>
                      <div style={styles.actionRow}>
                        <Link to={`/admin/content/${item.id}/edit`} style={styles.secondaryMiniBtn}>Review</Link>
                        <button type="button" onClick={() => handlePublish(item.id)} style={styles.publishBtn}>Publish</button>
                        <Link to={`/watch/${item.id}`} style={styles.secondaryMiniBtn}>Play</Link>
                      </div>
                    </div>
                  </article>
                )) : (
                  <div style={styles.empty}>No draft content is waiting right now.</div>
                )}
              </div>
            </section>

            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <span style={styles.sectionEyebrow}>Quality Control</span>
                  <h3 style={styles.sectionTitle}>Health And Duplicates</h3>
                </div>
              </div>
              <div style={styles.healthList}>
                <div style={styles.healthCard}>
                  <div style={styles.healthRow}>
                    <strong>Scanner Health</strong>
                    <span style={styles.metaInline}>
                      {healthSummary.healthyRoots} healthy / {healthSummary.brokenRoots} broken / {healthSummary.remoteRoots} remote
                    </span>
                  </div>
                  <span style={styles.metaLine}>Current job: {currentJob?.status || 'idle'}</span>
                </div>
                <div style={styles.healthCard}>
                  <div style={styles.healthRow}>
                    <strong>Database Health</strong>
                    <span style={styles.metaInline}>{dbHealth?.databaseSize || '...'}</span>
                  </div>
                  <span style={styles.metaLine}>
                    Pool: total {dbHealth?.pool?.total ?? '-'} | idle {dbHealth?.pool?.idle ?? '-'} | waiting {dbHealth?.pool?.waiting ?? '-'}
                  </span>
                </div>
                <div style={styles.healthCard}>
                  <div style={styles.healthRow}>
                    <strong>Duplicate Review</strong>
                    <span style={styles.metaInline}>{duplicateStats.totalItems} items</span>
                  </div>
                  <span style={styles.metaLine}>
                    Exact: {duplicateStats.exactDuplicates} | Pending review: {duplicateStats.pendingReview}
                  </span>
                </div>
              </div>

              <div style={styles.duplicateShelf}>
                {auxLoading && !duplicateHighlights.length ? (
                  <div style={styles.empty}>Loading duplicate review...</div>
                ) : null}
                {duplicateHighlights.length ? duplicateHighlights.map((entry, index) => (
                  <div key={entry.id || entry.titleKey || index} style={styles.duplicateShelfCard}>
                    <strong>{entry.title || entry.titleKey || `Duplicate Group ${index + 1}`}</strong>
                    <span style={styles.metaLine}>
                      {(entry.items || entry.matches || []).length || entry.count || 0} possible matches
                    </span>
                    <span style={styles.metaLine}>
                      {(entry.items || entry.matches || []).slice(0, 3).map((item) => item.title || item.originalTitle).filter(Boolean).join(', ') || 'Review in content table'}
                    </span>
                  </div>
                )) : (
                  <div style={styles.empty}>No duplicate groups reported.</div>
                )}
              </div>

              <div style={styles.logList}>
                {auxLoading && !logs.length ? (
                  <div style={styles.empty}>Loading recent scanner logs...</div>
                ) : null}
                {logs.map((log, index) => (
                  <div key={`${index}-${log.startedAt || log.endedAt || log.status}`} style={styles.logCard}>
                    <strong>{log.status || 'completed'}</strong>
                    <span style={styles.metaLine}>
                      {formatWhen(log.startedAt || log.endedAt)} | Added {log.createdCount || 0} | Updated {log.updatedCount || 0}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Scanner tab — run controls */}
          <div style={styles.scannerControls}>
            <button onClick={handleRunScanner} disabled={scanLoading || loading} style={styles.primaryBtn}>
              {scanLoading ? 'Scanning...' : `Run Scanner (${selectedRootIds.length || roots.length} roots)`}
            </button>
            <button onClick={handleStopScanner} disabled={scanLoading || currentJob?.status !== 'running'} style={styles.secondaryBtn}>
              Stop Scanner
            </button>
            <div style={styles.scannerMeta}>
              <span>Healthy: {healthSummary.healthyRoots}</span>
              <span>Broken: {healthSummary.brokenRoots}</span>
              <span>Last: {formatWhen(currentJob?.updatedAt || currentJob?.startedAt)}</span>
            </div>
          </div>
        </>)} {/* end scanner tab */}

      {/* ══ TOOLS TAB ════════════════════════════════════════════════════════ */}
      {activeTab === 'tools' && (
        <div style={styles.toolsGrid}>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Library Snapshot</h3>
            <div style={styles.metricsGrid}>
              <StatCard label="Total" value={contentMetrics.total} hint="all records" accent />
              <StatCard label="Published" value={contentMetrics.published} hint="live on portal" />
              <StatCard label="Drafts" value={contentMetrics.drafts} hint="pending review" />
              <StatCard label="Needs Review" value={contentMetrics.needsReview} hint="metadata issues" />
              <StatCard label="Scanner" value={contentMetrics.scanner} hint="imported" />
              <StatCard label="Manual" value={contentMetrics.manual} hint="created by editors" />
            </div>
          </section>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Maintenance</h3>
            <div style={styles.toolsActions}>
              <button onClick={handleDuplicateCleanup} disabled={duplicateCleanupLoading} style={styles.toolBtn}>
                {duplicateCleanupLoading ? 'Cleaning...' : 'Cleanup Duplicates'}
              </button>
              <button onClick={handlePruneCatalog} disabled={pruneLoading} style={styles.toolBtn}>
                {pruneLoading ? 'Pruning...' : 'Prune Catalog'}
              </button>
              <button onClick={handleVacuumDatabase} disabled={vacuumLoading} style={styles.toolBtn}>
                {vacuumLoading ? 'Optimizing...' : 'Optimize DB'}
              </button>
            </div>
            <div style={styles.healthList}>
              <div style={styles.healthCard}>
                <div style={styles.healthRow}><strong>Database</strong><span style={styles.metaInline}>{dbHealth?.databaseSize || '...'}</span></div>
                <span style={styles.metaLine}>Pool: {dbHealth?.pool?.total ?? '-'} total | {dbHealth?.pool?.idle ?? '-'} idle</span>
              </div>
              <div style={styles.healthCard}>
                <div style={styles.healthRow}><strong>Duplicates</strong><span style={styles.metaInline}>{duplicateStats.totalItems} items</span></div>
                <span style={styles.metaLine}>Exact: {duplicateStats.exactDuplicates} | Pending: {duplicateStats.pendingReview}</span>
              </div>
            </div>
          </section>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Collections & Tags</h3>
            <div style={styles.metricsGrid}>
              {(organization?.collections || []).slice(0, 4).map((entry) => (
                <StatCard key={`col-${entry.label}`} label={entry.label} value={entry.count} hint="in collection" />
              ))}
              {(organization?.tags || []).slice(0, 4).map((entry) => (
                <StatCard key={`tag-${entry.label}`} label={`#${entry.label}`} value={entry.count} hint="tagged" />
              ))}
            </div>
          </section>
        </div>
      )} {/* end tools tab */}

      {/* ══ CONTENT TAB ══════════════════════════════════════════════════════ */}
      {activeTab === 'content' && (
        <>
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <span style={styles.sectionEyebrow}>Filter And Manage</span>
                <h3 style={styles.sectionTitle}>Content Library</h3>
              </div>
              <div style={styles.catalogTools}>
                <span style={styles.summaryPill}>{pagination.total} total</span>
                <span style={styles.summaryPill}>{selectedContentIds.length} selected</span>
                <span style={styles.summaryPill}>{allContent.length} visible</span>
                {contentRefreshing && !loading ? <span style={styles.summaryPill}>Refreshing...</span> : null}
                <button type="button" onClick={exportVisibleContentCsv} style={styles.secondaryMiniBtn}>Export CSV</button>
              </div>
            </div>

            <div style={styles.filterGrid}>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Search</label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search title, genre, language, category..."
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Status</label>
                <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} style={styles.select}>
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Source</label>
                <select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)} style={styles.select}>
                  <option value="">All Sources</option>
                  <option value="scanner">Scanner</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Language</label>
                <select value={filters.language} onChange={(event) => updateFilter('language', event.target.value)} style={styles.select}>
                  <option value="">All Languages</option>
                  {filterOptions.languages.map((language) => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Category</label>
                <select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} style={styles.select}>
                  <option value="">All Categories</option>
                  {filterOptions.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Collection</label>
                <select value={filters.collection} onChange={(event) => updateFilter('collection', event.target.value)} style={styles.select}>
                  <option value="">All Collections</option>
                  {filterOptions.collections.map((collection) => (
                    <option key={collection} value={collection}>{collection}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Tag</label>
                <select value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)} style={styles.select}>
                  <option value="">All Tags</option>
                  {filterOptions.tags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.searchLabel}>Root</label>
                <select value={filters.sourceRootId} onChange={(event) => updateFilter('sourceRootId', event.target.value)} style={styles.select}>
                  <option value="">All Roots</option>
                  {roots.map((root) => (
                    <option key={root.id} value={root.id}>{root.label || root.id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.quickFilterBar}>
              <button type="button" onClick={() => updateFilter('duplicatesOnly', !filters.duplicatesOnly)} style={{ ...styles.quickChip, ...(filters.duplicatesOnly ? styles.quickChipActive : {}) }}>
                Duplicates Only
              </button>
              <button type="button" onClick={() => updateFilter('status', filters.status === 'draft' ? '' : 'draft')} style={{ ...styles.quickChip, ...(filters.status === 'draft' ? styles.quickChipActive : {}) }}>
                Drafts
              </button>
              <button type="button" onClick={() => updateFilter('status', filters.status === 'published' ? '' : 'published')} style={{ ...styles.quickChip, ...(filters.status === 'published' ? styles.quickChipActive : {}) }}>
                Published
              </button>
              <button type="button" onClick={() => updateFilter('source', filters.source === 'scanner' ? '' : 'scanner')} style={{ ...styles.quickChip, ...(filters.source === 'scanner' ? styles.quickChipActive : {}) }}>
                Scanner
              </button>
              <button type="button" onClick={() => updateFilter('source', filters.source === 'manual' ? '' : 'manual')} style={{ ...styles.quickChip, ...(filters.source === 'manual' ? styles.quickChipActive : {}) }}>
                Manual
              </button>
              <button type="button" onClick={() => updateFilter('collection', filters.collection === (organization?.collections?.[0]?.label || '') ? '' : (organization?.collections?.[0]?.label || ''))} style={{ ...styles.quickChip, ...(filters.collection && filters.collection === organization?.collections?.[0]?.label ? styles.quickChipActive : {}) }}>
                Top Collection
              </button>
              <button
                type="button"
                onClick={resetFilters}
                style={styles.quickChipClear}
              >
                Clear Filters
              </button>
            </div>

            <div style={styles.bulkBar}>
              <span style={styles.metaInline}>Saved Presets</span>
              <div style={styles.actionRow}>
                <input
                  type="text"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  placeholder="Preset name"
                  style={styles.bulkInput}
                />
                <button type="button" onClick={saveCurrentPreset} style={styles.secondaryMiniBtn}>Save Preset</button>
                {savedPresets.slice(0, 5).map((preset) => (
                  <div key={preset.id} style={styles.presetChipWrap}>
                    <button type="button" onClick={() => applyPreset(preset)} style={styles.quickChip}>{preset.name}</button>
                    <button type="button" onClick={() => removePreset(preset.id)} style={styles.presetDelete}>x</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.bulkBar}>
              <span style={styles.metaInline}>Visible Columns</span>
              <div style={styles.actionRow}>
                <button type="button" onClick={() => toggleColumn('status')} style={{ ...styles.quickChip, ...(visibleColumns.status ? styles.quickChipActive : {}) }}>Status</button>
                <button type="button" onClick={() => toggleColumn('metadata')} style={{ ...styles.quickChip, ...(visibleColumns.metadata ? styles.quickChipActive : {}) }}>Metadata</button>
                <button type="button" onClick={() => toggleColumn('source')} style={{ ...styles.quickChip, ...(visibleColumns.source ? styles.quickChipActive : {}) }}>Source</button>
                <button type="button" onClick={() => toggleColumn('actions')} style={{ ...styles.quickChip, ...(visibleColumns.actions ? styles.quickChipActive : {}) }}>Actions</button>
              </div>
            </div>

            <div style={styles.bulkBar}>
              <span style={styles.metaInline}>
                Page size
              </span>
              <div style={styles.actionRow}>
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => startTransition(() => setPagination((current) => ({ ...current, page: 1, limit: size })))}
                    style={{
                      ...styles.quickChip,
                      ...(pagination.limit === size ? styles.quickChipActive : {}),
                    }}
                  >
                    {size}
                  </button>
                ))}
                <button type="button" onClick={resetFilters} style={styles.secondaryMiniBtn}>Reset View</button>
              </div>
            </div>

            {selectedContentIds.length ? (
              <div style={styles.bulkBar}>
                <span style={styles.metaInline}>{selectedContentIds.length} items selected</span>
                <div style={styles.actionRow}>
                  <input
                    type="text"
                    value={bulkEditor.collection}
                    onChange={(event) => setBulkEditor((current) => ({ ...current, collection: event.target.value }))}
                    placeholder="Collection"
                    style={styles.bulkInput}
                  />
                  <input
                    type="text"
                    value={bulkEditor.tags}
                    onChange={(event) => setBulkEditor((current) => ({ ...current, tags: event.target.value }))}
                    placeholder="tags, comma separated"
                    style={styles.bulkInput}
                  />
                  <input
                    type="number"
                    value={bulkEditor.featuredOrder}
                    onChange={(event) => setBulkEditor((current) => ({ ...current, featuredOrder: event.target.value }))}
                    placeholder="Feature"
                    style={{ ...styles.bulkInput, width: '100px' }}
                  />
                  <button
                    type="button"
                    onClick={handleBulkOrganize}
                    disabled={bulkUpdateLoading || bulkStatusLoading}
                    style={styles.publishBtn}
                  >
                    {bulkUpdateLoading ? 'Organizing...' : 'Bulk Organize'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkStatusUpdate('published')}
                    disabled={bulkStatusLoading || bulkUpdateLoading}
                    style={styles.publishBtn}
                  >
                    {bulkStatusLoading ? 'Updating...' : 'Publish Selected'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkStatusUpdate('draft')}
                    disabled={bulkStatusLoading || bulkUpdateLoading}
                    style={styles.secondaryMiniBtn}
                  >
                    Unpublish Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ mode: 'bulk', count: selectedContentIds.length })}
                    disabled={bulkDeleteLoading || bulkStatusLoading}
                    style={styles.deleteBtn}
                  >
                    {bulkDeleteLoading ? 'Deleting...' : `Delete Selected (${selectedContentIds.length})`}
                  </button>
                </div>
              </div>
            ) : null}

            <div style={styles.tableWrap}>
              <table style={{ ...styles.table, ...(isMobile ? styles.tableMobile : isTablet ? styles.tableTablet : {}) }}>
                <thead>
                  <tr>
                    <th style={styles.thCheckbox}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                    </th>
                    <th style={styles.th}>Title</th>
                    {visibleColumns.status ? <th style={styles.th}>Status</th> : null}
                    {visibleColumns.metadata ? <th style={styles.th}>Metadata</th> : null}
                    {visibleColumns.source ? <th style={styles.th}>Source</th> : null}
                    {visibleColumns.actions ? <th style={styles.th}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2 + Number(visibleColumns.status) + Number(visibleColumns.metadata) + Number(visibleColumns.source) + Number(visibleColumns.actions)} style={styles.tableEmpty}>Loading first page...</td>
                    </tr>
                  ) : !allContent.length ? (
                    <tr>
                      <td colSpan={2 + Number(visibleColumns.status) + Number(visibleColumns.metadata) + Number(visibleColumns.source) + Number(visibleColumns.actions)} style={styles.tableEmpty}>
                        No content matched the current filters.
                        <div style={styles.actionRow}>
                          <button type="button" onClick={resetFilters} style={styles.secondaryMiniBtn}>Clear Filters</button>
                          <button type="button" onClick={() => startTransition(() => setPagination((current) => ({ ...current, page: 1 })))} style={styles.secondaryMiniBtn}>Back To Page 1</button>
                        </div>
                      </td>
                    </tr>
                  ) : allContent.map((item) => (
                    <tr key={item.id} style={styles.tableRow}>
                      <td style={styles.tdCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedContentIds.includes(item.id)}
                          onChange={() => toggleContentSelection(item.id)}
                        />
                      </td>
                      <td style={styles.td}>
                        <div style={styles.titleCell}>
                          <ContentPoster
                            src={resolvePosterSource(item)}
                            alt={item.title}
                            style={styles.tablePoster}
                            variant="table"
                            fallbackText="No Art"
                          />
                          <div>
                            <div style={styles.tableTitleRow}>
                              <strong style={styles.itemTitle}>{item.title}</strong>
                              {Number(item.duplicateCount || 0) > 0 ? (
                                <span style={styles.inlineDuplicateBadge}>{item.duplicateCount} dup</span>
                              ) : null}
                              {item.featured ? <span style={styles.inlineFeaturedBadge}>Featured</span> : null}
                              {item.collection ? <span style={styles.inlineCollectionBadge}>{item.collection}</span> : null}
                            </div>
                            <span style={styles.metaLine}>{item.type} | {item.category || '-'} | {item.year || 'N/A'}</span>
                            <span style={styles.metaLine}>{item.language || 'Unknown'} | {item.sourceRootLabel || item.sourceRootId || item.sourceType}</span>
                            {item.tags?.length ? <span style={styles.metaLine}>Tags: {toTagString(item.tags)}</span> : null}
                            {Array.isArray(item.duplicateCandidates) && item.duplicateCandidates.length ? (
                              <span style={styles.metaLine}>
                                Match: {item.duplicateCandidates.slice(0, 2).map((entry) => entry.title).join(', ')}
                              </span>
                            ) : null}
                            {item.sourcePath ? <span style={styles.pathCell}>{item.sourcePath}</span> : null}
                          </div>
                        </div>
                      </td>
                      {visibleColumns.status ? (
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...(item.status === 'published' ? styles.statusPublished : styles.statusDraft),
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                      ) : null}
                      {visibleColumns.metadata ? (
                        <td style={styles.td}>
                          <div style={{ ...styles.signalPill, ...getMetadataTone(item) }}>
                            {item.metadataStatus || 'pending'}
                          </div>
                          <span style={styles.metaLine}>{item.metadataConfidence || 0}% confidence</span>
                          <span style={styles.metaLine}>Updated: {formatWhen(item.metadataUpdatedAt || item.updatedAt)}</span>
                        </td>
                      ) : null}
                      {visibleColumns.source ? (
                        <td style={styles.td}>
                          <span style={styles.metaLine}>Type: {item.sourceType || '-'}</span>
                          <span style={styles.metaLine}>Trending: {item.trendingScore || 0}</span>
                          <span style={styles.metaLine}>Duplicates: {item.duplicateCount || 0}</span>
                          {item.featuredOrder ? <span style={styles.metaLine}>Feature Slot: {item.featuredOrder}</span> : null}
                          {item.adminNotes ? <span style={styles.metaLine}>Note: {item.adminNotes}</span> : null}
                        </td>
                      ) : null}
                      {visibleColumns.actions ? (
                        <td style={styles.td}>
                          <div style={styles.actionRow}>
                            {item.videoUrl ? <Link to={`/watch/${item.id}`} style={styles.secondaryMiniBtn}>Play</Link> : null}
                            <Link to={`/admin/content/${item.id}/edit`} style={styles.secondaryMiniBtn}>Edit</Link>
                            {item.status === 'published' ? (
                              <button type="button" onClick={() => handleUnpublish(item.id)} style={styles.secondaryMiniBtn}>Unpublish</button>
                            ) : (
                              <button type="button" onClick={() => handlePublish(item.id)} style={styles.publishBtn}>Publish</button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ mode: 'single', id: item.id, title: item.title })}
                              style={styles.deleteBtn}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.paginationSection}>
            <div style={styles.paginationControls}>
              <span style={styles.paginationInfo}>
                Page {pagination.page} of {totalPages} | Showing {allContent.length} of {pagination.total}
              </span>
              <div style={styles.paginationButtons}>
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1 || contentRefreshing}
                  style={styles.paginationBtn}
                >
                  Previous
                </button>
                {pageWindow.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => goToPage(pageNumber)}
                    disabled={contentRefreshing}
                    style={{
                      ...styles.paginationBtn,
                      ...(pageNumber === pagination.page ? styles.paginationBtnActive : {}),
                    }}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= totalPages || contentRefreshing}
                  style={styles.paginationBtn}
                >
                  Next
                </button>
                <div style={styles.pageJumpGroup}>
                  <span style={styles.paginationInfo}>Go to</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        goToPage(pageInput);
                      }
                    }}
                    style={styles.pageJumpInput}
                  />
                  <button
                    type="button"
                    onClick={() => goToPage(pageInput)}
                    disabled={contentRefreshing}
                    style={styles.paginationBtn}
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>)} {/* end content tab */}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => (deleteTarget?.mode === 'bulk' ? handleBulkDelete() : handleDelete(deleteTarget?.id))}
        title={deleteTarget?.mode === 'bulk' ? 'Delete selected content?' : 'Delete this content?'}
        message={deleteTarget?.mode === 'bulk'
          ? `${deleteTarget?.count || 0} selected items will be permanently removed from the portal catalog. This action cannot be undone.`
          : `"${deleteTarget?.title || 'This item'}" will be permanently removed from the portal catalog. This action cannot be undone.`}
        confirmText={deleteTarget?.mode === 'bulk' ? 'Delete Selected' : 'Delete Permanently'}
        cancelText="Keep Content"
      />
    </div>
  );
}

const panelBg = '#111318';
const ACCENT = '#6366f1';
const ACCENT_LIGHT = 'rgba(99,102,241,0.1)';
const ACCENT_BORDER = 'rgba(99,102,241,0.25)';
const SURFACE2 = '#181b22';
const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';

const styles = {
  page: { display: 'grid', gap: '14px' },

  // ── Page header ──────────────────────────────────────────────────────────
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  pageTitle2: { fontSize: '1.1rem', fontWeight: '700', color: TEXT, margin: 0 },
  pageHeaderMeta: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: TEXT2, marginTop: '4px', flexWrap: 'wrap' },
  metaDot: { color: TEXT3 },
  scanningLabel: { color: '#4ade80', fontWeight: '600' },
  pageHeaderActions: { display: 'flex', gap: '8px', flexShrink: 0 },
  addBtn2: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: ACCENT, color: '#fff', fontSize: '0.82rem', fontWeight: '600', textDecoration: 'none' },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    display: 'flex',
    gap: '2px',
    borderBottom: `1px solid ${BORDER}`,
    paddingBottom: '0',
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '8px 8px 0 0',
    background: 'transparent',
    color: TEXT2,
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
  },
  tabBtnActive: {
    color: TEXT,
    fontWeight: '600',
    borderBottomColor: ACCENT,
    background: ACCENT_LIGHT,
  },
  tabCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    borderRadius: '10px',
    background: SURFACE2,
    color: TEXT2,
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  tabCountActive: { background: ACCENT, color: '#fff' },

  // ── Scanner controls ──────────────────────────────────────────────────────
  scannerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '8px',
    background: SURFACE2,
    border: `1px solid ${BORDER}`,
    flexWrap: 'wrap',
  },
  scannerMeta: { display: 'flex', gap: '12px', color: TEXT3, fontSize: '0.78rem', marginLeft: 'auto', flexWrap: 'wrap' },

  // ── Tools tab ─────────────────────────────────────────────────────────────
  toolsGrid: { display: 'grid', gap: '14px' },
  toolsActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  toolBtn: { padding: '9px 14px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' },

  // ── Legacy hero (kept for compatibility) ──────────────────────────────────
  hero: {
    padding: '16px',
    borderRadius: '10px',
    background: SURFACE2,
    border: `1px solid ${BORDER}`,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
    gap: '16px',
  },
  heroTablet: { gridTemplateColumns: '1fr' },
  heroMobile: { padding: '16px', gridTemplateColumns: '1fr' },
  heroCopy: { display: 'grid', gap: '10px' },
  eyebrow: { display: 'inline-block', color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.7rem', fontWeight: '700' },
  title: { color: TEXT, fontSize: '1.4rem', fontWeight: '700', margin: 0 },
  subtitle: { maxWidth: '70ch', lineHeight: '1.7', color: TEXT2, fontSize: '0.85rem' },
  heroBadgeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  heroBadge: { padding: '5px 10px', borderRadius: '6px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, fontSize: '0.78rem', fontWeight: '600' },
  heroPanel: { display: 'grid', gap: '10px', padding: '14px', borderRadius: '10px', background: '#0a0c10', border: `1px solid ${BORDER}`, alignContent: 'start' },
  liveBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', width: 'fit-content', padding: '5px 10px', borderRadius: '6px', background: ACCENT_LIGHT, color: ACCENT, fontSize: '0.75rem', fontWeight: '600' },
  liveDot: { width: '7px', height: '7px', borderRadius: '50%', background: 'currentColor' },
  heroActionStack: { display: 'grid', gap: '6px' },
  heroMeta: { display: 'grid', gap: '3px', color: TEXT3, fontSize: '0.78rem' },
  primaryBtn: { padding: '9px 14px', borderRadius: '8px', background: ACCENT, color: '#fff', fontWeight: '600', fontSize: '0.85rem', textAlign: 'center', border: 'none', cursor: 'pointer' },
  secondaryBtn: { padding: '9px 14px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, fontWeight: '600', fontSize: '0.85rem', textAlign: 'center', cursor: 'pointer' },
  ghostBtn: { padding: '9px 14px', borderRadius: '8px', background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontWeight: '600', fontSize: '0.85rem', textAlign: 'center', textDecoration: 'none' },
  errorBox: { padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.85rem' },
  infoBox: { padding: '12px 16px', borderRadius: '8px', background: 'rgba(56,189,248,0.08)', color: '#7dd3fc', border: '1px solid rgba(56,189,248,0.18)', fontSize: '0.85rem' },
  section: { padding: '16px', borderRadius: '10px', background: panelBg, border: `1px solid ${BORDER}`, display: 'grid', gap: '14px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  catalogTools: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  sectionEyebrow: { display: 'inline-block', marginBottom: '4px', color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.68rem', fontWeight: '700' },
  sectionTitle: { color: TEXT, fontSize: '0.95rem', fontWeight: '600', margin: 0 },
  summaryPill: { padding: '4px 10px', borderRadius: '6px', background: SURFACE2, color: TEXT2, fontSize: '0.75rem', fontWeight: '600', border: `1px solid ${BORDER}` },
  liveScanLayout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: '12px' },
  liveScanCard: { padding: '14px', borderRadius: '10px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '12px' },
  liveStatsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' },
  liveStatBox: { padding: '10px', borderRadius: '8px', background: '#0a0c10', border: `1px solid ${BORDER}`, display: 'grid', gap: '4px' },
  liveRootList: { display: 'grid', gap: '8px' },
  liveRootCard: { padding: '10px 12px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '6px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' },
  metricCard: { padding: '12px 14px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '4px' },
  metricCardAccent: { padding: '12px 14px', borderRadius: '8px', background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, display: 'grid', gap: '4px' },
  metricLabel: { color: TEXT3, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' },
  metricValue: { color: TEXT, fontSize: '1.3rem', fontWeight: '700' },
  metricHint: { color: TEXT3, fontSize: '0.75rem' },
  rootGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' },
  rootCard: { padding: '12px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, display: 'grid', gap: '6px', textAlign: 'left', cursor: 'pointer' },
  rootCardActive: { background: 'linear-gradient(135deg, rgba(0,240,181,0.14), rgba(125,249,255,0.1))', color: 'var(--text-primary)', borderColor: 'rgba(125,249,255,0.18)' },
  rootCardBroken: { borderColor: 'rgba(255, 90, 95, 0.35)' },
  rootHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  rootName: { color: 'var(--text-primary)' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', background: TEXT3, flexShrink: 0 },
  statusDotActive: { background: ACCENT },
  rootFooter: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  rootToggle: { color: TEXT3, fontSize: '0.72rem' },
  okText: { color: '#4ade80', fontSize: '0.75rem' },
  warnText: { color: '#f87171', fontSize: '0.75rem' },
  topologyGrid: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' },
  topologyGridMobile: { gridTemplateColumns: '1fr' },
  draftGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' },
  draftCard: { display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', gap: '10px', padding: '10px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}` },
  draftCardMobile: { gridTemplateColumns: '1fr' },
  draftVisual: { display: 'flex', alignItems: 'start' },
  posterPreview: { width: '64px', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: '6px' },
  posterPlaceholder: { width: '64px', aspectRatio: '2 / 3', borderRadius: '6px', background: '#0a0c10', display: 'grid', placeItems: 'center', color: TEXT3, fontSize: '0.68rem' },
  draftBody: { display: 'grid', gap: '4px' },
  draftTop: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'start' },
  itemTitle: { display: 'block', color: TEXT, fontSize: '0.85rem', fontWeight: '600' },
  metaLine: { display: 'block', color: TEXT3, fontSize: '0.78rem', marginTop: '2px' },
  pathCell: { fontSize: '0.72rem', color: TEXT3, wordBreak: 'break-all' },
  duplicateBadge: { padding: '3px 7px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: '0.68rem', fontWeight: '700' },
  healthList: { display: 'grid', gap: '8px' },
  healthCard: { padding: '10px 12px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '4px' },
  healthRow: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' },
  metaInline: { color: TEXT3, fontSize: '0.8rem' },
  duplicateShelf: { display: 'grid', gap: '8px' },
  duplicateShelfCard: { padding: '10px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)', display: 'grid', gap: '4px' },
  logList: { display: 'grid', gap: '8px' },
  logCard: { padding: '10px 12px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '4px' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' },
  field: { display: 'grid', gap: '6px' },
  searchLabel: { color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem', fontWeight: '600' },
  input: { padding: '9px 12px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, fontSize: '0.875rem', width: '100%' },
  select: { padding: '9px 12px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, fontSize: '0.875rem', width: '100%' },
  quickFilterBar: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  quickChip: { padding: '6px 12px', borderRadius: '6px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
  quickChipActive: { background: ACCENT_LIGHT, color: TEXT, borderColor: ACCENT_BORDER },
  quickChipClear: { padding: '6px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
  bulkBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, flexWrap: 'wrap' },
  bulkInput: { padding: '7px 10px', background: '#0a0c10', border: `1px solid ${BORDER}`, borderRadius: '6px', color: TEXT, fontSize: '0.82rem', minWidth: '130px' },
  tableWrap: { overflowX: 'auto', maxHeight: '72vh', overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '1040px' },
  tableTablet: { minWidth: '880px' },
  tableMobile: { minWidth: '760px' },
  th: { position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.7rem', fontWeight: '600', padding: '8px 12px', background: '#0e1015', borderBottom: `1px solid ${BORDER}` },
  thCheckbox: { position: 'sticky', top: 0, zIndex: 2, width: '36px', padding: '8px 8px 8px 12px', background: '#0e1015', borderBottom: `1px solid ${BORDER}` },
  tableRow: { background: 'transparent' },
  td: { padding: '11px 12px', borderBottom: `1px solid ${BORDER}`, verticalAlign: 'middle' },
  tdCheckbox: { padding: '11px 8px 11px 12px', borderBottom: `1px solid ${BORDER}`, width: '36px', verticalAlign: 'middle' },
  tableEmpty: { padding: '32px 12px', textAlign: 'center', color: TEXT3 },
  titleCell: { display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: '10px', alignItems: 'center' },
  tableTitleRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  tablePoster: { width: '44px', height: '62px', objectFit: 'cover', borderRadius: '6px' },
  tablePosterFallback: { width: '44px', height: '62px', borderRadius: '6px', background: SURFACE2, display: 'grid', placeItems: 'center', color: TEXT3, fontSize: '0.62rem' },
  inlineDuplicateBadge: { padding: '2px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: '0.68rem', fontWeight: '600' },
  inlineFeaturedBadge: { padding: '2px 6px', borderRadius: '4px', background: ACCENT_LIGHT, color: ACCENT, fontSize: '0.68rem', fontWeight: '600' },
  inlineCollectionBadge: { padding: '2px 6px', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#c084fc', fontSize: '0.68rem', fontWeight: '600' },
  signalPill: { width: 'fit-content', padding: '4px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', textTransform: 'capitalize' },
  toneSuccess: { background: 'rgba(34,197,94,0.1)', color: '#4ade80' },
  toneWarning: { background: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
  toneDanger: { background: 'rgba(239,68,68,0.1)', color: '#f87171' },
  toneNeutral: { background: SURFACE2, color: TEXT2 },
  actionRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  publishBtn: { padding: '6px 10px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#4ade80', fontWeight: '600', fontSize: '0.75rem', border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer' },
  secondaryMiniBtn: { padding: '6px 10px', borderRadius: '6px', background: SURFACE2, color: TEXT2, fontWeight: '600', fontSize: '0.75rem', textDecoration: 'none', border: `1px solid ${BORDER}`, cursor: 'pointer' },
  deleteBtn: { padding: '6px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: '600', fontSize: '0.75rem', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer' },
  statusPill: { padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', textTransform: 'capitalize', display: 'inline-flex' },
  statusPublished: { background: 'rgba(34,197,94,0.1)', color: '#4ade80' },
  statusDraft: { background: 'rgba(234,179,8,0.1)', color: '#facc15' },
  empty: { padding: '20px', borderRadius: '8px', background: SURFACE2, color: TEXT3, fontSize: '0.85rem' },
  paginationSection: { padding: '12px 16px', borderRadius: '8px', background: panelBg, border: `1px solid ${BORDER}` },
  paginationControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  paginationInfo: { color: TEXT2, fontSize: '0.8rem' },
  paginationButtons: { display: 'flex', alignItems: 'center', gap: '6px' },
  paginationBtn: { padding: '6px 12px', borderRadius: '6px', background: SURFACE2, border: `1px solid ${BORDER}`, color: TEXT2, fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' },
  paginationBtnActive: { background: ACCENT_LIGHT, borderColor: ACCENT_BORDER, color: TEXT },
  pageJumpGroup: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  pageJumpInput: { width: '64px', padding: '6px 10px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '6px', color: TEXT, fontSize: '0.82rem' },
  presetChipWrap: { display: 'inline-flex', alignItems: 'center', gap: '4px', background: SURFACE2, borderRadius: '6px', paddingRight: '4px', border: `1px solid ${BORDER}` },
  presetDelete: { width: '18px', height: '18px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: '700', fontSize: '0.68rem', lineHeight: 1, cursor: 'pointer' },
  undoToast: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.85rem' },
  undoBtn: { padding: '6px 12px', borderRadius: '6px', background: SURFACE2, color: TEXT, fontWeight: '600', fontSize: '0.78rem', border: `1px solid ${BORDER}`, cursor: 'pointer' },
};

export default ContentLibraryPage;
