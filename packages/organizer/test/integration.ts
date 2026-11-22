import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import * as vscode from 'vscode';
import {
  planImportActions,
  planLineEndings,
  planTrailingWhitespace,
  previewScheme,
  queryImportActions,
  reviewAndApply,
  takeSnapshot,
} from '../src/changes';
import type { OrganizerResult } from '../src/index';
import type { OrganizerStatus } from '../src/status';

const organizer = 'syntaxcraft.organizer.';
const extensionId = 'syntaxcraft-studio.syntaxcraft-organizer';

async function waitFor<T>(
  check: () => T | undefined | PromiseLike<T | undefined>,
): Promise<T | undefined> {
  const deadline = Date.now() + 4_000;
  do {
    const result = await check();
    if (result !== undefined) return result;
    await delay(50);
  } while (Date.now() < deadline);
  return undefined;
}

function activeEditorFor(
  document: vscode.TextDocument,
  column?: vscode.ViewColumn,
): vscode.TextEditor | undefined {
  const active = vscode.window.activeTextEditor;
  if (
    active?.document.uri.toString() === document.uri.toString() &&
    (column === undefined || active.viewColumn === column)
  ) {
    return active;
  }
  return undefined;
}

async function waitForActiveEditor(
  document: vscode.TextDocument,
  column?: vscode.ViewColumn,
): Promise<vscode.TextEditor> {
  const active = await waitFor(() => activeEditorFor(document, column));
  const current = vscode.window.activeTextEditor;
  assert.ok(
    active,
    `Expected ${document.uri.toString()} in editor column ${column}. Active editor was ${current?.document.uri.toString() ?? '(none)'} in column ${current?.viewColumn}.`,
  );
  return active;
}

async function discard(document: vscode.TextDocument): Promise<void> {
  if (!document.isClosed) {
    await vscode.window.showTextDocument(document, { preview: false });
    if (await waitFor(() => activeEditorFor(document))) {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  }
}

function openPreview() {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .map((tab) => tab.input)
    .find(
      (input): input is vscode.TabInputTextDiff =>
        input instanceof vscode.TabInputTextDiff && input.modified.scheme === previewScheme,
    );
}

async function testFormatterAndStatus(): Promise<void> {
  const original = '{"greeting":"hello","items":[1,2]}';
  const document = await vscode.workspace.openTextDocument({ language: 'json', content: original });
  const shown = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
  });
  const editor = await waitForActiveEditor(document, shown.viewColumn);
  const sourceColumn = editor.viewColumn;
  const config = vscode.workspace.getConfiguration('editor', document);
  const previousFormatter = config.inspect<string | null>('defaultFormatter')?.globalLanguageValue;
  const builtin = 'vscode.json-language-features';
  const json = vscode.extensions.getExtension(builtin);
  assert.ok(json);
  await json.activate();
  const formattingOptions = { insertSpaces: true, tabSize: 2 };
  const ready = await waitFor(() =>
    vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
      'vscode.executeFormatDocumentProvider',
      document.uri,
      formattingOptions,
    ),
  );
  assert.ok(
    ready?.length,
    'built-in JSON formatting must be ready before registering a competing provider',
  );

  let otherCalls = 0;
  const override = { language: 'json', scheme: 'untitled' };
  const otherProvider: vscode.DocumentFormattingEditProvider &
    vscode.DocumentRangeFormattingEditProvider = {
    provideDocumentFormattingEdits() {
      otherCalls += 1;
      return [vscode.TextEdit.insert(new vscode.Position(0, 0), 'competing formatter was called')];
    },
    provideDocumentRangeFormattingEdits() {
      otherCalls += 1;
      return [vscode.TextEdit.insert(new vscode.Position(0, 0), 'competing formatter was called')];
    },
  };
  const anotherDocument = await vscode.workspace.openTextDocument({
    language: 'plaintext',
    content: 'another editor',
  });
  const documentProvider = vscode.languages.registerDocumentFormattingEditProvider(
    override,
    otherProvider,
  );
  const rangeProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
    override,
    otherProvider,
  );

  try {
    await config.update('defaultFormatter', builtin, vscode.ConfigurationTarget.Global, true);
    editor.options = formattingOptions;
    const anotherEditor = await vscode.window.showTextDocument(anotherDocument, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: false,
    });
    const anotherColumn = anotherEditor.viewColumn;
    await waitForActiveEditor(anotherDocument, anotherColumn);
    const status = await vscode.commands.executeCommand<OrganizerStatus>(
      organizer + 'status',
      document.uri,
    );
    assert.ok(
      activeEditorFor(anotherDocument, anotherColumn),
      'reading Organizer status must preserve editor focus',
    );
    assert.equal(status?.document?.languageId, 'json');
    assert.equal(status?.effective?.defaultFormatter, builtin);
    assert.equal(status?.effective?.tabSize, 2);
    assert.equal(status?.formatters.find((item) => item.id === builtin)?.configured, true);
    assert.equal(
      (
        await vscode.commands.executeCommand<OrganizerStatus>(organizer + 'status', {
          uri: document.uri,
        })
      )?.document,
      null,
    );

    const reopened = await vscode.window.showTextDocument(document, {
      viewColumn: sourceColumn,
      preview: false,
      preserveFocus: false,
    });
    const focused = await waitForActiveEditor(document, reopened.viewColumn ?? sourceColumn);
    const documentResult = await vscode.commands.executeCommand<OrganizerResult>(
      organizer + 'formatDocument',
    );
    assert.ok(
      documentResult?.outcome === 'completed' || documentResult?.outcome === 'applied',
      documentResult?.message,
    );
    const formatted = await waitFor(() =>
      document.getText() === original ? undefined : document.getText(),
    );
    assert.ok(formatted, 'the native Format Document action must change the sample');
    assert.deepEqual(JSON.parse(formatted), JSON.parse(original));
    assert.equal(otherCalls, 0, "document formatting must use VS Code's configured default");

    const reset = await focused.edit((edit) =>
      edit.replace(
        new vscode.Range(new vscode.Position(0, 0), document.positionAt(formatted.length)),
        original,
      ),
    );
    assert.equal(reset, true);
    focused.selection = new vscode.Selection(
      new vscode.Position(0, 0),
      document.positionAt(original.length),
    );
    const selectionResult = await vscode.commands.executeCommand<OrganizerResult>(
      organizer + 'formatSelection',
    );
    assert.ok(
      selectionResult?.outcome === 'completed' || selectionResult?.outcome === 'applied',
      selectionResult?.message,
    );
    const selectionFormatted = await waitFor(() =>
      document.getText() === original ? undefined : document.getText(),
    );
    assert.ok(
      selectionFormatted,
      'the native Format Selection action must change the selected sample',
    );
    assert.deepEqual(JSON.parse(selectionFormatted), JSON.parse(original));
    assert.equal(otherCalls, 0, "selection formatting must use VS Code's configured default");
  } finally {
    documentProvider.dispose();
    rangeProvider.dispose();
    await config.update(
      'defaultFormatter',
      previousFormatter,
      vscode.ConfigurationTarget.Global,
      true,
    );
    await discard(anotherDocument);
    await discard(document);
  }
}

