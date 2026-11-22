import { glob } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tests = [];
for await (const file of glob(['packages/**/test/**/*.test.{ts,mjs}', 'test/*.test.{ts,mjs}'], {
  exclude: ['**/node_modules/**', '**/dist/**'],
})) {
  tests.push(file);
}
if (!tests.length) throw new Error('No unit tests found');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests.sort()], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
