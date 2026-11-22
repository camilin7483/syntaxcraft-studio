import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const modules = {
  colors: ['themes', 'LANGUAGES.md'],
  icons: ['themes', 'assets'],
  organizer: ['dist'],
  'control-center': ['dist'],
  'extension-pack': [],
};

export async function manifestFor(name) {
  return JSON.parse(await readFile(join(root, 'packages', name, 'package.json'), 'utf8'));
}
