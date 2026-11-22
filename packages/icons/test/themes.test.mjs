import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = new URL('../', import.meta.url);

function localResource(owner, path) {
  assert.match(path, /^(?:\.\/|\.\.\/)/);
  const url = new URL(path, owner);
  const withinPackage = relative(fileURLToPath(root), fileURLToPath(url));
  assert.doesNotMatch(withinPackage, /^\.\./);
  return url;
}

const readJSON = (url) => JSON.parse(readFileSync(url, 'utf8'));
const manifest = readJSON(new URL('package.json', root));
const requiredFolders = [
  'src',
  'public',
  'assets',
  'components',
  'services',
  'controllers',
  'models',
  'views',
  'routes',
  'database',
  'tests',
  'config',
  'scripts',
  'docs',
  'hooks',
  'utilities',
  'api',
];
const requiredExtensions = {
  php: 'php',
  html: 'html',
  css: 'css',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  java: 'java',
  rs: 'rust',
  sql: 'sql',
  json: 'json',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  csv: 'csv',
  tsx: 'react',
  vue: 'vue',
  'component.ts': 'angular',
  svelte: 'svelte',
  'blade.php': 'laravel',
  tf: 'infra',
  'spec.ts': 'test',
  'test.js': 'test',
};
const requiredNames = {
  'readme.md': 'readme',
  license: 'license',
  '.gitignore': 'git',
  dockerfile: 'docker',
  'compose.yml': 'docker',
  'angular.json': 'angular',
  artisan: 'laravel',
  'tsconfig.json': 'config',
  '.gitlab-ci.yml': 'workflow',
  'phpunit.xml': 'test',
};
const associationKeys = [
  'fileExtensions',
  'fileNames',
  'languageIds',
  'folderNames',
  'folderNamesExpanded',
];
const defaults = {
  file: 'file',
  folder: 'folder',
  folderExpanded: 'folder-open',
  rootFolder: 'root-folder',
  rootFolderExpanded: 'root-folder-open',
};

test('the manifest contributes four separate file themes and a separate product theme', () => {
  assert.equal(manifest.publisher, 'syntaxcraft-studio');
  assert.equal(manifest.name, 'syntaxcraft-icons');
  assert.ok(!manifest.main && !manifest.browser);
  assert.deepEqual(
    manifest.contributes.iconThemes.map(({ id }) => id),
    ['syntaxcraft-minimal', 'syntaxcraft-modern', 'syntaxcraft-neon', 'syntaxcraft-colorful'],
  );
  assert.deepEqual(
    manifest.contributes.productIconThemes.map(({ id }) => id),
    ['syntaxcraft-product'],
  );
});

test('the file themes cover the required associations in each color scheme', () => {
  for (const contribution of manifest.contributes.iconThemes) {
    const url = localResource(root, contribution.path);
    const theme = readJSON(url);
    const entries = [
      [theme, ''],
      [theme.light, '-light'],
      [theme.highContrast, '-high-contrast'],
    ];
    for (const [mapping, suffix] of entries) {
      for (const [key, expected] of Object.entries(defaults)) {
        assert.equal(mapping[key], expected + suffix);
      }
      for (const [key, expected] of Object.entries(requiredExtensions)) {
        assert.equal(mapping.fileExtensions[key], expected + suffix);
      }
      for (const [key, expected] of Object.entries(requiredNames)) {
        assert.equal(mapping.fileNames[key], expected + suffix);
      }
      for (const name of requiredFolders) {
        assert.equal(mapping.folderNames[name], `folder-${name}${suffix}`);
        assert.equal(mapping.folderNamesExpanded[name], `folder-${name}-open${suffix}`);
      }
      const referenced = [
        ...Object.keys(defaults).map((key) => mapping[key]),
        ...associationKeys.flatMap((key) => Object.values(mapping[key])),
      ];
      for (const iconId of referenced) {
        assert.ok(
          theme.iconDefinitions[iconId],
          `Missing definition ${iconId} in ${contribution.id}`,
        );
      }
    }
  }
});

