import { tokens } from '../../../colors/src';
import { contrastRatio, parseColor } from '../color';
import { colorGroups, isRecord } from '../profile';
import type { Preferences } from '../profile';
import type { OrganizerAction } from '../protocol';
import { contrastPalette, historyTable } from './appearance-pages';
import { tokenName } from './color-page';
import { button, el, field, input, panel, select } from './dom';
import type { StudioModel } from './model';
import { palette, swatch, tokenAppearance } from './preview';

function toggle(
  model: StudioModel,
  key:
    | 'formatOnSave'
    | 'insertSpaces'
    | 'detectIndentation'
    | 'indentationGuides'
    | 'semanticHighlighting',
  name: string,
  description?: string,
) {
  const effective = model.state?.effective[key];
  const none =
    typeof effective === 'boolean'
      ? `Heredar (${effective ? 'activado' : 'desactivado'})`
      : 'Heredar';
  const control = select(
    key,
    String(model.draft.preferences[key] ?? ''),
    [
      ['', none],
      ['true', 'Activado'],
      ['false', 'Desactivado'],
    ],
    (value) => model.preference(key, value ? value === 'true' : undefined),
  );
  return field(name, control, description);
}

function numberPreference(
  model: StudioModel,
  key: 'tabSize' | 'fontSize' | 'lineHeight',
  name: string,
  min: number,
  max: number,
  description?: string,
) {
  const control = input(key, String(model.draft.preferences[key] ?? ''), 'number');
  control.min = String(min);
  control.max = String(max);
  control.step = '1';
  control.placeholder = String(model.state?.effective[key] ?? 'Heredar');
  control.addEventListener('change', () => {
    if (!control.reportValidity()) return;
    model.preference(key, control.value === '' ? undefined : control.valueAsNumber);
  });
  return field(name, control, description);
}

function selectPreference<K extends keyof Pick<Preferences, 'renderWhitespace' | 'wordWrap'>>(
  model: StudioModel,
  key: K,
  label: string,
  choices: readonly (readonly [string, string])[],
) {
  return field(
    label,
    select(key, model.draft.preferences[key] ?? '', [['', 'Heredar'], ...choices], (value) =>
      model.preference(key, value || undefined),
    ),
  );
}

const actions: readonly [OrganizerAction, string][] = [
  ['formatDocument', 'Formatear documento'],
  ['formatSelection', 'Formatear selección'],
  ['organizeImports', 'Organizar importaciones'],
  ['trimTrailingWhitespace', 'Quitar espacios finales'],
  ['normalizeLineEndings', 'Normalizar saltos de línea'],
  ['reindent', 'Corregir indentación'],
  ['nextRegion', 'Región siguiente'],
  ['previousRegion', 'Región anterior'],
  ['foldAll', 'Plegar bloques'],
  ['unfoldAll', 'Desplegar bloques'],
];

function providerList(title: string, raw: unknown) {
  const providers = Array.isArray(raw) ? raw.filter(isRecord) : [];
  if (!providers.length)
    return el(
      'div',
      'provider-list',
      el('h3', '', title),
      el('p', 'subtle', 'Sin candidatos en el catálogo para este archivo.'),
    );
  const states: Record<string, string> = {
    candidate: 'Detectado',
    notDetected: 'Por instalar',
    disabled: 'No habilitado',
  };
  return el(
    'div',
    'provider-list',
    el('h3', '', title),
    ...providers.map((provider) =>
      el(
        'div',
        'provider-row',
        el(
          'div',
          'provider-head',
          el('strong', '', String(provider.name)),
          el(
            'span',
            'tag',
            provider.configured
              ? 'Predeterminado'
              : (states[String(provider.availability)] ?? 'Disponibilidad variable'),
          ),
        ),
        typeof provider.requirements === 'string' && el('p', 'subtle', provider.requirements),
        typeof provider.reason === 'string' && el('p', 'field-note', provider.reason),
      ),
    ),
  );
}

