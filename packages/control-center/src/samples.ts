export type Fragment = readonly [token: string, text: string];
export interface Sample {
  language: string;
  name: string;
  lines: readonly (readonly Fragment[])[];
}

const text = (value: string): Fragment => ['', value];
const keyword = (value: string): Fragment => ['keyword', value];
const call = (value: string): Fragment => ['function-call', value];
const fn = (value: string): Fragment => ['function-declaration', value];
const type = (value: string): Fragment => ['type', value];
const str = (value: string): Fragment => ['string', value];
const comment = (value: string): Fragment => ['comment', value];
const tag = (value: string): Fragment => ['html-tag', value];
const attr = (value: string): Fragment => ['html-attribute', value];
const key = (value: string): Fragment => ['property', value];
const param = (value: string): Fragment => ['parameter', value];
const local = (value: string): Fragment => ['variable-local', value];
const lit = (value: string): Fragment => ['number', value];
const operator = (value: string): Fragment => ['operator', value];

const typescript: Sample = {
  language: 'typescript',
  name: 'palette.ts',
  lines: [
    [comment('// Build an accessible palette')],
    [keyword('interface '), ['interface', 'Swatch'], text(' {')],
    [text('  '), key('name'), text(': '), type('string'), text(';')],
    [text('  '), key('hex'), text(': '), type('string'), text(';')],
    [text('}')],
    [],
    [
      keyword('export function '),
      fn('createSwatch'),
      text('('),
      param('name'),
      text(': '),
      type('string'),
      text('): '),
      type('Swatch'),
      text(' {'),
    ],
    [
      text('  '),
      keyword('const '),
      ['constant', 'hex'],
      text(' '),
      operator('='),
      text(' '),
      call('toHex'),
      text('('),
      param('name'),
      text(');'),
    ],
    [text('  '), keyword('return '), text('{ '), key('name'), text(', '), key('hex'), text(' };')],
    [text('}')],
    [],
    [
      keyword('const '),
      ['constant', 'primary'],
      text(' = '),
      call('createSwatch'),
      text('('),
      str("'soft violet'"),
      text(');'),
    ],
  ],
};

