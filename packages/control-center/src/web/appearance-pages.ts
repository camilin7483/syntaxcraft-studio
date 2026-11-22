import { themes } from '../../../colors/src';
import { iconStyles, productIcon } from '../profile';
import { button, el, icon, panel } from './dom';
import type { StudioModel } from './model';
import { palette, preview, swatch } from './preview';

export function dashboardPage(model: StudioModel) {
  const range = palette(model.draft, model.state);
  const active = model.state?.effective;
  const activeIcons = iconStyles.find(({ id }) => id === active?.fileIcons);
  const visual = el(
    'section',
    'dashboard-hero',
    el(
      'div',
      'hero-copy',
      el('h2', '', 'Apariencia del editor'),
      el(
        'dl',
        'active-settings',
        el('dt', '', 'Tema activo'),
        el('dd', '', active?.theme ?? 'Cargando…'),
        el('dt', '', 'Iconos de archivo'),
        el(
          'dd',
          '',
          activeIcons?.label ??
            (active?.fileIcons === null ? 'Sin iconos' : (active?.fileIcons ?? 'Cargando…')),
        ),
        el('dt', '', 'Formato al guardar'),
        el('dd', '', active?.formatOnSave ? 'Activado' : 'Desactivado'),
      ),
      button('Abrir Estudio de color', () => model.navigate('colors'), 'primary'),
    ),
    el(
      'div',
      'hero-preview',
      el(
        'div',
        'hero-preview-title',
        'Vista previa',
        el('span', '', range.theme?.label ?? 'Tema actual'),
      ),
      preview(model.draft, model.baseline, model.state, '', false),
    ),
  );
  const shortcuts = [
    ['themes', 'Temas', 'Elige la paleta del editor y de la interfaz.'],
    ['icons', 'Iconos', 'Previsualiza archivos y carpetas del explorador.'],
    ['profiles', 'Perfiles', 'Guarda, exporta o restaura una configuración.'],
  ] as const;
  const installed = model.state?.installed;
  return el(
    'div',
    'page-stack',
    visual,
    installed &&
      (!installed.colors || !installed.icons || !installed.organizer) &&
      el(
        'p',
        'notice warning',
        `Extensiones por instalar: ${[!installed.colors && 'Colors', !installed.icons && 'Icons', !installed.organizer && 'Organizer'].filter(Boolean).join(', ')}.`,
      ),
    el(
      'div',
      'shortcut-row',
      ...shortcuts.map(([id, label, description]) => {
        const link = button('', () => model.navigate(id), 'shortcut');
        link.append(
          icon(id),
          el('span', 'shortcut-copy', el('strong', '', label), el('span', 'subtle', description)),
          icon('arrow', 'ui-icon trailing-icon'),
        );
        return link;
      }),
    ),
    panel('Actividad del ámbito seleccionado', historyTable(model, true)),
  );
}

export function themesPage(model: StudioModel) {
  const selected = model.draft.preferences.theme ?? model.state?.effective.theme;
  const grid = el('div', 'theme-grid');
  for (const theme of themes) {
    const chosen = selected === theme.label;
    const choice = button('', () => model.preference('theme', theme.label), 'theme-card');
    choice.setAttribute('aria-pressed', String(chosen));
    choice.setAttribute('aria-label', `Seleccionar ${theme.label}`);
    const mock = el(
      'span',
      'theme-sample',
      el(
        'span',
        'theme-sample-canvas',
        el('span', 'theme-sample-side'),
        el(
          'span',
          'theme-sample-code',
          ...Object.values(theme.palette)
            .slice(0, 5)
            .map((color) => {
              const line = el('span', 'theme-sample-line');
              line.style.setProperty('--stroke', color);
              return line;
            }),
        ),
      ),
    );
    mock.style.setProperty('--theme-bg', theme.background);
    mock.style.setProperty('--theme-text', theme.foreground);
    mock.style.setProperty('--theme-accent', theme.accent);
    const details = el(
      'span',
      'theme-details',
      theme.label.replace('SyntaxCraft ', ''),
      chosen && icon('check'),
    );
    const variant =
      theme.variant === 'light'
        ? 'Claro'
        : theme.variant === 'high-contrast'
          ? 'Alto contraste'
          : 'Oscuro';
    choice.append(mock, details, el('span', 'theme-variant', variant));
    grid.append(choice);
  }
  return el(
    'div',
    'page-stack',
    model.state &&
      !model.state.installed.colors &&
      el('p', 'notice warning', 'Instala SyntaxCraft Colors para aplicar los temas.'),
    el(
      'div',
      'panel-bar',
      el(
        'p',
        'subtle',
        selected
          ? `Selección del borrador: ${selected}`
          : 'Selecciona un tema. Aplica el borrador para activarlo.',
      ),
      el(
        'div',
        'inline actions',
        button(
          'Seguir el tema actual',
          () => model.preference('theme'),
          'secondary',
          !model.draft.preferences.theme,
        ),
        button(
          'Ajustes de VS Code',
          () => model.send({ type: 'nativeSettings', setting: 'workbench.colorTheme' }),
          'quiet',
          model.busy,
        ),
      ),
    ),
    grid,
    panel(
      'Custom Studio',
      el(
        'p',
        'subtle',
        'Personaliza los colores del área de trabajo y los tokens en el mismo perfil.',
      ),
      el(
        'div',
        'inline actions',
        button('Colores del área de trabajo', () => model.navigate('settings'), 'secondary'),
        button('Colores de tokens', () => model.navigate('colors'), 'quiet'),
      ),
    ),
  );
}

