import * as vscode from 'vscode';
import {
  type ChangeResult,
  DocumentReview,
  isCurrent,
  planImportActions,
  planLineEndings,
  planTrailingWhitespace,
  previewScheme,
  queryImportActions,
  reviewAndApply,
  takeSnapshot,
} from './changes';
import { configuredEndOfLine, getOrganizerStatus, showOrganizerStatus } from './status';

export interface OrganizerResult {
  outcome:
    | 'applied'
    | 'completed'
    | 'navigated'
    | 'noChanges'
    | 'cancelled'
    | 'unavailable'
    | 'blocked'
    | 'failed';
  message?: string;
}

type EditorOperation = (editor: vscode.TextEditor) => Promise<OrganizerResult>;
type NativeFormattingCommand = 'editor.action.formatDocument' | 'editor.action.formatSelection';
type NativeFoldingCommand =
  'editor.gotoNextFold' | 'editor.gotoPreviousFold' | 'editor.foldAll' | 'editor.unfoldAll';

const commandPrefix = 'syntaxcraft.organizer.';
const writableSchemes = new Set(['file', 'untitled', 'vscode-remote']);
const settings = [
  { label: 'Default formatter', description: 'editor.defaultFormatter' },
  { label: 'Tab size', description: 'editor.tabSize' },
  { label: 'Indent using spaces', description: 'editor.insertSpaces' },
  { label: 'Detect indentation', description: 'editor.detectIndentation' },
  { label: 'Render whitespace', description: 'editor.renderWhitespace' },
  { label: 'Indentation guides', description: 'editor.guides.indentation' },
  { label: 'Bracket pair guides', description: 'editor.guides.bracketPairs' },
  { label: 'Folding', description: 'editor.folding' },
  { label: 'Folding strategy', description: 'editor.foldingStrategy' },
  { label: 'Format on Save', description: 'editor.formatOnSave' },
  { label: 'Format on Save mode', description: 'editor.formatOnSaveMode' },
  { label: 'Code actions on save', description: 'editor.codeActionsOnSave' },
  { label: 'Default line endings', description: 'files.eol' },
  { label: 'Trim trailing whitespace on save', description: 'files.trimTrailingWhitespace' },
];

function report(outcome: OrganizerResult['outcome'], message: string): OrganizerResult {
  const warning = outcome === 'blocked' || outcome === 'failed';
  void (warning
    ? vscode.window.showWarningMessage(message)
    : vscode.window.showInformationMessage(message));
  return { outcome, message };
}

function stale(): OrganizerResult {
  return report(
    'blocked',
    'The document changed while this action was open. Run the action again to review the current version.',
  );
}

function changeResult(result: ChangeResult): OrganizerResult {
  switch (result) {
    case 'stale':
      return stale();
    case 'failed':
      return report(
        'failed',
        'VS Code could not apply the reviewed edit. Make sure the original editor is open and writable.',
      );
    case 'applied':
    case 'cancelled':
      return { outcome: result };
  }
}

function documentIsEditable(document: vscode.TextDocument): boolean {
  const { scheme } = document.uri;
  return writableSchemes.has(scheme) && vscode.workspace.fs.isWritableFileSystem(scheme) !== false;
}

async function runFormatting(
  editor: vscode.TextEditor,
  command: NativeFormattingCommand,
): Promise<OrganizerResult> {
  if (
    command === 'editor.action.formatSelection' &&
    editor.selections.some((selection) => selection.isEmpty)
  ) {
    return report('unavailable', 'Select text in each cursor range before formatting a selection.');
  }
  const previousVersion = editor.document.version;
  // The public edit-provider commands return the first available edits and do
  // not resolve editor.defaultFormatter. Let VS Code select its own provider.
  await vscode.commands.executeCommand(command);
  return { outcome: editor.document.version !== previousVersion ? 'applied' : 'completed' };
}

