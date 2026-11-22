export type SelectionFormatting = 'supported' | 'unsupported' | 'depends';
export type CodeActionOnSaveValue = boolean | 'always' | 'explicit' | 'never';
export type CodeActionsOnSave = Record<string, CodeActionOnSaveValue> | string[];
export type ReadSetting = (key: string) => unknown;

export interface EffectiveSettings {
  defaultFormatter: string | null;
  tabSize: number;
  insertSpaces: boolean;
  detectIndentation: boolean;
  renderWhitespace: string;
  indentationGuides: boolean;
  bracketPairGuides: boolean | 'active';
  folding: boolean;
  foldingStrategy: 'auto' | 'indentation';
  formatOnSave: boolean;
  formatOnSaveMode: 'file' | 'modifications' | 'modificationsIfAvailable';
  codeActionsOnSave: CodeActionsOnSave;
  eol: 'lf' | 'crlf' | 'auto';
  trimTrailingWhitespace: boolean;
}

export interface ProviderAvailability {
  id: string;
  name: string;
  availability: 'candidate' | 'disabled' | 'notDetected';
  active: boolean;
  configured: boolean;
  requirements: string;
  documentation: string;
  selectionFormatting: SelectionFormatting | null;
  reason?: string;
}

interface Conflict {
  code:
    | 'default-formatter-not-detected'
    | 'default-formatter-disabled'
    | 'multiple-formatter-candidates'
    | 'multiple-import-organizer-candidates'
    | 'eslint-duplicate-save'
    | 'php-cs-fixer-duplicate-save';
  message: string;
  extensionIds: string[];
}

export interface ProviderStatus {
  formatters: ProviderAvailability[];
  importOrganizers: ProviderAvailability[];
  conflicts: Conflict[];
}

interface ProviderSpec {
  id: string;
  name: string;
  languages: readonly string[];
  requirements: string;
  documentation: string;
  selectionFormatting?:
    SelectionFormatting | ((languageId: string, read: ReadSetting) => SelectionFormatting);
  organizeImports?: boolean;
  disabled?: (languageId: string, read: ReadSetting) => string | undefined;
  importsDisabled?: (read: ReadSetting) => string | undefined;
}

interface ExtensionInfo {
  isActive: boolean;
  name?: string;
}

interface ProviderContext {
  languageId: string;
  effective: EffectiveSettings;
  read: ReadSetting;
  extension: (id: string) => ExtensionInfo | undefined;
}

const jsTsLanguages = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];
const prettierRangeLanguages = [...jsTsLanguages, 'json', 'graphql', 'handlebars'];
const eslintId = 'dbaeumer.vscode-eslint';
const phpCsFixerId = 'junstyle.php-cs-fixer';

