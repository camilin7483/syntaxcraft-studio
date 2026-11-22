import { fileGlyphs, folderGlyphs } from './glyphs.mjs';

// Ink for dark editors, ink for light editors, and a contrasting accent for Colorful.
const palette = {
  slate: ['#aab9cf', '#4d5b72', '#d3b8fe'],
  blue: ['#8fb5ff', '#315cb0', '#c3e98f'],
  cyan: ['#66d9ef', '#176e86', '#ffb79a'],
  teal: ['#67d8cb', '#176c69', '#edb1ff'],
  green: ['#75dcac', '#1c6e53', '#f1db8e'],
  lime: ['#bbdf87', '#536d25', '#acbaff'],
  amber: ['#efcd76', '#775917', '#a8c2ff'],
  orange: ['#f9af82', '#974b27', '#e8b1fa'],
  coral: ['#f59c99', '#a3424b', '#a4e5d6'],
  pink: ['#f7a8d6', '#9b4182', '#ffd794'],
  violet: ['#bda9ff', '#6550a8', '#94e9df'],
};

function mix(color, tint, ratio) {
  const channels = color.slice(1).match(/../g);
  const tintChannels = tint.slice(1).match(/../g);
  return (
    '#' +
    channels
      .map((channel, index) => {
        const value = Number.parseInt(channel, 16);
        const target = Number.parseInt(tintChannels[index], 16);
        return Math.round(value + (target - value) * ratio)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

function path(d, fill, stroke = 'none', weight = 1) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function glyph(markup, ink, weight, transform) {
  if (!markup) {
    throw new Error(`Missing glyph for ${transform}`);
  }
  return `<g transform="${transform}" fill="${ink}" stroke="${ink}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round">${markup}</g>`;
}

function colors(tone, scheme) {
  const [darkEditor, lightEditor, secondary] = palette[tone];
  const light = scheme === 'light';
  const highContrast = scheme === 'high-contrast';
  const ink = light ? lightEditor : darkEditor;
  const paper = light ? '#ffffff' : '#171d30';
  return { darkEditor, lightEditor, secondary, ink, paper, highContrast, light };
}

const textLines = '<path d="M3 6.25h9.9M3 9.65h7.3M3 13.05h8.95" fill="none"/>';

const drawFile = {
  minimal(id, color) {
    const plate = color.highContrast
      ? path('M4.8 2.5h14.4L22 5.3v13.4l-2.8 2.8H4.8L2 18.7V5.3z', '#202638', '#ffffff', 0.9)
      : '';
    return plate + glyph(fileGlyphs[id], color.ink, 1.65, 'translate(1.6 1.6) scale(1.3)');
  },
  modern(id, color) {
    const paperShape =
      'M6 2.45h8.45l5.65 5.65v11.65a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4.45a2 2 0 0 1 2-2Z';
    const fill = mix(color.ink, color.paper, color.light ? 0.02 : 0.09);
    const ink = color.light ? '#ffffff' : '#151d2b';
    const fold = color.light ? mix(fill, '#ffffff', 0.36) : mix(fill, '#1e283f', 0.29);
    const mark = id === 'file' ? textLines : fileGlyphs[id];
    return (
      path(paperShape, fill, color.highContrast ? '#171d30' : 'none', 1.45) +
      path('M14.4 2.65v3.75q0 1.5 1.5 1.5h4z', fold) +
      glyph(mark, ink, 1.72, 'translate(4.4 5.3) scale(.95)')
    );
  },
  neon(id, color) {
    const frame = 'M7 2.55h12.95l1.65 1.65v12.95l-4.3 4.3H4.05L2.4 19.8V6.85z';
    const trace = 'M2.4 8.7V6.85L7 2.55h4.25m10.35 12.75v1.85l-4.3 4.3h-4.4';
    const circuitInk = color.light
      ? mix(color.ink, '#171d30', 0.05)
      : mix(color.ink, '#ffffff', 0.23);
    const fill = mix(color.ink, color.paper, color.highContrast ? 0.88 : 0.91);
    const edge = color.highContrast ? '#ffffff' : mix(circuitInk, color.paper, 0.58);
    return (
      path(frame, fill, edge, color.highContrast ? 1.15 : 0.95) +
      path(trace, 'none', circuitInk, 1.65) +
      glyph(fileGlyphs[id], circuitInk, 1.56, 'translate(3.05 3.2) scale(1.10)')
    );
  },
  colorful(id, color) {
    const piece =
      'M3.6 6.7 7.8 2.5h10.45a2 2 0 0 1 2 2v14.8a2 2 0 0 1-2 2H5.25a1.65 1.65 0 0 1-1.65-1.65z';
    const chip = 'M15.2 14.85h5.7a1.3 1.3 0 0 1 1.3 1.3v3.2l-2.47 2.47h-4.53z';
    const base = mix(color.darkEditor, '#ffffff', color.light ? 0.14 : 0.04);
    const edge = color.light ? mix(color.lightEditor, color.paper, 0.22) : '#101a2c';
    const mark = id === 'file' ? textLines : fileGlyphs[id];
    return (
      path(piece, base, edge, color.highContrast ? 1.55 : 1.07) +
      path('M3.9 6.9H8V2.8z', color.secondary) +
      path(chip, color.secondary, edge, 0.95) +
      path('M17.3 18.35h2.2', 'none', '#22273a', 1.2) +
      glyph(mark, '#1a2337', 1.85, 'translate(3.4 3.62) scale(.96)')
    );
  },
};

const outlineClosed = 'M3.1 6.1h6.5l2.1 2.2h9.15l.05 11.25H3.1z';
const outlineOpenBack = 'M3.1 19.55V5.05h6.5l2.1 2.2h7.95v4.2';
const outlineOpenFront = 'M3.1 19.55l2.6-9.55h15.95l-1.95 9.55z';
const modernClosed =
  'M3.3 5.45h6.5l2.05 2.2h7.4c1.05 0 1.7.55 1.7 1.55v9.15c0 .95-.65 1.6-1.6 1.6H4.65c-1.1 0-1.75-.65-1.75-1.65V6.95c0-.92.4-1.5.4-1.5z';
const modernOpenBack =
  'M4.55 4.4H9.7l2.05 2.2h7.85c.75 0 1.1.45 1.1 1.15v8H2.9V6.2c0-1 .6-1.8 1.65-1.8z';
const modernOpenFront =
  'M3 18.35 4.8 10.8c.18-.7.57-.98 1.3-.98h14.8c.83 0 1.2.6 1.04 1.3l-1.83 7.45c-.25.91-.73 1.3-1.65 1.3H4.23c-.9 0-1.42-.56-1.23-1.52z';
const neonClosed = 'M2.45 7.25 4.55 5.15H10l2.25 2.28h7.34l1.96 1.92v8.48l-2.1 2.1h-15l-2-2z';
const neonOpenBack = 'M2.45 17.8V5.8l2-2H9.7L12 6.1h7.65l1.4 1.4v3.4';
const neonOpenFront = 'M2.45 17.75 5.25 10h17l-2.1 8.1-1.7 1.8H4.38z';
const colorfulClosed = 'M2.9 7.75h8.15l2.3 2H21v8.6q0 1.5-1.5 1.5H4.35q-1.45 0-1.45-1.55z';
const colorfulOpenFront =
  'M3.3 18.5 5.45 10h15.6q1.05 0 .9 1.05l-1.83 7.37q-.3 1.43-1.83 1.43H4.42q-1.32 0-1.12-1.35z';

const drawFolder = {
  minimal(mark, open, color) {
    const fill = color.highContrast ? '#202638' : 'none';
    const shape = open
      ? path(outlineOpenBack, fill, color.ink, 1.6) + path(outlineOpenFront, fill, color.ink, 1.6)
      : path(outlineClosed, fill, color.ink, 1.6);
    return (
      shape +
      (mark ? glyph(folderGlyphs[mark], color.ink, 1.55, 'translate(8.55 10.05) scale(.79)') : '')
    );
  },
  modern(mark, open, color) {
    const fill = mix(color.ink, color.paper, color.light ? 0.03 : 0.09);
    const accent = color.light ? mix(fill, '#ffffff', 0.5) : mix(fill, '#171d30', 0.27);
    const edge = color.highContrast ? '#171d30' : 'none';
    const ink = color.light ? '#ffffff' : '#171e2d';
    const shape = open
      ? path(modernOpenBack, accent, edge, 1.25) + path(modernOpenFront, fill, edge, 1.25)
      : path(modernClosed, fill, edge, 1.25) + path('M3.6 8.55h8.85l1.2 1.35H3.6z', accent);
    return (
      shape + (mark ? glyph(folderGlyphs[mark], ink, 1.65, 'translate(8.15 10.35) scale(.82)') : '')
    );
  },
  neon(mark, open, color) {
    const ink = color.light ? mix(color.ink, '#171d30', 0.05) : mix(color.ink, '#ffffff', 0.22);
    const fill = mix(color.ink, color.paper, 0.91);
    const dim = color.highContrast ? '#ffffff' : mix(ink, color.paper, 0.34);
    const shape = open
      ? path(neonOpenBack, fill, dim, 1.2) + path(neonOpenFront, fill, ink, 1.25)
      : path(neonClosed, fill, dim, 1.2) +
        path('M2.45 10V7.25l2.1-2.1H8m13.55 9.65v3.03l-2.1 2.1h-3.2', 'none', ink, 1.72);
    return (
      shape + (mark ? glyph(folderGlyphs[mark], ink, 1.65, 'translate(8.5 10.05) scale(.83)') : '')
    );
  },
  colorful(mark, open, color) {
    const base = mix(color.darkEditor, '#ffffff', color.light ? 0.14 : 0.03);
    const edge = color.light ? mix(color.lightEditor, color.paper, 0.22) : '#101a2c';
    const back = 'M3.75 4.25h6.4l2 2.05h6.25q1.45 0 1.45 1.4v9.1H2.9V5.9q0-1.65.85-1.65z';
    const ticket = 'M16.8 12.05h5.35v5.3l-1.75 1.75h-3.6z';
    return (
      path(back, color.secondary, edge, 1.07) +
      path(
        open ? colorfulOpenFront : colorfulClosed,
        base,
        edge,
        color.highContrast ? 1.55 : 1.07,
      ) +
      path(ticket, color.secondary, edge, 0.95) +
      path('M18.35 15.05h2.2', 'none', '#22273a', 1.2) +
      (mark ? glyph(folderGlyphs[mark], '#192336', 1.66, 'translate(6.55 10.22) scale(.86)') : '')
    );
  },
};

export function renderFile(id, tone, style, scheme) {
  return svg(drawFile[style](id, colors(tone, scheme)));
}

export function renderFolder(mark, open, tone, style, scheme) {
  return svg(drawFolder[style](mark, open, colors(tone, scheme)));
}

function svg(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${content}</svg>\n`;
}
