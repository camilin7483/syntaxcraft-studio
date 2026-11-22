import * as vscode from 'vscode';
import {
  normalizeNewlines,
  previewEdits,
  trailingWhitespaceStart,
  type OffsetEdit,
  type TextPreview,
} from './text-edits';

export interface DocumentSnapshot {
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  version: number;
  languageId: string;
  name: string;
  text: string;
}

interface TextChange extends TextPreview {
  kind: 'text';
  title: string;
  summary: string;
}

interface EolChange {
  kind: 'eol';
  title: string;
  summary: string;
  eol: vscode.EndOfLine;
}

export type Change = TextChange | EolChange;
export type ReviewChange = (snapshot: DocumentSnapshot, change: Change) => Promise<boolean>;
export type ChangeResult = 'applied' | 'cancelled' | 'stale' | 'failed';

export const previewScheme = 'syntaxcraft-organizer-preview';
const sourceOrganizeImports = vscode.CodeActionKind.SourceOrganizeImports;

export function documentName(document: vscode.TextDocument): string {
  return document.uri.path.split('/').filter(Boolean).at(-1) || 'Untitled';
}

export function takeSnapshot(editor: vscode.TextEditor): DocumentSnapshot {
  const { document } = editor;
  return {
    editor,
    document,
    version: document.version,
    languageId: document.languageId,
    name: documentName(document),
    text: document.getText(),
  };
}

export function isCurrent(snapshot: DocumentSnapshot): boolean {
  const { editor, document, version, languageId } = snapshot;
  return (
    !document.isClosed &&
    editor.document === document &&
    document.version === version &&
    document.languageId === languageId
  );
}

export function planTrailingWhitespace(snapshot: DocumentSnapshot): TextChange | undefined {
  const { document, text } = snapshot;
  const edits: OffsetEdit[] = [];
  let characters = 0;
  for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
    const line = document.lineAt(lineNumber);
    const start = trailingWhitespaceStart(line.text);
    if (start < line.text.length) {
      const offset = document.offsetAt(line.range.start);
      edits.push({ start: offset + start, end: offset + line.text.length, newText: '' });
      characters += line.text.length - start;
    }
  }
  if (edits.length === 0) {
    return undefined;
  }
  const preview = previewEdits(text, edits);
  return (
    preview && {
      ...preview,
      kind: 'text',
      title: 'Trim Trailing Whitespace',
      summary: `Remove ${characters} trailing spaces or tabs across ${edits.length} line(s) in ${snapshot.name}?`,
    }
  );
}

function eolName(eol: vscode.EndOfLine): string {
  return eol === vscode.EndOfLine.LF ? 'LF' : 'CRLF';
}

export function planLineEndings(
  snapshot: DocumentSnapshot,
  eol: vscode.EndOfLine,
): EolChange | undefined {
  const originalEol = snapshot.document.eol;
  if (originalEol === eol) {
    return undefined;
  }
  const lineBreaks = snapshot.document.lineCount - 1;
  return {
    kind: 'eol',
    title: 'Normalize Line Endings',
    summary: `Change ${snapshot.name} from ${eolName(originalEol)} to ${eolName(eol)} (${lineBreaks} line breaks)?`,
    eol,
  };
}

export interface ImportOption {
  title: string;
  kind: string;
  change: TextChange;
}

interface ImportOptions {
  previews: ImportOption[];
  commandOnly: boolean;
  rejected: boolean;
  unchanged: boolean;
}

export async function queryImportActions(
  editor: vscode.TextEditor,
): Promise<readonly (vscode.CodeAction | vscode.Command | undefined)[]> {
  const actions = await vscode.commands.executeCommand<
    readonly (vscode.CodeAction | vscode.Command | undefined)[] | undefined
  >(
    'vscode.executeCodeActionProvider',
    editor.document.uri,
    editor.selection,
    sourceOrganizeImports.value,
    16,
  );
  return actions ?? [];
}