const catalog: readonly ProviderSpec[] = [
  {
    id: 'vscode.typescript-language-features',
    name: 'TypeScript and JavaScript Language Features',
    languages: jsTsLanguages,
    requirements: 'Built into VS Code.',
    documentation: 'https://code.visualstudio.com/docs/languages/javascript#_organize-imports',
    selectionFormatting: 'supported',
    organizeImports: true,
    disabled: (language, read) => {
      if (read('js/ts.format.enabled') === false) {
        return 'js/ts.format.enabled is off.';
      }
      const family = language.startsWith('typescript') ? 'typescript' : 'javascript';
      return off(read, `${family}.format.enable`);
    },
  },
  {
    id: 'vscode.json-language-features',
    name: 'JSON Language Features',
    languages: ['json', 'jsonc'],
    requirements: 'Built into VS Code.',
    documentation: 'https://code.visualstudio.com/docs/languages/json#_formatting',
    selectionFormatting: 'supported',
    disabled: (_language, read) => off(read, 'json.format.enable'),
  },
  {
    id: 'vscode.html-language-features',
    name: 'HTML Language Features',
    languages: ['html', 'handlebars'],
    requirements: 'Built into VS Code.',
    documentation: 'https://code.visualstudio.com/docs/languages/html#_formatting',
    selectionFormatting: 'supported',
    disabled: (_language, read) => off(read, 'html.format.enable'),
  },
  {
    id: 'vscode.css-language-features',
    name: 'CSS Language Features',
    languages: ['css', 'less', 'scss'],
    requirements: 'Built into VS Code.',
    documentation: 'https://code.visualstudio.com/docs/languages/css#_formatting',
    selectionFormatting: 'supported',
    disabled: (language, read) => off(read, `${language}.format.enable`),
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier',
    languages: [
      ...jsTsLanguages,
      'json',
      'jsonc',
      'css',
      'scss',
      'less',
      'html',
      'vue',
      'handlebars',
      'graphql',
      'markdown',
      'mdx',
      'yaml',
    ],
    requirements:
      'Includes Prettier. Project-specific parsers or plugins may require project dependencies.',
    documentation: 'https://github.com/prettier/prettier-vscode',
    selectionFormatting: (language) =>
      prettierRangeLanguages.includes(language) ? 'supported' : 'depends',
    disabled: (_language, read) => off(read, 'prettier.enable'),
  },
  {
    id: eslintId,
    name: 'ESLint',
    languages: [...jsTsLanguages, 'html', 'vue', 'markdown', 'json', 'jsonc', 'mdx'],
    requirements:
      'Needs an ESLint installation and configuration that validates this file. Enable eslint.format.enable to register a formatter.',
    documentation: 'https://github.com/microsoft/vscode-eslint',
    selectionFormatting: 'unsupported',
    disabled: (_language, read) =>
      off(read, 'eslint.enable') ??
      (read('eslint.format.enable') === true ? undefined : 'eslint.format.enable is off.'),
  },
  {
    id: 'charliermarsh.ruff',
    name: 'Ruff',
    languages: ['python'],
    requirements:
      'Includes Ruff. The extension can also use an environment installation or a configured executable.',
    documentation: 'https://docs.astral.sh/ruff/editors/setup/#vs-code',
    selectionFormatting: 'depends',
    organizeImports: true,
    disabled: (_language, read) => off(read, 'ruff.enable'),
    importsDisabled: (read) => off(read, 'ruff.enable') ?? off(read, 'ruff.organizeImports'),
  },
  {
    id: 'ms-python.black-formatter',
    name: 'Black Formatter',
    languages: ['python'],
    requirements: 'Includes Black and uses a supported Python interpreter to run it.',
    documentation: 'https://github.com/microsoft/vscode-black-formatter',
    selectionFormatting: 'unsupported',
  },
  {
    id: 'ms-python.isort',
    name: 'isort',
    languages: ['python'],
    requirements: 'Includes isort and uses a supported Python interpreter to run it.',
    documentation: 'https://github.com/microsoft/vscode-isort',
    organizeImports: true,
  },
  {
    id: phpCsFixerId,
    name: 'PHP CS Fixer',
    languages: ['php'],
    requirements:
      'Needs PHP. The extension includes a PHP CS Fixer PHAR and supports an optional configured executable.',
    documentation: 'https://marketplace.visualstudio.com/items?itemName=junstyle.php-cs-fixer',
    selectionFormatting: 'supported',
    disabled: (_language, read) => off(read, 'php-cs-fixer.documentFormattingProvider'),
  },
  {
    id: 'golang.go',
    name: 'Go',
    languages: ['go'],
    requirements:
      'Needs a Go installation and gopls for the standard language-server workflow. gopls uses gofmt style by default.',
    documentation:
      'https://github.com/golang/vscode-go/blob/master/docs/advanced.md#formatting-code-and-organizing-imports',
    selectionFormatting: 'depends',
    organizeImports: true,
  },
  {
    id: 'rust-lang.rust-analyzer',
    name: 'rust-analyzer',
    languages: ['rust'],
    requirements:
      'Needs a Rust toolchain with rustfmt. The extension bundles the rust-analyzer server on supported platforms.',
    documentation:
      'https://rust-analyzer.github.io/book/configuration#rust-analyzerrustfmtrangeformattingenable',
    selectionFormatting: (_language, read) =>
      read('rust-analyzer.rustfmt.rangeFormatting.enable') === true ? 'depends' : 'unsupported',
  },
  {
    id: 'ms-vscode.cpptools',
    name: 'C/C++',
    languages: ['c', 'cpp', 'cuda-cpp'],
    requirements:
      'Includes clang-format and vc_format. The active engine follows C_Cpp.formatting and the project configuration.',
    documentation: 'https://code.visualstudio.com/docs/cpp/cpp-ide#_code-formatting',
    selectionFormatting: 'supported',
    disabled: (_language, read) =>
      read('C_Cpp.formatting') === 'disabled' ? 'C_Cpp.formatting is disabled.' : undefined,
  },
  {
    id: 'llvm-vs-code-extensions.vscode-clangd',
    name: 'clangd',
    languages: ['c', 'cpp', 'cuda-cpp', 'objective-c', 'objective-cpp'],
    requirements: 'Needs a clangd server. clangd provides clang-format formatting.',
    documentation: 'https://clangd.llvm.org/installation#editor-plugins',
    selectionFormatting: 'supported',
  },
];

function off(read: ReadSetting, key: string): string | undefined {
  return read(key) === false ? `${key} is off.` : undefined;
}

