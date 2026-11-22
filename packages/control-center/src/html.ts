export interface WebAssets {
  cspSource: string;
  script: string;
  stylesheet: string;
  icons: string;
  section: string;
  nonce: string;
}

function escapeAttribute(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
  };
  return value.replace(/[&"'<>]/g, (character) => entities[character] ?? '');
}

export function webviewHtml(assets: WebAssets): string {
  const policy = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "connect-src 'none'",
    `img-src ${assets.cspSource}`,
    `style-src ${assets.cspSource}`,
    `script-src 'nonce-${assets.nonce}'`,
  ].join('; ');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SyntaxCraft Studio</title>
  <link rel="stylesheet" href="${escapeAttribute(assets.stylesheet)}">
</head>
<body>
  <div id="studio" data-icons="${escapeAttribute(assets.icons)}" data-section="${escapeAttribute(assets.section)}"></div>
  <script nonce="${escapeAttribute(assets.nonce)}" src="${escapeAttribute(assets.script)}" defer></script>
</body>
</html>`;
}
