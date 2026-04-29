import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { adminService } from '../../services';
import ConfirmDialog from '../../components/overlays/ConfirmDialog';
import { useBreakpoint } from '../../hooks';

const emptyForm = {
  title: '',
  type: 'movie',
  description: '',
  year: new Date().getFullYear(),
  genre: '',
  language: 'English',
  status: 'draft',
  poster: '',
  backdrop: '',
  videoUrl: '',
  category: '',
  collection: '',
  tags: '',
  adminNotes: '',
  editorialScore: 0,
  featuredOrder: 0,
  seasons: [],
};

function AddContentPage() {
  const { isMobile, isTablet } = useBreakpoint();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [loadingItem, setLoadingItem] = useState(isEditMode);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBackdrop, setUploadingBackdrop] = useState(false);
  const [tmdbIdInput, setTmdbIdInput] = useState('');
  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [tmdbPreview, setTmdbPreview] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [itemMeta, setItemMeta] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!isEditMode) {
      setItemMeta(null);
      setFormData(emptyForm);
      return;
    }

    const loadItem = async () => {
      try {
        setLoadingItem(true);
        setError('');
        const item = await adminService.getContentById(id);
        setItemMeta(item);
        setFormData({
          title: item.title || '',
          type: item.type || 'movie',
          description: item.description || '',
          year: item.year || '',
          genre: item.genre || '',
          language: item.language || 'English',
          status: item.status || 'draft',
          poster: item.poster || '',
          backdrop: item.backdrop || '',
          videoUrl: item.videoUrl || '',
          category: item.category || '',
          collection: item.collection || '',
          tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
          adminNotes: item.adminNotes || '',
          editorialScore: item.editorialScore || 0,
          featuredOrder: item.featuredOrder || 0,
          seasons: Array.isArray(item.seasons)
            ? item.seasons.map((season, seasonIndex) => ({
              ...season,
              id: season.id || seasonIndex + 1,
              number: season.number || season.id || seasonIndex + 1,
              title: season.title || '',
              episodes: Array.isArray(season.episodes)
                ? season.episodes.map((episode, episodeIndex) => ({
                  ...episode,
                  id: episode.id || episodeIndex + 1,
                  number: episode.number || episode.id || episodeIndex + 1,
                  title: episode.title || '',
                  description: episode.description || '',
                  videoUrl: episode.videoUrl || '',
                }))
                : [],
            }))
            : [],
        });
        setTmdbIdInput(item.tmdbId ? String(item.tmdbId) : '');
        setTmdbPreview(null);
      } catch (err) {
        setError(err.message || 'Failed to load content details.');
      } finally {
        setLoadingItem(false);
      }
    };

    loadItem();
  }, [id, isEditMode]);

  const duplicateCandidates = itemMeta?.duplicateCandidates || [];
  const completenessScore = useMemo(() => {
    const checks = [
      formData.title,
      formData.description,
      formData.genre,
      formData.poster,
      formData.backdrop,
      formData.videoUrl,
      formData.category,
      formData.language,
      formData.year,
    ];

    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [formData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSeasonChange = (seasonIndex, field, value) => {
    setFormData((prev) => ({
      ...prev,
      seasons: (prev.seasons || []).map((season, index) => (
        index === seasonIndex
          ? { ...season, [field]: value }
          : season
      )),
    }));
  };

  const handleEpisodeChange = (seasonIndex, episodeIndex, field, value) => {
    setFormData((prev) => ({
      ...prev,
      seasons: (prev.seasons || []).map((season, currentSeasonIndex) => {
        if (currentSeasonIndex !== seasonIndex) {
          return season;
        }

        return {
          ...season,
          episodes: (season.episodes || []).map((episode, currentEpisodeIndex) => (
            currentEpisodeIndex === episodeIndex
              ? { ...episode, [field]: value }
              : episode
          )),
        };
      }),
    }));
  };

  const refreshItemMeta = async (contentId) => {
    if (!contentId) {
      return;
    }

    try {
      const freshItem = await adminService.getContentById(contentId);
      setItemMeta(freshItem);
    } catch {
      // keep current form state if refresh fails
    }
  };

  const applyTmdbMetadata = (metadata) => {
    if (!metadata) {
      return;
    }

    setFormData((current) => ({
      ...current,
      title: metadata.title || current.title,
      type: metadata.type || current.type,
      description: metadata.description || current.description,
      year: metadata.year || current.year,
      genre: metadata.genre || current.genre,
      poster: metadata.poster || current.poster,
      backdrop: metadata.backdrop || current.backdrop,
      seasons: current.type === 'series' || metadata.type === 'series'
        ? (current.seasons || []).map((season, seasonIndex) => {
          const seasonNumber = Number(season.number || season.id || seasonIndex + 1);
          const tmdbSeason = (metadata.seasons || []).find((entry) => Number(entry.number) === seasonNumber);

          if (!tmdbSeason) {
            return season;
          }

          return {
            ...season,
            title: season.title || tmdbSeason.title || `Season ${seasonNumber}`,
            episodes: (season.episodes || []).map((episode, episodeIndex) => {
              const episodeNumber = Number(episode.number || episode.id || episodeIndex + 1);
              const tmdbEpisode = (tmdbSeason.episodes || []).find((entry) => Number(entry.number) === episodeNumber);

              if (!tmdbEpisode) {
                return episode;
              }

              return {
                ...episode,
                title: tmdbEpisode.title || episode.title,
                description: tmdbEpisode.description || episode.description,
              };
            }),
          };
        })
        : current.seasons,
    }));

    setItemMeta((current) => ({
      ...(current || {}),
      ...(metadata || {}),
      tmdbId: metadata.tmdbId || current?.tmdbId || null,
      imdbId: metadata.imdbId || current?.imdbId || '',
      originalTitle: metadata.originalTitle || current?.originalTitle || '',
      originalLanguage: metadata.originalLanguage || current?.originalLanguage || '',
      metadataStatus: metadata.metadataStatus || 'matched',
      metadataProvider: metadata.metadataProvider || 'tmdb',
      metadataConfidence: metadata.metadataConfidence || 100,
      metadataUpdatedAt: metadata.metadataUpdatedAt || new Date().toISOString(),
      metadataError: metadata.metadataError || '',
      parsedTitle: metadata.parsedTitle || current?.parsedTitle || '',
      rating: metadata.rating ?? current?.rating ?? null,
      runtime: metadata.runtime ?? current?.runtime ?? null,
    }));
  };

  const handleTmdbImport = async () => {
    try {
      setLoadingTmdb(true);
      setError('');
      const response = await adminService.importTmdbMetadata(tmdbIdInput, formData.type);
      setTmdbPreview(response.metadata || null);
    } catch (tmdbError) {
      setTmdbPreview(null);
      setError(tmdbError.message || 'Metadata import failed.');
    } finally {
      setLoadingTmdb(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');

      const submissionData = {
        ...formData,
        tags: typeof formData.tags === 'string'
          ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : formData.tags
      };

      if (isEditMode) {
        await adminService.updateContent(id, submissionData);
      } else {
        await adminService.createContent(submissionData);
      }

      navigate('/admin/content');
    } catch (err) {
      setError(err.message || 'Failed to save content.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPublish = async () => {
    try {
      setLoading(true);
      setError('');
      let targetId = id;

      const submissionData = {
        ...formData,
        status: 'published',
        tags: typeof formData.tags === 'string'
          ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
          : formData.tags
      };

      if (isEditMode) {
        const updated = await adminService.updateContent(id, submissionData);
        targetId = updated.id;
      } else {
        const created = await adminService.createContent(submissionData);
        targetId = created.id;
      }

      await refreshItemMeta(targetId);
      navigate('/admin/content');
    } catch (err) {
      setError(err.message || 'Failed to publish content.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetUpload = async (event, kind) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError('');
      if (kind === 'poster') {
        setUploadingPoster(true);
      } else {
        setUploadingBackdrop(true);
      }

      const response = kind === 'poster'
        ? await adminService.uploadPoster(file)
        : await adminService.uploadBanner(file);

      setFormData((current) => ({
        ...current,
        [kind === 'poster' ? 'poster' : 'backdrop']: response.url,
      }));
    } catch (uploadError) {
      setError(uploadError.message || 'Asset upload failed.');
    } finally {
      event.target.value = '';
      if (kind === 'poster') {
        setUploadingPoster(false);
      } else {
        setUploadingBackdrop(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || loading) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await adminService.deleteContent(id);
      navigate('/admin/content');
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete content.');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div style={styles.page}>
      <section style={{ ...styles.header, ...(isMobile ? styles.headerMobile : isTablet ? styles.headerTablet : {}) }}>
        <div style={styles.headerCopy}>
          <Link to="/admin/content" style={styles.back}>Back to Content Library</Link>
          <h1 style={styles.title}>{isEditMode ? 'Content Review Studio' : 'Create Content Entry'}</h1>
          <p style={styles.subtitle}>
            {isEditMode
              ? 'Review scanner metadata, tighten artwork, and publish with confidence.'
              : 'Build a polished storefront entry with metadata, assets, and playback source in one place.'}
          </p>
        </div>

        <div style={styles.statusRail}>
          <div style={styles.statusCard}>
            <span style={styles.statusLabel}>Status</span>
            <strong style={styles.statusValue}>{formData.status}</strong>
          </div>
          <div style={styles.statusCard}>
            <span style={styles.statusLabel}>Completeness</span>
            <strong style={styles.statusValue}>{completenessScore}%</strong>
          </div>
          <div style={styles.statusCard}>
            <span style={styles.statusLabel}>Metadata</span>
            <strong style={styles.statusValue}>{itemMeta?.metadataStatus || 'manual'}</strong>
          </div>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {loadingItem ? (
        <div style={styles.section}>Loading content details...</div>
      ) : (
        <>
          {isEditMode && itemMeta && (
            <div style={styles.metaGrid}>
              <section style={styles.section}>
                <span style={styles.sectionEyebrow}>Scanner Source</span>
                <div style={styles.metaList}>
                  <div><strong>Root:</strong> {itemMeta.sourceRootLabel || '-'}</div>
                  <div><strong>Category:</strong> {itemMeta.category || '-'}</div>
                  <div><strong>Path:</strong> {itemMeta.sourcePath || '-'}</div>
                  <div><strong>Last Scan:</strong> {itemMeta.lastScannedAt || '-'}</div>
                  <div><strong>Metadata:</strong> {itemMeta.metadataStatus || 'pending'} ({itemMeta.metadataConfidence || 0}%)</div>
                  <div><strong>TMDb:</strong> {itemMeta.tmdbId || '-'}</div>
                  <div><strong>IMDb:</strong> {itemMeta.imdbId || '-'}</div>
                </div>
              </section>

              <section style={styles.section}>
                <span style={styles.sectionEyebrow}>Duplicate Radar</span>
                {duplicateCandidates.length ? (
                  <div style={styles.duplicateList}>
                    {duplicateCandidates.map((candidate) => (
                      <Link key={candidate.id} to={`/admin/content/${candidate.id}/edit`} style={styles.duplicateCard}>
                        <strong>{candidate.title}</strong>
                        <span>{candidate.status} | {candidate.sourceType}</span>
                        <small>{candidate.sourcePath || 'No source path'}</small>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={styles.okBox}>No duplicate title candidates found.</div>
                )}
              </section>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={{ ...styles.contentGrid, ...(isMobile || isTablet ? styles.contentGridMobile : {}) }}>
              <div style={styles.formStack}>
                <section style={styles.section}>
                  <span style={styles.sectionEyebrow}>Metadata Assist</span>
                  <div style={{ ...styles.tmdbRow, ...(isMobile ? styles.tmdbRowMobile : {}) }}>
                    <div style={styles.field}>
                      <label style={styles.label}>TMDb / IMDb ID</label>
                      <input
                        type="text"
                        value={tmdbIdInput}
                        onChange={(event) => setTmdbIdInput(event.target.value)}
                        style={styles.input}
                        placeholder="Example: 728754 or tt7651504"
                      />
                    </div>
                    <div style={styles.tmdbActions}>
                      <button type="button" onClick={handleTmdbImport} disabled={loadingTmdb || !tmdbIdInput} style={styles.secondaryBtn}>
                        {loadingTmdb ? 'Fetching...' : 'Import Metadata'}
                      </button>
                      <button type="button" onClick={() => applyTmdbMetadata(tmdbPreview)} disabled={!tmdbPreview} style={styles.submitBtn}>
                        Apply to Form
                      </button>
                    </div>
                  </div>

                  {tmdbPreview && (
                    <div style={styles.tmdbPreviewCard}>
                      <strong>{tmdbPreview.title || 'Imported Result'}</strong>
                      <span>{tmdbPreview.type} | {tmdbPreview.year || 'N/A'} | {tmdbPreview.genre || 'No genre'}</span>
                      <small>
                        TMDb #{tmdbPreview.tmdbId} | IMDb {tmdbPreview.imdbId || '-'}
                        {tmdbPreview.type === 'series' ? ` | Episodes: ${(tmdbPreview.seasons || []).reduce((sum, season) => sum + ((season.episodes || []).length), 0)}` : ''}
                      </small>
                    </div>
                  )}

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Title *</label>
                      <input type="text" name="title" value={formData.title} onChange={handleChange} style={styles.input} required />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Type *</label>
                      <select name="type" value={formData.type} onChange={handleChange} style={styles.select}>
                        <option value="movie">Movie</option>
                        <option value="series">Series</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Description</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} style={styles.textarea} rows={5} />
                  </div>
                  {itemMeta?.metadataError ? <div style={styles.errorBox}>{itemMeta.metadataError}</div> : null}
                </section>

                <section style={styles.section}>
                  <span style={styles.sectionEyebrow}>Release Details</span>
                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Year</label>
                      <input type="number" name="year" value={formData.year} onChange={handleChange} style={styles.input} min={1900} max={2035} />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Genre</label>
                      <input type="text" name="genre" value={formData.genre} onChange={handleChange} style={styles.input} placeholder="Action, Drama, Thriller..." />
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Language</label>
                      <select name="language" value={formData.language} onChange={handleChange} style={styles.select}>
                        <option value="English">English</option>
                        <option value="Bengali">Bengali</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Korean">Korean</option>
                        <option value="Japanese">Japanese</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Status</label>
                      <select name="status" value={formData.status} onChange={handleChange} style={styles.select}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Category</label>
                      <input type="text" name="category" value={formData.category} onChange={handleChange} style={styles.input} placeholder="English Movies, K-Drama, Anime..." />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Media URL</label>
                      <input type="text" name="videoUrl" value={formData.videoUrl} onChange={handleChange} style={styles.input} placeholder="/English%20Movies/..." />
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Collection</label>
                      <input type="text" name="collection" value={formData.collection} onChange={handleChange} style={styles.input} placeholder="Weekend Picks, Bangla Spotlight..." />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Tags</label>
                      <input type="text" name="tags" value={formData.tags} onChange={handleChange} style={styles.input} placeholder="featured, family, trending" />
                    </div>
                  </div>

                  <div style={styles.row}>
                    <div style={styles.field}>
                      <label style={styles.label}>Editorial Score</label>
                      <input type="number" name="editorialScore" value={formData.editorialScore} onChange={handleChange} style={styles.input} min={0} max={100} />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Featured Order</label>
                      <input type="number" name="featuredOrder" value={formData.featuredOrder} onChange={handleChange} style={styles.input} min={0} max={999} />
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Admin Notes</label>
                    <textarea name="adminNotes" value={formData.adminNotes} onChange={handleChange} style={styles.textarea} rows={4} placeholder="Internal note for future management..." />
                  </div>
                </section>

                {formData.type === 'series' && Array.isArray(formData.seasons) && formData.seasons.length > 0 && (
                  <section style={styles.section}>
                    <span style={styles.sectionEyebrow}>Episode Media Control</span>
                    <div style={styles.infoBox}>
                      Manual override from here will save episode-specific `Media URL`, so each episode can point to its own file.
                    </div>

                    <div style={styles.seasonEditorStack}>
                      {formData.seasons.map((season, seasonIndex) => (
                        <div key={season.id || seasonIndex} style={styles.seasonCard}>
                          <div style={styles.seasonHeader}>
                            <strong style={styles.seasonTitle}>Season {season.number || seasonIndex + 1}</strong>
                            <span style={styles.seasonMeta}>{(season.episodes || []).length} episodes</span>
                          </div>

                          <div style={styles.row}>
                            <div style={styles.field}>
                              <label style={styles.label}>Season Title</label>
                              <input
                                type="text"
                                value={season.title || ''}
                                onChange={(event) => handleSeasonChange(seasonIndex, 'title', event.target.value)}
                                style={styles.input}
                                placeholder={`Season ${season.number || seasonIndex + 1}`}
                              />
                            </div>
                          </div>

                          <div style={styles.episodeEditorList}>
                            {(season.episodes || []).map((episode, episodeIndex) => (
                              <div key={episode.id || `${seasonIndex}-${episodeIndex}`} style={styles.episodeEditorCard}>
                                <div style={styles.episodeEditorHeader}>
                                  <strong>Episode {episode.number || episodeIndex + 1}</strong>
                                  <small style={styles.episodeEditorHint}>{episode.sourcePath || 'No source path found'}</small>
                                </div>

                                <div style={styles.row}>
                                  <div style={styles.field}>
                                    <label style={styles.label}>Episode Title</label>
                                    <input
                                      type="text"
                                      value={episode.title || ''}
                                      onChange={(event) => handleEpisodeChange(seasonIndex, episodeIndex, 'title', event.target.value)}
                                      style={styles.input}
                                      placeholder={`Episode ${episode.number || episodeIndex + 1}`}
                                    />
                                  </div>

                                  <div style={styles.field}>
                                    <label style={styles.label}>Media URL</label>
                                    <input
                                      type="text"
                                      value={episode.videoUrl || ''}
                                      onChange={(event) => handleEpisodeChange(seasonIndex, episodeIndex, 'videoUrl', event.target.value)}
                                      style={styles.input}
                                      placeholder="/Series/Season 1/Episode 01.mkv"
                                    />
                                  </div>
                                </div>

                                <div style={styles.field}>
                                  <label style={styles.label}>Episode Description</label>
                                  <textarea
                                    value={episode.description || ''}
                                    onChange={(event) => handleEpisodeChange(seasonIndex, episodeIndex, 'description', event.target.value)}
                                    style={styles.textarea}
                                    rows={3}
                                    placeholder="Optional episode notes"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside style={{ ...styles.assetRail, ...(isMobile || isTablet ? styles.assetRailMobile : {}) }}>
                <section style={styles.section}>
                  <span style={styles.sectionEyebrow}>Artwork Studio</span>
                  <div style={styles.field}>
                    <label style={styles.label}>Poster Image URL</label>
                    <input type="text" name="poster" value={formData.poster} onChange={handleChange} style={styles.input} placeholder="/portal/uploads/posters/..." />
                    <label style={styles.uploadBtn}>
                      {uploadingPoster ? 'Uploading poster...' : 'Upload Poster'}
                      <input type="file" accept="image/*" onChange={(event) => handleAssetUpload(event, 'poster')} style={styles.hiddenInput} />
                    </label>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Banner Image URL</label>
                    <input type="text" name="backdrop" value={formData.backdrop} onChange={handleChange} style={styles.input} placeholder="/portal/uploads/banners/..." />
                    <label style={styles.uploadBtn}>
                      {uploadingBackdrop ? 'Uploading banner...' : 'Upload Banner'}
                      <input type="file" accept="image/*" onChange={(event) => handleAssetUpload(event, 'backdrop')} style={styles.hiddenInput} />
                    </label>
                  </div>

                  <div style={styles.previewStage}>
                    {formData.poster ? <img src={formData.poster} alt="Poster preview" style={{ ...styles.previewImage, ...(isMobile ? styles.previewImageMobile : {}) }} /> : <div style={{ ...styles.posterFallback, ...(isMobile ? styles.previewImageMobile : {}) }}>Poster Preview</div>}
                    {formData.backdrop ? <img src={formData.backdrop} alt="Backdrop preview" style={styles.previewWideImage} /> : <div style={styles.backdropFallback}>Backdrop Preview</div>}
                  </div>
                </section>

                <section style={styles.section}>
                  <span style={styles.sectionEyebrow}>Publish Checklist</span>
                  <div style={styles.checklist}>
                    <div style={styles.checkItem}><span style={formData.title ? styles.checkOk : styles.checkMuted}>*</span><span>Title ready</span></div>
                    <div style={styles.checkItem}><span style={formData.description ? styles.checkOk : styles.checkMuted}>*</span><span>Description added</span></div>
                    <div style={styles.checkItem}><span style={formData.videoUrl ? styles.checkOk : styles.checkMuted}>*</span><span>Playback path linked</span></div>
                    <div style={styles.checkItem}><span style={formData.poster ? styles.checkOk : styles.checkMuted}>*</span><span>Poster attached</span></div>
                    <div style={styles.checkItem}><span style={formData.backdrop ? styles.checkOk : styles.checkMuted}>*</span><span>Backdrop attached</span></div>
                    <div style={styles.checkItem}><span style={itemMeta?.metadataStatus === 'matched' ? styles.checkOk : styles.checkMuted}>*</span><span>Metadata verified</span></div>
                  </div>
                </section>
              </aside>
            </div>

            <div style={styles.actions}>
              <button type="submit" disabled={loading} style={styles.secondaryBtn}>
                {loading ? 'Saving...' : (isEditMode ? 'Save Draft Changes' : 'Save Content')}
              </button>
              <button type="button" disabled={loading} onClick={handleSaveAndPublish} style={styles.submitBtn}>
                {loading ? 'Working...' : 'Save & Publish'}
              </button>
              {isEditMode && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowDeleteConfirm(true)}
                  style={styles.deleteBtn}
                >
                  {loading ? 'Working...' : 'Delete Content'}
                </button>
              )}
            </div>
          </form>

          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="Delete this content?"
            message={`"${formData.title || 'This item'}" will be removed from the portal catalog. This action cannot be undone.`}
            confirmText="Delete Permanently"
            cancelText="Keep Content"
          />
        </>
      )}
    </div>
  );
}

const ACCENT = '#6366f1';
const ACCENT_LIGHT = 'rgba(99,102,241,0.1)';
const ACCENT_BORDER = 'rgba(99,102,241,0.25)';
const SURFACE = '#111318';
const SURFACE2 = '#181b22';
const BORDER = 'rgba(255,255,255,0.07)';
const TEXT = '#f1f5f9';
const TEXT2 = '#94a3b8';
const TEXT3 = '#475569';

const styles = {
  page: { display: 'grid', gap: '20px' },
  header: {
    padding: '20px 24px',
    borderRadius: '10px',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(240px, 0.8fr)',
    gap: '20px',
    alignItems: 'center',
  },
  headerTablet: { gridTemplateColumns: '1fr' },
  headerMobile: { padding: '16px', gridTemplateColumns: '1fr' },
  headerCopy: { display: 'grid', gap: '8px' },
  back: { color: ACCENT, display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500', fontSize: '0.85rem' },
  title: { fontSize: '1.4rem', fontWeight: '700', color: TEXT, margin: 0 },
  subtitle: { maxWidth: '56ch', lineHeight: '1.7', color: TEXT2, fontSize: '0.85rem' },
  statusRail: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' },
  statusCard: { padding: '12px 14px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}`, display: 'grid', gap: '4px' },
  statusLabel: { fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT3, fontWeight: '600' },
  statusValue: { color: TEXT, fontWeight: '600', fontSize: '0.9rem', textTransform: 'capitalize' },
  section: { padding: '20px', borderRadius: '10px', background: SURFACE, border: `1px solid ${BORDER}`, display: 'grid', gap: '16px' },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' },
  metaList: { display: 'grid', gap: '8px', color: TEXT2, lineHeight: '1.7', fontSize: '0.875rem' },
  duplicateList: { display: 'grid', gap: '8px' },
  duplicateCard: { padding: '12px 14px', borderRadius: '8px', border: `1px solid ${BORDER}`, background: SURFACE2, color: TEXT, display: 'grid', gap: '4px', textDecoration: 'none' },
  okBox: { padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.15)', fontSize: '0.85rem' },
  infoBox: { padding: '10px 14px', borderRadius: '8px', background: ACCENT_LIGHT, color: '#a5b4fc', border: `1px solid ${ACCENT_BORDER}`, fontSize: '0.85rem' },
  errorBox: { padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', fontSize: '0.85rem' },
  form: { display: 'grid', gap: '16px' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)', gap: '16px', alignItems: 'start' },
  contentGridMobile: { gridTemplateColumns: '1fr' },
  formStack: { display: 'grid', gap: '16px' },
  assetRail: { display: 'grid', gap: '16px', position: 'sticky', top: '80px' },
  assetRailMobile: { position: 'static', top: 'auto' },
  tmdbRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'end' },
  tmdbRowMobile: { gridTemplateColumns: '1fr' },
  tmdbActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tmdbPreviewCard: { padding: '12px 14px', borderRadius: '8px', background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, display: 'grid', gap: '4px', color: TEXT, fontSize: '0.85rem' },
  sectionEyebrow: { color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem', fontWeight: '700' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.75rem', fontWeight: '600', color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em' },
  input: { padding: '9px 12px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, fontSize: '0.875rem' },
  select: { padding: '9px 12px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, fontSize: '0.875rem' },
  textarea: { padding: '9px 12px', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '8px', color: TEXT, fontSize: '0.875rem', resize: 'vertical' },
  uploadBtn: { padding: '9px 14px', borderRadius: '8px', background: SURFACE2, color: TEXT2, fontWeight: '600', textAlign: 'center', cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: '0.82rem' },
  hiddenInput: { display: 'none' },
  previewStage: { display: 'grid', gap: '12px' },
  previewImage: { width: '100%', maxWidth: '160px', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: '8px' },
  previewImageMobile: { maxWidth: '100%' },
  previewWideImage: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '8px' },
  posterFallback: { width: '100%', maxWidth: '160px', aspectRatio: '2 / 3', borderRadius: '8px', background: SURFACE2, display: 'grid', placeItems: 'center', color: TEXT3, fontSize: '0.75rem', border: `1px solid ${BORDER}` },
  backdropFallback: { width: '100%', aspectRatio: '16 / 9', borderRadius: '8px', background: SURFACE2, display: 'grid', placeItems: 'center', color: TEXT3, fontSize: '0.75rem', border: `1px solid ${BORDER}` },
  checklist: { display: 'grid', gap: '8px' },
  seasonEditorStack: { display: 'grid', gap: '12px' },
  seasonCard: { display: 'grid', gap: '12px', padding: '14px', borderRadius: '8px', background: SURFACE2, border: `1px solid ${BORDER}` },
  seasonHeader: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  seasonTitle: { color: TEXT, fontWeight: '600', fontSize: '0.875rem' },
  seasonMeta: { color: TEXT3, fontSize: '0.8rem' },
  episodeEditorList: { display: 'grid', gap: '10px' },
  episodeEditorCard: { display: 'grid', gap: '10px', padding: '12px', borderRadius: '8px', background: '#0a0c10', border: `1px solid ${BORDER}` },
  episodeEditorHeader: { display: 'grid', gap: '3px' },
  episodeEditorHint: { color: TEXT3, lineHeight: '1.5', wordBreak: 'break-all', fontSize: '0.75rem' },
  checkItem: { display: 'flex', gap: '8px', alignItems: 'center', color: TEXT2, fontSize: '0.85rem' },
  checkOk: { color: '#4ade80' },
  checkMuted: { color: TEXT3 },
  actions: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  secondaryBtn: { padding: '10px 20px', background: SURFACE2, color: TEXT, borderRadius: '8px', fontWeight: '600', border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: '0.875rem' },
  submitBtn: { padding: '10px 22px', background: ACCENT, color: '#fff', borderRadius: '8px', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', border: 'none' },
  deleteBtn: { padding: '10px 20px', background: 'rgba(239,68,68,0.08)', color: '#f87171', borderRadius: '8px', fontWeight: '600', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', fontSize: '0.875rem' },
};

export default AddContentPage;
