const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const npmExecPath = process.env.npm_execpath || 'npm';

function runNpm(args) {
  const command = npmExecPath.endsWith('.js')
    ? `"${process.execPath}" "${npmExecPath}" ${args}`
    : `"${npmExecPath}" ${args}`;

  execSync(command, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });
}

try {
  runNpm('install');
  runNpm('run build:plesk');
} catch (error) {
  process.exit(error.status || 1);
}