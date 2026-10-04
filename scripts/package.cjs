// Build a deterministic ZIP with only extension files and user documentation.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'tools/amex-offers/extension');
const version = JSON.parse(
  fs.readFileSync(path.join(source, 'manifest.json')),
).version;
const files = fs
  .readdirSync(source)
  .sort()
  .map((name) => ({ name, data: fs.readFileSync(path.join(source, name)) }));
files.push({
  name: 'README.md',
  data: fs.readFileSync(path.join(root, 'tools/amex-offers/README.md')),
});
files.push({
  name: 'LICENSE',
  data: fs.readFileSync(path.join(root, 'LICENSE')),
});

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [],
  central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from('amex-offers-one-click/' + file.name);
  const crc = crc32(file.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6); // UTF-8; stored without compression.
  header.writeUInt16LE(0x5d44, 12); // Fixed DOS date: October 4, 2026.
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(file.data.length, 18);
  header.writeUInt32LE(file.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, file.data);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(0x5d44, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(file.data.length, 20);
  entry.writeUInt32LE(file.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + file.data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const output = path.join(
  root,
  'artifacts',
  `amex-offers-one-click-v${version}.zip`,
);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([...local, directory, end]));
console.log(`Built ${path.relative(root, output)} (${files.length} files)`);
