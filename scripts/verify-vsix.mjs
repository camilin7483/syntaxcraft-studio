import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from '@vscode/test-electron';
import { manifestFor, modules, root } from './release-data.mjs';

const output = resolve(process.argv[2] ?? join(root, 'release'));
const sums = await readFile(join(output, 'SHA256SUMS.txt'), 'utf8');
const vscode =
  process.env.SYNTAXCRAFT_VSCODE_EXECUTABLE ??
  (await downloadAndUnzipVSCode(process.env.SYNTAXCRAFT_VSCODE_VERSION || '1.100.3'));
const [cli, ...required] = resolveCliArgsFromVSCodeExecutablePath(vscode);
await mkdir(join(root, '.test-runtime'), { recursive: true });
const data = await mkdtemp(join(root, '.test-runtime', 'install-'));
const args = [
  ...required,
  '--user-data-dir',
  join(data, 'user'),
  '--extensions-dir',
  join(data, 'extensions'),
];

function code(...options) {
  const result = spawnSync(cli, [...args, ...options], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout;
}

try {
  const installed = [];
  for (const name of Object.keys(modules)) {
    const manifest = await manifestFor(name);
    const nameOnDisk = `${manifest.name}-${manifest.version}.vsix`;
    const path = join(output, nameOnDisk);
    const hash = createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
    if (!sums.split('\n').includes(`${hash}  ${nameOnDisk}`))
      throw new Error(`Unexpected SHA-256 for ${nameOnDisk}`);
    console.log(code('--install-extension', path, '--force').trim());
    installed.push(`${manifest.publisher}.${manifest.name}@${manifest.version}`);
  }
  const listed = code('--list-extensions', '--show-versions')
    .trim()
    .split(/\r?\n/)
    .map((id) => id.toLowerCase());
  for (const id of installed)
    if (!listed.includes(id)) throw new Error(`Missing installed extension: ${id}`);
  console.log(`Verified ${installed.length} isolated VSIX installs.`);
} finally {
  await rm(data, { recursive: true, force: true, maxRetries: 3 });
}
