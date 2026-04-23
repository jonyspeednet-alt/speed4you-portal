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
      setError(tmdbError.message || 'TMDb import failed.');
    } finally {
      setLoadingTmdb(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');

      if (isEditMode) {
        await adminService.updateContent(id, formData);
      } else {
        await adminService.createContent(formData);
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

      if (isEditMode) {
        const updated = await adminService.updateContent(id, { ...formData, status: 'published' });
        targetId = updated.id;
      } else {
        const created = await adminService.createContent({ ...formData, status: 'published' });
        targetId = created.id;
      }

      navigate('/admin/content');
      await refreshItemMeta(targetId);
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
                      <label style={styles.label}>TMDb ID</label>
                      <input
                        type="number"
                        value={tmdbIdInput}
                        onChange={(event) => setTmdbIdInput(event.target.value)}
                        style={styles.input}
                        placeholder="Example: 728754"
                      />
                    </div>
                    <div style={styles.tmdbActions}>
                      <button type="button" onClick={handleTmdbImport} disabled={loadingTmdb || !tmdbIdInput} style={styles.secondaryBtn}>
                        {loadingTmdb ? 'Fetching...' : 'Preview from TMDb'}
                      </button>
                      <button type="button" onClick={() => applyTmdbMetadata(tmdbPreview)} disabled={!tmdbPreview} style={styles.submitBtn}>
                        Apply to Form
                      </button>
                    </div>
                  </div>

                  {tmdbPreview && (
                    <div style={styles.tmdbPreviewCard}>
                      <strong>{tmdbPreview.title || 'TMDb Result'}</strong>
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

const styles = {
  page: { display: 'grid', gap: '22px' },
  header: {
    padding: '28px',
    borderRadius: '34px',
    background: 'linear-gradient(135deg, rgba(11,24,42,0.9), rgba(19,38,62,0.76))',
    border: '1px solid rgba(125,249,255,0.12)',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)',
    gap: '20px',
    alignItems: 'end',
  },
  headerTablet: {
    gridTemplateColumns: '1fr',
  },
  headerMobile: {
    padding: '20px',
    gridTemplateColumns: '1fr',
  },
  headerCopy: { display: 'grid', gap: '10px' },
  back: { color: 'var(--accent-cyan)', display: 'inline-block', fontWeight: '700' },
  title: { fontSize: '2.2rem', color: 'var(--text-primary)' },
  subtitle: { maxWidth: '56ch', lineHeight: '1.8' },
  statusRail: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' },
  statusCard: { padding: '18px', borderRadius: '22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '8px' },
  statusLabel: { fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', fontWeight: '700' },
  statusValue: { color: 'var(--accent-amber)', textTransform: 'capitalize' },
  section: { padding: '24px', borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '18px' },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  metaList: { display: 'grid', gap: '10px', color: 'var(--text-secondary)', lineHeight: '1.7' },
  duplicateList: { display: 'grid', gap: '10px' },
  duplicateCard: { padding: '14px 16px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', display: 'grid', gap: '4px' },
  okBox: { padding: '14px 16px', borderRadius: '18px', background: 'rgba(34, 197, 94, 0.12)', color: '#86efac' },
  infoBox: { padding: '14px 16px', borderRadius: '18px', background: 'rgba(56, 189, 248, 0.1)', color: '#bfe9ff', border: '1px solid rgba(56, 189, 248, 0.22)' },
  errorBox: { padding: '14px 18px', borderRadius: '18px', background: 'rgba(255, 90, 95, 0.12)', color: '#ff8a8a', border: '1px solid rgba(255, 90, 95, 0.24)' },
  form: { display: 'grid', gap: '20px' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, 0.75fr)', gap: '20px', alignItems: 'start' },
  contentGridMobile: { gridTemplateColumns: '1fr' },
  formStack: { display: 'grid', gap: '20px' },
  assetRail: { display: 'grid', gap: '20px', position: 'sticky', top: '22px' },
  assetRailMobile: { position: 'static', top: 'auto' },
  tmdbRow: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'end' },
  tmdbRowMobile: { gridTemplateColumns: '1fr' },
  tmdbActions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  tmdbPreviewCard: { padding: '14px 16px', borderRadius: '18px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.18)', display: 'grid', gap: '6px', color: 'var(--text-primary)' },
  sectionEyebrow: { color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: '0.72rem', fontWeight: '700' },
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: { padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: 'var(--text-primary)', fontSize: '0.98rem' },
  select: { padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: 'var(--text-primary)', fontSize: '0.98rem' },
  textarea: { padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', color: 'var(--text-primary)', fontSize: '0.98rem', resize: 'vertical' },
  uploadBtn: { padding: '12px 16px', borderRadius: '16px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontWeight: '700', textAlign: 'center', cursor: 'pointer' },
  hiddenInput: { display: 'none' },
  previewStage: { display: 'grid', gap: '14px' },
  previewImage: { width: '100%', maxWidth: '180px', aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: '16px' },
  previewImageMobile: { maxWidth: '100%' },
  previewWideImage: { width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: '16px' },
  posterFallback: { width: '100%', maxWidth: '180px', aspectRatio: '2 / 3', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' },
  backdropFallback: { width: '100%', aspectRatio: '16 / 9', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' },
  checklist: { display: 'grid', gap: '10px' },
  seasonEditorStack: { display: 'grid', gap: '16px' },
  seasonCard: { display: 'grid', gap: '16px', padding: '18px', borderRadius: '22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' },
  seasonHeader: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
  seasonTitle: { color: 'var(--text-primary)' },
  seasonMeta: { color: 'var(--text-muted)', fontSize: '0.86rem' },
  episodeEditorList: { display: 'grid', gap: '14px' },
  episodeEditorCard: { display: 'grid', gap: '14px', padding: '16px', borderRadius: '18px', background: 'rgba(9,18,33,0.46)', border: '1px solid rgba(255,255,255,0.06)' },
  episodeEditorHeader: { display: 'grid', gap: '4px' },
  episodeEditorHint: { color: 'var(--text-muted)', lineHeight: '1.5', wordBreak: 'break-all' },
  checkItem: { display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text-secondary)' },
  checkOk: { color: '#86efac' },
  checkMuted: { color: 'var(--text-muted)' },
  actions: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  secondaryBtn: { padding: '15px 24px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', borderRadius: '999px', fontWeight: '700' },
  submitBtn: { padding: '15px 28px', background: 'linear-gradient(135deg, #ff744f, #ffb347)', color: '#fff', borderRadius: '999px', fontWeight: '700', fontSize: '1rem', boxShadow: '0 12px 30px rgba(255,90,95,0.24)' },
  deleteBtn: { padding: '15px 24px', background: 'rgba(255, 90, 95, 0.14)', color: '#ff9ea2', borderRadius: '999px', fontWeight: '700', border: '1px solid rgba(255, 90, 95, 0.28)' },
};

export default AddContentPage;
