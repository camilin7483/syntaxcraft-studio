import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { manifestFor, modules, root } from './release-data.mjs';

const output = resolve(process.argv[2] ?? join(root, 'release'));
const scratch = join(root, '.test-runtime');
await Promise.all([mkdir(output, { recursive: true }), mkdir(scratch, { recursive: true })]);
const stage = await mkdtemp(join(scratch, 'package-'));
const vsce = join(root, 'node_modules', '@vscode', 'vsce', 'vsce');
const checksums = [];
try {
  for (const [name, assets] of Object.entries(modules)) {
    const source = join(root, 'packages', name);
    const extension = join(stage, name);
    const manifest = await manifestFor(name);
    const file = `${manifest.name}-${manifest.version}.vsix`;
    const archive = join(output, file);
    await mkdir(extension);
    await Promise.all([
      ...['package.json', 'README.md', 'icon.png', ...assets].map((asset) =>
        cp(join(source, asset), join(extension, asset), { recursive: true }),
      ),
      ...['LICENSE', 'CHANGELOG.md'].map((name) => cp(join(root, name), join(extension, name))),
    ]);
    const result = spawnSync(
      process.execPath,
      [
        vsce,
        'package',
        '--no-dependencies',
        '--allow-missing-repository',
        '--no-rewrite-relative-links',
        '--out',
        archive,
      ],
      { cwd: extension, stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Packaging ${name} returned ${result.status}`);
    const hash = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex');
    checksums.push(`${hash}  ${file}`);
  }
  await writeFile(join(output, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
} finally {
  await rm(stage, { recursive: true, force: true });
}
