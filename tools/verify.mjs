import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const htmlPath = resolve(dist, 'index.html');
const zipPath = resolve(root, 'my-web-lens.zip');
const MAX_INDEX = 1 * 1024 * 1024;
const MAX_ZIP = 8 * 1024 * 1024;
let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) failures += 1;
};

check(existsSync(htmlPath), 'dist/index.html exists at the build root');
if (!existsSync(htmlPath)) process.exit(1);

const html = readFileSync(htmlPath, 'utf8');
const htmlBytes = statSync(htmlPath).size;
check(htmlBytes <= MAX_INDEX, `index.html is ${(htmlBytes / 1024).toFixed(1)} KiB (limit 1024 KiB)`);
check(!/<(?:script|link|img)[^>]+(?:src|href)=["']\/(?!\/)/i.test(html), 'index.html has no absolute-root asset references');

const localRefs = [];
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)) {
  const url = match[1];
  if (/^(?:[a-z]+:|\/\/|#|data:|blob:)/i.test(url)) continue;
  localRefs.push(url.split(/[?#]/)[0]);
}
for (const ref of localRefs) {
  const normalized = ref.startsWith('./') ? ref.slice(2) : ref;
  const target = resolve(dist, normalized);
  const relativeTarget = relative(dist, target);
  const isInside = relativeTarget !== '..' && !relativeTarget.startsWith(`..${sep}`) && !relativeTarget.startsWith('../');
  check(isInside && existsSync(target), `HTML asset reference exists: ${ref}`);
}

// Check built JS/CSS for accidental absolute-root URL paths and remote dependencies.
const assetFiles = collectFiles(dist);
let sourceText = '';
for (const path of assetFiles) {
  if (/\.(?:js|mjs|css|html)$/i.test(path)) sourceText += `\n${readFileSync(path, 'utf8')}`;
}
check(!/(?:src|href)=["']\/(?!\/)/i.test(sourceText), 'bundled HTML/JS/CSS has no absolute-root src/href references');
check(!/https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com)/i.test(sourceText), 'no common remote font/CDN dependencies are referenced');

check(existsSync(zipPath), 'my-web-lens.zip exists (run npm run pack after build)');
if (existsSync(zipPath)) {
  const zipBytes = statSync(zipPath).size;
  check(zipBytes <= MAX_ZIP, `ZIP is ${(zipBytes / 1024 / 1024).toFixed(3)} MiB (limit 8 MiB)`);
  try {
    const entries = inspectZip(readFileSync(zipPath));
    check(entries.includes('index.html'), 'ZIP contains index.html at its root');
    check(!entries.some((entry) => entry.includes('\\')), 'all ZIP entry paths use forward slashes');
    check(entries.every((entry) => !entry.startsWith('dist/')), 'ZIP does not nest files inside dist/');
  } catch (error) {
    check(false, `ZIP central directory is valid (${error instanceof Error ? error.message : String(error)})`);
  }
}

if (failures > 0) {
  console.error(`VERIFY FAILED: ${failures} check(s) did not pass.`);
  process.exit(1);
}
console.log('VERIFY OK: all static Lens checks passed.');

function collectFiles(directory) {
  const list = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) list.push(...collectFiles(path));
    else if (entry.isFile()) list.push(path);
  }
  return list;
}

function inspectZip(buffer) {
  let eocd = -1;
  const minimum = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minimum; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('end-of-central-directory record not found');
  const count = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('invalid central directory record');
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    names.push(buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
