const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const command = `"${process.execPath}" "${npmCli}" install && "${process.execPath}" "${npmCli}" run build:plesk`;

try {
  execSync(command, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true,
  });
} catch (error) {
  process.exit(error.status || 1);
}