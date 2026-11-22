# SyntaxCraft Colors

Ten original color themes for VS Code with coordinated editor, workbench, terminal, Git, and diff colors. Open **Preferences: Color Theme** and search for **SyntaxCraft**.

| Theme             | Palette                                                  |
| ----------------- | -------------------------------------------------------- |
| Midnight Pro      | Blue-black, cyan, and lavender                           |
| Neon Cyber        | Violet-black with bright teal and pink                   |
| Arctic Light      | Cool paper with deep blue accents                        |
| OLED Black        | Pure-black editor with cool highlights                   |
| Forest Developer  | Moss green, mint, and amber                              |
| Crimson Dark      | Burgundy with rose and peach                             |
| Pastel Coding     | Soft mauve surfaces, dark syntax colors                  |
| High Contrast Pro | Bright code colors and distinct focus borders            |
| Monochrome        | Grayscale with emphasis through font weight and contrast |
| Custom Studio     | Charcoal and warm amber                                  |

Use **SyntaxCraft Control Center** to save all-language and per-language token colors and styles, or edit VS Code’s native theme settings. For example, this `settings.json` fragment makes Python comments italic and gives TypeScript method names a light blue foreground in Custom Studio. [VS Code color theme guide](https://code.visualstudio.com/api/extension-guides/color-theme)

```json
{
  "workbench.colorTheme": "SyntaxCraft Custom Studio",
  "editor.tokenColorCustomizations": {
    "[SyntaxCraft Custom Studio]": {
      "textMateRules": [
        {
          "scope": "source.python comment",
          "settings": { "foreground": "#A6ACB8", "fontStyle": "italic" }
        }
      ]
    }
  },
  "editor.semanticTokenColorCustomizations": {
    "[SyntaxCraft Custom Studio]": {
      "enabled": true,
      "rules": {
        "method:typescript": { "foreground": "#B8CDF0", "bold": true }
      }
    }
  }
}
```

## Español

Diez temas originales para el editor, la interfaz, la terminal, Git y las diferencias de archivos. Abre **Preferencias: Tema de color** y busca **SyntaxCraft**.

Usa **SyntaxCraft Control Center** para guardar colores y estilos de tokens globales y por lenguaje. En el ejemplo anterior, los comentarios de Python aparecen en cursiva y los métodos de TypeScript aparecen en azul claro al usar **SyntaxCraft Custom Studio**. Puedes revisar los tokens que recibe el editor mediante **Developer: Inspect Editor Tokens and Scopes**. [Guía de resaltado de VS Code](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)

Los tokens disponibles dependen de la gramática activa y del proveedor semántico. Consulta las compatibilidades y sus fuentes en [Languages](./LANGUAGES.md).
