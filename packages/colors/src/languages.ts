import { standardSemanticScopes, textMateScopes, type Selectors, type TokenId } from './tokens';

export interface Language {
  readonly id: string;
  readonly label: string;
  readonly languageIds: readonly string[];
  readonly grammarRoots: readonly string[];
  readonly coverage: 'bundled' | 'extension' | 'framework';
  readonly source: string;
  readonly provider?: string;
  readonly providerSource?: string;
  readonly note?: string;
}

export interface LanguageDefinition extends Language {
  readonly textMate: Readonly<Selectors>;
  readonly semantic?: Readonly<Selectors>;
}

function select(
  scopes: Readonly<Selectors>,
  ids: readonly TokenId[],
  overrides?: Selectors,
): Selectors {
  return {
    ...Object.fromEntries(ids.map((id) => [id, scopes[id]])),
    ...overrides,
  };
}

function lexical(ids: readonly TokenId[], overrides?: Selectors): Selectors {
  return select(textMateScopes, ids, overrides);
}

function semantic(ids: readonly TokenId[], overrides?: Selectors): Selectors {
  return select(standardSemanticScopes, ids, overrides);
}

const code = ['keyword', 'operator', 'number', 'string', 'comment'] as const;
const text = ['string', 'comment'] as const;
const markup = lexical([...text, 'html-tag', 'html-attribute']);
const stylesheet = lexical([...code, 'property', 'css-selector', 'css-value', 'import-export'], {
  property: ['support.type.property-name', 'variable.css'],
  'import-export': ['keyword.control.at-rule.import'],
});
const scripting = lexical(
  [
    ...code,
    'constant',
    'function-declaration',
    'function-call',
    'method',
    'class',
    'interface',
    'type',
    'generic',
    'namespace',
    'object',
    'property',
    'parameter',
    'async',
    'decorator',
    'import-export',
    'regex',
    'boolean',
    'null',
  ],
  {
    'function-declaration': [
      'meta.definition.function entity.name.function',
      'meta.definition.variable entity.name.function',
    ],
    'function-call': [
      'meta.function-call entity.name.function',
      'meta.function-call support.function',
    ],
    method: [
      'meta.definition.method entity.name.function',
      'meta.method.declaration entity.name.function',
    ],
    generic: ['meta.type.parameters entity.name.type', 'entity.name.type.parameter'],
    namespace: ['meta.namespace.declaration entity.name.type.module'],
    object: ['variable.other.object.js', 'variable.other.object.ts', 'variable.other.object.tsx'],
    async: ['storage.modifier.async'],
  },
);
const jsx = { ...scripting, ...lexical(['html-tag', 'html-attribute']) };
const tsLegend = semantic(
  [
    'constant',
    'method',
    'class',
    'interface',
    'type',
    'generic',
    'namespace',
    'property',
    'parameter',
  ],
  {
    'variable-local': ['variable.local'],
    'function-declaration': ['function.declaration'],
    async: ['function.async', 'method.async'],
    type: ['type', 'enum'],
  },
);
const tsProvider = {
  provider: 'VS Code TypeScript and JavaScript Language Features',
  providerSource:
    'https://github.com/microsoft/vscode/blob/main/extensions/typescript-language-features/src/languageFeatures/semanticTokens.ts',
  semantic: tsLegend,
};
const tsNote =
  'The built-in provider marks local, declaration, and async symbols. Call syntax comes from the grammar.';
const clangdProvider = {
  provider: 'clangd (llvm-vs-code-extensions.vscode-clangd)',
  providerSource: 'https://clangd.llvm.org/features#semantic-highlighting',
};
const clangd = semantic(['constant', 'function-declaration', 'parameter', 'operator'], {
  'variable-local': ['variable.functionScope'],
  'variable-global': ['variable.globalScope', 'variable.fileScope'],
  'variable-instance': ['property.classScope'],
  property: ['property', 'variable.classScope.static'],
  type: ['type', 'enum'],
});
const clangdCpp = {
  ...clangd,
  ...semantic(['class', 'namespace', 'generic'], {
    method: ['method', 'function.static.classScope'],
  }),
};
const vscode = 'https://github.com/microsoft/vscode/tree/main/extensions/';

