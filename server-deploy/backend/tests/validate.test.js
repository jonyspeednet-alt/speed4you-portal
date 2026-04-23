const test = require('node:test');
const assert = require('node:assert/strict');

const { Joi, validateQuery } = require('../src/middleware/validate');

test('validateQuery returns 400 on invalid query', async () => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).required(),
  });
  const middleware = validateQuery(schema);
  const req = { query: { page: '0' } };
  let payload = null;
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  await new Promise((resolve) => {
    middleware(req, res, () => {
      resolve();
    });
    setTimeout(resolve, 10);
  });

  assert.equal(res.statusCode, 400);
  assert.equal(payload.error, 'Invalid query parameters');
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