export function organizerPage(model: StudioModel) {
  const report = isRecord(model.organizer) ? model.organizer : undefined;
  const document = isRecord(report?.document) ? report.document : undefined;
  const conflicts = Array.isArray(report?.conflicts) ? report.conflicts.filter(isRecord) : [];
  const available = Boolean(model.state?.installed.organizer);
  const trusted = Boolean(model.state?.trusted);
  return el(
    'div',
    'page-stack',
    !available &&
      el('p', 'notice warning', 'Instala SyntaxCraft Organizer para ejecutar estas acciones.'),
    !trusted &&
      el(
        'p',
        'notice warning',
        'El proyecto debe ser de confianza para organizar o formatear código.',
      ),
    panel(
      'Acciones sobre el editor',
      el(
        'p',
        'subtle',
        'Se usa el último archivo activo. El Organizador consulta los proveedores de VS Code y ofrece diferencias cuando puede obtener las ediciones.',
      ),
      el(
        'div',
        'actions organizer-buttons',
        ...actions.map(([action, label]) =>
          button(
            label,
            () => model.send({ type: 'organizerAction', action }),
            'secondary',
            model.busy || !available || !trusted,
          ),
        ),
      ),
    ),
    panel(
      'Proveedores y conflictos',
      el(
        'div',
        'panel-bar',
        el(
          'p',
          'subtle',
          document
            ? `${String(document.name)} · ${String(document.languageId)} · ${String(document.eol).toUpperCase()}`
            : 'Abre un archivo y consulta los proveedores disponibles.',
        ),
        el(
          'div',
          'inline wrap actions',
          button(
            'Consultar proveedores',
            () => model.send({ type: 'organizerStatus' }),
            'secondary',
            !available || model.busy,
          ),
          button(
            'Elegir formateador en VS Code',
            () => model.send({ type: 'nativeSettings', setting: 'editor.defaultFormatter' }),
            'quiet',
            model.busy,
          ),
        ),
      ),
      ...conflicts.flatMap((conflict) =>
        typeof conflict.message === 'string' ? [el('p', 'notice warning', conflict.message)] : [],
      ),
      document &&
        el(
          'div',
          'split',
          providerList('Formato', report?.formatters),
          providerList('Importaciones', report?.importOrganizers),
        ),
    ),
    panel(
      'Formato e indentación del perfil',
      el(
        'div',
        'fields two',
        toggle(model, 'formatOnSave', 'Formatear al guardar'),
        toggle(
          model,
          'detectIndentation',
          'Detectar indentación',
          'Desactiva la detección para fijar el tamaño y el tipo de sangría.',
        ),
        toggle(
          model,
          'insertSpaces',
          'Insertar espacios',
          'Desactiva esta opción para insertar tabulaciones.',
        ),
        numberPreference(model, 'tabSize', 'Tamaño de tabulación', 1, 32),
        toggle(model, 'indentationGuides', 'Guías de indentación'),
        selectPreference(model, 'renderWhitespace', 'Mostrar espacios en blanco', [
          ['none', 'Nunca'],
          ['boundary', 'En límites'],
          ['selection', 'En la selección'],
          ['trailing', 'Al final'],
          ['all', 'Siempre'],
        ]),
      ),
      el(
        'p',
        'subtle',
        'La consistencia de comillas depende del proveedor elegido y de su configuración del proyecto.',
      ),
    ),
  );
}

export function accessibilityPage(model: StudioModel) {
  const { background, foreground } = palette(model.draft, model.state);
  const title = tokens
    .flatMap(({ id }) => {
      const color = tokenAppearance(model.draft, model.state, id, model.language).foreground;
      const ratio = contrastRatio(color, background);
      return ratio >= 4.5 ? [] : [{ id, color, ratio }];
    })
    .sort((a, b) => a.ratio - b.ratio);
  const bodyRatio = contrastRatio(foreground, background);
  return el(
    'div',
    'page-stack',
    panel(
      'Contraste del borrador',
      contrastPalette(model),
      el(
        'p',
        `ratio ${bodyRatio < 4.5 ? 'ratio-warning' : ''}`,
        `${bodyRatio.toFixed(2)}:1`,
        el('span', '', ' Texto principal sobre el fondo'),
      ),
      el(
        'p',
        'subtle',
        'El umbral WCAG AA para texto normal es 4,5:1. La comprobación usa la paleta del borrador y el filtro del Estudio de color.',
      ),
      title.length
        ? el(
            'ul',
            'contrast-list',
            ...title.map(({ id, color, ratio }) => {
              const jump = button(
                tokenName(id),
                () => {
                  model.token = id;
                  model.navigate('colors');
                },
                'quiet',
              );
              return el(
                'li',
                '',
                swatch(color),
                jump,
                el('span', 'ratio-warning', `${ratio.toFixed(2)}:1`),
              );
            }),
          )
        : el('p', 'empty', 'Los colores comprobados alcanzan el umbral.'),
    ),
    panel(
      'Legibilidad',
      el(
        'div',
        'fields two',
        numberPreference(model, 'fontSize', 'Tamaño de fuente', 8, 80, 'En píxeles.'),
        numberPreference(
          model,
          'lineHeight',
          'Altura de línea',
          0,
          150,
          'Usa 0 para calcularla a partir del tamaño de fuente.',
        ),
        selectPreference(model, 'wordWrap', 'Ajuste de línea', [
          ['off', 'Desactivado'],
          ['on', 'Ancho del editor'],
          ['wordWrapColumn', 'Columna configurada'],
          ['bounded', 'El menor de ambos límites'],
        ]),
      ),
      button(
        'Seleccionar High Contrast Pro',
        () => model.preference('theme', 'SyntaxCraft High Contrast Pro'),
        'secondary',
      ),
    ),
  );
}

