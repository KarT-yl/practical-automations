const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '..'));
mkdirSync('artifacts', { recursive: true });
for (const name of [
  'myte',
  'analysis',
  'background',
  'extension',
  'collector',
  'report',
  'integration',
]) {
  const result = spawnSync(process.execPath, [`tests/test-${name}.cjs`], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
