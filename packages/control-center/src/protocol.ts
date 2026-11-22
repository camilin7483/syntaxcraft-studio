import { languages } from '../../colors/src';
import { exactKeys, isRecord, validateProfile } from './profile';
import type { Preferences, Profile, StoredProfile } from './profile';
import type { Scope, SettingsManager } from './settings';

export const sections = [
  'dashboard',
  'colors',
  'languages',
  'themes',
  'icons',
  'organizer',
  'profiles',
  'accessibility',
  'settings',
] as const;
export type Section = (typeof sections)[number];

export const organizerActions = [
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
] as const;
export type OrganizerAction = (typeof organizerActions)[number];

export const nativeSettings = [
  'workbench.colorTheme',
  'workbench.iconTheme',
  'workbench.productIconTheme',
  'editor.defaultFormatter',
  'editor.semanticHighlighting.enabled',
  'editor.tokenColorCustomizations',
  'editor.semanticTokenColorCustomizations',
  'workbench.colorCustomizations',
] as const;
type NativeSettings = (typeof nativeSettings)[number];

const languageIds: ReadonlySet<string> = new Set(languages.map(({ id }) => id));
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

type ProfileRevision = { profileId: string; revision: number };
type RequestBody =
  | { type: 'ready' | 'import' | 'organizerStatus' }
  | { type: 'apply'; scope: Scope; profile: Profile }
  | { type: 'undo' | 'restore'; scope: Scope }
  | ({ type: 'deleteProfile' } & ProfileRevision)
  | { type: 'saveProfile'; profile: Profile; edit?: ProfileRevision }
  | { type: 'export'; profile: Profile }
  | { type: 'organizerAction'; action: OrganizerAction }
  | { type: 'nativeSettings'; setting: NativeSettings }
  | { type: 'sample'; language: string };
export type StudioRequest = RequestBody & { id: number };

export interface ActivationMetrics {
  milliseconds: number;
  heapDeltaBytes: number;
  hostHeapBytes: number;
}

export interface StudioState {
  profiles: StoredProfile[];
  targets: ReturnType<SettingsManager['state']>;
  effective: { [K in keyof Preferences]?: Preferences[K] | null };
  installed: { colors: boolean; icons: boolean; organizer: boolean };
  trusted: boolean;
  workspace: boolean;
  workbench: Record<string, string>;
  metrics: ActivationMetrics;
}

export type StudioResponse =
  | { type: 'state'; state: StudioState }
  | { type: 'navigate'; section: Section }
  | {
      type: 'result';
      id: number;
      message?: string;
      profile?: Profile;
      saved?: StoredProfile;
      organizer?: unknown;
    }
  | { type: 'error'; id: number; message: string };

export function requestId(raw: unknown): number {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('id' in raw) ||
    typeof raw.id !== 'number' ||
    !Number.isSafeInteger(raw.id) ||
    raw.id < 1
  )
    return 0;
  return raw.id;
}

function revision(raw: unknown): ProfileRevision | undefined {
  if (
    !exactKeys(raw, ['profileId', 'revision']) ||
    typeof raw.profileId !== 'string' ||
    !uuid.test(raw.profileId) ||
    typeof raw.revision !== 'number' ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision < 1
  )
    return undefined;
  return { profileId: raw.profileId, revision: raw.revision };
}

export function readRequest(raw: unknown): StudioRequest {
  const id = requestId(raw);
  if (!id || !isRecord(raw)) throw new Error('Solicitud del panel no válida.');
  const type = raw.type;
  if (
    (type === 'ready' || type === 'import' || type === 'organizerStatus') &&
    exactKeys(raw, ['type', 'id'])
  )
    return { id, type };
  if (
    (type === 'apply' || type === 'undo' || type === 'restore') &&
    exactKeys(
      raw,
      type === 'apply' ? ['type', 'id', 'scope', 'profile'] : ['type', 'id', 'scope'],
    ) &&
    (raw.scope === 'user' || raw.scope === 'workspace')
  ) {
    return type === 'apply'
      ? { id, type, scope: raw.scope, profile: validateProfile(raw.profile) }
      : { id, type, scope: raw.scope };
  }
  if (type === 'saveProfile' && exactKeys(raw, ['type', 'id', 'profile', 'edit'])) {
    const edit = revision(raw.edit);
    if (raw.edit !== undefined && !edit) throw new Error('La revisión del perfil no es válida.');
    return { id, type, profile: validateProfile(raw.profile), edit };
  }
  if (type === 'deleteProfile' && exactKeys(raw, ['type', 'id', 'profileId', 'revision'])) {
    const edit = revision({ profileId: raw.profileId, revision: raw.revision });
    if (edit) return { id, type, ...edit };
  }
  if (type === 'export' && exactKeys(raw, ['type', 'id', 'profile']))
    return { id, type, profile: validateProfile(raw.profile) };
  if (type === 'organizerAction' && exactKeys(raw, ['type', 'id', 'action'])) {
    const action = organizerActions.find((allowed) => allowed === raw.action);
    if (action) return { id, type, action };
  }
  if (type === 'nativeSettings' && exactKeys(raw, ['type', 'id', 'setting'])) {
    const setting = nativeSettings.find((allowed) => allowed === raw.setting);
    if (setting) return { id, type, setting };
  }
  if (
    type === 'sample' &&
    exactKeys(raw, ['type', 'id', 'language']) &&
    typeof raw.language === 'string' &&
    languageIds.has(raw.language)
  )
    return { id, type, language: raw.language };
  throw new Error('La acción solicitada no está disponible.');
}