let selectedWorkbenchColor = 'editor.background';

function workbenchEditor(model: StudioModel) {
  const current = model.draft.workbench[selectedWorkbenchColor] ?? '';
  const fallback =
    parseColor(model.state?.workbench[selectedWorkbenchColor] ?? '') ??
    (selectedWorkbenchColor === 'editor.background'
      ? palette(model.draft, model.state).background
      : palette(model.draft, model.state).foreground);
  const key = el('select');
  key.id = 'workbench-key';
  for (const group of colorGroups) {
    const optgroup = el('optgroup');
    optgroup.label = group.label;
    for (const name of group.keys) {
      const option = el('option', '', name);
      option.value = name;
      optgroup.append(option);
    }
    key.append(optgroup);
  }
  key.value = selectedWorkbenchColor;
  key.addEventListener('change', () => {
    selectedWorkbenchColor = key.value;
    model.render();
  });
  const hex = input('workbench-hex', current);
  hex.placeholder = 'Heredar color del tema';
  hex.maxLength = 80;
  const picker = input('workbench-picker', current || fallback, 'color');
  picker.setAttribute('aria-label', 'Seleccionar color de interfaz');
  function set(value: string) {
    const color = parseColor(value);
    hex.setCustomValidity(value.trim() && !color ? 'Introduce HEX, RGB o HSL.' : '');
    if (!hex.reportValidity()) return;
    model.update((draft) => {
      if (color) draft.workbench[selectedWorkbenchColor] = color;
      else delete draft.workbench[selectedWorkbenchColor];
    });
  }
  picker.addEventListener('change', () => set(picker.value));
  hex.addEventListener('change', () => set(hex.value));
  hex.addEventListener('input', () => hex.setCustomValidity(''));
  return panel(
    'Colores del área de trabajo',
    el(
      'p',
      'subtle',
      'Guarda estos colores en cualquier perfil. Las reglas de color que ya estén asociadas a un tema pueden tener prioridad.',
    ),
    field('Color de interfaz', key),
    el(
      'div',
      'color-inputs',
      picker,
      field('Valor del color', hex, 'HEX, RGB o HSL. Déjalo vacío para heredar.'),
    ),
    el(
      'div',
      'inline wrap actions',
      button('Quitar personalización', () => set(''), 'quiet', !current),
      button(
        'Más colores en VS Code',
        () => model.send({ type: 'nativeSettings', setting: 'workbench.colorCustomizations' }),
        'secondary',
        model.busy,
      ),
    ),
  );
}

export function settingsPage(model: StudioModel) {
  const metrics = model.state?.metrics;
  const target = model.state?.targets[model.scope];
  return el(
    'div',
    'page-stack',
    workbenchEditor(model),
    panel(
      'Resaltado',
      toggle(
        model,
        'semanticHighlighting',
        'Tokens semánticos',
        'Heredar conserva el valor de VS Code. El proveedor del lenguaje debe emitir sus tokens.',
      ),
      el(
        'div',
        'inline wrap actions',
        button(
          'Ajustes TextMate de VS Code',
          () => model.send({ type: 'nativeSettings', setting: 'editor.tokenColorCustomizations' }),
          'secondary',
          model.busy,
        ),
        button(
          'Ajustes semánticos de VS Code',
          () =>
            model.send({
              type: 'nativeSettings',
              setting: 'editor.semanticTokenColorCustomizations',
            }),
          'secondary',
          model.busy,
        ),
      ),
    ),
    panel(
      'Restaurar ajustes de VS Code',
      el(
        'p',
        'subtle',
        'Recupera los valores previos de Studio en el ámbito seleccionado. Las ediciones externas que el panel detecte se conservan.',
      ),
      el(
        'div',
        'inline wrap actions',
        button(
          'Deshacer última aplicación',
          () => model.send({ type: 'undo', scope: model.scope }),
          'secondary',
          model.busy || !target?.available || !target.history.length,
        ),
        button(
          'Restaurar ajustes de Studio',
          () => model.send({ type: 'restore', scope: model.scope }),
          'danger',
          model.busy || !target?.available || !target.canRestore,
        ),
      ),
      historyTable(model),
    ),
    metrics &&
      panel(
        'Rendimiento del panel',
        el(
          'dl',
          'metrics',
          el('dt', '', 'Registro de activación'),
          el('dd', '', `${metrics.milliseconds.toFixed(2)} ms`),
          el('dt', '', 'Heap del host de extensiones'),
          el('dd', '', `${(metrics.hostHeapBytes / 1048576).toFixed(1)} MiB`),
        ),
        el(
          'p',
          'field-note',
          'La memoria corresponde al proceso compartido de extensiones. SyntaxCraft Studio carece de telemetría propia.',
        ),
      ),
  );
}
