const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const PORT = 3001;

function killPort() {
  return new Promise((resolve) => {
    if (!isWindows) {
      resolve();
      return;
    }
    
    const killProc = spawn('powershell', [
      '-Command',
      `$connections = Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue; ` +
      `if ($connections) { ` +
      `  $uniquePids = $connections | Select-Object -ExpandProperty OwningProcess -Unique; ` +
      `  foreach ($pid in $uniquePids) { ` +
      `    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue; ` +
      `    if ($proc -and $proc.ProcessName -ne 'powershell' -and $proc.ProcessName -ne 'node') { ` +
      `      Write-Host "Killing process $pid on port ${PORT}..."; ` +
      `      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue ` +
      `    } ` +
      `  } ` +
      `}`
    ], {
      stdio: 'inherit',
      shell: true,
    });

    killProc.on('close', () => resolve());
  });
}

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${args.join(' ')}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  console.log('Checking for existing processes on port ' + PORT + '...');
  await killPort();

  await run(['run', 'build'], rootDir);

  const backend = spawn(npmCmd, ['run', 'start'], {
    cwd: path.join(rootDir, 'backend'),
    stdio: 'inherit',
    shell: true,
  });

  backend.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  backend.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
