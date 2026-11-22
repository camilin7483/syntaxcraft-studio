import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as vscode from 'vscode';
import { emptyProfile } from '../../packages/control-center/src/profile';
import { SettingsManager } from '../../packages/control-center/src/settings';
import { runOrganizerIntegration } from '../../packages/organizer/test/integration';

const ns = 'syntaxcraft-studio.syntaxcraft-';
function extension(name: string) {
  const result = vscode.extensions.getExtension<unknown>(ns + name);
  assert(result, `Missing ${name} extension`);
  return result;
}

class RecordingMemento implements vscode.Memento {
  private readonly values = new Map<string, unknown>();
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return structuredClone((this.values.get(key) ?? defaultValue) as T | undefined);
  }
  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }
  keys(): readonly string[] {
    return [...this.values.keys()];
  }
}

class InterruptedMemento extends RecordingMemento {
  private shouldFail = true;

  override async update(key: string, value: unknown): Promise<void> {
    if (
      this.shouldFail &&
      typeof value === 'object' &&
      value !== null &&
      'history' in value &&
      Array.isArray(value.history) &&
      value.history.length === 1 &&
      !('pending' in value)
    ) {
      this.shouldFail = false;
      throw new Error('Simulated journal commit failure');
    }
    await super.update(key, value);
  }
}

async function contributions() {
  const color = extension('colors');
  const icons = extension('icons');
  const pack = extension('extension-pack');
  assert.equal(color.packageJSON.contributes.themes.length, 10);
  assert.equal(icons.packageJSON.contributes.iconThemes.length, 4);
  assert.equal(icons.packageJSON.contributes.productIconThemes.length, 1);
  assert.deepEqual(
    [...pack.packageJSON.extensionPack].sort(),
    ['colors', 'icons', 'control-center', 'organizer'].map((name) => ns + name).sort(),
  );
  for (const item of [color, icons]) {
    for (const kind of ['themes', 'iconThemes', 'productIconThemes']) {
      for (const contribution of item.packageJSON.contributes[kind] ?? []) {
        const content = await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(item.extensionUri, contribution.path),
        );
        assert.ok(Object.keys(JSON.parse(new TextDecoder().decode(content))).length > 0);
      }
    }
  }
}

async function activation() {
  const center = extension('control-center');
  assert.equal(center.isActive, false);
  assert.equal(extension('organizer').isActive, false);
  assert.equal(extension('colors').isActive, false);
  assert.equal(extension('icons').isActive, false);

  const before = performance.now();
  await vscode.commands.executeCommand('syntaxcraft.controlCenter.open');
  const latency = performance.now() - before;
  assert(center.isActive);
  assert(extension('organizer').isActive === false);
  assert(
    vscode.window.tabGroups.all.some((group) =>
      group.tabs.some(
        (tab) => tab.input instanceof vscode.TabInputWebview && tab.label === 'SyntaxCraft Studio',
      ),
    ),
  );
  const api = center.exports as {
    metrics: { milliseconds: number; heapDeltaBytes: number; hostHeapBytes: number };
  };
  assert(api.metrics.milliseconds < 1500);
  assert(api.metrics.hostHeapBytes > 0);
  assert(Number.isFinite(api.metrics.heapDeltaBytes));
  console.log(
    `[Control Center] register ${api.metrics.milliseconds.toFixed(2)} ms, command ${latency.toFixed(2)} ms, heap change ${api.metrics.heapDeltaBytes} bytes; host heap ${api.metrics.hostHeapBytes} bytes`,
  );
}

