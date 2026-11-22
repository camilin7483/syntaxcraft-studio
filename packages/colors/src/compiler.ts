import { languageDefinitions, type LanguageDefinition } from './languages';
import { standardSemanticScopes, textMateScopes, tokens, type TokenId } from './tokens';

export type TokenStyle = 'normal' | 'bold' | 'italic' | 'underline';
export type RuleMechanism = 'semantic' | 'textmate';

export interface TokenRule {
  token: string;
  language?: string;
  foreground?: string;
  style?: TokenStyle;
  mechanism?: 'auto' | RuleMechanism;
}

export interface TextMateRuleSettings {
  foreground?: string;
  fontStyle?: string;
}

export interface TextMateRule {
  name: string;
  scope: string | string[];
  settings: TextMateRuleSettings;
}

export interface SemanticRuleSettings {
  foreground?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface CompiledRules {
  textMateRules: TextMateRule[];
  semanticRules: Record<string, SemanticRuleSettings>;
}

type DiagnosticCode =
  | 'unknown-token'
  | 'unknown-language'
  | 'invalid-color'
  | 'invalid-style'
  | 'invalid-mechanism'
  | 'unsupported-mechanism'
  | 'empty-rule';

export interface RuleDiagnostic {
  readonly index: number;
  readonly code: DiagnosticCode;
}

interface NativeSelectors {
  readonly semantic: readonly string[];
  readonly textmate: readonly string[];
}

const tokenById = new Map<string, (typeof tokens)[number]>(
  tokens.map((token) => [token.id, token]),
);
const languageById = new Map(languageDefinitions.map((language) => [language.id, language]));
const styles = new Set<string>(['normal', 'bold', 'italic', 'underline']);
const mechanisms: readonly RuleMechanism[] = ['semantic', 'textmate'];
const emptySelectors: NativeSelectors = { semantic: [], textmate: [] };

function forLanguage(token: TokenId, language: LanguageDefinition): NativeSelectors {
  const semantic = language.semantic?.[token] ?? [];
  const textmate = language.textMate[token] ?? [];
  return {
    semantic: language.languageIds.flatMap((id) => semantic.map((selector) => `${selector}:${id}`)),
    textmate: language.grammarRoots.flatMap((root) =>
      textmate.map((selector) => `${root} ${selector}`),
    ),
  };
}

function portable(token: TokenId): NativeSelectors {
  const standard = standardSemanticScopes[token] ?? [];
  const lexical = textMateScopes[token];
  const semantic = new Set(standard);
  const textmate = new Set(lexical);

  // Provider-specific selectors stay qualified even in an all-languages rule.
  // The standard fallback is unqualified and can also serve other providers.
  for (const language of languageDefinitions) {
    const providerScopes = (language.semantic?.[token] ?? []).filter(
      (scope) => !standard.includes(scope),
    );
    const grammarScopes = (language.textMate[token] ?? []).filter(
      (scope) => !lexical.includes(scope),
    );
    for (const id of language.languageIds) {
      for (const scope of providerScopes) semantic.add(`${scope}:${id}`);
    }
    for (const root of language.grammarRoots) {
      for (const scope of grammarScopes) textmate.add(`${root} ${scope}`);
    }
  }
  return { semantic: [...semantic], textmate: [...textmate] };
}

const globalSelectors = new Map(tokens.map(({ id }) => [id, portable(id)]));

function selectors(token: string, language?: string): NativeSelectors {
  const tokenId = tokenById.get(token)?.id;
  if (!tokenId) return emptySelectors;
  if (language === undefined) return globalSelectors.get(tokenId) ?? emptySelectors;
  const definition = languageById.get(language);
  return definition ? forLanguage(tokenId, definition) : emptySelectors;
}

export function ruleMechanisms(token: string, language?: string): readonly RuleMechanism[] {
  const native = selectors(token, language);
  return mechanisms.filter((mechanism) => native[mechanism].length > 0);
}

/** Native token foregrounds use opaque, hexadecimal RGB. */
export function canonicalizeColor(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const color = input.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(color)) return color;
  if (/^#[0-9A-F]{3}$/.test(color)) {
    return '#' + [...color.slice(1)].map((digit) => digit + digit).join('');
  }
  return undefined;
}

