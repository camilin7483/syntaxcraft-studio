import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Memento } from 'vscode';
import { contrastRatio, parseColor } from '../packages/control-center/src/color';
import { webviewHtml } from '../packages/control-center/src/html';
import { ProfileStore } from '../packages/control-center/src/profile-store';
import {
  builtInProfiles,
  decodeProfile,
  emptyProfile,
  maxProfileBytes,
  validateProfile,
} from '../packages/control-center/src/profile';
import { readRequest } from '../packages/control-center/src/protocol';
import {
  prepareApplication,
  prepareUndo,
  revertSettings,
} from '../packages/control-center/src/settings-plan';
import type { SettingValues } from '../packages/control-center/src/settings-plan';

const encoder = new TextEncoder();
const id = '86f5b453-4bb1-4842-817f-cf5212899b0e';

test('normalizes the three color formats and reports WCAG contrast', () => {
  assert.equal(parseColor('#da4'), '#DDAA44');
  assert.equal(parseColor('rgb(100% 0% 25%)'), '#FF0040');
  assert.equal(parseColor('hsl(-60deg, 100%, 50%)'), '#FF00FF');
  assert.equal(parseColor('hsl(223 55% 31%)'), '#243C7B');
  assert.equal(parseColor('rgb(256, 10, 100)'), undefined);
  assert.equal(parseColor('rgba(25,0,25,.8)'), undefined);
  assert.equal(parseColor('#fff; url(https://example.com)'), undefined);
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#222222', '#222222'), 1);
});

test('imports and exports profiles without accepting commands, paths, or prototype keys', () => {
  const profile = {
    ...emptyProfile('Palette'),
    rules: [
      { token: 'class', language: 'typescript', foreground: 'rgb(231, 193, 255)', style: 'bold' },
    ],
    preferences: { fontSize: 17, formatOnSave: false },
    workbench: { 'editor.background': '#141525' },
  };
  const parsed = decodeProfile(encoder.encode(JSON.stringify(profile)));
  assert.equal(parsed.rules[0]?.foreground, '#E7C1FF');
  assert.deepEqual(decodeProfile(encoder.encode(JSON.stringify(parsed))), parsed);
  for (const preset of builtInProfiles) assert.deepEqual(validateProfile(preset), preset);
  assert.throws(() => decodeProfile(new Uint8Array(maxProfileBytes + 1)), /límite/);
  assert.throws(() => decodeProfile(new Uint8Array([0xc0, 0xaf])), /UTF-8/);
  assert.throws(
    () => validateProfile({ ...profile, command: 'workbench.action.closeWindow' }),
    /versión/,
  );
  assert.throws(
    () =>
      validateProfile({ ...profile, preferences: JSON.parse('{"__proto__":{"polluted":true}}') }),
    /ajuste/,
  );
  assert.throws(
    () => validateProfile({ ...profile, rules: [...profile.rules, ...profile.rules] }),
    /duplicadas/,
  );
  assert.throws(
    () => validateProfile({ ...profile, workbench: { 'terminal.external.linuxExec': '#000000' } }),
    /no admitido/,
  );
});

test('checks every Webview message against its exact action schema', () => {
  assert.deepEqual(readRequest({ id: 12, type: 'undo', scope: 'workspace' }), {
    id: 12,
    type: 'undo',
    scope: 'workspace',
  });
  assert.equal(
    readRequest({ id: 1, type: 'organizerAction', action: 'formatSelection' }).type,
    'organizerAction',
  );
  const invalid = [
    { id: 1, type: 'nativeSettings', setting: 'security.workspace.trust.enabled' },
    { id: 1, type: 'organizerAction', action: 'workbench.action.closeWindow' },
    { id: 1, type: 'sample', language: 'typescript', path: '/test' },
    { id: -1, type: 'ready' },
    { id: 1, type: 'apply', scope: 'workspaceFolder', profile: emptyProfile() },
    { id: 1, type: 'saveProfile', profile: emptyProfile(), edit: { profileId: id, revision: 0 } },
  ];
  for (const value of invalid) assert.throws(() => readRequest(value));
});

