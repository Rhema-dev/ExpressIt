import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const paths = [
  'CSXS',
  'dist',
  'host',
  'licenses',
  'INSTALL.md',
  'README.md',
  'THIRD_PARTY_NOTICES.txt',
];
const files = [];
function walk(path) {
  const entry = readdirSync(join(path, '..'), { withFileTypes: true }).find(
    (e) => e.name === path.split(/[\\/]/).pop(),
  );
  if (entry?.isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
  else files.push({ name: 'ExpressIt/' + path.replaceAll('\\', '/'), data: readFileSync(path) });
}
paths.forEach(walk);
const sums =
  files.map((f) => createHash('sha256').update(f.data).digest('hex') + '  ' + f.name).join('\n') +
  '\n';
files.push({ name: 'ExpressIt/SHA256SUMS.txt', data: Buffer.from(sums) });
// Standard ZIP records; no shell, dependencies, deletion or signing keys.
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [],
  central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name);
  const data = deflateRawSync(file.data);
  const crc = crc32(file.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(file.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  const dir = Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50);
  dir.writeUInt16LE(20, 4);
  dir.writeUInt16LE(20, 6);
  dir.writeUInt16LE(0x800, 8);
  dir.writeUInt16LE(8, 10);
  dir.writeUInt16LE(0x21, 14);
  dir.writeUInt32LE(crc, 16);
  dir.writeUInt32LE(data.length, 20);
  dir.writeUInt32LE(file.data.length, 24);
  dir.writeUInt16LE(name.length, 28);
  dir.writeUInt32LE(offset, 42);
  local.push(header, name, data);
  central.push(dir, name);
  offset += header.length + name.length + data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
mkdirSync('release', { recursive: true });
const archive = Buffer.concat([...local, directory, end]);
const path = 'release/expressit-' + version + '.zip';
writeFileSync(path, archive);
writeFileSync(
  path + '.sha256',
  createHash('sha256').update(archive).digest('hex') + '  ' + path.split('/').pop() + '\n',
);
console.log(
  'Packaged ' +
    files.length +
    ' files: ' +
    path +
    ' (' +
    archive.length +
    ' bytes). Unsigned; see README for installation.',
);