async function runFolding(
  editor: vscode.TextEditor,
  command: NativeFoldingCommand,
): Promise<OrganizerResult> {
  if (!vscode.workspace.getConfiguration('editor', editor.document).get<boolean>('folding', true)) {
    return report(
      'unavailable',
      'Folding is disabled for this editor. Enable editor.folding in Settings.',
    );
  }
  const position = editor.selection.active;
  await vscode.commands.executeCommand(command);
  if (command === 'editor.foldAll' || command === 'editor.unfoldAll') {
    return { outcome: 'completed' };
  }
  if (editor.selection.active.isEqual(position)) {
    const direction = command === 'editor.gotoNextFold' ? 'next' : 'previous';
    return report('unavailable', `There is no ${direction} folding region from this position.`);
  }
  return { outcome: 'navigated' };
}

export function activate(context: vscode.ExtensionContext): void {
  const review = new DocumentReview();
  const output = vscode.window.createOutputChannel('SyntaxCraft Organizer');
  context.subscriptions.push(review, output);
  let editInProgress = false;

  function withEditor(
    operation: EditorOperation,
    options: { edits?: boolean; provider?: boolean } = {},
  ) {
    return async (): Promise<OrganizerResult> => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme === previewScheme) {
        return report(
          'unavailable',
          'Open a source file in a text editor to use SyntaxCraft Organizer.',
        );
      }
      if (options.provider && !vscode.workspace.isTrusted) {
        return report(
          'blocked',
          'Provider actions are disabled in Restricted Mode. Use Workspace Trust to review this workspace.',
        );
      }
      if (options.edits && !documentIsEditable(editor.document)) {
        return report(
          'unavailable',
          'This document is read-only or uses a file system that Organizer cannot edit.',
        );
      }
      if (options.edits && editInProgress) {
        return report(
          'blocked',
          'An Organizer edit is already in progress. Finish or cancel it first.',
        );
      }
      if (options.edits) {
        editInProgress = true;
      }
      try {
        return await operation(editor);
      } catch {
        return report(
          'failed',
          'VS Code could not complete the Organizer action. Check the active editor and provider settings, then try again.',
        );
      } finally {
        if (options.edits) {
          editInProgress = false;
        }
      }
    };
  }

  const formatDocument = withEditor(
    (editor) => runFormatting(editor, 'editor.action.formatDocument'),
    { edits: true, provider: true },
  );
  const formatSelection = withEditor(
    (editor) => runFormatting(editor, 'editor.action.formatSelection'),
    { edits: true, provider: true },
  );

  const organizeImports = withEditor(
    async (editor) => {
      const snapshot = takeSnapshot(editor);
      const actions = await queryImportActions(editor);
      if (!isCurrent(snapshot)) {
        return stale();
      }
      const { previews, commandOnly, rejected, unchanged } = planImportActions(snapshot, actions);
      const [firstPreview] = previews;
      if (!firstPreview) {
        if (rejected) {
          return report(
            'unavailable',
            'The provider returned an import edit outside the active document or with invalid edit ranges.',
          );
        }
        if (commandOnly) {
          const openActions = 'Open VS Code Actions';
          const answer = await vscode.window.showInformationMessage(
            'This provider supplies a command for organizing imports. Open the VS Code source action menu to select it.',
            openActions,
          );
          if (answer !== openActions) {
            return { outcome: 'cancelled' };
          }
          if (!isCurrent(snapshot) || vscode.window.activeTextEditor !== editor) {
            return stale();
          }
          if (!vscode.workspace.isTrusted) {
            return report('blocked', 'Provider actions require a trusted workspace.');
          }
          await vscode.commands.executeCommand('editor.action.codeAction', {
            kind: vscode.CodeActionKind.SourceOrganizeImports.value,
            apply: 'never',
          });
          return { outcome: 'completed' };
        }
        return unchanged
          ? report('noChanges', 'The import provider returned no changes.')
          : report(
              'unavailable',
              'VS Code returned no Organize Imports action for this file. The imports may already be organized.',
            );
      }
      let change = firstPreview.change;
      if (previews.length > 1) {
        const selected = await vscode.window.showQuickPick(
          previews.map((preview) => ({
            label: preview.title,
            description: preview.kind,
            change: preview.change,
          })),
          { title: 'Organize Imports', placeHolder: 'Choose a source action to preview' },
        );
        if (!selected) {
          return { outcome: 'cancelled' };
        }
        change = selected.change;
      }
      return changeResult(
        await reviewAndApply(
          snapshot,
          change,
          (source, edit) => review.confirm(source, edit),
          () => vscode.workspace.isTrusted && documentIsEditable(snapshot.document),
        ),
      );
    },
    { edits: true, provider: true },
  );

  const trimTrailingWhitespace = withEditor(
    async (editor) => {
      const snapshot = takeSnapshot(editor);
      const change = planTrailingWhitespace(snapshot);
      if (!change) {
        return report('noChanges', 'There are no trailing spaces or tabs in this document.');
      }
      return changeResult(
        await reviewAndApply(
          snapshot,
          change,
          (source, edit) => review.confirm(source, edit),
          () => documentIsEditable(snapshot.document),
        ),
      );
    },
    { edits: true },
  );

  const normalizeLineEndings = withEditor(
    async (editor) => {
      const snapshot = takeSnapshot(editor);
      const configured = configuredEndOfLine(
        vscode.workspace.getConfiguration('files', snapshot.document).get<string>('eol', 'auto'),
      );
      let eol: vscode.EndOfLine;
      if (configured === 'auto') {
        const selected = await vscode.window.showQuickPick(
          [
            { label: 'LF', eol: vscode.EndOfLine.LF },
            { label: 'CRLF', eol: vscode.EndOfLine.CRLF },
          ],
          { title: 'Normalize Line Endings', placeHolder: 'Choose the target line ending' },
        );
        if (!selected) {
          return { outcome: 'cancelled' };
        }
        eol = selected.eol;
      } else {
        eol = configured === 'lf' ? vscode.EndOfLine.LF : vscode.EndOfLine.CRLF;
      }
      if (!isCurrent(snapshot)) {
        return stale();
      }
      const change = planLineEndings(snapshot, eol);
      if (!change) {
        return report('noChanges', 'The editor already uses the requested line endings.');
      }
      return changeResult(
        await reviewAndApply(
          snapshot,
          change,
          (source, edit) => review.confirm(source, edit),
          () => documentIsEditable(snapshot.document),
        ),
      );
    },
    { edits: true },
  );

  const reindent = withEditor(
    async (editor) => {
      const snapshot = takeSnapshot(editor);
      const answer = await vscode.window.showInformationMessage(
        `Reindent ${snapshot.name} using the editor’s language rules and current indentation settings?`,
        { modal: true },
        'Reindent',
      );
      if (answer !== 'Reindent') {
        return { outcome: 'cancelled' };
      }
      if (!isCurrent(snapshot) || vscode.window.activeTextEditor !== editor) {
        return stale();
      }
      await vscode.commands.executeCommand('editor.action.reindentlines');
      return editor.document.version !== snapshot.version
        ? { outcome: 'applied' }
        : report('noChanges', 'The editor’s indentation rules made no changes.');
    },
    { edits: true },
  );

  const commands = [
    ['formatDocument', formatDocument],
    ['formatSelection', formatSelection],
    ['organizeImports', organizeImports],
    ['trimTrailingWhitespace', trimTrailingWhitespace],
    ['normalizeLineEndings', normalizeLineEndings],
    ['reindent', reindent],
    ['nextRegion', withEditor((editor) => runFolding(editor, 'editor.gotoNextFold'))],
    ['previousRegion', withEditor((editor) => runFolding(editor, 'editor.gotoPreviousFold'))],
    ['foldAll', withEditor((editor) => runFolding(editor, 'editor.foldAll'))],
    ['unfoldAll', withEditor((editor) => runFolding(editor, 'editor.unfoldAll'))],
    ['status', getOrganizerStatus],
    ['showStatus', () => showOrganizerStatus(output)],
    [
      'openSettings',
      async () => {
        const selected = await vscode.window.showQuickPick(settings, {
          title: 'Organizer Settings',
          placeHolder: 'Choose a VS Code setting to open',
        });
        if (selected) {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            `@id:${selected.description}`,
          );
        }
      },
    ],
  ] as const;
  for (const [name, callback] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(commandPrefix + name, callback));
  }
}