const iconPreview = [
  ['folder-src-open', 'src', 0],
  ['typescript', 'palette.ts', 1],
  ['react', 'Swatch.tsx', 1],
  ['vue', 'Swatch.vue', 1],
  ['folder-tests', 'tests', 0],
  ['test', 'palette.test.ts', 1],
  ['docker', 'Dockerfile', 0],
] as const;

export function iconsPage(model: StudioModel) {
  const current = model.draft.preferences.fileIcons ?? model.state?.effective.fileIcons;
  const folder = model.root.dataset.icons ?? '';
  const product = model.draft.preferences.productIcons ?? model.state?.effective.productIcons;
  const grid = el('div', 'icon-grid');
  for (const style of iconStyles) {
    const choice = button('', () => model.preference('fileIcons', style.id), 'icon-card');
    choice.setAttribute('aria-pressed', String(current === style.id));
    choice.setAttribute('aria-label', `Seleccionar iconos ${style.label}`);
    const tree = el('span', 'file-tree');
    for (const [asset, name, level] of iconPreview) {
      const image = el('img');
      image.src = `${folder}/${style.slug}/${asset}.svg`;
      image.alt = '';
      image.width = 18;
      image.height = 18;
      tree.append(el('span', `file-tree-row ${level ? 'child' : ''}`, image, name));
    }
    choice.append(
      el('span', 'theme-details', style.label, current === style.id && icon('check')),
      tree,
    );
    grid.append(choice);
  }
  return el(
    'div',
    'page-stack',
    model.state &&
      !model.state.installed.icons &&
      el('p', 'notice warning', 'Instala SyntaxCraft Icons para activar estos conjuntos.'),
    panel(
      'Iconos de archivos y carpetas',
      grid,
      el(
        'div',
        'inline actions wrap',
        button(
          'Seguir el estilo actual',
          () => model.preference('fileIcons'),
          'quiet',
          model.draft.preferences.fileIcons === undefined,
        ),
        button(
          'Usar iconos de VS Code',
          () => model.preference('fileIcons', 'vs-seti'),
          'secondary',
        ),
        button('Sin iconos', () => model.preference('fileIcons', 'none'), 'quiet'),
      ),
    ),
    panel(
      'Iconos de interfaz',
      el(
        'p',
        'subtle',
        'El tema SyntaxCraft cambia nueve iconos del área de trabajo. VS Code proporciona los restantes.',
      ),
      el(
        'div',
        'inline actions wrap',
        button(
          'Seleccionar SyntaxCraft',
          () => model.preference('productIcons', productIcon),
          product === productIcon ? 'primary' : 'secondary',
        ),
        button(
          'Usar iconos de VS Code',
          () => model.preference('productIcons', 'Default'),
          'secondary',
        ),
        button(
          'Seguir el estilo actual',
          () => model.preference('productIcons'),
          'quiet',
          model.draft.preferences.productIcons === undefined,
        ),
      ),
    ),
  );
}

export function historyTable(model: StudioModel, compact = false) {
  const target = model.state?.targets[model.scope];
  const entries = target?.history.slice(0, compact ? 3 : undefined) ?? [];
  if (!entries.length)
    return el('p', 'empty', 'Las aplicaciones de perfiles en este ámbito aparecerán aquí.');
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return el(
    'ul',
    'history-list',
    ...entries.map((entry) => {
      const time = el('time', 'subtle', date.format(new Date(entry.date)));
      time.dateTime = entry.date;
      return el(
        'li',
        '',
        el('strong', '', entry.label),
        time,
        el('span', 'history-count', `${entry.count} ajustes`),
      );
    }),
  );
}

export function contrastPalette(model: StudioModel) {
  const range = palette(model.draft, model.state);
  return el(
    'div',
    'palette-strip',
    swatch(range.background),
    el('code', '', range.background),
    swatch(range.foreground),
    el('code', '', range.foreground),
  );
}
