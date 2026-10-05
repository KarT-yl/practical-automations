const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
process.chdir(path.resolve(__dirname, '..'));
fs.mkdirSync('artifacts', { recursive: true });
for (const [folder, name] of [
  ['extension', 'myte-hours-filler-v1.0.2.zip'],
  ['original-v1.0.1', 'myte-hours-filler-original-v1.0.1.zip'],
]) {
  const output = path.resolve('artifacts', name);
  if (fs.existsSync(output))
    throw Error(`Preserving existing archive: ${output}`);
  const input = path.resolve('tools/myte-hours', folder);
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${input.replaceAll("'", "''")}', '${output.replaceAll("'", "''")}')`,
          ],
          { stdio: 'inherit' },
        )
      : spawnSync('zip', ['-r', output, '.'], { cwd: input, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(output);
}
