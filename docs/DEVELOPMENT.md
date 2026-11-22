# Desarrollo de SyntaxCraft Studio

## Arquitectura

| Ruta                      | Responsabilidad                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `packages/colors`         | Temas declarativos, paletas y compilador TypeScript puro de selectores nativos.         |
| `packages/icons`          | Temas declarativos de archivos y producto, SVG, fuente WOFF y generadores.              |
| `packages/organizer`      | Comandos del host, disponibilidad de proveedores, vista diff y aplicación de ediciones. |
| `packages/control-center` | Webview, protocolo tipado, persistencia, perfiles y transacciones de ajustes.           |
| `packages/extension-pack` | Manifiesto opcional sin código ejecutable.                                              |

Control Center incorpora el compilador puro de Colors durante la compilación y copia una muestra local de SVG de Icons. Las acciones del Organizador se invocan por IDs de comando explícitos. Los cuatro módulos se pueden instalar de forma independiente.

Los puntos de entrada para el host se empaquetan con esbuild. TypeScript comprueba tipos estrictos contra la API pública de VS Code 1.100. La interfaz usa el DOM con texto escapado y salidas de color validadas. El Webview restringe recursos a `dist/web` y usa CSP, nonce de script y un protocolo cerrado de acciones. El importador acepta JSON UTF-8 de hasta 1 MiB, comprueba la versión y valida cada clave. El formato nunca convierte valores importados en comandos, rutas ni procesos.

## Construir y probar

Instala Node.js 22.13 o posterior y npm. Compila con npm workspaces.

```sh
npm ci --ignore-scripts
npm run check
npm run test:integration
npm run package
npm run verify:vsix
```

La integración usa el host oficial de `@vscode/test-electron` con un perfil aislado de VS Code 1.100.3. `SYNTAXCRAFT_VSCODE_VERSION` permite elegir otra versión. `SYNTAXCRAFT_VSCODE_EXECUTABLE` apunta a un ejecutable ya instalado. Para Linux sin ventana visible:

```sh
env -u WAYLAND_DISPLAY -u WAYLAND_SOCKET -u ELECTRON_OZONE_PLATFORM_HINT XDG_SESSION_TYPE=x11 \
  xvfb-run -a npm run test:integration
```

El lanzador **SyntaxCraft Studio** de `.vscode/launch.json` inicia un Extension Development Host con los cinco módulos. Ejecuta primero `npm run build`. La compilación escribe archivos de salida en `dist` y copia el icono PNG compartido a cada paquete. La función de VS Code **Developer: Inspect Editor Tokens and Scopes** permite verificar qué selectores reconoce un lenguaje. [Pruebas de extensiones](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

## Ajustes, capas y recuperación

- Las reglas semánticas usan `tipo.modificador:lenguaje`. Las reglas TextMate se anclan al ámbito de la gramática cuando VS Code lo expone. Cuando dos modos comparten un ámbito raíz, una regla léxica puede afectar ambos modos.
- Studio escribe únicamente las claves nativas que utiliza el perfil y serializa las operaciones dentro de su host. Guarda un registro antes de cada actualización para recuperación si la operación se interrumpe. VS Code expone actualizaciones por clave y no una transacción nativa para múltiples ajustes.
- Para revertir, Studio compara los valores que escribió con los actuales. Conserva campos editados externamente cuando detecta diferencias. Si un perfil añade un array TextMate a Proyecto que antes heredaba reglas de Usuario, copia las reglas heredadas presentes en ese momento para preservarlas. Los cambios posteriores al array de Usuario se vuelven a heredar al restaurar el ámbito de Proyecto.
- La selección automática de tema de VS Code, reglas con selectores más específicos y ajustes por lenguaje pueden tener precedencia. La vista del panel usa una muestra anotada. Abre la muestra en el editor para comprobar el resultado del proveedor en tiempo real.
- Cada ámbito mantiene hasta 12 aplicaciones. Los perfiles guardados viven en el almacenamiento de la extensión del perfil de VS Code y se pueden trasladar por JSON. El esquema de perfil admite el conjunto de ajustes y colores ofrecidos por el panel.
- Las claves y los IDs de los lenguajes se amplían en el registro de Colors. Para cambios en temas usa `packages/colors/scripts/palettes.mjs`. Para iconos usa los generadores de Icons. La fuente WOFF ya está incluida.

## Rendimiento

Colors, Icons y Extension Pack aportan manifiestos declarativos. Control Center carga su Webview al ejecutar un comando. Organizer consulta el documento y los proveedores a demanda. La integración comprueba registro diferido, medición de heap del host y consulta del Organizador en un documento de 60.001 líneas. La medición de heap incluye las demás extensiones del mismo host.

[Semantic Highlight Guide](https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide) · [TextMate](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide) · [Webview](https://code.visualstudio.com/api/extension-guides/webview) · [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust)

## English contributor notes

Run `npm run check` before integration and packaging. The five packages share a lockfile and version. Local runtime packages have no npm dependencies. Start from the capability definitions in Colors, Formatter status and edit planning in Organizer, or the explicit message schema in Control Center. Keep generated theme JSON, passive SVGs, the original WOFF, and their source generators aligned.
