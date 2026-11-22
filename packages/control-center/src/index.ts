import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import * as vscode from 'vscode';
import { webviewHtml } from './html';
import {
  colorKeys,
  decodeProfile,
  isRecord,
  maxProfileBytes,
  preferenceSettings,
  productIcon,
} from './profile';
import type { Preferences, Profile } from './profile';
import { ProfileStore } from './profile-store';
import { readRequest, requestId } from './protocol';
import type {
  ActivationMetrics,
  Section,
  StudioRequest,
  StudioResponse,
  StudioState,
} from './protocol';
import { sampleFor, sampleText } from './samples';
import { managedSettings } from './settings-plan';
import { SettingsManager } from './settings';

const identifier = 'syntaxcraft-studio';

function isSource(editor: vscode.TextEditor | undefined): editor is vscode.TextEditor {
  return Boolean(
    editor &&
    !editor.document.isClosed &&
    editor.document.uri.scheme !== 'syntaxcraft-organizer-preview',
  );
}

async function waitForActiveEditor(expected: vscode.TextEditor) {
  const matches = (editor: vscode.TextEditor | undefined) =>
    editor?.document === expected.document && editor.viewColumn === expected.viewColumn;
  if (matches(vscode.window.activeTextEditor)) return;
  await new Promise<void>((resolve, reject) => {
    const subscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (matches(editor)) {
        subscription.dispose();
        clearTimeout(timeout);
        resolve();
      }
    });
    const timeout = setTimeout(() => {
      subscription.dispose();
      reject(new Error('Activa el archivo de origen y vuelve a ejecutar la acción.'));
    }, 2000);
  });
}
function installed() {
  return {
    colors: Boolean(vscode.extensions.getExtension(`${identifier}.syntaxcraft-colors`)),
    icons: Boolean(vscode.extensions.getExtension(`${identifier}.syntaxcraft-icons`)),
    organizer: Boolean(vscode.extensions.getExtension(`${identifier}.syntaxcraft-organizer`)),
  };
}

async function importProfile(): Promise<Profile | undefined> {
  const [file] =
    (await vscode.window.showOpenDialog({
      title: 'Importar perfil de SyntaxCraft Studio',
      filters: { JSON: ['json'] },
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
    })) ?? [];
  if (!file) return undefined;
  if ((await vscode.workspace.fs.stat(file)).size > maxProfileBytes)
    throw new Error('El perfil supera el límite de 1 MiB.');
  return decodeProfile(await vscode.workspace.fs.readFile(file));
}

async function exportProfile(profile: Profile): Promise<boolean> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  const appearance =
    profile.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'perfil';
  const file = await vscode.window.showSaveDialog({
    title: 'Exportar perfil de SyntaxCraft Studio',
    filters: { JSON: ['json'] },
    defaultUri: root ? vscode.Uri.joinPath(root, `syntaxcraft-${appearance}.json`) : undefined,
  });
  if (!file) return false;
  await vscode.workspace.fs.writeFile(
    file,
    new TextEncoder().encode(JSON.stringify(profile, null, 2) + '\n'),
  );
  return true;
}

async function consent(message: string, detail: string, action: string): Promise<boolean> {
  return (
    (await vscode.window.showWarningMessage(message, { modal: true, detail }, action)) === action
  );
}

function outcome(count: number, conflicts: string[], unavailable: number): string {
  const parts = [
    count ? `Se actualizaron ${count} ajustes de VS Code.` : 'Los ajustes ya están al día.',
  ];
  if (conflicts.length) parts.push(`Se conservaron ediciones externas en ${conflicts.join(', ')}.`);
  if (unavailable)
    parts.push(
      `${unavailable} reglas carecen de un selector compatible con la configuración elegida.`,
    );
  return parts.join(' ');
}

