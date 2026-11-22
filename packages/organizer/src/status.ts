import * as vscode from 'vscode';
import { documentName, previewScheme } from './changes';
import {
  getProviderStatus,
  type CodeActionOnSaveValue,
  type CodeActionsOnSave,
  type EffectiveSettings,
  type ProviderStatus,
} from './providers';

export interface OrganizerStatus extends ProviderStatus {
  trusted: boolean;
  document: { name: string; languageId: string; eol: 'lf' | 'crlf' } | null;
  effective: EffectiveSettings | null;
}

function toCodeActionsOnSave(value: unknown): CodeActionsOnSave {
  if (Array.isArray(value)) {
    return value.filter((kind): kind is string => typeof kind === 'string');
  }
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, CodeActionOnSaveValue] => {
      const action = entry[1];
      return (
        typeof action === 'boolean' ||
        action === 'always' ||
        action === 'explicit' ||
        action === 'never'
      );
    }),
  );
}

export function configuredEndOfLine(value: string): EffectiveSettings['eol'] {
  if (value === '\n') {
    return 'lf';
  }
  if (value === '\r\n') {
    return 'crlf';
  }
  return 'auto';
}

function effectiveSettings(
  config: vscode.WorkspaceConfiguration,
  editor?: vscode.TextEditor,
): EffectiveSettings {
  const formatter = config.get<unknown>('editor.defaultFormatter');
  const formatOnSaveMode = config.get<string>('editor.formatOnSaveMode');
  const bracketPairs = config.get<boolean | string>('editor.guides.bracketPairs');
  const configuredTabSize = config.get<unknown>('editor.tabSize');
  const configuredWhitespace = config.get<unknown>('editor.renderWhitespace');
  const readBoolean = (key: string, fallback: boolean) => {
    const value = config.get<unknown>(key);
    return typeof value === 'boolean' ? value : fallback;
  };
  return {
    defaultFormatter: typeof formatter === 'string' && formatter ? formatter : null,
    tabSize:
      typeof editor?.options.tabSize === 'number'
        ? editor.options.tabSize
        : typeof configuredTabSize === 'number' &&
            Number.isInteger(configuredTabSize) &&
            configuredTabSize > 0
          ? configuredTabSize
          : 4,
    insertSpaces:
      typeof editor?.options.insertSpaces === 'boolean'
        ? editor.options.insertSpaces
        : readBoolean('editor.insertSpaces', true),
    detectIndentation: readBoolean('editor.detectIndentation', true),
    renderWhitespace: typeof configuredWhitespace === 'string' ? configuredWhitespace : 'selection',
    indentationGuides: readBoolean('editor.guides.indentation', true),
    bracketPairGuides: bracketPairs === 'active' || bracketPairs === true ? bracketPairs : false,
    folding: readBoolean('editor.folding', true),
    foldingStrategy:
      config.get<string>('editor.foldingStrategy') === 'indentation' ? 'indentation' : 'auto',
    formatOnSave: readBoolean('editor.formatOnSave', false),
    formatOnSaveMode:
      formatOnSaveMode === 'modifications' || formatOnSaveMode === 'modificationsIfAvailable'
        ? formatOnSaveMode
        : 'file',
    codeActionsOnSave: toCodeActionsOnSave(config.get<unknown>('editor.codeActionsOnSave')),
    eol: configuredEndOfLine(config.get<string>('files.eol', 'auto')),
    trimTrailingWhitespace: readBoolean('files.trimTrailingWhitespace', false),
  };
}

export function getOrganizerStatus(source?: unknown): OrganizerStatus {
  const active = vscode.window.activeTextEditor;
  const sourceKey = source instanceof vscode.Uri ? source.toString() : undefined;
  const openSource =
    sourceKey && vscode.workspace.textDocuments.find((item) => item.uri.toString() === sourceKey);
  const document = source === undefined ? active?.document : openSource;
  const trusted = vscode.workspace.isTrusted;

  if (!document || document.isClosed || document.uri.scheme === previewScheme) {
    return {
      trusted,
      document: null,
      effective: null,
      formatters: [],
      importOrganizers: [],
      conflicts: [],
    };
  }
  const editor =
    active?.document === document
      ? active
      : vscode.window.visibleTextEditors.find((item) => item.document === document);
  const config = vscode.workspace.getConfiguration(undefined, document);
  const effective = effectiveSettings(config, editor);
  const providers = getProviderStatus({
    languageId: document.languageId,
    effective,
    read: (key) => config.get<unknown>(key),
    extension: (id) => {
      const found = vscode.extensions.getExtension(id);
      if (found) {
        const displayName: unknown = found.packageJSON.displayName;
        return {
          isActive: found.isActive,
          ...(typeof displayName === 'string' && { name: displayName }),
        };
      }
      return undefined;
    },
  });

  return {
    trusted,
    document: {
      name: documentName(document),
      languageId: document.languageId,
      eol: document.eol === vscode.EndOfLine.CRLF ? 'crlf' : 'lf',
    },
    effective,
    ...providers,
  };
}

export function showOrganizerStatus(output: vscode.OutputChannel): void {
  const { trusted, document, effective, formatters, importOrganizers, conflicts } =
    getOrganizerStatus();
  output.clear();
  if (!document || !effective) {
    output.appendLine('Open a text editor to see its provider candidates and effective settings.');
    output.show();
    return;
  }
  output.appendLine(`${document.name} (${document.languageId})`);
  output.appendLine(trusted ? 'Trusted workspace' : 'Restricted Mode');
  output.appendLine(`Default formatter: ${effective.defaultFormatter ?? 'VS Code selection'}`);
  output.appendLine(
    `Indentation: ${effective.insertSpaces ? 'spaces' : 'tabs'} (tab size ${effective.tabSize})`,
  );
  output.appendLine(`Line endings: ${document.eol.toUpperCase()} (setting ${effective.eol})`);
  output.appendLine(
    `Format on Save: ${effective.formatOnSave ? effective.formatOnSaveMode : 'off'}`,
  );

  const groups = [
    ['Formatter candidates', formatters],
    ['Import organizer candidates', importOrganizers],
  ] as const;
  for (const [title, providers] of groups) {
    output.appendLine(`\n${title}`);
    if (!providers.length) {
      output.appendLine(
        '  No catalog entries for this language. VS Code can discover other registered providers.',
      );
    }
    for (const provider of providers) {
      const state =
        provider.availability === 'notDetected' ? 'not detected' : provider.availability;
      const labels = [
        state,
        ...(provider.configured ? ['default'] : []),
        ...(provider.active ? ['active extension'] : []),
      ];
      output.appendLine(`  ${provider.name} (${provider.id}) — ${labels.join(', ')}`);
      if (provider.reason) {
        output.appendLine(`    ${provider.reason}`);
      }
      output.appendLine(`    ${provider.requirements}`);
      if (provider.selectionFormatting) {
        output.appendLine(`    Selection formatting: ${provider.selectionFormatting}`);
      }
      output.appendLine(`    ${provider.documentation}`);
    }
  }
  for (const conflict of conflicts) {
    output.appendLine(`\n${conflict.message}`);
  }
  output.show();
}
