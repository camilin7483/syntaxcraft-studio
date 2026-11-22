import type { Preferences, Profile, StoredProfile } from '../profile';
import type { Section, StudioRequest, StudioState } from '../protocol';
import type { Scope } from '../settings';

type RemoveId<T> = T extends { id: number } ? Omit<T, 'id'> : never;
export type Request = RemoveId<StudioRequest>;

export interface StudioModel {
  section: Section;
  state?: StudioState;
  draft: Profile;
  baseline: Profile;
  edit?: { profileId: string; revision: number };
  scope: Scope;
  language: string;
  token: string;
  query: string;
  compare: boolean;
  busy: boolean;
  organizer?: unknown;
  notice: string;
  root: HTMLElement;
  update: (apply: (draft: Profile) => void) => void;
  render: () => void;
  send: (request: Request) => void;
  navigate: (section: Section) => void;
  load: (profile: Profile, edit?: StoredProfile) => void;
  preference: <K extends keyof Preferences>(item: K, value?: Preferences[K]) => void;
}
