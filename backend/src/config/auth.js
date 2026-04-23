function getNodeEnv() {
  return String(process.env.NODE_ENV || 'development').toLowerCase();
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  const isProduction = getNodeEnv() === 'production';

  if (!secret && isProduction) {
    throw new Error('JWT_SECRET must be configured in production.');
  }

  return secret || 'dev-only-jwt-secret-change-before-production';
}

module.exports = {
  getJwtSecret,
};
