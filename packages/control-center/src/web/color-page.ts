import { languages, ruleMechanisms, tokens } from '../../../colors/src';
import type { TokenRule } from '../../../colors/src';
import { contrastRatio, parseColor } from '../color';
import { ruleIdentity } from '../profile';
import { sampleFor } from '../samples';
import { button, el, field, icon, input, panel, select } from './dom';
import type { StudioModel } from './model';
import { palette, preview, swatch, tokenAppearance } from './preview';

export const tokenNames: Record<string, string> = {
  'variable-local': 'Variable local',
  'variable-global': 'Variable global',
  'variable-instance': 'Variable de instancia',
  constant: 'Constante',
  'function-declaration': 'Declaración de función',
  'function-call': 'Llamada a función',
  method: 'Método',
  class: 'Clase',
  interface: 'Interfaz',
  type: 'Tipo',
  generic: 'Tipo genérico',
  namespace: 'Espacio de nombres',
  object: 'Objeto',
  property: 'Propiedad',
  parameter: 'Parámetro',
  argument: 'Argumento',
  keyword: 'Palabra reservada',
  operator: 'Operador',
  async: 'Código asíncrono',
  decorator: 'Decorador',
  annotation: 'Anotación',
  'import-export': 'Importación y exportación',
  'html-tag': 'Etiqueta HTML o XML',
  'html-attribute': 'Atributo HTML o XML',
  'css-selector': 'Selector CSS',
  'css-value': 'Valor CSS',
  number: 'Número',
  string: 'Cadena',
  comment: 'Comentario',
  regex: 'Expresión regular',
  boolean: 'Booleano',
  null: 'Valor nulo',
};
export const tokenName = (id: string) =>
  tokenNames[id] ?? tokens.find((token) => token.id === id)?.label ?? id;

function languageSelect(model: StudioModel, id = 'language') {
  return select(
    id,
    model.language,
    [['', 'Todos los lenguajes'], ...languages.map(({ id, label }) => [id, label] as const)],
    (value) => {
      model.language = value;
      model.render();
    },
  );
}

function tokenList(model: StudioModel, list: HTMLElement) {
  const query = model.query.toLocaleLowerCase().trim();
  list.replaceChildren();
  for (const token of tokens) {
    const name = tokenName(token.id);
    if (query && !`${name} ${token.id} ${token.group}`.toLowerCase().includes(query)) continue;
    const chosen = model.token === token.id;
    const rule = model.draft.rules.find(
      (item) => item.token === token.id && (item.language ?? '') === model.language,
    );
    const foreground = tokenAppearance(
      model.draft,
      model.state,
      token.id,
      model.language,
    ).foreground;
    const row = button(
      '',
      () => {
        model.token = token.id;
        model.render();
      },
      'token-row',
    );
    row.id = `token-${token.id}`;
    row.setAttribute('aria-pressed', String(chosen));
    row.append(swatch(foreground), el('span', 'token-name', name));
    if (rule) row.append(el('span', 'token-change', icon('check')));
    list.append(row);
  }
  if (!list.childElementCount) list.append(el('p', 'empty', 'No se encontraron tokens.'));
}

function tokenEditor(model: StudioModel) {
  const language = model.language || undefined;
  const token = model.token;
  const mechanisms = ruleMechanisms(token, language);
  const id = ruleIdentity({ token, language });
  const current = model.draft.rules.find((item) => ruleIdentity(item) === id);
  const appearance = tokenAppearance(model.draft, model.state, token, language);
  const { background } = palette(model.draft, model.state);
  const ratio = contrastRatio(appearance.foreground, background);

  function set(change: Partial<TokenRule>) {
    model.update((draft) => {
      const rule = { token, ...current, ...change, language };
      draft.rules = draft.rules.filter((candidate) => ruleIdentity(candidate) !== id);
      if (rule.foreground || rule.style) draft.rules.push(rule);
    });
  }

  const hex = input('token-hex', current?.foreground ?? '');
  hex.placeholder = appearance.foreground;
  hex.maxLength = 80;
  const color = input('token-picker', appearance.foreground, 'color');
  color.setAttribute('aria-label', 'Seleccionar color del token');
  const ratioText = el(
    'p',
    `ratio ${ratio < 4.5 ? 'ratio-warning' : ''}`,
    `${ratio.toFixed(2)}:1`,
    el('span', '', ratio < 4.5 ? ' Contraste bajo' : ' Contraste AA para texto normal'),
  );
  const onColor = () => {
    const value = hex.value.trim();
    const parsed = value ? parseColor(value) : undefined;
    hex.setCustomValidity(value && !parsed ? 'Introduce HEX, RGB o HSL.' : '');
    if (value && !parsed) {
      hex.reportValidity();
      return;
    }
    set({ foreground: parsed });
  };
  hex.addEventListener('change', onColor);
  hex.addEventListener('input', () => hex.setCustomValidity(''));
  color.addEventListener('change', () => set({ foreground: parseColor(color.value) }));
  const style = select(
    'token-style',
    current?.style ?? '',
    [
      ['', 'Heredar'],
      ['normal', 'Normal'],
      ['bold', 'Negrita'],
      ['italic', 'Cursiva'],
      ['underline', 'Subrayado'],
    ],
    (value) => set({ style: (value || undefined) as TokenRule['style'] }),
  );
  const mechanism = select(
    'token-mechanism',
    current?.mechanism ?? 'auto',
    [
      ['auto', 'Automático'],
      ...mechanisms.map((kind) => [kind, kind === 'semantic' ? 'Semántico' : 'TextMate'] as const),
    ],
    (value) =>
      set({
        mechanism: value as TokenRule['mechanism'],
        foreground: current?.foreground ?? (current?.style ? undefined : appearance.foreground),
      }),
  );
  for (const control of [hex, color, style, mechanism]) control.disabled = mechanisms.length === 0;
  const names = mechanisms
    .map((kind) => (kind === 'semantic' ? 'Semántico' : 'TextMate'))
    .join(' + ');
  const ruleScope = language
    ? (languages.find(({ id }) => id === language)?.label ?? language)
    : 'Todos los lenguajes';
  return panel(
    tokenName(token),
    el('p', 'rule-scope', ruleScope, names ? el('span', 'tag', names) : undefined),
    mechanisms.length === 0 &&
      el(
        'p',
        'notice warning',
        'Este lenguaje o proveedor no distingue este token de forma fiable.',
      ),
    current?.mechanism &&
      current.mechanism !== 'auto' &&
      !mechanisms.includes(current.mechanism) &&
      el('p', 'notice warning', 'Este borrador contiene un mecanismo no disponible para el token.'),
    el(
      'div',
      'color-inputs',
      color,
      field('Color del token', hex, 'HEX, RGB o HSL. Déjalo vacío para heredar.'),
    ),
    ratioText,
    el('div', 'fields two', field('Estilo', style), field('Mecanismo', mechanism)),
    button(
      'Quitar personalización',
      () =>
        model.update((draft) => {
          draft.rules = draft.rules.filter((candidate) => ruleIdentity(candidate) !== id);
        }),
      'quiet',
      !current,
    ),
  );
}

