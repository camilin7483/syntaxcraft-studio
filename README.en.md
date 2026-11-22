# SyntaxCraft Studio

A five-extension suite for desktop Visual Studio Code. It combines original themes, a visual editor for native syntax rules, Explorer icons, code organization, and portable appearance profiles.

[Leer en español](README.md) · [Installation](docs/INSTALL.md) · [Development](docs/DEVELOPMENT.md) · [Publishing](docs/RELEASE.md) · [Verification](docs/VERIFICATION.md)

## Install from GitHub

[Download SyntaxCraft Studio 1.0.0](https://github.com/camilin7483/syntaxcraft-studio/releases/tag/v1.0.0). Under **Assets**, choose the installer ZIP for all VSIX files or download individual modules.

1. Install the **Colors**, **Icons**, **Organizer**, and **Control Center** VSIX files with **Extensions: Install from VSIX…**. Install the optional extension pack last when using local files.
2. Open the Command Palette and run **SyntaxCraft: Open Control Center**.
3. Choose a theme, edit a token, or load a preset in **Perfiles**. The panel previews your draft.
4. Choose **Usuario** for user settings or **Proyecto** for workspace settings. Select **Aplicar ajustes** and confirm. Save the draft as a profile to use it again or export it later.

Desktop VS Code 1.100 and later is supported. Each extension includes its own local assets.

| Extension      | What it does                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Colors         | Ten original themes and 32 token categories using native TextMate and semantic selectors.                        |
| Icons          | Minimal, Modern, Neon, and Colorful Explorer icon sets. A product theme replaces nine workbench glyphs.          |
| Organizer      | Document and selection formatting, import organization, cleanup, line endings, indenting, and fold navigation.   |
| Control Center | Color and icon previews, language coverage, contrast, JSON profiles, comparison, and scope-specific restoration. |
| Extension Pack | Installs the four extensions together once they are published to Visual Studio Marketplace.                      |

## Customize and restore

Choose an original theme in the Control Center or use **Preferences: Color Theme**. The Color Studio supports HEX, RGB, and HSL, token search, language filters, and side-by-side comparison. **Abrir muestra en VS Code** opens an unsaved sample in the actual editor. Custom workbench colors affect editor, terminal, diagnostics, diff, and other theme surfaces. The Accessibility page checks the draft against a 4.5:1 contrast threshold for normal text.

Choose a preset for web, Python, PHP, systems, data science, or a minimal workspace. Save, duplicate, import, and export your own settings on the Profiles page. The Settings page can undo the most recent application or restore the current Studio overlay. Studio retains 12 applications per scope and checks the current values before reverting individual fields.

## Provider-dependent behavior

The registry covers 50 languages, formats, and frameworks. Language grammars and providers determine whether categories such as arguments, global variables, and calls have distinct selectors. See the [coverage notes](packages/colors/LANGUAGES.md).

Organizer integrates with [registered formatters and code action providers](packages/organizer/README.md), including Prettier, ESLint, Ruff, Black, PHP CS Fixer, Go, Rust, and clang-format. Native Format Document and Format Selection retain VS Code's formatter choice and editor undo. Import organization and supported cleanup use a reviewable diff when the provider returns safe edits.

In Restricted Mode, the Control Center offers previews and personal profiles. Workspace writes and Organizer actions initiated from the panel require Workspace Trust. Studio stores profiles and history locally and ships without extension telemetry.

## Build and verify

```sh
npm ci --ignore-scripts
npm run check
npm run test:integration
npm run package
npm run verify:vsix
```

See the [developer guide](docs/DEVELOPMENT.md) for the Linux virtual-display command and contribution workflow.

[Change log](CHANGELOG.md) · [MIT license](LICENSE)
