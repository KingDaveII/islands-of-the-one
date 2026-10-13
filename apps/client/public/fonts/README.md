# Fonts

Self-hosted pixel faces, both under the SIL Open Font License 1.1 (license texts next to the files):

| File | Family | Use | Source |
| --- | --- | --- | --- |
| `Silkscreen-Regular.woff2` | Silkscreen (The Silkscreen Project Authors) | labels and numbers | Google Fonts, Latin subset |
| `Tiny5-Regular.woff2` | Tiny5 (The Tiny5 Project Authors) | sentences, stats, lore | Google Fonts, Latin subset |

The game does not draw text with these files directly any more: `tools/bitmap-fonts.py` converts
them into the pixel atlases in `packages/shared/assets/fonts` (8 px, no antialiasing), which the
client scales by whole numbers for 16 and 24 px. The woff2 files stay here as the generator's
sources and for the DOM dev panels (F2 tuning, F3 overlay), which use the browser's own text.
