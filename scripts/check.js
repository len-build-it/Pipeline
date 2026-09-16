import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

let hasErrors = false;

function error(msg) {
  console.error(`[check:error] ${msg}`);
  hasErrors = true;
}

function info(msg) {
  console.log(`[check:info] ${msg}`);
}

// 1. Collect all JS files
function getFiles(dir, exts = ['.js', '.mjs']) {
  let results = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(getFiles(filePath, exts));
      }
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(filePath);
    }
  }
  return results;
}

info('Checking JavaScript syntax across repository...');
const jsFiles = [
  ...getFiles(join(rootDir, 'db')),
  ...getFiles(join(rootDir, 'server')),
  ...getFiles(join(rootDir, 'web')),
  ...getFiles(join(rootDir, 'scripts')),
  ...getFiles(join(rootDir, 'tests')),
  ...getFiles(rootDir, ['.js']).filter(f => dirname(f) === rootDir)
];

for (const file of jsFiles) {
  const checkResult = spawnSync('node', ['--check', file], { stdio: 'pipe', encoding: 'utf-8' });
  if (checkResult.status !== 0) {
    error(`Syntax error in ${file}:\n${checkResult.stderr}`);
  }
}

// 2. Verify static asset references in web/index.html
const indexHtmlPath = join(rootDir, 'web', 'index.html');
if (existsSync(indexHtmlPath)) {
  info('Verifying static references in web/index.html...');
  const html = readFileSync(indexHtmlPath, 'utf-8');

  // Match href and src attributes pointing to relative assets
  const refRegex = /(?:href|src)=["']([^"':#]+)["']/g;
  let match;
  while ((match = refRegex.exec(html)) !== null) {
    const ref = match[1];
    if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('//') || ref.startsWith('data:')) {
      continue;
    }
    const cleanRef = ref.split('?')[0].split('#')[0];
    const target = join(rootDir, 'web', cleanRef.startsWith('/') ? cleanRef.slice(1) : cleanRef);
    if (!existsSync(target)) {
      error(`Broken reference in web/index.html: "${ref}" -> file not found at ${target}`);
    }
  }
}

// 3. Verify ES module import specifiers in web/js
info('Verifying local ES module imports...');
const webJsFiles = getFiles(join(rootDir, 'web', 'js'));
for (const file of webJsFiles) {
  const content = readFileSync(file, 'utf-8');
  const importRegex = /(?:import|from)\s+['"](\.[^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const resolvedPath = resolve(dirname(file), importPath);
    if (!existsSync(resolvedPath)) {
      error(`Broken import in ${file}: "${importPath}" -> file not found at ${resolvedPath}`);
    }
  }
}

if (hasErrors) {
  console.error('\nVerification failed with errors.');
  process.exit(1);
} else {
  info(`All ${jsFiles.length} JavaScript files and references verified successfully.`);
  process.exit(0);
}
