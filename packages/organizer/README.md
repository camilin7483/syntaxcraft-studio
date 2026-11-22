# SyntaxCraft Organizer

[Español](#español)

Use the formatters you already have in VS Code, review import and whitespace edits, and move between folding regions. Organizer supports VS Code 1.100 and later and works independently of SyntaxCraft Control Center.

## English

Run **Extensions: Install from VSIX…**, open a file, then search for **SyntaxCraft Organizer** in the Command Palette.

| Command                                                     | Behavior                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format Document / Format Selection                          | Runs the native VS Code action, using the effective `editor.defaultFormatter` and the provider's supported formatting ranges.                                             |
| Organize Imports                                            | Requests `source.organizeImports` and its sub-kinds. Choose an action if several providers return editable results. Review the diff, then choose **Apply** or **Cancel**. |
| Trim Trailing Whitespace                                    | Previews removal of spaces and tabs at the ends of lines. Use **Show Whitespace Differences** in the diff editor when your settings hide these changes.                   |
| Normalize Line Endings                                      | Uses `files.eol` when set to LF or CRLF. Otherwise, choose a target. The confirmation shows both styles and the number of affected line breaks.                           |
| Reindent Lines                                              | Confirms and runs VS Code's language-aware reindent action with the editor's current indentation settings.                                                                |
| Go to Next / Previous Folding Region, Fold All / Unfold All | Uses the editor's folding model, including language and indentation-based ranges.                                                                                         |
| Show Provider Status                                        | Lists known candidates, their requirements, effective settings and potential conflicts for the active editor.                                                             |
| Open Organizer Settings                                     | Opens the exact native setting in VS Code. Use the Settings editor to choose a user, workspace, folder or language scope.                                                 |

Explicit format commands use the editor’s native undo behavior. When the editor discovers multiple eligible formatters, it handles the choice through its default formatter setting or its formatter picker. Format Selection needs a nonempty selection for each cursor. The native formatter can expand the affected range to a line or syntax boundary.

Import providers may reorder, add or remove imports. Organizer applies reviewed text edits to the same open document revision. Edit-based actions are applied from their text changes. Use the explicitly opened VS Code action menu when a provider supplies a standalone command. Restricted Mode allows local cleanup, settings and folding. Format and import providers require a trusted workspace. Editing commands support local and remote files and untitled editors.

### Settings example

Place this in User Settings or Workspace Settings. This example uses Prettier for TypeScript formatting and the TypeScript language service for import organization.

```jsonc
{
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.detectIndentation": false,
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": "explicit",
    },
  },
  "editor.renderWhitespace": "boundary",
  "editor.guides.indentation": true,
  "editor.guides.bracketPairs": "active",
  "files.eol": "\n",
}
```

VS Code manages saving through `editor.formatOnSave`, `editor.formatOnSaveMode`, `editor.codeActionsOnSave` and `files.trimTrailingWhitespace`. Use full-file formatting for providers such as Black that require it. [VS Code formatting](https://code.visualstudio.com/docs/editing/codebasics#_formatting) · [Python formatter setup](https://code.visualstudio.com/docs/python/formatting)

### Formatter and import providers

Status is based on known language coverage, extension visibility in the current extension host, and relevant settings. Actual availability can depend on the provider's supported file types, binaries and project configuration. Organizer also works with other providers registered in VS Code.

| Provider          | Extension ID                                                                                                                            | Setup and coverage                                                                                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VS Code built-ins | `vscode.typescript-language-features`, `vscode.json-language-features`, `vscode.html-language-features`, `vscode.css-language-features` | Format JavaScript/TypeScript, JSON/JSONC, HTML and CSS/SCSS/Less. The JavaScript/TypeScript service also organizes imports. [VS Code formatting](https://code.visualstudio.com/docs/editing/codebasics#_formatting) · [JavaScript import organization](https://code.visualstudio.com/docs/languages/javascript#_organize-imports) |
| Prettier          | `esbenp.prettier-vscode`                                                                                                                | Includes Prettier. Project parsers and plugins can require local dependencies. Selection support depends on the language. [Prettier extension](https://github.com/prettier/prettier-vscode)                                                                                                                                       |
| ESLint            | `dbaeumer.vscode-eslint`                                                                                                                | Requires ESLint configured to validate the file. Enable `eslint.format.enable` for document formatting. Fix All on save uses `source.fixAll.eslint`. [ESLint extension](https://github.com/microsoft/vscode-eslint)                                                                                                               |
| Ruff              | `charliermarsh.ruff`                                                                                                                    | Includes Ruff and supports configured Python environments. Formats Python and may publish `source.organizeImports.ruff`. [Ruff editor setup](https://docs.astral.sh/ruff/editors/setup/#vs-code)                                                                                                                                  |
| Black and isort   | `ms-python.black-formatter`, `ms-python.isort`                                                                                          | Each includes its tool and uses a Python interpreter. Black formats whole Python files. isort handles import sorting. [Black extension](https://github.com/microsoft/vscode-black-formatter) · [isort extension](https://github.com/microsoft/vscode-isort)                                                                       |
| PHP CS Fixer      | `junstyle.php-cs-fixer`                                                                                                                 | Requires PHP. Includes a PHP CS Fixer PHAR and accepts a configured executable. [PHP CS Fixer extension](https://marketplace.visualstudio.com/items?itemName=junstyle.php-cs-fixer)                                                                                                                                               |
| Go                | `golang.go`                                                                                                                             | Requires Go and gopls in the common language-server setup. gopls formats in gofmt style and organizes imports. [Go extension](https://github.com/golang/vscode-go/blob/master/docs/advanced.md#formatting-code-and-organizing-imports)                                                                                            |
| rust-analyzer     | `rust-lang.rust-analyzer`                                                                                                               | Uses rustfmt from the Rust toolchain. Selection formatting depends on the extension setting and toolchain. [rust-analyzer installation](https://rust-analyzer.github.io/book/installation.html) · [rustfmt settings](https://rust-analyzer.github.io/book/configuration#rust-analyzerrustfmtrangeformattingenable)                |
| C/C++ and clangd  | `ms-vscode.cpptools`, `llvm-vs-code-extensions.vscode-clangd`                                                                           | C/C++ bundles clang-format and vc_format. clangd uses its language server for clang-format. [C/C++ formatting](https://code.visualstudio.com/docs/cpp/cpp-ide#_code-formatting) · [clangd setup](https://clangd.llvm.org/installation#editor-plugins)                                                                             |

### Extension command API

`syntaxcraft.organizer.status` returns the active editor's `document`, `effective` settings, `trusted` state, `formatters`, `importOrganizers` and `conflicts`. Pass a `vscode.Uri` for an already-open document to read its status without focusing it. The `status` command reports candidates from metadata and settings. The edit and navigation commands operate on the active text editor.

## Español

Ejecuta **Extensiones: Instalar desde VSIX…**, abre un archivo y busca **SyntaxCraft Organizer** en la paleta de comandos.

| Comando                                                     | Función                                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format Document / Format Selection                          | Ejecuta el comando nativo de VS Code con el valor efectivo de `editor.defaultFormatter` y los rangos de formato admitidos por el proveedor.                             |
| Organize Imports                                            | Solicita `source.organizeImports` y sus subtipos. Si varios proveedores devuelven cambios, elige una acción. Revisa la comparación y selecciona **Apply** o **Cancel**. |
| Trim Trailing Whitespace                                    | Muestra qué espacios y tabulaciones se eliminarán al final de las líneas. Si quedan ocultos, usa **Show Whitespace Differences** en el editor de comparación.           |
| Normalize Line Endings                                      | Usa LF o CRLF cuando `files.eol` especifica uno de ellos. Con `auto`, elige el estilo. La confirmación indica ambos estilos y la cantidad de saltos de línea afectados. |
| Reindent Lines                                              | Pide confirmación y vuelve a sangrar el documento con las reglas del lenguaje y la configuración del editor.                                                            |
| Go to Next / Previous Folding Region, Fold All / Unfold All | Usa las regiones plegables del editor, incluidas las definidas por el lenguaje y por la sangría.                                                                        |
| Show Provider Status                                        | Muestra los candidatos conocidos, requisitos, valores efectivos y posibles conflictos para el editor activo.                                                            |
| Open Organizer Settings                                     | Abre el ajuste de VS Code que elijas. El editor de configuración permite elegir el ámbito de usuario, espacio de trabajo, carpeta o lenguaje.                           |

Los comandos de formato usan la función nativa de deshacer. Cuando hay varios proveedores disponibles, VS Code usa el formateador predeterminado o muestra su selector. Para dar formato a una selección, selecciona texto en cada cursor. El proveedor puede ampliar el rango al límite de una línea o de una estructura del lenguaje.

Organizar las importaciones puede ordenarlas, añadirlas o eliminar las que sobren. Organizer aplica los cambios de texto revisados a la misma versión del documento abierto. Si un proveedor ofrece un comando independiente, puedes abrir explícitamente el menú de acciones de código de VS Code. El modo restringido permite la limpieza local, la configuración y el plegado. Los proveedores de formato e importaciones requieren un espacio de trabajo de confianza. Los comandos de edición admiten archivos locales y remotos y editores sin título.

El [ejemplo de configuración](#settings-example) muestra cómo elegir Prettier para TypeScript, usar dos espacios y organizar las importaciones en un guardado explícito. El [listado de proveedores](#formatter-and-import-providers) incluye Prettier, ESLint, Ruff, Black, isort, PHP CS Fixer, Go con gofmt/gopls, rust-analyzer con rustfmt, clang-format y los formateadores integrados. Instala y configura el proveedor que corresponda a tu lenguaje. El estado de candidatos se obtiene de las extensiones visibles y de la configuración de VS Code.

`syntaxcraft.organizer.status` devuelve el documento y sus ajustes efectivos, el estado de confianza, los formateadores, los organizadores de importaciones y sus posibles conflictos. Acepta un `vscode.Uri` opcional de un documento abierto para consultarlo sin mover el foco.
