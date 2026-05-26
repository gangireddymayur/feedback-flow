const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const command = process.platform === 'win32'
  ? 'cmd /d /s /c "npm install && npm run build:plesk"'
  : 'npm install && npm run build:plesk';

try {
  execSync(command, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });
} catch (error) {
  process.exit(error.status || 1);
}