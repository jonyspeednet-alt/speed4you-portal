const test = require('node:test');
const assert = require('node:assert/strict');

const { Joi, validateQuery } = require('../src/middleware/validate');

test('validateQuery returns 400 on invalid query', async () => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).required(),
  });
  const middleware = validateQuery(schema);
  const req = { query: { page: '0' } };
  const res = {};
  let error = null;

  await new Promise((resolve) => {
    middleware(req, res, (err) => {
      error = err;
      resolve();
    });
  });

  assert.ok(error);
  assert.equal(error.status, 400);
  assert.equal(error.message, 'Validation failed');
});

test('validateQuery populates validatedQuery on valid input', async () => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).required(),
  });
  const middleware = validateQuery(schema);
  const req = { query: { page: '2' } };
  const res = {
    status() {
      return this;
    },
    json() {
      return this;
    },
  };
  let called = false;

  await new Promise((resolve) => {
    middleware(req, res, () => {
      called = true;
      resolve();
    });
  });

  assert.equal(called, true);
  assert.equal(req.validatedQuery.page, 2);
});
