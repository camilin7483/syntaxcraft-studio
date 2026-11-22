import assert from 'node:assert/strict';
import test from 'node:test';
import { getProviderStatus, type EffectiveSettings } from '../src/providers';
import { normalizeNewlines, previewEdits, trailingWhitespaceStart } from '../src/text-edits';

const defaults: EffectiveSettings = {
  defaultFormatter: null,
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: true,
  renderWhitespace: 'selection',
  indentationGuides: true,
  bracketPairGuides: false,
  folding: true,
  foldingStrategy: 'auto',
  formatOnSave: false,
  formatOnSaveMode: 'file',
  codeActionsOnSave: {},
  eol: 'auto',
  trimTrailingWhitespace: false,
};

test('previews sorted, nonoverlapping text changes using UTF-16 offsets', () => {
  const before = 'a😀bc\r\nd';
  const edits = [
    { start: 7, end: 7, newText: 'e' },
    { start: 1, end: 3, newText: 'é' },
  ];
  assert.equal(previewEdits(before, edits)?.after, 'aébc\r\ned');
  assert.equal(edits[0]?.start, 7);
  assert.equal(
    previewEdits(before, [
      { start: 1, end: 3, newText: '' },
      { start: 3, end: 4, newText: 'z' },
    ])?.after,
    'azc\r\nd',
  );
});

test('rejects ambiguous same-position edits, overlaps and out-of-bounds ranges', () => {
  const edit = (start: number, end: number) => ({ start, end, newText: 'x' });
  assert.equal(previewEdits('abc', [edit(1, 1), edit(1, 1)]), undefined);
  assert.equal(previewEdits('abc', [edit(0, 2), edit(1, 3)]), undefined);
  assert.equal(previewEdits('abc', [edit(2, 1)]), undefined);
  assert.equal(previewEdits('abc', [edit(-1, 0)]), undefined);
  assert.equal(previewEdits('abc', [edit(1, 4)]), undefined);
  assert.equal(previewEdits('abc', [edit(1.25, 2)]), undefined);
});

test('removes only trailing horizontal ASCII whitespace and preserves line content', () => {
  for (const [line, expected] of [
    ['\tword\t  ', 5],
    ['', 0],
    [' \t', 0],
    ['hello\u00a0 ', 6],
    ['a b', 3],
  ] as const) {
    assert.equal(trailingWhitespaceStart(line), expected);
  }
  assert.equal(normalizeNewlines('a\rb\nc\r\nd', '\r\n'), 'a\r\nb\r\nc\r\nd');
});

test('reports multiple candidates and tracks an explicitly configured default without activating extensions', () => {
  const extension = (id: string) =>
    ['esbenp.prettier-vscode', 'vscode.typescript-language-features'].includes(id)
      ? { isActive: id.startsWith('vscode.') }
      : undefined;
  const read = () => undefined;
  const multiple = getProviderStatus({
    languageId: 'typescript',
    effective: defaults,
    extension,
    read,
  });
  assert.equal(multiple.conflicts[0]?.code, 'multiple-formatter-candidates');
  assert.equal(
    multiple.formatters.find(({ id }) => id === 'esbenp.prettier-vscode')?.active,
    false,
  );
  const selected = getProviderStatus({
    languageId: 'javascript',
    effective: { ...defaults, defaultFormatter: 'EsbenP.prettier-vscode' },
    extension,
    read,
  });
  assert.equal(
    selected.formatters.find(({ configured }) => configured)?.id,
    'esbenp.prettier-vscode',
  );
  assert.deepEqual(selected.conflicts, []);
  const absent = getProviderStatus({
    languageId: 'javascript',
    effective: { ...defaults, defaultFormatter: 'custom.unavailable-formatter' },
    extension,
    read,
  });
  assert.equal(absent.conflicts[0]?.code, 'default-formatter-not-detected');
});

test('distinguishes Python import organizers, formatting and disabled registrations', () => {
  const extension = () => ({ isActive: true });
  const read = (key: string) => ({ 'ruff.organizeImports': false })[key as 'ruff.organizeImports'];
  const result = getProviderStatus({ languageId: 'python', effective: defaults, extension, read });
  assert.equal(
    result.formatters.find(({ id }) => id === 'ms-python.black-formatter')?.selectionFormatting,
    'unsupported',
  );
  assert.equal(
    result.formatters.find(({ id }) => id === 'charliermarsh.ruff')?.availability,
    'candidate',
  );
  assert.equal(
    result.importOrganizers.find(({ id }) => id === 'charliermarsh.ruff')?.availability,
    'disabled',
  );
  assert.equal(
    result.importOrganizers.some(({ id }) => id === 'ms-python.black-formatter'),
    false,
  );
  assert.equal(
    result.importOrganizers.find(({ id }) => id === 'ms-python.isort')?.availability,
    'candidate',
  );
  assert.equal(
    result.conflicts.some(({ code }) => code === 'multiple-import-organizer-candidates'),
    false,
  );
});

test('detects ESLint duplicate save work and honors a specific exclusion', () => {
  const effective = {
    ...defaults,
    defaultFormatter: 'dbaeumer.vscode-eslint',
    formatOnSave: true,
    codeActionsOnSave: { 'source.fixAll': 'always', 'source.fixAll.eslint': 'never' },
  } satisfies EffectiveSettings;
  const context = {
    languageId: 'javascript',
    effective,
    extension: () => ({ isActive: true }),
    read: (key: string) => (key === 'eslint.format.enable' ? true : undefined),
  };
  assert.deepEqual(getProviderStatus(context).conflicts, []);
  assert.equal(
    getProviderStatus({
      ...context,
      effective: { ...effective, codeActionsOnSave: ['source.fixAll.eslint'] },
    }).conflicts[0]?.code,
    'eslint-duplicate-save',
  );
  assert.equal(
    getProviderStatus({ ...context, read: () => undefined }).conflicts[0]?.code,
    'default-formatter-disabled',
  );
});