export function activate(context: vscode.ExtensionContext) {
  const start = performance.now();
  const heap = process.memoryUsage().heapUsed;
  const metrics: ActivationMetrics = { milliseconds: 0, heapDeltaBytes: 0, hostHeapBytes: 0 };
  const settings = new SettingsManager({
    user: context.globalState,
    workspace: context.workspaceState,
  });
  const profiles = new ProfileStore(context.globalState);
  let panel: vscode.WebviewPanel | undefined;
  let lastEditor = vscode.window.activeTextEditor;
  let requests: Promise<unknown> = Promise.resolve();
  let messages: vscode.Disposable | undefined;
  let scheduled: ReturnType<typeof setTimeout> | undefined;

  function state(): StudioState {
    const configuration = settings.effective();
    const effective = Object.fromEntries(
      Object.entries(preferenceSettings).map(([preference, key]) => [
        preference,
        configuration[key],
      ]),
    ) as StudioState['effective'];
    const colors = configuration['workbench.colorCustomizations'];
    const workbench = isRecord(colors)
      ? Object.fromEntries(
          Object.entries(colors).filter(
            (item): item is [string, string] =>
              colorKeys.has(item[0]) && typeof item[1] === 'string',
          ),
        )
      : {};
    return {
      effective,
      workbench,
      metrics,
      profiles: profiles.list(),
      targets: settings.state(),
      installed: installed(),
      trusted: vscode.workspace.isTrusted,
      workspace: Boolean(vscode.workspace.workspaceFolders?.length),
    };
  }

  async function post(view: vscode.WebviewPanel, message: StudioResponse) {
    if (panel === view) await view.webview.postMessage(message);
  }

  function publish() {
    if (!panel || scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = undefined;
      const view = panel;
      if (view) void post(view, { type: 'state', state: state() });
    }, 80);
  }

  async function previousSource(): Promise<void> {
    const active = vscode.window.activeTextEditor;
    const editor = isSource(active) ? active : lastEditor;
    if (!isSource(editor))
      throw new Error('Abre un archivo en el editor para usar el Organizador.');
    if (editor === active) return;
    const revealed = await vscode.window.showTextDocument(editor.document, {
      viewColumn: editor.viewColumn,
      preserveFocus: false,
      preview: false,
      selection: editor.selection,
    });
    await waitForActiveEditor(revealed);
  }

  async function handle(view: vscode.WebviewPanel, request: StudioRequest) {
    const id = request.id;
    const reply = (result: Omit<Extract<StudioResponse, { type: 'result' }>, 'id' | 'type'> = {}) =>
      post(view, { type: 'result', id, ...result });
    switch (request.type) {
      case 'ready': {
        await post(view, { type: 'state', state: state() });
        const conflicts = await settings.recoverWritable();
        if (conflicts.length) {
          await reply({ message: `Se conservaron ediciones externas en ${conflicts.join(', ')}.` });
        } else await reply();
        publish();
        return;
      }
      case 'apply':
      case 'undo':
      case 'restore': {
        const scope = request.scope;
        const targetName = scope === 'user' ? 'Usuario' : 'Proyecto';
        if (!settings.state()[scope].available)
          throw new Error('Este ámbito requiere un proyecto de confianza.');
        if (request.type === 'apply') {
          const available = installed();
          const appearance: Preferences = request.profile.preferences;
          if (appearance.theme && !available.colors)
            throw new Error('Instala SyntaxCraft Colors para aplicar este tema.');
          if (
            (appearance.fileIcons?.startsWith('syntaxcraft-') ||
              appearance.productIcons === productIcon) &&
            !available.icons
          ) {
            throw new Error('Instala SyntaxCraft Icons para aplicar este estilo.');
          }
          if (
            !(await consent(
              `¿Aplicar «${request.profile.name}» en ${targetName}?`,
              'Studio guarda los valores que cambie y sustituye su personalización activa en este ámbito. Puedes restaurarla desde el historial.',
              'Aplicar',
            ))
          ) {
            await reply();
            return;
          }
        } else if (
          !(await consent(
            request.type === 'undo'
              ? `¿Deshacer el último cambio en ${targetName}?`
              : `¿Restaurar los ajustes de Studio en ${targetName}?`,
            'Studio compara los valores guardados con los actuales y conserva las ediciones externas que detecte.',
            request.type === 'undo' ? 'Deshacer' : 'Restaurar',
          ))
        ) {
          await reply();
          return;
        }
        const result =
          request.type === 'apply'
            ? await settings.apply(scope, request.profile)
            : request.type === 'undo'
              ? await settings.undo(scope)
              : await settings.restore(scope);
        await reply({ message: outcome(result.count, result.conflicts, result.unavailable) });
        publish();
        return;
      }
      case 'saveProfile': {
        const saved = await profiles.save(request.profile, request.edit);
        await reply({ saved, message: `Se guardó «${saved.profile.name}».` });
        publish();
        return;
      }
      case 'deleteProfile': {
        const name =
          profiles.list().find(({ id }) => id === request.profileId)?.profile.name ?? 'este perfil';
        if (
          await consent(
            `¿Eliminar «${name}»?`,
            'Se elimina el perfil guardado en Studio.',
            'Eliminar',
          )
        ) {
          await profiles.delete(request.profileId, request.revision);
          await reply({ message: 'Se eliminó el perfil.' });
          publish();
        } else await reply();
        return;
      }
      case 'import': {
        const profile = await importProfile();
        await reply(profile ? { profile, message: 'Perfil importado como borrador.' } : {});
        return;
      }
      case 'export': {
        await reply(
          (await exportProfile(request.profile)) ? { message: 'Se exportó el perfil JSON.' } : {},
        );
        return;
      }
      case 'organizerStatus': {
        if (!installed().organizer)
          throw new Error('Instala SyntaxCraft Organizer para ver los proveedores disponibles.');
        const active = vscode.window.activeTextEditor;
        const uri = (isSource(active) ? active : lastEditor)?.document.uri;
        const organizer: unknown = await vscode.commands.executeCommand(
          'syntaxcraft.organizer.status',
          uri,
        );
        await reply({ organizer });
        return;
      }
      case 'organizerAction': {
        if (!vscode.workspace.isTrusted)
          throw new Error('Concede confianza al proyecto para usar las acciones del Organizador.');
        if (!installed().organizer)
          throw new Error('Instala SyntaxCraft Organizer para utilizar estas acciones.');
        await previousSource();
        const output: unknown = await vscode.commands.executeCommand(
          `syntaxcraft.organizer.${request.action}`,
        );
        await reply({
          message:
            isRecord(output) && typeof output.message === 'string' ? output.message : undefined,
        });
        return;
      }
      case 'nativeSettings': {
        await vscode.commands.executeCommand('workbench.action.openSettings', request.setting);
        await reply();
        return;
      }
      case 'sample': {
        const sample = sampleFor(request.language);
        if (!sample)
          throw new Error('Esta vista previa no tiene un ejemplo para el lenguaje seleccionado.');
        if (!(await vscode.languages.getLanguages()).includes(request.language)) {
          throw new Error('Instala una extensión que aporte este modo de lenguaje.');
        }
        const document = await vscode.workspace.openTextDocument({
          language: request.language,
          content: sampleText(sample),
        });
        await vscode.window.showTextDocument(document, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: true,
        });
        await reply();
        return;
      }
    }
  }

  function open(section: Section) {
    if (panel) {
      panel.reveal();
      void post(panel, { type: 'navigate', section });
      return;
    }
    const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'web');
    const view = vscode.window.createWebviewPanel(
      'syntaxcraft.controlCenter',
      'SyntaxCraft Studio',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        enableCommandUris: false,
        localResourceRoots: [root],
      },
    );
    panel = view;
    view.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    const uri = (relative: string) =>
      view.webview.asWebviewUri(vscode.Uri.joinPath(root, relative)).toString();
    view.webview.html = webviewHtml({
      cspSource: view.webview.cspSource,
      script: uri('app.js'),
      stylesheet: uri('studio.css'),
      icons: uri('icons'),
      section,
      nonce: randomBytes(24).toString('hex'),
    });
    messages = view.webview.onDidReceiveMessage((raw: unknown) => {
      requests = requests
        .then(async () => {
          if (panel !== view) return;
          try {
            await handle(view, readRequest(raw));
          } catch (error) {
            await post(view, {
              type: 'error',
              id: requestId(raw),
              message: error instanceof Error ? error.message : 'La acción no pudo completarse.',
            });
          }
        })
        .catch((error: unknown) =>
          console.error('SyntaxCraft Studio message delivery failed', error),
        );
    });
    view.onDidDispose(() => {
      messages?.dispose();
      messages = undefined;
      panel = undefined;
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('syntaxcraft.controlCenter.open', () => open('dashboard')),
    vscode.commands.registerCommand('syntaxcraft.controlCenter.openColors', () => open('colors')),
    vscode.commands.registerCommand('syntaxcraft.controlCenter.openProfiles', () =>
      open('profiles'),
    ),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (isSource(editor)) lastEditor = editor;
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (managedSettings.some((key) => event.affectsConfiguration(key))) publish();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(publish),
    vscode.workspace.onDidGrantWorkspaceTrust(publish),
    vscode.extensions.onDidChange(publish),
    {
      dispose: () => {
        if (scheduled) clearTimeout(scheduled);
        panel?.dispose();
      },
    },
  );
  metrics.milliseconds = performance.now() - start;
  metrics.hostHeapBytes = process.memoryUsage().heapUsed;
  metrics.heapDeltaBytes = metrics.hostHeapBytes - heap;
  return { metrics };
}
