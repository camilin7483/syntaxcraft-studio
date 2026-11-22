# Instalar SyntaxCraft Studio 1.0.0

Requiere Visual Studio Code de escritorio 1.100 o posterior. Extrae el archivo de distribución y abre una carpeta con los VSIX.

## Desde VS Code

Ejecuta **Extensions: Install from VSIX…** desde la paleta de comandos. Instala Colors, Icons, Organizer y Control Center. Después puedes instalar Extension Pack.

## Desde la terminal

```sh
code --install-extension syntaxcraft-colors-1.0.0.vsix
code --install-extension syntaxcraft-icons-1.0.0.vsix
code --install-extension syntaxcraft-organizer-1.0.0.vsix
code --install-extension syntaxcraft-control-center-1.0.0.vsix
code --install-extension syntaxcraft-extension-pack-1.0.0.vsix
```

El pack local declara los otros cuatro IDs. Instalarlos primero permite usar los VSIX sin pedir a Marketplace que los resuelva. Si instalas un solo módulo, puedes activar sus temas o ejecutar sus comandos directamente desde la paleta.

En macOS, instala el comando `code` desde **Shell Command: Install 'code' command in PATH** o usa el método gráfico. [CLI oficial de VS Code](https://code.visualstudio.com/docs/configure/command-line)

## Primer uso

1. Ejecuta **SyntaxCraft: Open Control Center**.
2. Abre **Temas** o **Estudio de color**, ajusta el borrador y pulsa **Aplicar ajustes**.
3. Usa **Usuario** para tu perfil de VS Code o **Proyecto** para el espacio de trabajo de confianza abierto.
4. Guarda o exporta el borrador desde **Perfiles**. Usa **Ajustes** para recuperar los valores anteriores.

Si necesitas desinstalar, restaura primero las preferencias administradas por Studio desde **Ajustes**. En un proyecto con varios ajustes de lenguaje, las reglas del editor definidas por carpeta o por lenguaje pueden tener precedencia según VS Code. [Ámbitos de configuración](https://code.visualstudio.com/docs/configure/settings)

## English quick start

Extract the release archive. Install the first four VSIX files above and then the optional pack. Run **SyntaxCraft: Open Control Center**. Select **Usuario** for User scope or **Proyecto** for the open, trusted workspace. **Aplicar ajustes** previews the scope and asks for confirmation. Export profiles from **Perfiles** and restore earlier settings from **Ajustes** before uninstalling.
