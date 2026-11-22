export function tokenColors(palette) {
  const emphatic = ['monochrome', 'high-contrast-pro'].includes(palette.id);
  const definitions = [
    ['Comments', ['comment'], 'muted', 'italic'],
    ['Quoted text', ['string', 'markup.inline.raw'], 'strings'],
    [
      'Escapes and interpolations',
      ['constant.character.escape', 'punctuation.definition.template-expression'],
      'members',
    ],
    ['Numbers', ['constant.numeric'], 'numbers'],
    ['Boolean and null literals', ['constant.language', 'constant.other.null'], 'numbers'],
    [
      'Keywords',
      ['keyword', 'storage.type', 'storage.modifier'],
      'keywords',
      emphatic ? 'bold' : undefined,
    ],
    ['Operators', ['keyword.operator'], 'foreground', ''],
    [
      'Imports and exports',
      [
        'keyword.control.import',
        'keyword.control.export',
        'keyword.other.import',
        'keyword.control.from',
        'keyword.control.require',
        'keyword.other.use',
      ],
      'keywords',
    ],
    ['Variables', ['variable', 'support.variable'], 'variables'],
    [
      'Read-only names and constants',
      ['variable.other.constant', 'constant.other.symbol', 'support.constant'],
      'members',
    ],
    [
      'Parameters and named arguments',
      ['variable.parameter', 'variable.other.parameter', 'variable.argument'],
      'members',
    ],
    [
      'Properties',
      [
        'variable.other.property',
        'variable.object.property',
        'support.variable.property',
        'support.type.property-name',
        'support.type.property-name.json',
        'meta.object-literal.key',
      ],
      'members',
    ],
    [
      'Function declarations and calls',
      [
        'meta.definition.function entity.name.function',
        'meta.definition.variable entity.name.function',
        'meta.function entity.name.function',
        'meta.function-call entity.name.function',
        'meta.function-call support.function',
        'meta.function-call variable.function',
        'meta.function.definition.rust entity.name.function.rust',
        'meta.function.call.rust entity.name.function.rust',
        'meta.function-call.generic.python',
        'entity.name.function.support.go',
        'entity.name.function.definition',
        'entity.name.function.call',
      ],
      'functions',
      emphatic ? 'bold' : undefined,
    ],
    [
      'Methods',
      [
        'meta.definition.method entity.name.function',
        'meta.method.declaration entity.name.function',
        'meta.method.identifier.java entity.name.function.java',
        'meta.method-call.java entity.name.function.java',
        'meta.function.method.with-arguments.ruby entity.name.function.ruby',
        'meta.function.method.without-arguments.ruby entity.name.function.ruby',
        'entity.name.function.member',
        'entity.name.function.method',
        'support.function.method',
      ],
      'methods',
    ],
    [
      'Types, interfaces and classes',
      [
        'entity.name.type',
        'entity.name.class',
        'entity.name.struct',
        'support.type',
        'support.class',
        'storage.type.primitive',
        'entity.name.type.parameter',
      ],
      'types',
    ],
    ['Namespaces', ['entity.name.namespace', 'entity.name.module', 'entity.name.package'], 'types'],
    [
      'Decorators and annotations',
      [
        'entity.name.function.decorator',
        'meta.decorator entity.name.function',
        'storage.type.annotation',
        'storage.type.annotation entity.name.type',
        'punctuation.decorator',
      ],
      'tags',
    ],
    ['Regular expressions', ['string.regexp', 'string.regex'], 'regex'],
    ['Tag names', ['entity.name.tag'], 'tags', emphatic ? 'bold' : undefined],
    ['Tag punctuation', ['punctuation.definition.tag'], 'muted'],
    [
      'Attributes',
      [
        'meta.tag entity.other.attribute-name',
        'entity.other.attribute-name.html',
        'entity.other.attribute-name.xml',
      ],
      'members',
    ],
    [
      'Style selectors',
      [
        'entity.other.attribute-name.class',
        'entity.other.attribute-name.id',
        'entity.other.attribute-name.pseudo-class',
        'entity.other.attribute-name.pseudo-element',
        'entity.name.tag.css',
        'entity.name.tag.scss',
        'entity.name.tag.less',
      ],
      'styles',
    ],
    [
      'Style values',
      [
        'support.constant.property-value',
        'constant.other.color',
        'support.constant.font-name',
        'support.constant.color',
        'constant.numeric.suffix',
      ],
      'strings',
    ],
    ['Markdown headings', ['markup.heading'], 'types', 'bold'],
    ['Markdown emphasis', ['markup.bold'], 'foreground', 'bold'],
    ['Markdown emphasis', ['markup.italic'], 'foreground', 'italic'],
    ['Markdown deleted text', ['markup.strikethrough'], 'muted', 'strikethrough'],
    ['Links', ['markup.underline.link'], 'accent', 'underline'],
    ['Invalid syntax', ['invalid'], 'error', 'underline'],
  ];
  return definitions.map(([name, scope, role, fontStyle]) => ({
    name,
    scope,
    settings: { foreground: palette[role], ...(fontStyle === undefined ? {} : { fontStyle }) },
  }));
}

export function semanticTokenColors(palette) {
  const emphatic = ['monochrome', 'high-contrast-pro'].includes(palette.id);
  return {
    namespace: palette.types,
    type: palette.types,
    class: palette.types,
    enum: palette.types,
    interface: palette.types,
    struct: palette.types,
    typeParameter: palette.types,
    parameter: palette.members,
    property: palette.members,
    enumMember: palette.members,
    'variable.readonly': palette.members,
    'function.declaration': emphatic
      ? { foreground: palette.functions, bold: true }
      : palette.functions,
    method: palette.methods,
    macro: palette.functions,
    decorator: palette.tags,
    // Call sites keep their grammar's TextMate style when the provider only
    // emits the broad function type.
  };
}
