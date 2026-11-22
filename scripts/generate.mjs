import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const name of ['colors', 'icons']) {
  const generator = fileURLToPath(
    new URL(`../packages/${name}/scripts/generate.mjs`, import.meta.url),
  );
  if (existsSync(generator)) {
    const result = spawnSync(process.execPath, [generator], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