function isMechanism(mechanism: unknown): mechanism is TokenRule['mechanism'] {
  return (
    mechanism === undefined ||
    mechanism === 'auto' ||
    mechanism === 'semantic' ||
    mechanism === 'textmate'
  );
}

export function ruleDiagnostics(rules: readonly TokenRule[]): RuleDiagnostic[] {
  const diagnostics: RuleDiagnostic[] = [];
  rules.forEach((rule, index) => {
    if (!tokenById.has(rule.token)) diagnostics.push({ index, code: 'unknown-token' });
    if (rule.language !== undefined && !languageById.has(rule.language))
      diagnostics.push({ index, code: 'unknown-language' });
    if (rule.foreground !== undefined && !canonicalizeColor(rule.foreground))
      diagnostics.push({ index, code: 'invalid-color' });
    if (rule.style !== undefined && !styles.has(rule.style))
      diagnostics.push({ index, code: 'invalid-style' });
    if (!isMechanism(rule.mechanism)) diagnostics.push({ index, code: 'invalid-mechanism' });
    if (rule.foreground === undefined && rule.style === undefined)
      diagnostics.push({ index, code: 'empty-rule' });
    if (
      tokenById.has(rule.token) &&
      (rule.language === undefined || languageById.has(rule.language))
    ) {
      const supported = ruleMechanisms(rule.token, rule.language);
      if (
        supported.length === 0 ||
        (rule.mechanism &&
          rule.mechanism !== 'auto' &&
          isMechanism(rule.mechanism) &&
          !supported.includes(rule.mechanism))
      ) {
        diagnostics.push({ index, code: 'unsupported-mechanism' });
      }
    }
  });
  return diagnostics;
}

/** Global rules are composed first, followed by language rules in caller order. */
export function compileRules(rules: readonly TokenRule[]): CompiledRules {
  const textMateRules: TextMateRule[] = [];
  const semantic = new Map<string, SemanticRuleSettings>();
  const globalTextMate = new Map<string, TextMateRuleSettings>();
  const orderedRules = [
    ...rules.filter((rule) => rule.language === undefined),
    ...rules.filter((rule) => rule.language !== undefined),
  ];

  for (const rule of orderedRules) {
    const token = tokenById.get(rule.token);
    if (!token || !isMechanism(rule.mechanism)) continue;
    const language = rule.language === undefined ? undefined : languageById.get(rule.language);
    if (rule.language !== undefined && !language) continue;
    const foreground = canonicalizeColor(rule.foreground);
    const style = rule.style && styles.has(rule.style) ? rule.style : undefined;
    if (!foreground && !style) continue;

    const native = selectors(token.id, rule.language);
    const color = foreground ? { foreground } : {};

    if (rule.mechanism !== 'textmate' && native.semantic.length) {
      const settings: SemanticRuleSettings = {
        ...color,
        ...(style
          ? {
              bold: style === 'bold',
              italic: style === 'italic',
              underline: style === 'underline',
              strikethrough: false,
            }
          : {}),
      };
      for (const scope of native.semantic) {
        const merged = { ...semantic.get(scope), ...settings };
        // Preserve last-write precedence for equal-specificity native selectors.
        semantic.delete(scope);
        semantic.set(scope, merged);
      }
    }

    if (rule.mechanism !== 'semantic' && native.textmate.length) {
      const settings: TextMateRuleSettings = {
        ...globalTextMate.get(token.id),
        ...color,
        ...(style ? { fontStyle: style === 'normal' ? '' : style } : {}),
      };
      if (!language) globalTextMate.set(token.id, settings);
      textMateRules.push({
        name: `SyntaxCraft: ${token.label} (${language?.label ?? 'All languages'})`,
        scope: [...native.textmate],
        settings,
      });
    }
  }

  return { textMateRules, semanticRules: Object.fromEntries(semantic) };
}
