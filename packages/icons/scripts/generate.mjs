import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { files, folders } from './catalog.mjs';
import { renderFile, renderFolder } from './render.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const check = process.argv.includes('--check');
const schemes = ['dark', 'light', 'high-contrast'];
const mappingKeys = [
  'fileExtensions',
  'fileNames',
  'languageIds',
  'folderNames',
  'folderNamesExpanded',
];

const setAssociation = (table, name, id) => {
  if (Object.hasOwn(table, name)) {
    throw new Error(
      `Duplicate association "${name}" for ${id} (already mapped to ${table[name]}).`,
    );
  }
  table[name] = id;
};

// These names follow the VS Code File Icon Theme association schema.
// https://code.visualstudio.com/api/extension-guides/file-icon-theme#file-association
const associations = {
  file: 'file',
  folder: 'folder',
  folderExpanded: 'folder-open',
  rootFolder: 'root-folder',
  rootFolderExpanded: 'root-folder-open',
  ...Object.fromEntries(mappingKeys.map((key) => [key, {}])),
};

for (const [id, { extensions = [], names = [], languages = [] }] of Object.entries(files)) {
  for (const extension of extensions) {
    setAssociation(associations.fileExtensions, extension, id);
  }
  for (const name of names) {
    setAssociation(associations.fileNames, name, id);
  }
  for (const language of languages) {
    setAssociation(associations.languageIds, language, id);
  }
}

for (const [id, { names = [] }] of Object.entries(folders)) {
  for (const name of names) {
    setAssociation(associations.folderNames, name, id);
    setAssociation(associations.folderNamesExpanded, name, `${id}-open`);
  }
}

function associationVariant(suffix) {
  const mapping = {};
  for (const [key, value] of Object.entries(associations)) {
    mapping[key] =
      typeof value === 'string'
        ? `${value}${suffix}`
        : Object.fromEntries(Object.entries(value).map(([name, id]) => [name, `${id}${suffix}`]));
  }
  return mapping;
}

const stale = [];

async function emit(url, content) {
  if (!check) {
    await writeFile(url, content);
    return;
  }
  const existing = await readFile(url, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  if (content !== existing) {
    stale.push(url.pathname.slice(root.pathname.length));
  }
}

const themeContributions = manifest.contributes.iconThemes;
for (const { id, path } of themeContributions) {
  const style = id.replace(/^syntaxcraft-/, '');
  const styleRoot = new URL(`assets/file-icons/${style}/`, root);
  const definitions = {};

  for (const scheme of schemes) {
    const suffix = scheme === 'dark' ? '' : `-${scheme}`;
    const subdirectory = scheme === 'dark' ? '' : `${scheme}/`;
    const target = new URL(subdirectory, styleRoot);
    if (!check) {
      await mkdir(target, { recursive: true });
    }

    async function emitIcon(icon, content) {
      definitions[`${icon}${suffix}`] = {
        iconPath: `../assets/file-icons/${style}/${subdirectory}${icon}.svg`,
      };
      await emit(new URL(`${icon}.svg`, target), content);
    }

    const writes = [];
    for (const [icon, { tone }] of Object.entries(files)) {
      writes.push(emitIcon(icon, renderFile(icon, tone, style, scheme)));
    }
    for (const [icon, { tone, mark }] of Object.entries(folders)) {
      writes.push(emitIcon(icon, renderFolder(mark, false, tone, style, scheme)));
      writes.push(emitIcon(`${icon}-open`, renderFolder(mark, true, tone, style, scheme)));
    }
    await Promise.all(writes);
  }

  // The light and high contrast sections override the same catalog with matching assets.
  const theme = {
    iconDefinitions: definitions,
    ...associations,
    light: associationVariant('-light'),
    highContrast: associationVariant('-high-contrast'),
    showLanguageModeIcons: false,
    hidesExplorerArrows: false,
  };

  await emit(new URL(path, root), JSON.stringify(theme, null, 2) + '\n');
}

if (stale.length) {
  const examples = stale.sort().slice(0, 8);
  throw new Error(
    `${stale.length} generated file(s) are stale. Run npm run build.\n${examples.join('\n')}`,
  );
}