async function testVerifiedImportAndWhitespaceEdits(): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: 'plaintext',
    content: 'one \t\ntwo  \n',
  });
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  const kind = vscode.CodeActionKind.SourceOrganizeImports.append('syntaxcraftIntegration');
  let companionRan = false;
  const companionId = 'syntaxcraft.organizer.integration.companion';
  const companion = vscode.commands.registerCommand(companionId, () => {
    companionRan = true;
  });
  const provider = vscode.languages.registerCodeActionsProvider(
    { language: 'plaintext', scheme: 'untitled' },
    {
      provideCodeActions(source, _range, context) {
        if (source.uri.toString() !== document.uri.toString() || !context.only?.contains(kind)) {
          return [];
        }
        const action = new vscode.CodeAction('Organizer integration edits', kind);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(source.uri, new vscode.Range(0, 0, 0, 3), 'ONE');
        action.command = { title: 'Separate provider command', command: companionId };
        return [action];
      },
    },
    { providedCodeActionKinds: [kind] },
  );

  try {
    const snapshot = takeSnapshot(editor);
    const actions = await queryImportActions(editor);
    const preview = planImportActions(snapshot, actions).previews[0];
    assert.ok(preview, 'a real VS Code source action must resolve to a text diff');
    assert.equal(preview.change.after, 'ONE \t\ntwo  \n');
    assert.equal(
      await reviewAndApply(
        snapshot,
        preview.change,
        async () => false,
        () => true,
      ),
      'cancelled',
    );
    assert.equal(document.getText(), snapshot.text);

    const other = new vscode.CodeAction('An out-of-scope edit', kind);
    other.edit = new vscode.WorkspaceEdit();
    other.edit.insert(
      vscode.Uri.file('/outside-organizer-test.ts'),
      new vscode.Position(0, 0),
      'out of scope',
    );
    assert.equal(planImportActions(snapshot, [other]).rejected, true);
    const badRange = new vscode.CodeAction('An invalid range', kind);
    badRange.edit = new vscode.WorkspaceEdit();
    badRange.edit.insert(
      document.uri,
      new vscode.Position(document.lineCount + 1, 0),
      'out of bounds',
    );
    assert.equal(planImportActions(snapshot, [badRange]).rejected, true);

    assert.equal(
      await reviewAndApply(
        snapshot,
        preview.change,
        async () => true,
        () => true,
      ),
      'applied',
    );
    assert.equal(document.getText(), preview.change.after);
    assert.equal(
      companionRan,
      false,
      "reviewing edits never executes a provider's companion command",
    );

    const whitespaceSnapshot = takeSnapshot(editor);
    const whitespace = planTrailingWhitespace(whitespaceSnapshot);
    assert.ok(whitespace);
    assert.equal(whitespace.after, 'ONE\ntwo\n');
    assert.equal(
      await reviewAndApply(
        whitespaceSnapshot,
        whitespace,
        async () => {
          await editor.edit((change) => change.insert(new vscode.Position(1, 0), 'updated '));
          return true;
        },
        () => true,
      ),
      'stale',
    );
    assert.equal(document.getText(), 'ONE \t\nupdated two  \n');

    const current = takeSnapshot(editor);
    await vscode.commands.executeCommand('notifications.clearAll');
    let outcome: OrganizerResult | undefined;
    const command = vscode.commands
      .executeCommand<OrganizerResult>(organizer + 'trimTrailingWhitespace')
      .then((result) => {
        outcome = result;
      });
    const diff = await waitFor(openPreview);
    assert.ok(diff, 'the public trim command must show the VS Code diff editor');
    const original = await vscode.workspace.openTextDocument(diff.original);
    const modified = await vscode.workspace.openTextDocument(diff.modified);
    assert.equal(original.getText(), current.text);
    assert.equal(modified.getText(), 'ONE\nupdated two\n');
    assert.equal(document.getText(), current.text);
    const confirmed = await waitFor(async () => {
      if (!outcome) {
        await vscode.commands.executeCommand('notification.acceptPrimaryAction');
      }
      return outcome;
    });
    assert.equal(confirmed?.outcome, 'applied', confirmed?.message);
    await command;
    assert.equal(openPreview(), undefined);
    assert.equal(document.getText(), 'ONE\nupdated two\n');
    const eolSnapshot = takeSnapshot(editor);
    const endings = planLineEndings(eolSnapshot, vscode.EndOfLine.CRLF);
    assert.ok(endings);
    assert.equal(
      await reviewAndApply(
        eolSnapshot,
        endings,
        async () => true,
        () => true,
      ),
      'applied',
    );
    assert.equal(document.eol, vscode.EndOfLine.CRLF);
    assert.equal(document.getText(), 'ONE\r\nupdated two\r\n');
  } finally {
    provider.dispose();
    companion.dispose();
    await discard(document);
  }
}

