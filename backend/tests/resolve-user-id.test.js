const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../src/config/auth');

const { resolveUserId } = require('../src/middleware/resolve-user-id');

test('resolveUserId prefers explicit x-user-id', () => {
  const req = {
    headers: {
      'x-user-id': 'custom-user',
      authorization: '',
    },
  };

  assert.equal(resolveUserId(req), 'custom-user');
});

test('resolveUserId extracts id from Bearer token', () => {
  const token = jwt.sign({ id: 123 }, getJwtSecret());
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  assert.equal(resolveUserId(req), 'user:123');
});
