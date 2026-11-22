# Preparar y publicar una versión

Los cinco paquetes de esta suite usan versionado semántico. El ID de publicador que figura en los manifiestos locales es `syntaxcraft-studio`. La persona que publique debe controlar ese ID en Marketplace o adaptar el publicador, las referencias del pack y los IDs que usa Control Center antes de volver a construir los VSIX.

## Crear una release

1. Cambia la versión de la raíz y de los cinco manifiestos. Actualiza el lockfile con `npm install --package-lock-only --ignore-scripts`.
2. Actualiza el CHANGELOG y ejecuta `npm run check`, `npm run test:integration` y `npm run package`.
3. Ejecuta `npm run verify:vsix`. Publica como artefactos de la release los cinco VSIX y `SHA256SUMS.txt`. Para una release con repositorio asociado, agrega su URL HTTPS a los manifiestos.
4. Etiqueta el commit verificado como `vX.Y.Z`. GitHub Actions valida y empaca el código, y adjunta los VSIX al resultado de la ejecución.

## Visual Studio Marketplace

Para subir los archivos manualmente, inicia sesión en la página de administración del publicador y elige **New extension**. Sube Colors, Icons, Organizer y Control Center primero. Cuando sus cuatro IDs estén disponibles, sube el Extension Pack. Para actualizaciones posteriores, sube el nuevo VSIX desde el registro de cada extensión. [Administración de publicadores](https://marketplace.visualstudio.com/manage/publishers/) · [Publicación oficial](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

Para automatizar una futura publicación, configura una política de Trusted Publishing para el repositorio y el workflow, concede `id-token: write` al trabajo de publicación y publica cada VSIX con `vsce publish --oidc --packagePath <archivo.vsix>`. Solicita una nueva credencial temporal mediante el comando para cada publicación. [Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-from-github-actions-with-trusted-publishing)

## English release summary

Bump and lock all synchronized package versions. Verify tests, VSIX installation, and checksums, and tag the tested commit. Publish the four individual extensions with a Marketplace publisher you control, then publish the pack after its member IDs are available. Upload the release artifacts manually or configure Trusted Publishing for a dedicated workflow.
