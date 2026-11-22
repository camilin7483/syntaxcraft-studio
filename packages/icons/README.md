# SyntaxCraft Icons

Four original File Icon Themes for Visual Studio Code 1.100 or later. Each set pairs distinct file and folder shapes with its own palette, including versions for light and high-contrast color themes.

| File icon theme      | Artwork                                     |
| -------------------- | ------------------------------------------- |
| SyntaxCraft Minimal  | Bare glyphs and thin folder outlines        |
| SyntaxCraft Modern   | Filled folders and folded file tiles        |
| SyntaxCraft Neon     | Angular outlines and bright circuit accents |
| SyntaxCraft Colorful | Two-tone tabs, file tags, and folder badges |

## English

Install the SyntaxCraft Icons VSIX through **Extensions: Install from VSIX…** in the Command Palette. Select a style through **Preferences: File Icon Theme**. The file icon sets cover common languages, data formats, framework suffixes, Docker and infrastructure files, tests, configs, README, licenses, and Git. Named folders have their own icons, with expanded and collapsed artwork for named, generic, and workspace root folders.

The optional **SyntaxCraft Product** theme uses an original, bundled WOFF for nine workbench icons. Select it through **Preferences: Product Icon Theme**. It covers Explorer, Search, Source Control, Run and Debug, Extensions, Testing, Terminal, Settings, and Accounts. VS Code resolves the remaining icons through its default definitions. Product glyphs are monochrome and take their color from the active color theme.

Set both choices in VS Code's `settings.json` with these keys.

```json
{
  "workbench.iconTheme": "syntaxcraft-modern",
  "workbench.productIconTheme": "syntaxcraft-product"
}
```

File associations are based on VS Code's extension, exact-name, and language-ID matching. Framework icons use known names or suffixes such as `.blade.php`, `.component.ts`, and `.tsx`. An unrecognized association receives the generic file icon.

## Español

Instala el archivo VSIX de SyntaxCraft Icons desde **Extensions: Install from VSIX…** en la paleta de comandos. Elige **SyntaxCraft Minimal**, **Modern**, **Neon** o **Colorful** en **Preferences: File Icon Theme**. Los iconos abarcan lenguajes, formatos de datos, frameworks, Docker, infraestructura, pruebas, configuración, README, licencias y Git. Las carpetas con nombre reconocido, las genéricas y las raíces del espacio de trabajo tienen iconos distintos para ambos estados.

En **Preferences: Product Icon Theme**, puedes elegir **SyntaxCraft Product**. Su fuente WOFF original incluye nueve símbolos para el Explorador, Búsqueda, Control de código fuente, Ejecutar y depurar, Extensiones, Pruebas, Terminal, Configuración y Cuentas. VS Code aplica sus definiciones predeterminadas a los demás símbolos. Los iconos del producto son monocromos y toman su color del tema activo.

VS Code asocia los iconos por extensión, nombre exacto o identificador de lenguaje. Los archivos de frameworks se reconocen por nombres o sufijos como `.blade.php`, `.component.ts` y `.tsx`. Los archivos sin una coincidencia reciben el icono genérico.

## Development / Desarrollo

Edit the catalog in `scripts/catalog.mjs`, the symbols in `scripts/glyphs.mjs`, or the styles in `scripts/render.mjs`. Run `npm run build` to regenerate the SVGs and themes and `npm test` to check the associations and assets. To regenerate the bundled WOFF, install FontTools 4.63 in a Python environment and run `npm run build:product`.

Edita el catálogo en `scripts/catalog.mjs`, los símbolos en `scripts/glyphs.mjs` o los estilos en `scripts/render.mjs`. Ejecuta `npm run build` para regenerar los SVG y los temas, y `npm test` para comprobar los recursos y las asociaciones. Para regenerar la fuente WOFF incluida, instala FontTools 4.63 en un entorno Python y ejecuta `npm run build:product`.

[VS Code File Icon Theme guide](https://code.visualstudio.com/api/extension-guides/file-icon-theme) · [VS Code Product Icon Theme guide](https://code.visualstudio.com/api/extension-guides/product-icon-theme) · [VS Code Product Icon Reference](https://code.visualstudio.com/api/references/icons-in-labels)
