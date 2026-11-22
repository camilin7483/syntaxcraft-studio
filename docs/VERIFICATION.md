# Verificación de la release 1.0.0

Las comprobaciones locales se ejecutaron en Linux con Node.js 26 y el host oficial de Visual Studio Code 1.100.3.

| Comprobación               | Resultado                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run check`            | Compilación, TypeScript estricto, ESLint, Prettier y 23 pruebas unitarias.                    |
| `npm run test:integration` | Temas e iconos, activación diferida, ajustes nativos, restauración y proveedores reales.      |
| Webview en VS Code         | Las nueve secciones, carga de recursos, color RGB por lenguaje, comparación y guardar perfil. |
| Temas e iconos             | 16 aserciones con el tokenizador TextMate oficial y cuatro estilos de explorador comprobados. |
| `npm run verify:vsix`      | Comprobación de SHA-256 e instalación de los cinco VSIX en un entorno limpio.                 |
| `npm audit`                | Cero vulnerabilidades reportadas para el lockfile durante la verificación local.              |

En una medición, el registro de Control Center tomó 0,36 ms y abrirlo desde su comando tomó 86,97 ms. La variación observada del heap al registrar la extensión fue de 8.744 bytes en un proceso de host compartido de unos 34,4 MiB. La prueba abrió un documento de 60.001 líneas y la consulta del Organizador tardó 1,03 ms una vez cargado. Las mediciones son observaciones de una ejecución local.

Las pruebas de integración usan los proveedores integrados de JSON y TypeScript/JavaScript y un proveedor de prueba para comprobar selección, conflictos y aislamiento de ediciones. Las dependencias opcionales se revisaron mediante su documentación y código fuente. Su instalación y ejecución depende de cada proyecto. [Catálogo de resaltado](../packages/colors/LANGUAGES.md) · [Matriz de formateadores](../packages/organizer/README.md)
