const Joi = require('joi');

const episodeSchema = Joi.object({
  id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
  number: Joi.number().integer().min(1).allow(null),
  title: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  videoUrl: Joi.string().allow('', null),
  sourcePath: Joi.string().allow('', null),
  duration: Joi.alternatives().try(Joi.number().integer().min(0), Joi.string().allow('', null)).allow(null),
});

const seasonSchema = Joi.object({
  id: Joi.alternatives().try(Joi.number(), Joi.string()).allow(null),
  number: Joi.number().integer().min(1).allow(null),
  title: Joi.string().allow('', null),
  sourcePath: Joi.string().allow('', null),
  episodes: Joi.array().items(episodeSchema).default([]),
});

const contentSchema = Joi.object({
  title: Joi.string().required().min(1).max(500),
  type: Joi.string().valid('movie', 'series').default('movie'),
  status: Joi.string().valid('published', 'draft').default('draft'),
  genre: Joi.string().allow('', null),
  year: Joi.number().integer().min(1800).max(new Date().getFullYear() + 5).allow(null),
  language: Joi.string().allow('', null),
  category: Joi.string().allow('', null),
  collection: Joi.string().allow('', null),
  tags: Joi.array().items(Joi.string()).default([]),
  description: Joi.string().allow('', null),
  poster: Joi.string().allow('', null),
  backdrop: Joi.string().allow('', null),
  videoUrl: Joi.string().allow('', null),
  featured: Joi.boolean().default(false),
  featuredOrder: Joi.number().integer().default(0),
  rating: Joi.number().min(0).max(10).allow(null),
  duration: Joi.number().integer().min(0).allow(null),
  adminNotes: Joi.string().allow('', null),
  tmdbId: Joi.number().integer().allow(null),
  imdbId: Joi.string().allow('', null),
  editorialScore: Joi.number().integer().min(0).max(100).allow(null),
  seasons: Joi.array().items(seasonSchema).default([]),
});

const bulkUpdateSchema = Joi.object({
  ids: Joi.array().items(Joi.alternatives().try(Joi.number(), Joi.string())).min(1).required(),
  changes: Joi.object({
    status: Joi.string().valid('published', 'draft'),
    category: Joi.string().allow(''),
    language: Joi.string().allow(''),
    featured: Joi.boolean(),
    collection: Joi.string().allow(''),
    tags: Joi.array().items(Joi.string()).allow(null),
    adminNotes: Joi.string().allow('', null),
    featuredOrder: Joi.number().integer().allow(null),
  }).min(1).required(),
});

module.exports = {
  contentSchema,
  bulkUpdateSchema,
};
