import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/stamp-version.js <version>');
  process.exit(1);
}

function stamp(filePath, key = 'version') {
  const fullPath = resolve(projectRoot, filePath);
  const json = JSON.parse(readFileSync(fullPath, 'utf8'));
  json[key] = version;
  writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n');
}

stamp('package.json');
stamp('src/manifest.json');

function stampVersionName(filePath) {
  const fullPath = resolve(projectRoot, filePath);
  const json = JSON.parse(readFileSync(fullPath, 'utf8'));
  json.version_name = `v${version}`;
  writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n');
}
stampVersionName('src/manifest.json');

console.log(`Version stamped: ${version}`);
