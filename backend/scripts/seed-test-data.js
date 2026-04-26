#!/usr/bin/env node

/**
 * Seed test data for ISP Entertainment Portal
 * Run: node scripts/seed-test-data.js
 */

require('dotenv').config();

const { createItem, ensureContentStore } = require('../src/data/store');
const db = require('../src/config/database');

const SAMPLE_MOVIES = [
  {
    id: 1001,
    title: 'The Journey Begins',
    type: 'movie',
    status: 'published',
    genre: 'Action',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
    rating: 8.2,
    duration: 142,
    description: 'An epic adventure film filled with action and mystery.',
    director: 'John Smith',
    cast: ['Tom Hardy', 'Emma Stone'],
  },
  {
    id: 1002,
    title: 'Heart of Gold',
    type: 'movie',
    status: 'published',
    genre: 'Drama',
    year: 2023,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
    rating: 7.9,
    duration: 128,
    description: 'A touching story about love, loss, and redemption.',
    director: 'Sarah Johnson',
    cast: ['Saoirse Ronan', 'Timothée Chalamet'],
  },
  {
    id: 1003,
    title: 'Laugh Track',
    type: 'movie',
    status: 'published',
    genre: 'Comedy',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=400',
    backdrop: 'https://images.unsplash.com/photo-1495997622626-f1fbb8e068aa?w=1200',
    rating: 7.1,
    duration: 95,
    description: 'A hilarious comedy about everyday life mishaps.',
    director: 'Michael Chen',
    cast: ['Will Ferrell', 'Amy Poehler'],
  },
  {
    id: 1004,
    title: 'Midnight Terror',
    type: 'movie',
    status: 'published',
    genre: 'Horror',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200',
    rating: 7.4,
    duration: 105,
    description: 'A chilling horror experience that will keep you on edge.',
    director: 'Alex Rivera',
    cast: ['Jennifer Connelly', 'Tom Hardy'],
  },
  {
    id: 1005,
    title: 'Love in Paris',
    type: 'movie',
    status: 'published',
    genre: 'Romance',
    year: 2023,
    language: 'French',
    poster: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200',
    rating: 8.0,
    duration: 112,
    description: 'A romantic tale set in the city of love.',
    director: 'François Truffaut',
    cast: ['Léa Seydoux', 'Vincent Cassel'],
  },
];

const SAMPLE_SERIES = [
  {
    id: 2001,
    title: 'Tech Titans',
    type: 'series',
    status: 'published',
    genre: 'Thriller',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=400',
    backdrop: 'https://images.unsplash.com/photo-1574609644844-fcf46c1e1e2c?w=1200',
    rating: 8.5,
    seasons: 2,
    episodes: 24,
    description: 'Follow the rise of ambitious tech entrepreneurs in Silicon Valley.',
    creator: 'David Fincher',
    cast: ['Adam Scott', 'Tracee Ellis Ross'],
  },
  {
    id: 2002,
    title: 'Mystery Island',
    type: 'series',
    status: 'published',
    genre: 'Adventure',
    year: 2023,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
    backdrop: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200',
    rating: 8.3,
    seasons: 1,
    episodes: 10,
    description: 'A group of friends must solve the mysteries of an uncharted island.',
    creator: 'J.J. Abrams',
    cast: ['Oscar Isaac', 'Elizabeth Olsen'],
  },
  {
    id: 2003,
    title: 'Legal Minds',
    type: 'series',
    status: 'published',
    genre: 'Drama',
    year: 2024,
    language: 'English',
    poster: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    backdrop: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200',
    rating: 8.1,
    seasons: 3,
    episodes: 36,
    description: 'High-stakes legal battles and personal drama in a prestigious law firm.',
    creator: 'Peter Nowalk',
    cast: ['Viola Davis', 'Alfred Enoch'],
  },
];

async function seedData() {
  try {
    await ensureContentStore();
    
    console.log('Seeding test movies...');
    for (const movie of SAMPLE_MOVIES) {
      try {
        await createItem(movie);
        console.log(`✓ Added: ${movie.title}`);
      } catch (err) {
        console.error(`✗ Failed to add ${movie.title}:`, err.message);
      }
    }

    console.log('\nSeeding test series...');
    for (const series of SAMPLE_SERIES) {
      try {
        await createItem(series);
        console.log(`✓ Added: ${series.title}`);
      } catch (err) {
        console.error(`✗ Failed to add ${series.title}:`, err.message);
      }
    }

    console.log('\n✓ Seeding complete!');
    process.exitCode = 0;
  } catch (error) {
    console.error('Fatal error during seeding:', error);
    process.exitCode = 1;
  } finally {
    await db.pool.end().catch(() => {});
  }
}

seedData();