async function settings() {
  const user = new RecordingMemento();
  const workspace = new RecordingMemento();
  const manager = new SettingsManager({ user, workspace });
  const config = () => vscode.workspace.getConfiguration();
  const target = vscode.ConfigurationTarget.Workspace;
  const personal = { 'tab.activeForeground': '#DDEEFF' };
  await config().update('workbench.colorCustomizations', personal, target);

  const profile = emptyProfile('Integrated');
  profile.preferences = {
    theme: 'SyntaxCraft Midnight Pro',
    fileIcons: 'syntaxcraft-modern',
    productIcons: 'syntaxcraft-product',
    fontSize: 15,
  };
  profile.workbench['editor.background'] = '#121122';
  profile.rules = [
    { token: 'class', language: 'typescript', foreground: '#FFEEDD', mechanism: 'semantic' },
    { token: 'comment', language: 'python', foreground: '#AA9988', mechanism: 'textmate' },
    { token: 'comment', language: 'php', foreground: '#AA7700', mechanism: 'textmate' },
  ];

  const result = await manager.apply('workspace', profile);
  assert.equal(result.unavailable, 0);
  assert.equal(result.count, 7);
  const scoped = <T>(key: string) => config().inspect<T>(key)?.workspaceValue;
  assert.equal(scoped('workbench.colorTheme'), 'SyntaxCraft Midnight Pro');
  assert.equal(config().get('workbench.iconTheme'), 'syntaxcraft-modern');
  assert.equal(config().get('workbench.productIconTheme'), 'syntaxcraft-product');
  assert.equal(scoped('editor.fontSize'), 15);
  const semantic = scoped<{ rules: Record<string, unknown> }>(
    'editor.semanticTokenColorCustomizations',
  );
  assert.deepEqual(semantic?.rules['class:typescript'], { foreground: '#FFEEDD' });
  const textMate = scoped<{
    textMateRules: { scope: string[]; settings: { foreground: string } }[];
  }>('editor.tokenColorCustomizations');
  assert(
    textMate?.textMateRules.some(
      ({ scope, settings }) =>
        [...scope].join('').includes('source.python') && settings.foreground === '#AA9988',
    ),
  );
  assert(
    textMate?.textMateRules.some(
      ({ scope, settings }) =>
        [...scope].join('').includes('php') && settings.foreground === '#AA7700',
    ),
  );
  assert.equal(manager.state().workspace.history.length, 1);
  assert.equal(manager.state().user.history.length, 0);

  await config().update(
    'workbench.colorCustomizations',
    { ...personal, 'editor.background': '#121122', 'statusBar.background': '#1A2026' },
    target,
  );
  const recreated = new SettingsManager({ user, workspace });
  assert.equal(recreated.state().workspace.canRestore, true);
  const undo = await recreated.undo('workspace');
  assert.deepEqual(undo.conflicts, []);
  assert.deepEqual(scoped('workbench.colorCustomizations'), {
    ...personal,
    'statusBar.background': '#1A2026',
  });
  assert.equal(scoped('editor.semanticTokenColorCustomizations'), undefined);
  assert.equal(scoped('editor.tokenColorCustomizations'), undefined);
  assert.equal(scoped('workbench.colorTheme'), undefined);

  const partial = emptyProfile('Personal');
  partial.preferences = { lineHeight: 22 };
  const userResult = await manager.apply('user', partial);
  assert.equal(userResult.count, 1);
  assert.equal(config().inspect('editor.lineHeight')?.globalValue, 22);
  await new SettingsManager({ user, workspace }).restore('user');
  assert.equal(config().inspect('editor.lineHeight')?.globalValue, undefined);

  const interrupted = new SettingsManager({ user: new InterruptedMemento(), workspace });
  partial.preferences = { fontSize: 19, lineHeight: 23 };
  await assert.rejects(interrupted.apply('user', partial), /Simulated journal commit failure/);
  assert.equal(config().inspect('editor.fontSize')?.globalValue, undefined);
  assert.equal(config().inspect('editor.lineHeight')?.globalValue, undefined);
  assert.equal(interrupted.state().user.history.length, 0);
  assert.equal((await interrupted.apply('user', partial)).count, 2);
  await interrupted.restore('user');
  await config().update('workbench.colorCustomizations', undefined, target);
}

async function largeDocument() {
  const start = performance.now();
  const content = 'const swatch = "#ABCDEF";  \n'.repeat(60_000);
  const document = await vscode.workspace.openTextDocument({ language: 'typescript', content });
  assert.equal(document.lineCount, 60_001);
  const ready = performance.now();
  const status: { document?: { languageId: string } } | undefined =
    await vscode.commands.executeCommand('syntaxcraft.organizer.status', document.uri);
  const done = performance.now();
  assert.equal(status?.document?.languageId, 'typescript');
  assert(done - ready < 3000, 'Organizer status should not scan a large document');
  console.log(
    `[Large file] ${document.lineCount} lines in ${(ready - start).toFixed(2)} ms; Organizer status in ${(done - ready).toFixed(2)} ms`,
  );
}

export async function run(): Promise<void> {
  await contributions();
  console.log('PASS contributed themes, file and product icons, and optional extension pack');
  await activation();
  console.log('PASS lazy activation and Control Center Webview registration');
  await settings();
  console.log('PASS workspace and user native settings, per-language selectors and restoration');
  await runOrganizerIntegration();
  console.log(
    'PASS document and range providers, import preview, cancellation, and edit isolation',
  );
  await largeDocument();
  console.log('PASS shared state and large document workload');
}