function bundled(
  id: string,
  label: string,
  grammarRoots: readonly string[],
  grammarDirectory: string,
  textMate: Selectors,
  extra?: Pick<LanguageDefinition, 'provider' | 'providerSource' | 'semantic' | 'note'>,
): LanguageDefinition {
  return {
    id,
    label,
    languageIds: [id],
    grammarRoots,
    coverage: 'bundled',
    source: vscode + grammarDirectory,
    textMate,
    ...extra,
  };
}

function extension(
  id: string,
  label: string,
  root: string,
  source: string,
  provider: string,
  textMate: Selectors,
  note?: string,
): LanguageDefinition {
  return {
    id,
    label,
    languageIds: [id],
    grammarRoots: [root],
    coverage: 'extension',
    source,
    provider,
    textMate,
    note,
  };
}

export const languageDefinitions: readonly LanguageDefinition[] = [
  bundled(
    'python',
    'Python',
    ['source.python'],
    'python',
    lexical([...code, 'class', 'decorator', 'regex', 'type', 'import-export'], {
      'function-declaration': ['meta.function.python entity.name.function.python'],
      'function-call': [
        'meta.function-call.generic.python',
        'meta.function-call.python support.function',
      ],
      parameter: ['variable.parameter.function.language.python', 'variable.parameter.class.python'],
      argument: ['variable.parameter.function-call.python'],
      async: ['storage.type.function.async.python'],
    }),
    {
      provider: 'Pylance (ms-python.vscode-pylance)',
      providerSource: 'https://github.com/microsoft/pylance-release#semantic-highlighting',
      semantic: semantic(['constant', 'class', 'property'], {
        'function-declaration': ['function.declaration'],
        method: ['method', 'magicFunction'],
        parameter: ['parameter', 'selfParameter', 'clsParameter'],
        namespace: ['module'],
        type: ['enum'],
        annotation: ['*.typeHint', '*.typeHintComment'],
        async: ['function.async', 'method.async', 'magicFunction.async'],
        decorator: ['*.decorator'],
      }),
      note: 'Python’s bundled grammar gives True, False, and None the same scope. Pylance adds symbol and annotation distinctions.',
    },
  ),
  bundled('javascript', 'JavaScript', ['source.js'], 'javascript', scripting, {
    ...tsProvider,
    note: tsNote,
  }),
  bundled('typescript', 'TypeScript', ['source.ts'], 'typescript-basics', scripting, {
    ...tsProvider,
    note: tsNote,
  }),
  bundled('javascriptreact', 'JavaScript React (JSX)', ['source.js.jsx'], 'javascript', jsx, {
    ...tsProvider,
    note: tsNote,
  }),
  bundled('typescriptreact', 'TypeScript React (TSX)', ['source.tsx'], 'typescript-basics', jsx, {
    ...tsProvider,
    note: tsNote,
  }),
  bundled(
    'php',
    'PHP',
    ['source.php', 'text.html.php'],
    'php',
    lexical(
      [
        ...code,
        'class',
        'interface',
        'type',
        'namespace',
        'annotation',
        'import-export',
        'html-tag',
        'html-attribute',
      ],
      {
        'function-declaration': ['meta.function.php entity.name.function.php'],
        'function-call': [
          'meta.function-call.php entity.name.function.php',
          'meta.function-call.php support.function',
        ],
        annotation: ['meta.attribute.php entity.name.type', 'meta.attribute.php support.class'],
        parameter: ['meta.function.parameters.php variable.other.php'],
        property: ['variable.other.property.php'],
        'import-export': ['keyword.other.use.php', 'keyword.control.import.include.php'],
      },
    ),
    {
      note: 'The bundled grammar marks PHP and embedded HTML. PHP language extensions may supply different semantic types.',
    },
  ),
  bundled(
    'java',
    'Java',
    ['source.java'],
    'java',
    lexical([...code, 'class', 'type', 'parameter', 'annotation', 'property', 'import-export'], {
      'variable-local': ['meta.definition.variable.local.java variable.other.definition.java'],
      method: [
        'meta.method.identifier.java entity.name.function.java',
        'meta.method-call.java entity.name.function.java',
      ],
      namespace: ['meta.package.java storage.modifier.package.java'],
      object: ['variable.other.object.java'],
      'import-export': ['keyword.other.import.java', 'keyword.other.package.java'],
    }),
    {
      provider: 'Language Support for Java by Red Hat (redhat.java, Eclipse JDT LS)',
      providerSource:
        'https://github.com/eclipse-jdtls/eclipse.jdt.ls/tree/master/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/semantictokens',
      semantic: semantic(['method', 'class', 'interface', 'parameter', 'namespace', 'keyword'], {
        'variable-local': ['variable'],
        constant: ['variable.readonly', 'property.readonly.static', 'enumMember'],
        type: ['type', 'enum', 'record'],
        generic: ['typeParameter', '*.typeArgument'],
        property: ['property', 'recordComponent'],
        annotation: ['decorator', 'annotationMember'],
        'import-export': ['*.importDeclaration'],
      }),
      note: 'Java member declarations and invocations are methods. The bundled grammar gives true, false, and null the same scope.',
    },
  ),
  bundled(
    'c',
    'C',
    ['source.c'],
    'cpp',
    lexical([...code, 'parameter'], {
      'variable-global': ['variable.other.readwrite.global.mac-classic.c'],
      'function-call': ['meta.function-call.c entity.name.function.c'],
    }),
    {
      ...clangdProvider,
      semantic: { ...clangd, type: ['type', 'enum', 'class'] },
      note: 'The optional clangd provider distinguishes function, file, and global scope. C struct fields may share the property type.',
    },
  ),
  bundled(
    'cpp',
    'C++',
    ['source.cpp', 'source.cpp.embedded.macro'],
    'cpp',
    lexical(
      [
        ...code,
        'function-declaration',
        'function-call',
        'method',
        'class',
        'type',
        'generic',
        'namespace',
        'parameter',
      ],
      {
        'import-export': ['keyword.control.directive.import.cpp'],
      },
    ),
    {
      ...clangdProvider,
      semantic: clangdCpp,
      note: 'This semantic profile targets clangd. Other C/C++ extensions use their own classifications.',
    },
  ),
  bundled(
    'csharp',
    'C#',
    ['source.cs'],
    'csharp',
    lexical(
      [
        ...code,
        'variable-local',
        'class',
        'interface',
        'type',
        'generic',
        'namespace',
        'parameter',
        'boolean',
        'null',
      ],
      {
        annotation: ['keyword.other.attribute-specifier.cs'],
        property: ['entity.name.variable.property.cs', 'variable.other.object.property.cs'],
        'import-export': ['keyword.other.directive.using.cs'],
        'html-tag': ['entity.name.tag.cs'],
        'html-attribute': ['entity.other.attribute-name.cs'],
      },
    ),
    {
      provider: 'C# (ms-dotnettools.csharp, Roslyn)',
      providerSource: 'https://github.com/dotnet/vscode-csharp/blob/main/package.json',
      semantic: semantic(
        [
          'class',
          'interface',
          'generic',
          'namespace',
          'parameter',
          'operator',
          'number',
          'string',
          'comment',
        ],
        {
          constant: ['constant', 'enumMember'],
          method: ['method', 'extensionMethod'],
          type: ['type', 'enum', 'struct', 'delegate', 'recordClass', 'recordStruct'],
          property: ['property', 'field'],
          keyword: ['keyword', 'controlKeyword'],
          regex: ['regexText', 'regexCharacterClass', 'regexQuantifier', 'regexGrouping'],
        },
      ),
      note: 'Roslyn semantic coverage depends on project loading and the C# extension’s selected language server.',
    },
  ),
  bundled(
    'rust',
    'Rust',
    ['source.rust'],
    'rust',
    lexical([...code, 'type', 'boolean'], {
      'function-declaration': ['meta.function.definition.rust entity.name.function.rust'],
      'function-call': ['meta.function.call.rust entity.name.function.rust'],
      interface: ['entity.name.type.trait.rust'],
      annotation: ['meta.attribute.rust'],
    }),
    {
      provider: 'rust-analyzer (rust-lang.rust-analyzer)',
      providerSource:
        'https://github.com/rust-lang/rust-analyzer/blob/master/editors/code/package.json',
      semantic: semantic(
        [
          'generic',
          'namespace',
          'method',
          'parameter',
          'operator',
          'keyword',
          'number',
          'string',
          'comment',
        ],
        {
          'variable-local': ['variable'],
          constant: ['const', 'static', 'enumMember'],
          'function-declaration': ['function.declaration'],
          interface: ['interface'],
          type: ['type', 'enum', 'struct', 'typeAlias', 'builtinType', 'union'],
          property: ['property'],
          annotation: ['attribute', 'builtinAttribute', 'derive', 'deriveHelper'],
          boolean: ['boolean'],
          async: ['function.async', 'method.async'],
        },
      ),
      note: 'Rust traits use interface classifications. Some extra token types depend on rust-analyzer semantic settings.',
    },
  ),
  bundled(
    'go',
    'Go',
    ['source.go'],
    'go',
    lexical([...code, 'type', 'parameter', 'boolean', 'null', 'import-export'], {
      namespace: ['entity.name.type.package.go'],
      'function-call': [
        'entity.name.function.support.go',
        'entity.name.function.support.builtin.go',
      ],
    }),
    {
      provider: 'Go (golang.go, gopls)',
      providerSource: 'https://github.com/golang/tools/blob/master/gopls/internal/golang/semtok.go',
      semantic: semantic(
        [
          'constant',
          'method',
          'interface',
          'generic',
          'namespace',
          'property',
          'parameter',
          'keyword',
          'operator',
          'number',
          'string',
          'comment',
        ],
        {
          'function-declaration': ['function.definition'],
          type: ['type', 'struct', 'type.defaultLibrary'],
        },
      ),
      note: 'The standard gopls semantic profile is optional. The grammar can still color imports, types, and literals.',
    },
  ),
  bundled(
    'ruby',
    'Ruby',
    ['source.ruby'],
    'ruby',
    lexical(
      [
        ...code,
        'variable-global',
        'variable-instance',
        'constant',
        'class',
        'parameter',
        'regex',
        'boolean',
        'null',
      ],
      {
        method: [
          'meta.function.method.ruby entity.name.function.ruby',
          'meta.function.method.with-arguments.ruby entity.name.function.ruby',
          'meta.function.method.without-arguments.ruby entity.name.function.ruby',
        ],
        namespace: ['entity.name.type.module.ruby'],
      },
    ),
    {
      note: 'Ruby’s grammar distinguishes $global and @instance variables. Ruby LSP may add semantic styling.',
    },
  ),
  bundled(
    'lua',
    'Lua',
    ['source.lua'],
    'lua',
    lexical([...code, 'parameter', 'annotation'], {
      'function-declaration': ['meta.function.lua entity.name.function.lua'],
    }),
    {
      note: 'Lua Language Server (sumneko.lua) can supplement the built-in grammar with semantic tokens.',
    },
  ),
  extension(
    'kotlin',
    'Kotlin',
    'source.kotlin',
    'https://github.com/fwcd/vscode-kotlin/blob/main/package.json',
    'Kotlin (fwcd.kotlin)',
    lexical([
      ...code,
      'class',
      'type',
      'annotation',
      'parameter',
      'function-declaration',
      'function-call',
      'boolean',
      'null',
    ]),
  ),
  bundled(
    'swift',
    'Swift',
    ['source.swift'],
    'swift',
    lexical(
      [
        ...code,
        'function-declaration',
        'function-call',
        'type',
        'parameter',
        'import-export',
        'regex',
        'boolean',
        'null',
      ],
      {
        argument: ['meta.function-call.swift support.variable.parameter.swift'],
        namespace: ['entity.name.type.module.swift'],
      },
    ),
    {
      provider: 'Swift (swiftlang.swift-vscode, SourceKit-LSP)',
      providerSource:
        'https://github.com/swiftlang/sourcekit-lsp/blob/main/Sources/SwiftLanguageService/SemanticTokens.swift',
      semantic: { argument: ['function.parameterLabel'] },
      note: 'Exact Swift symbol classifications depend on the project’s SourceKit toolchain.',
    },
  ),
  bundled(
    'dart',
    'Dart',
    ['source.dart'],
    'dart',
    lexical([...code, 'class', 'annotation', 'parameter', 'import-export']),
    {
      provider: 'Dart (Dart-Code.dart-code, Dart Analysis Server)',
      providerSource:
        'https://github.com/dart-lang/sdk/blob/main/pkg/analysis_server/lib/src/lsp/handlers/handler_semantic_tokens.dart',
      note: 'The Dart extension adds semantic highlighting. This profile uses the bundled grammar for its category mappings.',
    },
  ),
  bundled(
    'r',
    'R',
    ['source.r'],
    'r',
    lexical([...code, 'parameter'], {
      'function-declaration': ['meta.function.r entity.name.function.r'],
      'function-call': [
        'meta.function-call.r support.function',
        'meta.function-call.r meta.symbol',
      ],
      argument: ['variable.parameter.function-call.r'],
    }),
  ),
  bundled(
    'julia',
    'Julia',
    ['source.julia'],
    'julia',
    lexical([...code, 'constant', 'type', 'import-export', 'regex'], {
      'function-declaration': ['entity.name.function.julia'],
    }),
    {
      provider: 'Julia (julialang.language-julia)',
      providerSource: 'https://github.com/julia-vscode/julia-vscode',
    },
  ),
  extension(
    'scala',
    'Scala',
    'source.scala',
    'https://github.com/scala/vscode-scala-syntax',
    'Scala Syntax (scala-lang.scala) and Metals (scalameta.metals)',
    lexical([...code, 'class', 'type', 'parameter', 'import-export']),
    'The Scala Syntax extension supplies the grammar. Metals can add semantic highlighting.',
  ),
  extension(
    'haskell',
    'Haskell',
    'source.haskell',
    'https://github.com/haskell/vscode-haskell-syntax-highlighting/blob/master/syntaxes/haskell.YAML-tmLanguage',
    'Haskell Syntax Highlighting (haskell.language-haskell)',
    lexical([...code, 'type', 'namespace'], { 'import-export': ['keyword.other.import.haskell'] }),
    'The Haskell extension can supplement syntax highlighting through Haskell Language Server.',
  ),
  extension(
    'elixir',
    'Elixir',
    'source.elixir',
    'https://github.com/elixir-lsp/vscode-elixir-ls/blob/master/package.json',
    'ElixirLS (JakeBecker.elixir-ls)',
    lexical([...code, 'constant', 'type', 'regex'], {
      'function-declaration': ['meta.function.definition.elixir entity.name.function.elixir'],
      'function-call': [
        'entity.name.function.call.local.elixir',
        'entity.name.function.call.dot.elixir',
      ],
      namespace: ['entity.name.type.module.elixir'],
    }),
  ),
  extension(
    'erlang',
    'Erlang',
    'source.erlang',
    'https://github.com/erlang-ls/grammar/blob/main/Erlang.plist',
    'Erlang LS (erlang-ls.erlang-ls)',
    lexical([...code, 'constant', 'type', 'function-declaration'], {
      'import-export': [
        'keyword.control.directive.import.erlang',
        'keyword.control.directive.export.erlang',
      ],
    }),
  ),
  bundled(
    'perl',
    'Perl',
    ['source.perl'],
    'perl',
    lexical(['keyword', 'operator', ...text, 'variable-global', 'class', 'parameter', 'regex'], {
      'function-declaration': ['meta.function.perl entity.name.function.perl'],
    }),
  ),
  bundled(
    'shellscript',
    'Bash and shell scripts',
    ['source.shell'],
    'shellscript',
    lexical([...code, 'function-call', 'parameter'], {
      'function-declaration': ['meta.function.shell entity.name.function.shell'],
    }),
    { note: 'VS Code’s shellscript ID is shared by Bash and other shell dialects.' },
  ),
  bundled(
    'powershell',
    'PowerShell',
    ['source.powershell'],
    'powershell',
    lexical([...code, 'parameter', 'constant'], {
      type: ['storage.type.powershell'],
      property: ['variable.other.member.powershell'],
      'function-declaration': ['meta.function.powershell entity.name.function.powershell'],
    }),
    {
      provider: 'PowerShell (ms-vscode.PowerShell)',
      providerSource:
        'https://github.com/PowerShell/vscode-powershell/blob/main/docs/troubleshooting.md#syntax-highlighting-problems',
      note: 'PowerShell Editor Services can layer semantic colors over the bundled syntax.',
    },
  ),
  bundled(
    'sql',
    'SQL',
    ['source.sql'],
    'sql',
    lexical([...code, 'regex'], {
      type: ['storage.type.sql', 'support.function.datatype.sql'],
      'function-call': ['support.function.sql', 'entity.name.function.sql'],
    }),
    {
      note: 'This profile follows the generic SQL grammar. Database extensions may add dialect-specific scopes.',
    },
  ),
  bundled('html', 'HTML', ['text.html.derivative'], 'html', markup),
  bundled('css', 'CSS', ['source.css'], 'css', stylesheet),
  bundled('scss', 'SCSS', ['source.css.scss'], 'scss', stylesheet),
  extension(
    'sass',
    'Sass (indented)',
    'source.sass',
    'https://github.com/TheRealSyler/vscode-sass-indented/blob/master/package.json',
    'Sass (syler.sass-indented)',
    {
      ...stylesheet,
      'css-value': [...textMateScopes['css-value'], 'constant.language.color.rgb-value.css.sass'],
      'import-export': ['keyword.control.at-rule.use', 'keyword.control.at-rule.css.sass.use'],
    },
  ),
  bundled('less', 'Less', ['source.css.less'], 'less', stylesheet),
  bundled('json', 'JSON', ['source.json'], 'json', lexical(['number', 'string', 'property']), {
    note: 'The bundled grammar shares one scope between true, false, and null.',
  }),
  bundled(
    'jsonc',
    'JSON with Comments',
    ['source.json.comments'],
    'json',
    lexical(['number', 'string', 'property', 'comment']),
    {
      note: 'The bundled grammar shares one scope between true, false, and null.',
    },
  ),
  bundled('xml', 'XML', ['text.xml'], 'xml', markup),
  bundled(
    'yaml',
    'YAML',
    ['source.yaml'],
    'yaml',
    lexical([...text, 'number', 'boolean', 'null'], {
      property: ['entity.name.tag.yaml', 'meta.mapping.key.yaml string'],
    }),
  ),
  extension(
    'toml',
    'TOML',
    'source.toml',
    'https://github.com/tamasfe/taplo/blob/master/editors/vscode/package.json',
    'Even Better TOML (tamasfe.even-better-toml)',
    lexical([...text, 'number', 'boolean', 'property']),
  ),
  bundled('markdown', 'Markdown', ['text.html.markdown'], 'markdown-basics', markup, {
    note: 'HTML and fenced code keep embedded grammar scopes. A Markdown TextMate rule can reach an embedded token.',
  }),
  bundled(
    'dockerfile',
    'Dockerfile',
    ['source.dockerfile'],
    'docker',
    lexical([...text, 'keyword', 'operator']),
  ),
  extension(
    'graphql',
    'GraphQL',
    'source.graphql',
    'https://github.com/graphql/graphiql/blob/main/packages/vscode-graphql-syntax/package.json',
    'GraphQL: Syntax Highlighting (GraphQL.vscode-graphql-syntax)',
    lexical([...code, 'type', 'boolean', 'null', 'parameter'], {
      property: ['constant.object.key.graphql'],
    }),
  ),
  extension(
    'solidity',
    'Solidity',
    'source.solidity',
    'https://github.com/juanfranblanco/vscode-solidity/blob/master/package.json',
    'Solidity (JuanBlanco.solidity)',
    lexical([...code, 'type', 'interface', 'parameter', 'import-export', 'boolean'], {
      class: ['entity.name.type.contract'],
    }),
    'Contract names use the class category.',
  ),
  extension(
    'asm-intel-x86-generic',
    'Assembly (x86 and x86-64)',
    'source.asm.x86_64',
    'https://github.com/13xforever/x86_64-assembly-vscode/blob/master/package.json',
    'x86 and x86_64 Assembly (13xforever.language-x86-64-assembly)',
    lexical(['keyword', 'number', 'comment', 'string']),
    'This grammar targets Intel-style assemblies such as NASM and YASM.',
  ),
  extension(
    'vue',
    'Vue',
    'text.html.vue',
    'https://github.com/vuejs/language-tools/blob/master/extensions/vscode/package.json',
    'Vue (Official) (Vue.volar)',
    { ...scripting, ...markup, ...lexical(['css-selector', 'css-value']) },
    'Vue rules apply where the single-file component grammar preserves its outer scope.',
  ),
  extension(
    'svelte',
    'Svelte',
    'source.svelte',
    'https://github.com/sveltejs/language-tools/blob/master/packages/svelte-vscode/package.json',
    'Svelte for VS Code (svelte.svelte-vscode)',
    { ...scripting, ...markup, ...lexical(['css-selector', 'css-value']) },
    'Svelte rules apply where the single-file component grammar preserves its outer scope.',
  ),
  extension(
    'astro',
    'Astro',
    'source.astro',
    'https://github.com/withastro/astro/blob/main/packages/language-tools/vscode/package.json',
    'Astro (astro-build.astro-vscode)',
    { ...scripting, ...markup, ...lexical(['css-selector', 'css-value']) },
    'Astro frontmatter, template, and embedded code can have different grammar and semantic coverage.',
  ),
  {
    id: 'react',
    label: 'React (JSX and TSX)',
    languageIds: ['javascriptreact', 'typescriptreact'],
    grammarRoots: ['source.js.jsx', 'source.tsx'],
    coverage: 'framework',
    source: 'https://react.dev/learn/writing-markup-with-jsx',
    ...tsProvider,
    textMate: jsx,
    note: 'React shares VS Code’s JSX and TSX modes. These rules affect those modes in other libraries too.',
  },
  {
    id: 'angular',
    label: 'Angular templates',
    languageIds: ['html', 'typescript'],
    grammarRoots: ['expression.ng', 'control.block.ng', 'meta.definition.variable.ng'],
    coverage: 'framework',
    source: 'https://github.com/angular/angular/tree/main/vscode-ng-language-service/syntaxes',
    provider: 'Angular Language Service (Angular.ng-template)',
    textMate: lexical([...code, 'property', 'boolean', 'null'], {
      'function-call': ['entity.name.function.pipe.ng'],
    }),
    note: 'Angular-specific rules target injected template expression and block scopes. HTML tags and component TypeScript use their standard modes.',
  },
  {
    id: 'blade',
    label: 'Laravel Blade',
    languageIds: ['blade'],
    grammarRoots: ['text.html.php.blade'],
    coverage: 'framework',
    source: 'https://github.com/laravel/vs-code-extension/blob/main/package.json',
    provider: 'Laravel (laravel.vscode-laravel)',
    textMate: { ...markup, ...lexical(['keyword', 'operator', 'number']) },
    note: 'Blade has its own grammar. Laravel PHP application files use PHP mode.',
  },
  {
    id: 'django-html',
    label: 'Django HTML templates',
    languageIds: ['django-html'],
    grammarRoots: ['text.html.django'],
    coverage: 'framework',
    source: 'https://github.com/vscode-django/vscode-django/blob/master/package.json',
    provider: 'Django (batisteo.vscode-django)',
    textMate: {
      ...markup,
      ...lexical(['keyword', 'operator'], {
        'function-call': ['entity.name.function.filter.django'],
      }),
    },
    note: 'Django template rules use the Django HTML grammar. Django Python code uses Python mode.',
  },
  {
    id: 'spring-boot',
    label: 'Spring Boot configuration',
    languageIds: ['spring-boot-properties', 'spring-boot-properties-yaml'],
    grammarRoots: ['source.spring-boot-properties', 'source.spring-boot-properties-yaml'],
    coverage: 'framework',
    source:
      'https://github.com/spring-projects/spring-tools/blob/main/vscode-extensions/vscode-spring-boot/package.json',
    provider: 'Spring Boot Tools (vmware.vscode-spring-boot)',
    textMate: lexical([...text, 'number', 'boolean', 'null'], {
      property: [
        'entity.name.tag.yaml',
        'keyword.other.definition.ini',
        'support.type.property-name',
      ],
    }),
    note: 'Spring Boot configuration modes come from Spring Boot Tools. Spring application source uses its Java or Kotlin mode.',
  },
];

export const languages: readonly Language[] = languageDefinitions.map(
  ({ id, label, languageIds, grammarRoots, coverage, source, provider, providerSource, note }) => ({
    id,
    label,
    languageIds,
    grammarRoots,
    coverage,
    source,
    provider,
    providerSource,
    note,
  }),
);