export function planImportActions(
  snapshot: DocumentSnapshot,
  actions: readonly (vscode.CodeAction | vscode.Command | undefined)[],
): ImportOptions {
  const result: ImportOptions = {
    previews: [],
    commandOnly: false,
    rejected: false,
    unchanged: false,
  };
  if (!isCurrent(snapshot)) {
    return result;
  }
  const { document, text } = snapshot;
  const uri = document.uri.toString();
  const eol = document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
  for (const action of actions) {
    if (
      !(action instanceof vscode.CodeAction) ||
      !action.kind ||
      !sourceOrganizeImports.contains(action.kind) ||
      action.disabled
    ) {
      continue;
    }
    if (!action.edit) {
      // VS Code's TypeScript provider may attach an empty-title telemetry-only
      // command even when there are no edits. Provider commands never run here.
      if (action.command && action.command.command !== '_typescript.didOrganizeImports') {
        result.commandOnly = true;
      } else {
        result.unchanged = true;
      }
      continue;
    }
    const entries = action.edit.entries();
    const [entry] = entries;
    if (entries.length !== 1 || !entry || entry[0].toString() !== uri) {
      result.rejected = true;
      continue;
    }
    const edits: OffsetEdit[] = [];
    let valid = true;
    for (const edit of entry[1]) {
      if (
        !(edit instanceof vscode.TextEdit) ||
        !(edit.range instanceof vscode.Range) ||
        !document.validateRange(edit.range).isEqual(edit.range) ||
        typeof edit.newText !== 'string' ||
        edit.newEol !== undefined
      ) {
        valid = false;
        break;
      }
      edits.push({
        start: document.offsetAt(edit.range.start),
        end: document.offsetAt(edit.range.end),
        newText: normalizeNewlines(edit.newText, eol),
      });
    }
    const preview = valid ? previewEdits(text, edits) : undefined;
    if (!preview) {
      result.rejected = true;
      continue;
    }
    if (preview.after === text) {
      result.unchanged = true;
      continue;
    }
    result.previews.push({
      title: action.title,
      kind: action.kind.value,
      change: {
        ...preview,
        kind: 'text',
        title: action.title,
        summary: `Apply the reviewed import edits to ${snapshot.name}?`,
      },
    });
  }
  return result;
}

export async function reviewAndApply(
  snapshot: DocumentSnapshot,
  change: Change,
  review: ReviewChange,
  stillAllowed: () => boolean,
): Promise<ChangeResult> {
  if (!isCurrent(snapshot)) {
    return 'stale';
  }
  if (!(await review(snapshot, change))) {
    return 'cancelled';
  }
  if (!isCurrent(snapshot)) {
    return 'stale';
  }
  if (!stillAllowed() || !vscode.window.visibleTextEditors.includes(snapshot.editor)) {
    return 'failed';
  }
  const { editor, document } = snapshot;
  // TextEditor.edit checks the document version again at the editor host.
  const applied = await editor.edit((builder) => {
    if (change.kind === 'eol') {
      builder.setEndOfLine(change.eol);
      return;
    }
    for (const { start, end, newText } of change.edits) {
      builder.replace(
        new vscode.Range(document.positionAt(start), document.positionAt(end)),
        newText,
      );
    }
  });
  return applied ? 'applied' : isCurrent(snapshot) ? 'failed' : 'stale';
}

export class DocumentReview implements vscode.Disposable, vscode.TextDocumentContentProvider {
  private readonly previews = new Map<string, string>();
  private readonly registration = vscode.workspace.registerTextDocumentContentProvider(
    previewScheme,
    this,
  );
  private reviewId = 0;
  private disposed = false;

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.previews.get(uri.toString());
  }

  async confirm(snapshot: DocumentSnapshot, change: Change): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    if (change.kind === 'eol') {
      return (
        (await vscode.window.showInformationMessage(change.summary, { modal: true }, 'Apply')) ===
        'Apply'
      );
    }
    const id = ++this.reviewId;
    const original = vscode.Uri.from({
      scheme: previewScheme,
      path: `/before/${id}/${snapshot.name}`,
    });
    const modified = vscode.Uri.from({
      scheme: previewScheme,
      path: `/after/${id}/${snapshot.name}`,
    });
    this.previews.set(original.toString(), snapshot.text);
    this.previews.set(modified.toString(), change.after);
    try {
      await vscode.commands.executeCommand<undefined>(
        'vscode.diff',
        original,
        modified,
        `${change.title} • ${snapshot.name}`,
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
      );
      return (
        (await vscode.window.showInformationMessage(change.summary, 'Apply', 'Cancel')) === 'Apply'
      );
    } finally {
      const previewTab = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .find(
          ({ input }) =>
            input instanceof vscode.TabInputTextDiff &&
            input.original.toString() === original.toString() &&
            input.modified.toString() === modified.toString(),
        );
      if (previewTab) {
        await Promise.resolve(vscode.window.tabGroups.close(previewTab, true)).catch(() => false);
      }
      this.previews.delete(original.toString());
      this.previews.delete(modified.toString());
    }
  }

  dispose(): void {
    this.disposed = true;
    this.registration.dispose();
    this.previews.clear();
  }
}