async function testTypeScriptImportProvider(): Promise<void> {
  const typescript = vscode.extensions.getExtension('vscode.typescript-language-features');
  assert.ok(typescript);
  const document = await vscode.workspace.openTextDocument({
    language: 'typescript',
    content: "import { readFile, writeFile } from 'fs';\nexport { writeFile };\n",
  });
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  try {
    await typescript.activate();
    const snapshot = takeSnapshot(editor);
    const option = await waitFor(
      async () => planImportActions(snapshot, await queryImportActions(editor)).previews[0],
    );
    assert.ok(option, 'the built-in TypeScript provider must expose its editable import action');
    assert.match(option.change.after, /import\s*\{\s*writeFile\s*\}/u);
    assert.doesNotMatch(option.change.after, /readFile/u);
    assert.equal(document.getText(), snapshot.text);
  } finally {
    await discard(document);
  }
}

export async function runOrganizerIntegration(): Promise<void> {
  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, 'Organizer must be installed in the test host');
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  for (const name of [
    'status',
    'formatDocument',
    'formatSelection',
    'organizeImports',
    'trimTrailingWhitespace',
    'normalizeLineEndings',
    'reindent',
    'nextRegion',
    'previousRegion',
    'foldAll',
    'unfoldAll',
    'showStatus',
    'openSettings',
  ]) {
    assert.ok(commands.includes(organizer + name), `missing Organizer command ${name}`);
  }
  await testFormatterAndStatus();
  await testVerifiedImportAndWhitespaceEdits();
  await testTypeScriptImportProvider();
}
