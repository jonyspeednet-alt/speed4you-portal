const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function runProcess(name, workingDirectory, args) {
  const child = spawn(npmCmd, args, {
    cwd: workingDirectory,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${name} stopped with exit code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const frontend = runProcess('frontend', path.join(rootDir, 'frontend'), ['run', 'dev']);
const backend = runProcess('backend', path.join(rootDir, 'backend'), ['run', 'dev']);

function stopChildren() {
  for (const child of [frontend, backend]) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

console.log('Frontend: http://127.0.0.1:4173');
console.log('Backend:  http://127.0.0.1:3001');
