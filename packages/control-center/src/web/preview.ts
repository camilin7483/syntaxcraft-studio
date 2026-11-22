import { themes, tokens } from '../../../colors/src';
import { parseColor } from '../color';
import type { Profile } from '../profile';
import type { StudioState } from '../protocol';
import { sampleFor } from '../samples';
import type { Sample } from '../samples';
import { el } from './dom';

const tokenGroup = new Map<string, string>(tokens.map((token) => [token.id, token.group]));

function cssColor(value: string | undefined, fallback: string): string {
  return parseColor(value ?? '') ?? fallback;
}

export function palette(profile: Profile, state: StudioState | undefined) {
  const theme = themes.find(
    ({ label }) => label === (profile.preferences.theme ?? state?.effective.theme),
  );
  const system = getComputedStyle(document.body);
  const themeBackground =
    theme?.background ?? cssColor(system.getPropertyValue('--vscode-editor-background'), '#151724');
  const themeForeground =
    theme?.foreground ?? cssColor(system.getPropertyValue('--vscode-editor-foreground'), '#E9E7F2');
  const applicableWorkbench =
    !profile.preferences.theme || profile.preferences.theme === state?.effective.theme
      ? state?.workbench
      : undefined;
  return {
    theme,
    background: cssColor(
      profile.workbench['editor.background'] ?? applicableWorkbench?.['editor.background'],
      themeBackground,
    ),
    foreground: cssColor(
      profile.workbench['editor.foreground'] ?? applicableWorkbench?.['editor.foreground'],
      themeForeground,
    ),
  };
}

export function tokenAppearance(
  profile: Profile,
  state: StudioState | undefined,
  token: string,
  language?: string,
) {
  const { theme, foreground } = palette(profile, state);
  const group = tokenGroup.get(token);
  let fallback = foreground;
  if (theme && group && Object.hasOwn(theme.palette, group))
    fallback = (theme.palette as Record<string, string>)[group] ?? foreground;
  if (theme && token === 'comment') fallback = theme.comment;
  if (theme && token === 'number') fallback = theme.number;
  if (theme && token === 'string') fallback = theme.string;
  const rule = language
    ? profile.rules.find((item) => item.token === token && item.language === language)
    : undefined;
  const shared = profile.rules.find((item) => item.token === token && item.language === undefined);
  return {
    foreground: rule?.foreground ?? shared?.foreground ?? fallback,
    style: rule?.style ?? shared?.style,
  };
}

function codeWindow(
  sample: Sample,
  profile: Profile,
  state: StudioState | undefined,
  language: string,
  label?: string,
) {
  const colors = new Map<string, ReturnType<typeof tokenAppearance>>();
  function color(token: string) {
    const existing = colors.get(token);
    if (existing) return existing;
    const choice = tokenAppearance(profile, state, token, language);
    colors.set(token, choice);
    return choice;
  }
  const lines = sample.lines.map((line, index) => {
    const number = el('span', 'line-number', index + 1);
    number.setAttribute('aria-hidden', 'true');
    const segments = line.map(([token, text]) => {
      const node = el('span', '', text);
      if (!token) return node;
      const appearance = color(token);
      node.style.setProperty('--segment', appearance.foreground);
      node.className = `segment ${appearance.style ?? ''}`;
      return node;
    });
    return el('span', 'code-line', number, el('span', 'line-content', ...segments));
  });
  const range = palette(profile, state);
  const pre = el('pre', 'code-body', el('code', '', ...lines));
  pre.tabIndex = 0;
  pre.setAttribute('aria-label', `Código de ejemplo en ${language}`);
  const result = el(
    'div',
    'code-window',
    el(
      'div',
      'code-tab',
      el('span', 'file-mark'),
      sample.name,
      label && el('span', 'code-caption', label),
    ),
    pre,
  );
  result.style.setProperty('--sample-background', range.background);
  result.style.setProperty('--sample-foreground', range.foreground);
  return result;
}

export function preview(
  draft: Profile,
  baseline: Profile,
  state: StudioState | undefined,
  language: string,
  compare: boolean,
) {
  const sample = sampleFor(language || undefined);
  if (!sample)
    return el(
      'div',
      'empty code-empty',
      'Este lenguaje usa su gramática real en VS Code. Selecciona otro para ver un ejemplo en el panel.',
    );
  const mode = language || sample.language;
  return compare
    ? el(
        'div',
        'code-comparison',
        codeWindow(sample, baseline, state, mode, 'Origen'),
        codeWindow(sample, draft, state, mode, 'Borrador'),
      )
    : codeWindow(sample, draft, state, mode);
}

export function swatch(color: string, kind = ''): HTMLElement {
  const node = el('span', `swatch ${kind}`);
  node.style.setProperty('--swatch', color);
  node.title = color;
  return node;
}