const samples: readonly Sample[] = [
  typescript,
  {
    language: 'javascript',
    name: 'swatch.js',
    lines: [
      [comment('// Load the workspace palette')],
      [
        ['import-export', 'import '],
        text('{ '),
        call('readPalette'),
        text(' } '),
        ['import-export', 'from '],
        str("'./colors.js'"),
        text(';'),
      ],
      [],
      [
        ['import-export', 'export '],
        ['async', 'async '],
        keyword('function '),
        fn('loadPalette'),
        text('('),
        param('name'),
        text(') {'),
      ],
      [text('  '), keyword('const '), ['constant', 'limit'], text(' = '), lit('12'), text(';')],
      [
        text('  '),
        keyword('return '),
        ['async', 'await '],
        call('readPalette'),
        text('('),
        param('name'),
        text(', '),
        local('limit'),
        text(');'),
      ],
      [text('}')],
    ],
  },
  {
    language: 'python',
    name: 'palette.py',
    lines: [
      [comment('# Define one accent per workspace')],
      [
        ['import-export', 'from '],
        ['namespace', 'dataclasses'],
        ['import-export', ' import '],
        ['decorator', 'dataclass'],
      ],
      [],
      [['decorator', '@dataclass']],
      [keyword('class '), ['class', 'Palette'], text(':')],
      [text('    '), key('accent'), text(': '), type('str')],
      [],
      [
        keyword('def '),
        fn('create_palette'),
        text('('),
        param('name'),
        text(': '),
        type('str'),
        text(') '),
        operator('->'),
        text(' '),
        type('Palette'),
        text(':'),
      ],
      [text('    '), local('accent'), text(' = '), str('"#AA9CF5"')],
      [text('    '), keyword('return '), call('Palette'), text('('), local('accent'), text(')')],
    ],
  },
  {
    language: 'php',
    name: 'Palette.php',
    lines: [
      [keyword('<?php')],
      [],
      [comment('// Create a reusable palette')],
      [keyword('final class '), ['class', 'Palette'], text(' {')],
      [
        text('    '),
        keyword('public function '),
        ['method', 'accent'],
        text('('),
        type('string '),
        param('$fallback'),
        text('): '),
        type('string'),
        text(' {'),
      ],
      [text('        '), local('$accent'), text(' = '), str("'#A98CF4'"), text(';')],
      [
        text('        '),
        keyword('return '),
        local('$accent'),
        text(' '),
        operator('?:'),
        text(' '),
        param('$fallback'),
        text(';'),
      ],
      [text('    }')],
      [text('}')],
    ],
  },
  {
    language: 'rust',
    name: 'palette.rs',
    lines: [
      [comment('// Return a readable fallback')],
      [
        keyword('pub fn '),
        fn('swatch'),
        text('('),
        param('name'),
        text(': &'),
        type('str'),
        text(') -> '),
        type('String'),
        text(' {'),
      ],
      [text('    '), keyword('let '), local('fallback'), text(' = '), str('"#A98CF4"'), text(';')],
      [text('    '), call('format!'), text('('), str('"{name}: {fallback}"'), text(')')],
      [text('}')],
    ],
  },
  {
    language: 'go',
    name: 'palette.go',
    lines: [
      [keyword('package '), ['namespace', 'palette']],
      [],
      [
        keyword('func '),
        fn('Accent'),
        text('('),
        param('name'),
        text(' '),
        type('string'),
        text(') '),
        type('string'),
        text(' {'),
      ],
      [
        text('    '),
        keyword('if '),
        param('name'),
        text(' '),
        operator('=='),
        text(' '),
        str('""'),
        text(' {'),
      ],
      [text('        '), keyword('return '), str('"#A98CF4"')],
      [text('    }')],
      [text('    '), keyword('return '), param('name')],
      [text('}')],
    ],
  },
  {
    language: 'html',
    name: 'palette.html',
    lines: [
      [comment('<!-- The display swatch -->')],
      [text('<'), tag('section'), text(' '), attr('class'), text('='), str('"palette"'), text('>')],
      [text('  <'), tag('h1'), text('>'), text('Color Studio'), text('</'), tag('h1'), text('>')],
      [
        text('  <'),
        tag('span'),
        text(' '),
        attr('aria-label'),
        text('='),
        str('"Violet"'),
        text('></'),
        tag('span'),
        text('>'),
      ],
      [text('</'), tag('section'), text('>')],
    ],
  },
  {
    language: 'xml',
    name: 'palette.xml',
    lines: [
      [text('<'), tag('palette'), text(' '), attr('name'), text('='), str('"Studio"'), text('>')],
      [
        text('  <'),
        tag('swatch'),
        text(' '),
        attr('value'),
        text('='),
        str('"#A98CF4"'),
        text(' />'),
      ],
      [text('</'), tag('palette'), text('>')],
    ],
  },
  {
    language: 'css',
    name: 'palette.css',
    lines: [
      [comment('/* Workspace palette */')],
      [['css-selector', '.palette:focus-visible'], text(' {')],
      [text('  '), key('color'), text(': '), ['css-value', '#A98CF4'], text(';')],
      [
        text('  '),
        key('outline'),
        text(': '),
        lit('2px'),
        text(' '),
        ['css-value', 'solid currentColor'],
        text(';'),
      ],
      [text('  '), key('outline-offset'), text(': '), lit('4px'), text(';')],
      [text('}')],
    ],
  },
  {
    language: 'json',
    name: 'palette.json',
    lines: [
      [text('{')],
      [text('  '), key('"name"'), text(': '), str('"Studio"'), text(',')],
      [text('  '), key('"accent"'), text(': '), str('"#A98CF4"'), text(',')],
      [text('  '), key('"enabled"'), text(': '), ['boolean', 'true'], text(',')],
      [text('  '), key('"limit"'), text(': '), lit('12'), text(',')],
      [text('  '), key('"fallback"'), text(': '), ['null', 'null']],
      [text('}')],
    ],
  },
  {
    language: 'sql',
    name: 'palettes.sql',
    lines: [
      [comment('-- Read the recent workspaces')],
      [keyword('SELECT '), key('name'), text(', '), key('accent')],
      [keyword('FROM '), type('palettes')],
      [keyword('WHERE '), key('active'), text(' '), operator('='), text(' '), ['boolean', 'TRUE']],
      [keyword('ORDER BY '), key('created_at'), keyword(' DESC')],
      [keyword('LIMIT '), lit('12'), text(';')],
    ],
  },
  {
    language: 'java',
    name: 'Palette.java',
    lines: [
      [comment('// A single active accent')],
      [
        keyword('public record '),
        ['class', 'Palette'],
        text('('),
        type('String '),
        param('name'),
        text(') {'),
      ],
      [text('  '), keyword('public '), type('String '), ['method', 'accent'], text('() {')],
      [text('    '), keyword('return '), str('"#A98CF4"'), text(';')],
      [text('  }')],
      [text('}')],
    ],
  },
];

const aliases: Record<string, string> = { jsonc: 'json', scss: 'css', sass: 'css', less: 'css' };

export function sampleFor(language?: string): Sample | undefined {
  if (!language) return typescript;
  return samples.find((sample) => sample.language === (aliases[language] ?? language));
}

export function sampleText(sample: Sample): string {
  return (
    sample.lines.map((line) => line.map(([, fragment]) => fragment).join('')).join('\n') + '\n'
  );
}
