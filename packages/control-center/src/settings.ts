import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import * as vscode from 'vscode';
import type { Profile } from './profile';
import { managedSettings, prepareApplication, prepareUndo, revertSettings } from './settings-plan';
import type { SettingChange, SettingKey, SettingValues } from './settings-plan';

export type Scope = 'user' | 'workspace';

interface Application {
  id: string;
  label: string;
  date: string;
  changes: SettingChange[];
  overlay: SettingChange[];
}

interface Journal {
  history: Application[];
  pending?: { changes: SettingChange[]; attempted: number };
}

export interface HistoryItem {
  id: string;
  label: string;
  date: string;
  count: number;
}

interface TargetState {
  available: boolean;
  canRestore: boolean;
  history: HistoryItem[];
}

export type ApplyResult = { count: number; conflicts: SettingKey[]; unavailable: number };

const journalKey = 'syntaxcraft.settings-journal.v1';
const limit = 12;

function writable(scope: Scope): boolean {
  return (
    scope === 'user' ||
    (vscode.workspace.isTrusted && (vscode.workspace.workspaceFolders?.length ?? 0) > 0)
  );
}

function nativeTarget(scope: Scope): vscode.ConfigurationTarget {
  return scope === 'user'
    ? vscode.ConfigurationTarget.Global
    : vscode.ConfigurationTarget.Workspace;
}

function requireWritable(scope: Scope): void {
  if (!writable(scope))
    throw new Error('Abre un proyecto de confianza para cambiar los ajustes de este ámbito.');
}

function patch(target: vscode.WorkspaceConfiguration, scope: Scope, key: SettingKey): unknown {
  const inspection = target.inspect<unknown>(key);
  return scope === 'user' ? inspection?.globalValue : inspection?.workspaceValue;
}

function snapshot(scope: Scope): SettingValues {
  const settings = vscode.workspace.getConfiguration();
  return Object.fromEntries(managedSettings.map((key) => [key, patch(settings, scope, key)]));
}

function effective(): SettingValues {
  const settings = vscode.workspace.getConfiguration();
  return Object.fromEntries(managedSettings.map((key) => [key, settings.get<unknown>(key)]));
}

