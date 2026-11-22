import { builtInProfiles, emptyProfile } from '../profile';
import type { StoredProfile } from '../profile';
import { historyTable } from './appearance-pages';
import { button, el, field, input, panel } from './dom';
import type { StudioModel } from './model';

function profileRow(model: StudioModel, saved: StoredProfile) {
  const { profile } = saved;
  return el(
    'li',
    'profile-row',
    el(
      'div',
      '',
      el('strong', '', profile.name),
      el(
        'span',
        'subtle',
        `${profile.rules.length} reglas · ${Object.keys(profile.preferences).length} preferencias`,
      ),
    ),
    el(
      'div',
      'inline wrap actions',
      button('Editar', () => model.load(profile, saved), 'secondary', model.busy),
      button(
        'Duplicar',
        () =>
          model.send({
            type: 'saveProfile',
            profile: { ...profile, name: `Copia de ${profile.name.slice(0, 54)}` },
          }),
        'quiet',
        model.busy,
      ),
      button('Exportar', () => model.send({ type: 'export', profile }), 'quiet', model.busy),
      button(
        'Eliminar',
        () => model.send({ type: 'deleteProfile', profileId: saved.id, revision: saved.revision }),
        'danger',
        model.busy,
      ),
    ),
  );
}

export function profilesPage(model: StudioModel) {
  const name = input('profile-name', model.draft.name);
  name.maxLength = 64;
  name.required = true;
  name.addEventListener('change', () =>
    model.update((draft) => {
      draft.name = name.value;
    }),
  );
  const saved = model.state?.profiles ?? [];
  return el(
    'div',
    'page-stack',
    panel(
      'Borrador de perfil',
      field('Nombre del perfil', name),
      el(
        'div',
        'inline wrap actions',
        button(
          'Guardar perfil',
          () => model.send({ type: 'saveProfile', profile: model.draft, edit: model.edit }),
          'primary',
          model.busy,
        ),
        button('Crear perfil', () => model.load(emptyProfile()), 'secondary', model.busy),
        button('Importar JSON', () => model.send({ type: 'import' }), 'secondary', model.busy),
        button(
          'Exportar borrador',
          () => model.send({ type: 'export', profile: model.draft }),
          'quiet',
          model.busy,
        ),
      ),
    ),
    panel(
      'Perfiles guardados',
      saved.length
        ? el('ul', 'profile-list', ...saved.map((profile) => profileRow(model, profile)))
        : el('p', 'empty', 'Todavía no has guardado perfiles.'),
    ),
    panel(
      'Preajustes',
      el(
        'div',
        'preset-grid',
        ...builtInProfiles.map((preset) =>
          button(preset.name, () => model.load(preset), 'secondary', model.busy),
        ),
      ),
    ),
    panel('Historial de aplicaciones', historyTable(model)),
  );
}
