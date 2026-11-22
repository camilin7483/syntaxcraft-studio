import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const fromRoot = (relative) => join(root, relative);
const web = 'packages/control-center/dist/web';
const packageNames = ['colors', 'icons', 'organizer', 'control-center', 'extension-pack'];
await Promise.all(
  ['packages/organizer/dist', 'packages/control-center/dist'].map((dir) =>
    rm(fromRoot(dir), { recursive: true, force: true }),
  ),
);
await mkdir(fromRoot(web), { recursive: true });
await Promise.all(
  packageNames.map((name) =>
    copyFile(fromRoot('assets/studio.png'), fromRoot(`packages/${name}/icon.png`)),
  ),
);

const bundled = { absWorkingDir: root, bundle: true, legalComments: 'none', logLevel: 'info' };
const host = {
  ...bundled,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
};
const iconAssets = [
  'folder-src-open',
  'typescript',
  'react',
  'vue',
  'folder-tests',
  'test',
  'docker',
];

await Promise.all([
  ...['control-center', 'organizer'].map((name) =>
    build({
      ...host,
      entryPoints: [`packages/${name}/src/index.ts`],
      outfile: `packages/${name}/dist/index.cjs`,
    }),
  ),
  build({
    ...bundled,
    platform: 'browser',
    target: 'chrome132',
    format: 'iife',
    entryPoints: ['packages/control-center/src/web/app.ts'],
    outfile: `${web}/app.js`,
  }),
  copyFile(fromRoot('packages/control-center/media/studio.css'), fromRoot(`${web}/studio.css`)),
  ...['minimal', 'modern', 'neon', 'colorful'].map(async (style) => {
    const destination = fromRoot(`${web}/icons/${style}`);
    await mkdir(destination, { recursive: true });
    await Promise.all(
      iconAssets.map((asset) =>
        copyFile(
          fromRoot(`packages/icons/assets/file-icons/${style}/${asset}.svg`),
          fromRoot(`${web}/icons/${style}/${asset}.svg`),
        ),
      ),
    );
  }),
]);
