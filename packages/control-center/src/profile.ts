import { languages, themes, tokens } from '../../colors/src';
import type { TokenRule } from '../../colors/src';
import { parseColor } from './color';

export const iconStyles = [
  { id: 'syntaxcraft-minimal', slug: 'minimal', label: 'Minimal' },
  { id: 'syntaxcraft-modern', slug: 'modern', label: 'Modern' },
  { id: 'syntaxcraft-neon', slug: 'neon', label: 'Neon' },
  { id: 'syntaxcraft-colorful', slug: 'colorful', label: 'Colorful' },
] as const;

export const productIcon = 'syntaxcraft-product';
export const maxProfileBytes = 1024 * 1024;
export const maxSavedProfiles = 60;

export const colorGroups = [
  {
    label: 'Editor y texto',
    keys: [
      'editor.background',
      'editor.foreground',
      'editorCursor.foreground',
      'editor.selectionBackground',
      'editor.selectionForeground',
      'editor.lineHighlightBackground',
      'editorLineNumber.foreground',
      'editorLineNumber.activeForeground',
      'editorIndentGuide.background1',
      'editorIndentGuide.activeBackground1',
      'editorWhitespace.foreground',
      'editor.findMatchBackground',
      'editorBracketMatch.border',
    ],
  },
  {
    label: 'Barras y paneles',
    keys: [
      'sideBar.background',
      'sideBar.foreground',
      'sideBar.border',
      'panel.background',
      'panel.border',
      'panelTitle.activeForeground',
      'activityBar.background',
      'activityBar.foreground',
      'activityBar.activeBorder',
      'activityBarBadge.background',
      'statusBar.background',
      'statusBar.foreground',
      'statusBar.border',
      'titleBar.activeBackground',
      'titleBar.activeForeground',
      'menu.background',
      'menu.foreground',
      'menu.selectionBackground',
      'menu.selectionForeground',
      'focusBorder',
      'contrastBorder',
    ],
  },
  {
    label: 'Pestañas y controles',
    keys: [
      'tab.activeBackground',
      'tab.activeForeground',
      'tab.activeBorderTop',
      'tab.inactiveBackground',
      'tab.inactiveForeground',
      'editorGroupHeader.tabsBackground',
      'editorGroup.border',
      'list.activeSelectionBackground',
      'list.activeSelectionForeground',
      'input.background',
      'input.foreground',
      'input.border',
      'button.background',
      'button.foreground',
    ],
  },
  {
    label: 'Terminal',
    keys: [
      'terminal.background',
      'terminal.foreground',
      'terminalCursor.foreground',
      'terminal.ansiBlack',
      'terminal.ansiRed',
      'terminal.ansiGreen',
      'terminal.ansiYellow',
      'terminal.ansiBlue',
      'terminal.ansiMagenta',
      'terminal.ansiCyan',
      'terminal.ansiWhite',
      'terminal.ansiBrightBlack',
      'terminal.ansiBrightRed',
      'terminal.ansiBrightGreen',
      'terminal.ansiBrightYellow',
      'terminal.ansiBrightBlue',
      'terminal.ansiBrightMagenta',
      'terminal.ansiBrightCyan',
      'terminal.ansiBrightWhite',
    ],
  },
  {
    label: 'Diagnóstico y control de cambios',
    keys: [
      'editorError.foreground',
      'editorWarning.foreground',
      'editorInfo.foreground',
      'problemsErrorIcon.foreground',
      'problemsWarningIcon.foreground',
      'gitDecoration.addedResourceForeground',
      'gitDecoration.modifiedResourceForeground',
      'gitDecoration.deletedResourceForeground',
      'gitDecoration.ignoredResourceForeground',
      'diffEditor.insertedTextBackground',
      'diffEditor.removedTextBackground',
      'diffEditor.insertedTextBorder',
      'diffEditor.removedTextBorder',
    ],
  },
] as const;

export const colorKeys: ReadonlySet<string> = new Set(colorGroups.flatMap(({ keys }) => [...keys]));

