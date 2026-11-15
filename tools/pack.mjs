import { createWriteStream, existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const archModule = require('archiver');
const createZipArchive = (options) => {
  if (typeof archModule === 'function') return archModule('zip', options);
  if (archModule.ZipArchive) return new archModule.ZipArchive(options);
  if (archModule.Archiver) return new archModule.Archiver({ format: 'zip', ...options });
  throw new Error('Could not find archiver constructor');
};

const root = process.cwd();
const distDir = resolve(root, 'dist');
const indexPath = resolve(distDir, 'index.html');
const zipPath = resolve(root, 'my-web-lens.zip');
const MAX_INDEX = 1 * 1024 * 1024;
const MAX_ZIP = 8 * 1024 * 1024;

if (!existsSync(indexPath)) {
  console.error('PACK FAILED: dist/index.html is missing. Run "npm run build" first.');
  process.exit(1);
}
const indexBytes = statSync(indexPath).size;
if (indexBytes > MAX_INDEX) {
  console.error(`PACK FAILED: dist/index.html is ${(indexBytes / 1024).toFixed(1)} KiB; limit is 1024 KiB.`);
  process.exit(1);
}
if (existsSync(zipPath)) unlinkSync(zipPath);

const output = createWriteStream(zipPath);
const archive = createZipArchive({ zlib: { level: 9 } });
const finished = new Promise((resolvePromise, rejectPromise) => {
  output.on('close', resolvePromise);
  output.on('error', rejectPromise);
  archive.on('error', rejectPromise);
});
archive.pipe(output);
// false puts the contents of dist/ at the ZIP root; entry names use POSIX slashes.
archive.directory(distDir + '/', false);
await archive.finalize();
await finished;

const zipSize = statSync(zipPath).size;
if (zipSize > MAX_ZIP) {
  unlinkSync(zipPath);
  console.error(`PACK FAILED: archive is ${(zipSize / 1024 / 1024).toFixed(2)} MiB; limit is 8 MiB.`);
  process.exit(1);
}
const entries = inspectZip(readFileSync(zipPath));
if (!entries.includes('index.html')) {
  unlinkSync(zipPath);
  console.error('PACK FAILED: ZIP does not contain index.html at its root.');
  process.exit(1);
}
if (entries.some((entry) => entry.includes('\\'))) {
  unlinkSync(zipPath);
  console.error('PACK FAILED: ZIP contains a backslash entry path. Expected POSIX forward slashes.');
  process.exit(1);
}
console.log(`PACK OK: ${zipPath}`);
console.log(`ZIP size: ${(zipSize / 1024 / 1024).toFixed(3)} MiB / 8.000 MiB`);
console.log(`index.html: ${(indexBytes / 1024).toFixed(1)} KiB / 1024 KiB`);
console.log(`ZIP entries: ${entries.length}; root index.html confirmed; path separators are POSIX.`);

function inspectZip(buffer) {
  let eocd = -1;
  const minimum = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minimum; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: end-of-central-directory record not found.');
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP central directory entry.');
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    names.push(buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
