const { getItemById } = require('../src/data/store');

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

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (entry.startsWith('--')) {
      const key = entry.slice(2);
      const value = argv[index + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        index += 1;
      } else {
        args[key] = true;
      }
      continue;
    }
    args._.push(entry);
  }
  return args;
}

function selectEpisode(item, seasonNumber, episodeNumber) {
  if (!item || item.type !== 'series') {
    return { selectedSeason: null, selectedEpisode: null };
  }

  const seasons = Array.isArray(item.seasons) ? item.seasons : [];
  const selectedSeason = seasons.find((season, index) => toPositiveInt(season?.number ?? season?.id, index + 1) === seasonNumber)
    || seasons[0]
    || null;

  const episodes = Array.isArray(selectedSeason?.episodes) ? selectedSeason.episodes : [];
  const selectedEpisode = episodes.find((episode, index) => toPositiveInt(episode?.number ?? episode?.id, index + 1) === episodeNumber)
    || episodes[episodeNumber - 1]
    || episodes[0]
    || null;

  return { selectedSeason, selectedEpisode };
}

function main() {
  const argv = parseArgs(process.argv.slice(2));
  const [id] = argv._;
  if (!id) {
    console.error('Usage: node backend/scripts/inspect-player-selection.js <contentId> --season 1 --episode 1');
    process.exitCode = 2;
    return;
  }

  const seasonNumber = toPositiveInt(argv.season, 1);
  const episodeNumber = toPositiveInt(argv.episode, 1);

  const item = getItemById(id);
  if (!item) {
    console.error(`Content not found: ${id}`);
    process.exitCode = 1;
    return;
  }

  const { selectedSeason, selectedEpisode } = selectEpisode(item, seasonNumber, episodeNumber);

  const payload = {
    id: item.id,
    type: item.type,
    title: item.title,
    request: { season: seasonNumber, episode: episodeNumber },
    selectedSeason: selectedSeason ? {
      id: selectedSeason.id,
      number: selectedSeason.number,
      title: selectedSeason.title,
      episodeCount: (selectedSeason.episodes || []).length,
    } : null,
    selectedEpisode: selectedEpisode ? {
      id: selectedEpisode.id,
      number: selectedEpisode.number,
      title: selectedEpisode.title,
      videoUrl: selectedEpisode.videoUrl || '',
      sourcePath: selectedEpisode.sourcePath || '',
    } : null,
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main();

