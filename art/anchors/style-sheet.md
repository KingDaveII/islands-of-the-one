# Style sheet: 32×48 sprites (ART, G1.3b anchors, 2026-10-15)

The visual rules every generated asset is judged against. Exemplars in this folder: `kindled-ash-s-64.png` (the player), `husk-peeling-64.png` (an enemy), `prop-clay-jar-64.png` (a prop); `icon-ref-hookblade-32.png` and `icon-ref-lock-32.png` (two 16 px design-system icons shown at 2×); `palette-28.png` is the colour whitelist as a 28×1 strip; `style-sheet.png` is this page as a picture.

## Canvas and proportions
- Characters: a 32×48 body box on a **64×64** canvas, centred, **soles on row 53**. Enemies and props rest on row 53 too.
- About 3 heads tall. Kindled: 40 px from sole to hood. Scattered folk: 42–44 px. Enemies: 24–40 px bodies. Props: 12–32 px.
- Width at most 30 px without weapons. Front views are symmetric except the weapon hand.

## Colour
- Only the 28 whitelist colours below. Never #FFFFFF (hit flash), #E0457B / #8E2550 (telegraph frames only), #FFE7A3 (perfect dodge).
- At most 12 colours per character.

| Material | Light → dark |
|---|---|
| Outline, player only | dream-night #1C2147 |
| Outline, everyone else | hollow-deep #2A2540 |
| Clay skin (grey-ochre) + freckles | unwritten-sail #8C7F6E, unwritten-tar #5E5448; freckles spark-amber #F2B65A |
| Soot cloth | watcher-stone #7D8794, watcher-iron #4A4E57, hollow-deep #2A2540 |
| Ember singe | choir-flame #F07A3A, spark-ember #C9733A, unwritten-tar #5E5448 |
| Fired red clay | sleeper-soil #E3C29E, sleeper-flesh #C98F78, sleeper-ochre #9C5B4A |
| Brass and gold | choir-gold #D8B24A, wheel-brass #C79A3E, wheel-brass-dark #8A6420 |
| Bronze, wood, rope | watcher-bronze #A8743A, unwritten-sail #8C7F6E, unwritten-tar #5E5448 |
| Pale shell (Husks) + core | hollow-light #F4EFE6, husk-shell #E8E2D6, hollow-dusk #A99FC4; core husk-core #FFF4C7 with a 1 px hollow-deep ring |
| Stone, floor, wall | hollow-lavender #D9D2E9, hollow-dusk #A99FC4, hollow-below #5B5478, hollow-deep #2A2540 |
| Water, patina, rain | wheel-patina #2F7F7A, watcher-rain #3E5C7A, sleeper-night #24305A |
| Paper, eye-white, night | choir-paper #FBF8F0, wheel-eye #E9E4D4, dream-night #1C2147 |
| Flame (Choirs, fire) | choir-flame #F07A3A, choir-flame-deep #B5402E |

Whitelist (28): #F4EFE6 #D9D2E9 #A99FC4 #5B5478 #2A2540 #F2B65A #C9733A #4A4E57 #7D8794 #3E5C7A #A8743A #C79A3E #8A6420 #E9E4D4 #2F7F7A #C98F78 #9C5B4A #E3C29E #24305A #E8E2D6 #FFF4C7 #8C7F6E #5E5448 #FBF8F0 #D8B24A #F07A3A #B5402E #1C2147

## Drawing
- Light from the top left. 2–3 steps per material (light, base, shade).
- 1 px outline all round: dream-night for the player only, hollow-deep for everyone else. Lines inside a figure use the material's shade, not the outline colour (except to part limbs).
- No dither on characters, enemies or props (only on big floor tiles). No anti-aliasing, no soft or semi-transparent pixels, no pure white or black, no glow.
- Transparent background. No baked shadow: the engine draws the grounding shadow.
- No letters, numbers or text on anything.
- Kindled are clay folk: two eyes of 1×2 px, 3 amber freckles, a mouth at most 2 px of shade, skin in the clay ramp. The Hookblade (a short blade with a hook at the tip) sits in the right hand.
- Husks are hollow shells: pale shell ramp, one bright core with its ring, no face, eyes or legs.
- Silhouette first: everything must read as a flat shape at 1×.
- Icons: 16×16, 1 px dream-night outline, the same ramps, one clear shape filling about 12–14 px. Generated at 32 px, they are reduced to 16 and snapped.
