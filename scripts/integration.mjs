import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';

const root = resolve('.');
await mkdir(join(root, '.test-runtime'), { recursive: true });
const testRoot = await mkdtemp(join(root, '.test-runtime', 'integration-'));
try {
  const workspace = join(testRoot, 'workspace');
  const settings = join(testRoot, 'user', 'User');
  const suite = join(testRoot, 'suite.cjs');
  await Promise.all([mkdir(workspace), mkdir(settings, { recursive: true })]);
  await writeFile(
    join(settings, 'settings.json'),
    JSON.stringify({
      'workbench.startupEditor': 'none',
      'security.workspace.trust.enabled': false,
      'telemetry.telemetryLevel': 'off',
      'update.mode': 'none',
    }),
  );
  await build({
    entryPoints: [join(root, 'test/integration/index.ts')],
    outfile: suite,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['vscode'],
  });
  await runTests({
    version: process.env.SYNTAXCRAFT_VSCODE_VERSION || '1.100.3',
    vscodeExecutablePath: process.env.SYNTAXCRAFT_VSCODE_EXECUTABLE,
    extensionDevelopmentPath: [
      'colors',
      'icons',
      'organizer',
      'control-center',
      'extension-pack',
    ].map((name) => join(root, 'packages', name)),
    extensionTestsPath: suite,
    launchArgs: [
      workspace,
      '--user-data-dir',
      join(testRoot, 'user'),
      '--extensions-dir',
      join(testRoot, 'extensions'),
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      '--disable-gpu',
      ...(process.platform === 'linux' && process.env.DISPLAY && !process.env.WAYLAND_DISPLAY
        ? ['--ozone-platform=x11']
        : []),
      ...(typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : []),
    ],
  });
} finally {
  await rm(testRoot, { recursive: true, force: true, maxRetries: 3 });
}