function providerAvailability(
  spec: ProviderSpec,
  context: ProviderContext,
  format: boolean,
): ProviderAvailability {
  const { languageId, effective, extension, read } = context;
  const found = extension(spec.id);
  const languageMatches = spec.languages.includes(languageId);
  const formatSetting = format ? spec.disabled?.(languageId, read) : undefined;
  const importSetting = format ? undefined : spec.importsDisabled?.(read);
  const reason = !found
    ? 'The extension is not visible to this VS Code extension host.'
    : (formatSetting ?? importSetting);
  const capability = languageMatches ? spec.selectionFormatting : 'depends';
  const selectionFormatting =
    typeof capability === 'function' ? capability(languageId, read) : capability;

  return {
    id: spec.id,
    name: spec.name,
    availability: found ? (reason ? 'disabled' : 'candidate') : 'notDetected',
    active: found?.isActive ?? false,
    configured: format && effective.defaultFormatter?.toLowerCase() === spec.id,
    requirements: spec.requirements,
    documentation: spec.documentation,
    selectionFormatting: format ? (selectionFormatting ?? 'depends') : null,
    ...(reason ? { reason } : {}),
  };
}

function codeActionIsEnabled(actions: CodeActionsOnSave, kind: string, parent: string): boolean {
  if (Array.isArray(actions)) {
    return actions.includes(kind) || actions.includes(parent);
  }
  const value = actions[kind] ?? actions[parent];
  return value === true || value === 'always' || value === 'explicit';
}

export function getProviderStatus(context: ProviderContext): ProviderStatus {
  const { effective, languageId, extension, read } = context;
  const configuredId = effective.defaultFormatter?.toLowerCase();
  const languageProviders = catalog.filter((spec) => spec.languages.includes(languageId));
  const formatterSpecs = catalog.filter(
    (spec) =>
      spec.selectionFormatting !== undefined &&
      (spec.languages.includes(languageId) || spec.id === configuredId),
  );
  const formatters = formatterSpecs.map((spec) => providerAvailability(spec, context, true));
  if (configuredId && !formatters.some((provider) => provider.configured)) {
    const found = extension(configuredId);
    formatters.push({
      id: configuredId,
      name: found?.name ?? configuredId,
      availability: found ? 'candidate' : 'notDetected',
      active: found?.isActive ?? false,
      configured: true,
      requirements:
        'This is the configured default. VS Code checks its support for the active document.',
      documentation: 'https://code.visualstudio.com/docs/editing/codebasics#_formatting',
      selectionFormatting: 'depends',
      ...(!found ? { reason: 'The extension is not visible to this VS Code extension host.' } : {}),
    });
  }

  const importOrganizers = languageProviders
    .filter((spec) => spec.organizeImports)
    .map((spec) => providerAvailability(spec, context, false));
  const conflicts: Conflict[] = [];
  const selected = formatters.find((provider) => provider.configured);
  const formatterCandidates = formatters.filter(
    (provider) => provider.availability === 'candidate',
  );
  const importCandidates = importOrganizers.filter(
    (provider) => provider.availability === 'candidate',
  );

  if (selected?.availability === 'notDetected') {
    conflicts.push({
      code: 'default-formatter-not-detected',
      message: `The configured default formatter ${selected.id} is not visible to the extension host.`,
      extensionIds: [selected.id],
    });
  } else if (selected?.availability === 'disabled') {
    conflicts.push({
      code: 'default-formatter-disabled',
      message:
        `The configured default formatter ${selected.name} is disabled by its settings. ${selected.reason ?? ''}`.trim(),
      extensionIds: [selected.id],
    });
  } else if (!configuredId && formatterCandidates.length > 1) {
    conflicts.push({
      code: 'multiple-formatter-candidates',
      message:
        'Several formatter extensions may handle this language. VS Code can ask you to select a default.',
      extensionIds: formatterCandidates.map((provider) => provider.id),
    });
  }

  if (importCandidates.length > 1) {
    conflicts.push({
      code: 'multiple-import-organizer-candidates',
      message:
        'Several extensions may offer import organization. Choose one action when VS Code returns multiple options.',
      extensionIds: importCandidates.map((provider) => provider.id),
    });
  }
  if (
    selected?.id === eslintId &&
    selected.availability === 'candidate' &&
    effective.formatOnSave &&
    codeActionIsEnabled(effective.codeActionsOnSave, 'source.fixAll.eslint', 'source.fixAll')
  ) {
    conflicts.push({
      code: 'eslint-duplicate-save',
      message: 'Format on Save and ESLint Fix All on save may both run ESLint.',
      extensionIds: [eslintId],
    });
  }
  if (
    selected?.id === phpCsFixerId &&
    selected.availability === 'candidate' &&
    effective.formatOnSave &&
    read('php-cs-fixer.onsave') === true
  ) {
    conflicts.push({
      code: 'php-cs-fixer-duplicate-save',
      message: 'Format on Save and php-cs-fixer.onsave may both run PHP CS Fixer.',
      extensionIds: [phpCsFixerId],
    });
  }

  return { formatters, importOrganizers, conflicts };
}
