const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const backendRoot = path.join(projectRoot, 'backend');
const deployRoot = path.join(projectRoot, 'server-deploy');
const deployFrontendRoot = path.join(deployRoot, 'frontend', 'dist');
const deployBackendRoot = path.join(deployRoot, 'backend');

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyRecursive(sourcePath, targetPath, options = {}) {
  const {
    excludeNames = new Set(),
    excludeExtensions = new Set(),
  } = options;

  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
      if (excludeNames.has(entry.name)) {
        continue;
      }
      copyRecursive(
        path.join(sourcePath, entry.name),
        path.join(targetPath, entry.name),
        options,
      );
    }
    return;
  }

  if (excludeExtensions.has(path.extname(sourcePath).toLowerCase())) {
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function main() {
  const frontendDistRoot = path.join(frontendRoot, 'dist');
  if (!fs.existsSync(frontendDistRoot)) {
    throw new Error('Frontend build output not found. Run the frontend build first.');
  }

  removePath(deployFrontendRoot);
  removePath(deployBackendRoot);

  copyRecursive(frontendDistRoot, deployFrontendRoot);

  copyRecursive(backendRoot, deployBackendRoot, {
    excludeNames: new Set([
      'node_modules',
      '.env',
      '.git',
    ]),
    excludeExtensions: new Set([
      '.log',
    ]),
  });

  console.log('Deploy package prepared in server-deploy/.');
}

main();