export const preferenceValues = {
  theme: new Set(themes.map(({ label }) => label)),
  fileIcons: new Set([...iconStyles.map(({ id }) => id), 'vs-seti', 'none']),
  productIcons: new Set([productIcon, 'Default']),
  renderWhitespace: new Set(['none', 'boundary', 'selection', 'trailing', 'all']),
  wordWrap: new Set(['off', 'on', 'wordWrapColumn', 'bounded']),
} as const;

export interface Preferences {
  theme?: string;
  fileIcons?: string;
  productIcons?: string;
  formatOnSave?: boolean;
  insertSpaces?: boolean;
  detectIndentation?: boolean;
  tabSize?: number;
  renderWhitespace?: string;
  indentationGuides?: boolean;
  fontSize?: number;
  lineHeight?: number;
  wordWrap?: string;
  semanticHighlighting?: boolean;
}

export interface Profile {
  version: 1;
  name: string;
  rules: TokenRule[];
  preferences: Preferences;
  workbench: Record<string, string>;
}

export interface StoredProfile {
  id: string;
  revision: number;
  profile: Profile;
}

export const preferenceSettings = {
  theme: 'workbench.colorTheme',
  fileIcons: 'workbench.iconTheme',
  productIcons: 'workbench.productIconTheme',
  formatOnSave: 'editor.formatOnSave',
  insertSpaces: 'editor.insertSpaces',
  detectIndentation: 'editor.detectIndentation',
  tabSize: 'editor.tabSize',
  renderWhitespace: 'editor.renderWhitespace',
  indentationGuides: 'editor.guides.indentation',
  fontSize: 'editor.fontSize',
  lineHeight: 'editor.lineHeight',
  wordWrap: 'editor.wordWrap',
  semanticHighlighting: 'editor.semanticHighlighting.enabled',
} satisfies Record<keyof Preferences, string>;

const tokenIds: ReadonlySet<string> = new Set(tokens.map(({ id }) => id));
const languageIds: ReadonlySet<string> = new Set(languages.map(({ id }) => id));
const styles = ['normal', 'bold', 'italic', 'underline'] as const;
const mechanisms = ['auto', 'semantic', 'textmate'] as const;
const badName = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u;

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function isMember<const T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.some((choice) => choice === value);
}

export function validName(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > 64 ||
    badName.test(value)
  ) {
    throw new Error('El nombre del perfil debe tener entre 1 y 64 caracteres visibles.');
  }
  return value.trim().normalize('NFC');
}

function readRule(value: unknown): TokenRule {
  if (
    !exactKeys(value, ['token', 'language', 'foreground', 'style', 'mechanism']) ||
    typeof value.token !== 'string' ||
    !tokenIds.has(value.token)
  ) {
    throw new Error('El perfil contiene un token desconocido.');
  }
  const result: TokenRule = { token: value.token };
  if (value.language !== undefined) {
    if (typeof value.language !== 'string' || !languageIds.has(value.language))
      throw new Error('El perfil contiene un lenguaje desconocido.');
    result.language = value.language;
  }
  if (value.foreground !== undefined) {
    const color = typeof value.foreground === 'string' ? parseColor(value.foreground) : undefined;
    if (!color) throw new Error('Usa un color HEX, RGB o HSL opaco.');
    result.foreground = color;
  }
  if (value.style !== undefined) {
    if (!isMember(value.style, styles))
      throw new Error('El perfil contiene un estilo de texto desconocido.');
    result.style = value.style;
  }
  if (value.mechanism !== undefined) {
    if (!isMember(value.mechanism, mechanisms))
      throw new Error('El perfil contiene un mecanismo de resaltado desconocido.');
    result.mechanism = value.mechanism;
  }
  if (!result.foreground && !result.style)
    throw new Error('Cada regla debe indicar un color o un estilo.');
  return result;
}

