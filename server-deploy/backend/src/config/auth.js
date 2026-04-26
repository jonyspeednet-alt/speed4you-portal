function getNodeEnv() {
  return String(process.env.NODE_ENV || 'development').toLowerCase();
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (!secret) {
    if (getNodeEnv() === 'production') {
      throw new Error('JWT_SECRET must be configured in production.');
    }
    // Warn loudly in non-production so developers notice
    console.warn(
      '[auth] WARNING: JWT_SECRET is not set. Using an insecure fallback. ' +
      'Set JWT_SECRET before deploying to production.'
    );
    return 'dev-only-jwt-secret-change-before-production';
  }

  if (secret.length < 32) {
    console.warn('[auth] WARNING: JWT_SECRET is shorter than 32 characters. Use a longer secret.');
  }

  return secret;
}

module.exports = {
  getJwtSecret,
};
