"""Build SyntaxCraft's original workbench glyphs. Requires FontTools for authoring."""

import json
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parents[1]
UNITS = 1024
FONT_ID = "syntaxcraft-workbench"
RELEASE_TIMESTAMP = 3850070400  # 2026-01-01 UTC in the OpenType 1904 epoch

# Original filled contours on a 24-unit design grid. Append entries to keep code points stable.
# VS Code icon IDs: https://code.visualstudio.com/api/references/icons-in-labels
GLYPHS = (
    (
        "explorer-view-icon",
        "M4 2.6h8.7l4.4 4.4v1.2H15V7.6h-3.6V4.7H6.1V17H4Z "
        "M8.5 9.6h10.9l2 2v9.7H8.5Z M10.7 11.8v7.3h8.5v-6.7l-.6-.6Z",
    ),
    (
        "search-view-icon",
        "M5.2 2.8h7.9l4.2 4.1v6.2l-1.4 1.45 5.35 5.2-1.65 1.7-5.4-5.2H5.2L2.6 13V5.5Z "
        "M6.05 5.05 4.85 6.4v5.8l1.2 1.8h6.4l2.55-2.45V7.85l-2.85-2.8Z",
    ),
    (
        "source-control-view-icon",
        "M6.3 2.7 10 6.25 7.4 8.9v3h5.05l3.1-3.15 3.9 3.9-3.9 3.9-2.65-2.7H7.4v1.1l2.65 2.65-3.75 3.8-3.75-3.8 2.65-2.65V8.9L2.6 6.25Z "
        "M6.3 5.2 5.25 6.25 6.3 7.3 7.35 6.25Z M6.3 16.55 5.25 17.6 6.3 18.65 7.35 17.6Z M15.55 11.5l-1.15 1.15 1.15 1.15 1.15-1.15Z",
    ),
    (
        "run-view-icon",
        "M4 3.5h2.3l12.25 7.35v2.3L6.3 20.5H4Z M6.3 6.2v11.6l9.75-5.8Z "
        "M18.5 4.3h2.2v3.35h-2.2Z M18.5 16.35h2.2v3.35h-2.2Z",
    ),
    (
        "extensions-view-icon",
        "M4 4.8h6.45v5.1l-1.35 1.35H3V5.8Z M4.9 6.7v2.65h3.65V6.7Z "
        "M14.8 2.55l6.05 2.9-2.85 6.1-6.05-2.9Z M15.77 5.1l-1.22 2.54 2.5 1.17 1.2-2.52Z "
        "M3 13.6h7.45v6.5l-1.05 1H3Z M4.9 15.5v3.7h3.65v-3.7Z "
        "M12.8 13.6h7.5v6.45l-1.05 1.05H12.8Z M14.7 15.5v3.7h3.7v-3.7Z",
    ),
    (
        "test-view-icon",
        "M8.3 2.8h7.4v2.15h-1.08v3.3l5.15 9.5v2.3l-1.15 1.15H5.38l-1.15-1.15v-2.3l5.15-9.5V4.95H8.3Z "
        "M11.47 4.95v3.9l-4.9 9.03v1.17h10.86v-1.17l-4.9-9.03v-3.9Z "
        "M9.75 10.82H14v1.8H9.75Z M11.1 15.15h1.8V17h-1.8Z",
    ),
    (
        "terminal-view-icon",
        "M4.2 4.3h14.5l2.55 2.55v11.6H2.75V5.75Z M5.35 6.4l-.5.45v9.5h14.3V7.75L17.8 6.4Z "
        "M6.55 8.95 7.8 7.75l4.2 3.8-4.2 3.75-1.25-1.25 2.75-2.5Z M12.7 13.7h4.5v1.65h-4.5Z",
    ),
    (
        "settings-view-bar-icon",
        "M3 5.35h4.65V3.5h4.55v1.85H21v2.25h-8.8v1.85H7.65V7.6H3Z "
        "M3 11.2h10v-1.85h4.55v1.85H21v2.25h-3.45v1.85H13v-1.85H3Z "
        "M3 17.1h3.85v-1.85h4.55v1.85H21v2.25h-9.6v1.85H6.85v-1.85H3Z",
    ),
    (
        "accounts-view-bar-icon",
        "M7.1 2.8h9.8l4.3 4.3v9.8l-4.3 4.3H7.1l-4.3-4.3V7.1Z "
        "M8.05 4.9 4.9 8.05v7.9l3.15 3.15h7.9l3.15-3.15v-7.9L15.95 4.9Z "
        "M9.95 6.6h4.1l.95.95v3.2l-.95.95h-4.1L9 10.75v-3.2Z "
        "M8.4 13.15h7.2l1.35 1.35v2.25H7.05V14.5Z",
    ),
)


def build_font_and_theme():
    # VS Code reads CSS code-point escapes and a local WOFF file.
    # https://code.visualstudio.com/api/extension-guides/product-icon-theme#product-icon-definition-file
    glyph_set = {".notdef": TTGlyphPen(None).glyph()}
    cmap = {}
    definitions = {}
    for index, (icon_id, outline) in enumerate(GLYPHS):
        codepoint = 0xE900 + index
        glyph_name = f"uni{codepoint:04X}"
        scale = UNITS / 24
        pen = TTGlyphPen(None)
        parse_path(outline, TransformPen(pen, (scale, 0, 0, -scale, 0, 896)))
        glyph_set[glyph_name] = pen.glyph()
        cmap[codepoint] = glyph_name
        definitions[icon_id] = {
            "fontCharacter": f"\\{codepoint:X}",
            "fontId": FONT_ID,
        }

    font = FontBuilder(UNITS, isTTF=True)
    font.setupGlyphOrder(list(glyph_set))
    font.setupCharacterMap(cmap)
    font.setupGlyf(glyph_set)
    font.setupHorizontalMetrics({
        name: (UNITS, getattr(glyph, "xMin", 0)) for name, glyph in glyph_set.items()
    })
    font.setupHorizontalHeader(ascent=896, descent=-128, lineGap=0)
    font.setupNameTable({
        "familyName": "SyntaxCraft Workbench",
        "styleName": "Regular",
        "uniqueFontIdentifier": "SyntaxCraft Workbench 1.0",
        "fullName": "SyntaxCraft Workbench Regular",
        "psName": "SyntaxCraftWorkbench-Regular",
        "version": "Version 1.0",
        "copyright": "Copyright © 2026 SyntaxCraft Studio",
        "licenseDescription": "MIT License",
    })
    font.setupOS2(sTypoAscender=896, sTypoDescender=-128, sTypoLineGap=0,
                  usWinAscent=896, usWinDescent=128)
    font.setupPost()
    font.font["head"].created = RELEASE_TIMESTAMP
    font.font["head"].modified = RELEASE_TIMESTAMP
    font.font.recalcTimestamp = False
    font.font.flavor = "woff"
    font_path = ROOT / "assets/product-icons/syntaxcraft-workbench.woff"
    font_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(font_path)

    theme = {
        "fonts": [{
            "id": FONT_ID,
            "src": [{"path": "../assets/product-icons/syntaxcraft-workbench.woff", "format": "woff"}],
            "weight": "normal",
            "style": "normal",
        }],
        "iconDefinitions": definitions,
    }
    theme_path = ROOT / "themes/syntaxcraft-product-icon-theme.json"
    theme_path.parent.mkdir(parents=True, exist_ok=True)
    theme_path.write_text(json.dumps(theme, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build_font_and_theme()