export function colorsPage(model: StudioModel) {
  const search = input('search-tokens', model.query, 'search');
  search.placeholder = 'Buscar un token';
  search.setAttribute('aria-label', 'Buscar un token');
  const list = el('div', 'token-list');
  search.addEventListener('input', () => {
    model.query = search.value;
    tokenList(model, list);
  });
  tokenList(model, list);
  const sample = sampleFor(model.language || undefined);
  const compare = button(
    model.compare ? 'Vista única' : 'Comparar',
    () => {
      model.compare = !model.compare;
      model.render();
    },
    'secondary',
    !sample,
  );
  compare.setAttribute('aria-pressed', String(model.compare));
  const heading = el(
    'div',
    'panel-bar',
    el(
      'div',
      '',
      el('h2', 'panel-title', 'Vista previa de código'),
      el('p', 'subtle', 'El resultado en el editor depende de su gramática y proveedor semántico.'),
    ),
    el(
      'div',
      'inline actions',
      compare,
      button(
        'Abrir muestra en VS Code',
        () => {
          if (sample) model.send({ type: 'sample', language: model.language || sample.language });
        },
        'quiet',
        model.busy || !sample,
      ),
    ),
  );
  const theme = palette(model.draft, model.state).theme;
  const paletteStrip = theme
    ? el(
        'div',
        'palette-strip',
        el('span', '', 'Paleta del tema'),
        ...[...new Set(Object.values(theme.palette))].map((value) => swatch(value)),
      )
    : undefined;
  return el(
    'div',
    'page-stack',
    el(
      'section',
      'panel preview-panel',
      heading,
      preview(model.draft, model.baseline, model.state, model.language, model.compare),
      paletteStrip,
    ),
    el(
      'div',
      'split token-layout',
      panel(
        'Tokens',
        field('Lenguaje', languageSelect(model)),
        el('div', 'search-field', icon('search'), search),
        list,
      ),
      tokenEditor(model),
    ),
  );
}

export function languagesPage(model: StudioModel) {
  const current = languages.find(({ id }) => id === model.language);
  const cards = el('div', 'language-grid');
  for (const language of languages) {
    const chosen = language.id === model.language;
    const row = button(
      '',
      () => {
        model.language = language.id;
        model.render();
      },
      'language-row',
    );
    row.setAttribute('aria-pressed', String(chosen));
    row.id = `language-${language.id}`;
    row.append(el('strong', '', language.label), el('code', '', language.id));
    cards.append(row);
  }
  return el(
    'div',
    'page-stack',
    panel(
      'Preferencias por lenguaje',
      field('Lenguaje', languageSelect(model, 'catalog-language')),
      current
        ? el(
            'div',
            'language-detail',
            el('strong', '', current.label),
            current.note && el('p', 'subtle', current.note),
            current.provider && el('p', 'field-note', 'Proveedor: ', current.provider),
            el('p', 'field-note', 'Modos de VS Code: ', current.languageIds.join(', ')),
            el(
              'p',
              'field-note',
              `${tokens.filter(({ id }) => ruleMechanisms(id, current.id).length > 0).length} categorías con selectores disponibles. La cobertura depende del proveedor instalado.`,
            ),
            button('Editar tokens de este lenguaje', () => model.navigate('colors'), 'secondary'),
          )
        : el(
            'p',
            'subtle',
            'Selecciona un lenguaje para consultar sus selectores y personalizar sus reglas.',
          ),
    ),
    panel(`Catálogo de lenguajes · ${languages.length}`, cards),
  );
}