test('SVG resources are local, passive, and distinct across styles and folder states', () => {
  const exampleIcons = new Map();
  const seen = new Set();
  for (const contribution of manifest.contributes.iconThemes) {
    const url = localResource(root, contribution.path);
    const theme = readJSON(url);
    const assets = {};
    for (const [id, { iconPath }] of Object.entries(theme.iconDefinitions)) {
      const asset = localResource(url, iconPath);
      assert.equal(asset.pathname.slice(-4), '.svg');
      assert.ok(!seen.has(asset.href), `Repeated asset path ${asset.href}`);
      seen.add(asset.href);
      const artwork = readFileSync(asset, 'utf8');
      assert.match(artwork, /viewBox="0 0 24 24"/);
      assert.doesNotMatch(artwork, /<!|<\?|(?:\bon\w+|\bhref|\bstyle)\s*=|url\s*\(/i);
      for (const [, element] of artwork.matchAll(/<\/?([A-Za-z]+)\b/g)) {
        assert.ok(
          ['svg', 'g', 'path', 'circle'].includes(element),
          `Unexpected SVG element ${element}`,
        );
      }
      assets[id] = artwork;
    }
    for (const icon of [
      'folder',
      'root-folder',
      ...requiredFolders.map((name) => `folder-${name}`),
    ]) {
      assert.notEqual(assets[icon], assets[`${icon}-open`]);
    }
    for (const icon of ['file', 'javascript', 'react', 'folder-src', 'folder-tests-open']) {
      const styles = exampleIcons.get(icon) ?? new Set();
      styles.add(assets[icon]);
      exampleIcons.set(icon, styles);
    }
  }
  for (const styles of exampleIcons.values()) {
    assert.equal(styles.size, 4);
  }
});

function woffTable(woff, tag) {
  const size = woff.readUInt16BE(12);
  for (let i = 0; i < size; i += 1) {
    const entry = 44 + 20 * i;
    if (woff.toString('ascii', entry, entry + 4) === tag) {
      const start = woff.readUInt32BE(entry + 4);
      const encodedLength = woff.readUInt32BE(entry + 8);
      const originalLength = woff.readUInt32BE(entry + 12);
      const bytes = woff.subarray(start, start + encodedLength);
      const decoded = encodedLength === originalLength ? bytes : inflateSync(bytes);
      assert.equal(decoded.length, originalLength);
      return decoded;
    }
  }
  assert.fail(`WOFF table missing: ${tag}`);
}

function glyphIndex(cmap, codepoint) {
  const unicodeTableCount = cmap.readUInt16BE(2);
  for (let entry = 0; entry < unicodeTableCount; entry += 1) {
    const table = cmap.subarray(cmap.readUInt32BE(8 + entry * 8));
    if (table.readUInt16BE(0) !== 4) {
      continue;
    }
    const segmentCount = table.readUInt16BE(6) / 2;
    for (let i = 0; i < segmentCount; i += 1) {
      const start = table.readUInt16BE(16 + (segmentCount + i) * 2);
      const end = table.readUInt16BE(14 + i * 2);
      if (start <= codepoint && codepoint <= end) {
        const delta = table.readInt16BE(16 + (2 * segmentCount + i) * 2);
        const rangeLocation = 16 + (3 * segmentCount + i) * 2;
        const rangeOffset = table.readUInt16BE(rangeLocation);
        const slot = rangeOffset
          ? table.readUInt16BE(rangeLocation + rangeOffset + 2 * (codepoint - start))
          : codepoint;
        return slot ? (slot + delta) & 0xffff : 0;
      }
    }
  }
  return 0;
}

test('every workbench glyph has a mapped, nonempty outline in the bundled WOFF', () => {
  const url = localResource(root, manifest.contributes.productIconThemes[0].path);
  const theme = readJSON(url);
  assert.equal(theme.fonts.length, 1);
  assert.equal(theme.fonts[0].src[0].format, 'woff');
  const woff = readFileSync(localResource(url, theme.fonts[0].src[0].path));
  assert.equal(woff.toString('ascii', 0, 4), 'wOFF');
  assert.equal(woff.readUInt32BE(8), woff.length);
  const cmap = woffTable(woff, 'cmap');
  const loca = woffTable(woff, 'loca');
  const glyf = woffTable(woff, 'glyf');
  const isShortOffset = woffTable(woff, 'head').readInt16BE(50) === 0;
  const contourOffset = (index) =>
    isShortOffset ? 2 * loca.readUInt16BE(index * 2) : loca.readUInt32BE(index * 4);
  const indices = new Set();

  for (const id of [
    'explorer-view-icon',
    'search-view-icon',
    'source-control-view-icon',
    'run-view-icon',
    'extensions-view-icon',
    'test-view-icon',
    'terminal-view-icon',
    'settings-view-bar-icon',
    'accounts-view-bar-icon',
  ]) {
    const { fontId, fontCharacter } = theme.iconDefinitions[id];
    assert.equal(fontId, theme.fonts[0].id);
    assert.match(fontCharacter, /^\\E[0-9A-F]{3}$/);
    const index = glyphIndex(cmap, Number.parseInt(fontCharacter.slice(1), 16));
    assert.ok(index > 0 && !indices.has(index), `Invalid or reused glyph for ${id}`);
    indices.add(index);
    const offset = contourOffset(index);
    assert.ok(contourOffset(index + 1) > offset && glyf.readInt16BE(offset) > 0);
  }
  assert.equal(indices.size, Object.keys(theme.iconDefinitions).length);
});