test('Webview document requires a local script nonce and escapes attributes', () => {
  const html = webviewHtml({
    cspSource: 'vscode-webview:',
    nonce: 'deafbeef',
    script: 'vscode-webview://local/app.js',
    stylesheet: 'vscode-webview://local/style.css',
    icons: '" onmouseover="error()',
    section: 'dashboard',
  });
  assert.match(html, /default-src &#39;none&#39;/);
  assert.match(html, /connect-src &#39;none&#39;/);
  assert.match(html, /script-src &#39;nonce-deafbeef&#39;/);
  assert.match(html, /nonce="deafbeef"/);
  assert.match(html, /data-icons="&quot; onmouseover=&quot;error\(\)"/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|https?:\/\//);
});

test('profile revisions persist and a stale edit or deletion is rejected', async () => {
  const values = new Map<string, unknown>();
  const storage = {
    get: (key: string) => values.get(key),
    async update(key: string, value: unknown) {
      values.set(key, structuredClone(value));
    },
    keys: () => [...values.keys()],
  } as Memento;
  const store = new ProfileStore(storage);
  const created = await store.save(emptyProfile('Testing'));
  const restarted = new ProfileStore(storage);
  assert.deepEqual(restarted.list(), [created]);
  const edited = await restarted.save(emptyProfile('Changed'), {
    profileId: created.id,
    revision: created.revision,
  });
  await assert.rejects(
    store.save(emptyProfile(), { profileId: created.id, revision: created.revision }),
    /revisión/,
  );
  await assert.rejects(store.delete(edited.id, created.revision), /revisión/);
  await store.delete(edited.id, edited.revision);
  assert.deepEqual(restarted.list(), []);
});

test('native color plans preserve inherited rules and undo individual edited fields', () => {
  const current = {
    'workbench.colorCustomizations': {
      'editor.background': '#101010',
      'tab.activeForeground': '#CCCCCC',
    },
    'editor.semanticTokenColorCustomizations': {
      enabled: true,
      rules: { 'class:typescript': '#ABCDEF' },
    },
  };
  const oldRule = { name: 'Personal', scope: 'string', settings: { foreground: '#FCFCCC' } };
  const user = { 'editor.tokenColorCustomizations': { textMateRules: [oldRule] } };
  const profile = validateProfile({
    ...emptyProfile(),
    workbench: { 'editor.background': '#151525' },
    rules: [
      { token: 'class', language: 'typescript', style: 'bold', mechanism: 'semantic' },
      { token: 'comment', language: 'python', foreground: '#FFCCEE', mechanism: 'textmate' },
    ],
  });
  const plan = prepareApplication(current, user, [], profile, id);
  assert.equal(plan.changes.length, 3);
  const result = Object.fromEntries(plan.changes.map(({ key, after }) => [key, after]));
  const tm = result['editor.tokenColorCustomizations'] as {
    textMateRules: { name: string; scope: string[] }[];
  };
  assert.deepEqual(tm.textMateRules[0], oldRule);
  assert.equal(tm.textMateRules[1]?.name.startsWith(`SyntaxCraft: [${id}:0]`), true);
  assert.match(String(tm.textMateRules[1]?.scope), /source\.python/);
  assert.deepEqual(result['editor.semanticTokenColorCustomizations'], {
    enabled: true,
    rules: {
      'class:typescript': {
        foreground: '#ABCDEF',
        bold: true,
        italic: false,
        underline: false,
        strikethrough: false,
      },
    },
  });
  assert.deepEqual(revertSettings(result, plan.overlay).values, current);

  const external = {
    ...result,
    'workbench.colorCustomizations': {
      'editor.background': '#090909',
      'tab.activeForeground': '#F0F0F0',
      'editorLineNumber.foreground': '#CCCCCC',
    },
  };
  const undo = prepareUndo(external, plan.changes);
  assert.deepEqual(undo.conflicts, ['workbench.colorCustomizations']);
  assert.equal(
    undo.changes.some(({ key }) => key === 'workbench.colorCustomizations'),
    false,
  );
  const following = prepareApplication(
    external,
    user,
    plan.overlay,
    {
      ...emptyProfile(),
      rules: [{ token: 'comment', language: 'php', foreground: '#FEDCBA', mechanism: 'textmate' }],
    },
    '25a7b463-ddb1-448c-83b7-c53327a607f1',
  );
  const updated = following.changes.find(({ key }) => key === 'editor.tokenColorCustomizations')
    ?.after as typeof tm;
  assert.equal(updated.textMateRules.length, 2);
  assert.match(String(updated.textMateRules[1]?.scope), /php/);
});

test('restoring a TextMate list keeps external rules added after applying', () => {
  const current = emptyProfile();
  current.rules.push({ token: 'comment', foreground: '#E7CFBF', mechanism: 'textmate' });
  const snapshot: SettingValues = { 'editor.tokenColorCustomizations': { textMateRules: [] } };
  const plan = prepareApplication(snapshot, {}, [], current, id);
  const active = plan.changes[0]?.after as { textMateRules: unknown[] };
  const manual = { scope: 'keyword', settings: { foreground: '#EADDCC' } };
  const edited = {
    'editor.tokenColorCustomizations': { textMateRules: [manual, ...active.textMateRules] },
  };
  assert.deepEqual(revertSettings(edited, plan.overlay), {
    conflicts: [],
    values: { 'editor.tokenColorCustomizations': { textMateRules: [manual] } },
  });
});