function readPreferences(input: unknown): Preferences {
  if (!exactKeys(input, Object.keys(preferenceSettings)))
    throw new Error('El perfil contiene un ajuste desconocido.');
  const output: Record<string, boolean | string | number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (Object.hasOwn(preferenceValues, key)) {
      const allowed: ReadonlySet<string> = preferenceValues[key as keyof typeof preferenceValues];
      if (typeof value !== 'string' || !allowed.has(value))
        throw new Error(`Valor no disponible para ${key}.`);
    } else if (key === 'tabSize' || key === 'fontSize' || key === 'lineHeight') {
      const [min, max] = key === 'tabSize' ? [1, 32] : key === 'fontSize' ? [8, 80] : [0, 150];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Introduce un entero entre ${min} y ${max} para ${key}.`);
      }
    } else if (typeof value !== 'boolean') throw new Error(`Activa o desactiva ${key}.`);
    if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
      output[key] = value;
  }
  return output;
}

export function ruleIdentity(rule: Pick<TokenRule, 'token' | 'language'>): string {
  return `${rule.language ?? '*'}:${rule.token}`;
}

export function validateProfile(input: unknown): Profile {
  if (
    !exactKeys(input, ['version', 'name', 'rules', 'preferences', 'workbench']) ||
    input.version !== 1
  ) {
    throw new Error('Este archivo requiere un perfil de SyntaxCraft Studio con versión 1.');
  }
  if (!Array.isArray(input.rules) || input.rules.length > tokenIds.size * (languageIds.size + 1))
    throw new Error('La lista de reglas del perfil no es válida.');
  if (!isRecord(input.workbench) || Object.keys(input.workbench).length > colorKeys.size)
    throw new Error('Los colores de la interfaz no son válidos.');
  const rules = input.rules.map(readRule);
  if (new Set(rules.map(ruleIdentity)).size !== rules.length)
    throw new Error('Hay reglas duplicadas para el mismo token y lenguaje.');
  const workbench: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.workbench)) {
    const color = typeof value === 'string' ? parseColor(value) : undefined;
    if (!colorKeys.has(key) || !color) throw new Error(`Color no admitido para ${key}.`);
    workbench[key] = color;
  }
  return {
    version: 1,
    name: validName(input.name),
    rules,
    preferences: readPreferences(input.preferences),
    workbench,
  };
}

export function decodeProfile(bytes: Uint8Array): Profile {
  if (bytes.byteLength > maxProfileBytes) throw new Error('El perfil supera el límite de 1 MiB.');
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('El archivo debe contener JSON válido en UTF-8.');
  }
  return validateProfile(json);
}

export function emptyProfile(name = 'Custom'): Profile {
  return { version: 1, name, rules: [], preferences: {}, workbench: {} };
}

const presets: readonly [string, Preferences, readonly TokenRule[]][] = [
  [
    'Web Development',
    {
      theme: 'SyntaxCraft Midnight Pro',
      fileIcons: 'syntaxcraft-modern',
      tabSize: 2,
      insertSpaces: true,
    },
    [],
  ],
  [
    'Python Development',
    {
      theme: 'SyntaxCraft Forest Developer',
      fileIcons: 'syntaxcraft-colorful',
      tabSize: 4,
      insertSpaces: true,
    },
    [],
  ],
  [
    'PHP Development',
    {
      theme: 'SyntaxCraft Crimson Dark',
      fileIcons: 'syntaxcraft-modern',
      tabSize: 4,
      insertSpaces: true,
    },
    [],
  ],
  [
    'Systems Programming',
    { theme: 'SyntaxCraft OLED Black', fileIcons: 'syntaxcraft-neon', indentationGuides: true },
    [],
  ],
  [
    'Data Science',
    { theme: 'SyntaxCraft Arctic Light', fileIcons: 'syntaxcraft-colorful', wordWrap: 'on' },
    [],
  ],
  [
    'Minimal Workspace',
    {
      theme: 'SyntaxCraft Monochrome',
      fileIcons: 'syntaxcraft-minimal',
      renderWhitespace: 'trailing',
    },
    [],
  ],
  ['Custom', {}, []],
];

export const builtInProfiles: readonly Profile[] = presets.map(([name, preferences, rules]) => ({
  version: 1,
  name,
  preferences,
  rules: [...rules],
  workbench: {},
}));
