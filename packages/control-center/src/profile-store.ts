import { randomUUID } from 'node:crypto';
import type { Memento } from 'vscode';
import { maxSavedProfiles, validateProfile } from './profile';
import type { Profile, StoredProfile } from './profile';

const key = 'syntaxcraft.profiles.v1';

export class ProfileStore {
  constructor(private readonly storage: Memento) {}

  list(): StoredProfile[] {
    return this.storage.get<StoredProfile[]>(key) ?? [];
  }

  async save(
    profile: Profile,
    edit?: { profileId: string; revision: number },
  ): Promise<StoredProfile> {
    const profiles = this.list();
    const normalized = validateProfile(profile);
    const index = edit ? profiles.findIndex(({ id }) => id === edit.profileId) : -1;
    const old = index === -1 ? undefined : profiles[index];
    if (edit && old?.revision !== edit.revision)
      throw new Error('El perfil cambió. Vuelve a abrirlo para editar la revisión actual.');
    if (!edit && profiles.length >= maxSavedProfiles)
      throw new Error(`Puedes guardar hasta ${maxSavedProfiles} perfiles.`);
    const saved = {
      id: old?.id ?? randomUUID(),
      revision: (old?.revision ?? 0) + 1,
      profile: normalized,
    };
    const updated = [...profiles];
    if (index < 0) updated.push(saved);
    else updated[index] = saved;
    await this.storage.update(key, updated);
    return saved;
  }

  async delete(profileId: string, revision: number): Promise<void> {
    const profiles = this.list();
    const match = profiles.find(({ id }) => id === profileId);
    if (match?.revision !== revision)
      throw new Error('El perfil cambió. Abre su revisión actual para eliminarlo.');
    await this.storage.update(
      key,
      profiles.filter(({ id }) => id !== profileId),
    );
  }
}
