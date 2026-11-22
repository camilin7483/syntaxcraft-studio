import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalizeColor,
  compileRules,
  languages,
  ruleDiagnostics,
  ruleMechanisms,
  themes,
  tokens,
} from '../src';

test('the theme and language catalogs expose stable IDs and usable bindings', () => {
  assert.equal(themes.length, 10);
  assert.equal(new Set(themes.map((theme) => theme.label)).size, 10);
  assert.ok(languages.length >= 45);
  assert.equal(new Set(languages.map((language) => language.id)).size, languages.length);
  assert.equal(new Set(tokens.map((token) => token.id)).size, tokens.length);
  for (const { id } of tokens) assert.ok(ruleMechanisms(id).length);
  for (const language of languages) {
    assert.ok(language.grammarRoots.length > 0 && language.source.startsWith('https://'));
    assert.ok(tokens.some(({ id }) => ruleMechanisms(id, language.id).includes('textmate')));
  }
  assert.equal(themes.find((theme) => theme.id === 'oled-black')?.background, '#000000');
  assert.equal(themes.find((theme) => theme.id === 'high-contrast-pro')?.variant, 'high-contrast');
});

test('composes defaults first with native selectors and explicit normal styling', () => {
  const language = { token: 'comment', language: 'python', style: 'normal' } as const;
  const global = { token: 'comment', foreground: '#a2c', style: 'italic' } as const;
  const expected = compileRules([global, language]);
  assert.deepEqual(compileRules([language, global]), expected);
  assert.equal(expected.semanticRules.comment?.foreground, '#AA22CC');
  assert.equal(expected.semanticRules.comment?.italic, true);
  assert.deepEqual(expected.textMateRules[0]?.settings, {
    foreground: '#AA22CC',
    fontStyle: 'italic',
  });
  assert.deepEqual(expected.textMateRules[1], {
    name: 'SyntaxCraft: Comments (Python)',
    scope: ['source.python comment'],
    settings: { foreground: '#AA22CC', fontStyle: '' },
  });
  assert.equal(expected.semanticRules['comment:python'], undefined);
});

test('keeps methods, function declarations, and lexical calls distinct', () => {
  const output = compileRules([
    { token: 'method', language: 'typescript', foreground: '#AABBCC', style: 'bold' },
    {
      token: 'function-declaration',
      language: 'typescript',
      foreground: '#CCDDEE',
      style: 'normal',
    },
    { token: 'function-call', language: 'typescript', foreground: '#334456', style: 'underline' },
  ]);
  assert.deepEqual(Object.keys(output.semanticRules), [
    'method:typescript',
    'function.declaration:typescript',
  ]);
  assert.deepEqual(output.semanticRules['method:typescript'], {
    foreground: '#AABBCC',
    bold: true,
    italic: false,
    underline: false,
    strikethrough: false,
  });
  assert.deepEqual(output.semanticRules['function.declaration:typescript'], {
    foreground: '#CCDDEE',
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });
  assert.ok(
    output.textMateRules[0]?.scope.includes(
      'source.ts meta.definition.method entity.name.function',
    ),
  );
  assert.ok(
    output.textMateRules[1]?.scope.includes(
      'source.ts meta.definition.function entity.name.function',
    ),
  );
  assert.ok(
    output.textMateRules[2]?.scope.includes('source.ts meta.function-call entity.name.function'),
  );
  assert.equal(output.textMateRules[2]?.settings.fontStyle, 'underline');
});

test('merges multiple semantic assignments to the same selector without inventing unrelated styles', () => {
  const actual = compileRules([
    { token: 'variable-local', language: 'javascript', foreground: '#abc', mechanism: 'semantic' },
    { token: 'variable-local', language: 'javascript', style: 'italic', mechanism: 'semantic' },
  ]);
  assert.deepEqual(actual, {
    textMateRules: [],
    semanticRules: {
      'variable.local:javascript': {
        foreground: '#AABBCC',
        bold: false,
        italic: true,
        underline: false,
        strikethrough: false,
      },
    },
  });
});

test('uses actual file modes and scopes for framework template overrides', () => {
  const output = compileRules([
    { token: 'class', language: 'react', foreground: '#9966EE', mechanism: 'semantic' },
    { token: 'keyword', language: 'angular', style: 'bold' },
    { token: 'html-attribute', language: 'blade', style: 'italic' },
  ]);
  assert.deepEqual(Object.keys(output.semanticRules), [
    'class:javascriptreact',
    'class:typescriptreact',
  ]);
  assert.ok(output.textMateRules[0]?.scope.includes('expression.ng keyword'));
  assert.ok(
    output.textMateRules[1]?.scope.includes(
      'text.html.php.blade meta.tag entity.other.attribute-name',
    ),
  );
  assert.ok(output.textMateRules[0]?.scope.includes('control.block.ng keyword'));
  assert.equal(output.semanticRules['class:react'], undefined);
});

test('keeps unsupported and invalid categories from emitting broad fallback selectors', () => {
  assert.deepEqual(ruleMechanisms('html-tag', 'html'), ['textmate']);
  assert.deepEqual(ruleMechanisms('comment', 'python'), ['textmate']);
  assert.deepEqual(ruleMechanisms('null', 'json'), []);
  assert.deepEqual(ruleMechanisms('function-call', 'typescript'), ['textmate']);
  assert.deepEqual(ruleMechanisms('variable-instance', 'ruby'), ['textmate']);
  const rules = [
    { token: 'variable-instance', language: 'python', foreground: '#FF0000' },
    { token: 'typo', foreground: '#00FF00' },
    { token: 'comment', language: 'plain-example', foreground: '#0000FF' },
    { token: 'number', foreground: 'red' },
    { token: 'number' },
  ];
  assert.deepEqual(compileRules(rules), { textMateRules: [], semanticRules: {} });
  assert.deepEqual(ruleDiagnostics(rules), [
    { index: 0, code: 'unsupported-mechanism' },
    { index: 1, code: 'unknown-token' },
    { index: 2, code: 'unknown-language' },
    { index: 3, code: 'invalid-color' },
    { index: 4, code: 'empty-rule' },
  ]);
  assert.equal(canonicalizeColor(' #a2c '), '#AA22CC');
  assert.equal(canonicalizeColor('#FF112233'), undefined);
});