export class SettingsManager {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly stores: Record<Scope, vscode.Memento>) {}

  state(): Record<Scope, TargetState> {
    const scopes: Scope[] = ['user', 'workspace'];
    const [user, workspace] = scopes.map((scope) => {
      const { history } = this.read(scope);
      return {
        available: writable(scope),
        canRestore: Boolean(history.at(-1)?.overlay.length),
        history: [...history].reverse().map(({ id, label, date, changes }) => ({
          id,
          label,
          date,
          count: changes.length,
        })),
      };
    });
    if (!user || !workspace) throw new Error('No se pudieron leer los ámbitos de configuración.');
    return { user, workspace };
  }

  effective(): SettingValues {
    return effective();
  }

  apply(scope: Scope, profile: Profile): Promise<ApplyResult> {
    return this.run(() => this.applyOrRestore(scope, profile));
  }

  restore(scope: Scope): Promise<ApplyResult> {
    return this.run(() => this.applyOrRestore(scope));
  }

  undo(scope: Scope): Promise<ApplyResult> {
    return this.run(async () => {
      requireWritable(scope);
      const recoveryConflicts: SettingKey[] = [];
      const history = await this.recover(scope, recoveryConflicts);
      const previous = history.at(-1);
      if (!previous) return { count: 0, conflicts: recoveryConflicts, unavailable: 0 };
      const { changes, conflicts } = prepareUndo(snapshot(scope), previous.changes);
      await this.write(scope, history, history.slice(0, -1), changes);
      return {
        count: changes.length,
        conflicts: [...new Set([...recoveryConflicts, ...conflicts])],
        unavailable: 0,
      };
    });
  }

  recoverWritable(): Promise<SettingKey[]> {
    return this.run(async () => {
      const conflicts: SettingKey[] = [];
      for (const scope of ['user', 'workspace'] as const) {
        if (writable(scope)) await this.recover(scope, conflicts);
      }
      return conflicts;
    });
  }

  private run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private read(scope: Scope): Journal {
    return this.stores[scope].get<Journal>(journalKey) ?? { history: [] };
  }

  private async recover(scope: Scope, conflicts: SettingKey[] = []): Promise<Application[]> {
    const journal = this.read(scope);
    if (journal.pending) {
      requireWritable(scope);
      const { changes, attempted } = journal.pending;
      const outcome = await this.rollback(scope, changes.slice(0, attempted));
      conflicts.push(...outcome);
      await this.stores[scope].update(journalKey, { history: journal.history });
    }
    return journal.history;
  }

  private async applyOrRestore(scope: Scope, profile?: Profile): Promise<ApplyResult> {
    requireWritable(scope);
    const recoveryConflicts: SettingKey[] = [];
    const history = await this.recover(scope, recoveryConflicts);
    const id = randomUUID();
    const previous = history.at(-1)?.overlay ?? [];
    const result = prepareApplication(
      snapshot(scope),
      scope === 'workspace' ? snapshot('user') : {},
      previous,
      profile,
      id,
    );
    const { overlay, changes, unavailable } = result;
    if (changes.length || !isDeepStrictEqual(previous, overlay)) {
      const application: Application = {
        id,
        label: profile?.name ?? 'Restaurar ajustes de Studio',
        date: new Date().toISOString(),
        changes,
        overlay,
      };
      await this.write(scope, history, [...history, application].slice(-limit), changes);
    }
    return {
      count: changes.length,
      conflicts: [...new Set([...result.conflicts, ...recoveryConflicts])],
      unavailable,
    };
  }

  private async write(
    scope: Scope,
    history: Application[],
    next: Application[],
    changes: SettingChange[],
  ): Promise<void> {
    const store = this.stores[scope];
    let attempted = 0;
    try {
      for (const change of changes) {
        this.assertCurrent(scope, change);
        const index = attempted + 1;
        await store.update(journalKey, { history, pending: { changes, attempted: index } });
        this.assertCurrent(scope, change);
        attempted = index;
        await vscode.workspace
          .getConfiguration()
          .update(change.key, change.after, nativeTarget(scope));
      }
      await store.update(journalKey, { history: next });
    } catch (error) {
      let conflicts: SettingKey[];
      try {
        conflicts = await this.rollback(scope, changes.slice(0, attempted));
        await store.update(journalKey, { history });
      } catch (rollbackError) {
        throw new Error(
          `La operación se interrumpió. Revisa los ajustes de VS Code. ${String(rollbackError)}`,
          { cause: rollbackError },
        );
      }
      if (conflicts.length) {
        throw new Error(`Se conservaron ediciones externas en ${conflicts.join(', ')}.`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  private assertCurrent(scope: Scope, change: SettingChange): void {
    requireWritable(scope);
    if (
      !isDeepStrictEqual(
        patch(vscode.workspace.getConfiguration(), scope, change.key),
        change.before,
      )
    ) {
      throw new Error(`${change.key} cambió en VS Code. Revisa el valor y vuelve a aplicar.`);
    }
  }

  private async rollback(scope: Scope, changes: readonly SettingChange[]): Promise<SettingKey[]> {
    const conflicts = new Set<SettingKey>();
    for (const change of [...changes].reverse()) {
      requireWritable(scope);
      const config = vscode.workspace.getConfiguration();
      const current = patch(config, scope, change.key);
      const result = revertSettings({ [change.key]: current }, [change]);
      for (const conflict of result.conflicts) conflicts.add(conflict);
      if (!isDeepStrictEqual(current, result.values[change.key])) {
        await config.update(change.key, result.values[change.key], nativeTarget(scope));
      }
    }
    return [...conflicts];
  }
}
