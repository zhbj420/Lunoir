// Drives the acrylic panel scrim from the frostStrength setting, live, in every
// window (main / OSC / panels / menu). Imported for its side effects by main.tsx
// so it runs once per window — like useT. No React; it just writes CSS variables.
//
// The scrim (--panel) does double duty: it sets how frosted the panels look AND
// backs the text so it stays legible over bright video. So the slider is not raw
// alpha — it maps 0..100 into a hand-picked safe range where both ends still read,
// and it drives BOTH the active and inactive scrim (Win11 lightens the acrylic when
// the app is inactive, so the inactive scrim stays a touch heavier to compensate).

const R = 24
const G = 24
const B = 27

// slider 0..100 → active-state scrim alpha, INVERTED: right = more frost. So a
// higher slider value = LOWER alpha = more see-through. Range chosen so the solid
// end (0) isn't a flat wall and the glassiest end (100) is as transparent as still
// stays legible over a bright scene.
const ALPHA_SOLID = 0.68 // slider 0
const ALPHA_GLASS = 0.12 // slider 100
const INACTIVE_BUMP = 0.1 // heavier when the app isn't focused (see above)

export const FROST_DEFAULT = 50 // ≈ alpha 0.40 — the look before this setting existed
// (recompute this whenever an endpoint moves: v = (0.40 - SOLID) / (GLASS - SOLID))

function apply(strength: number): void {
  const v = Math.max(0, Math.min(100, strength)) / 100
  const active = ALPHA_SOLID + v * (ALPHA_GLASS - ALPHA_SOLID)
  const inactive = Math.min(0.85, active + INACTIVE_BUMP)
  const el = document.documentElement
  el.style.setProperty('--panel', `rgba(${R}, ${G}, ${B}, ${active.toFixed(3)})`)
  el.style.setProperty('--panel-inactive', `rgba(${R}, ${G}, ${B}, ${inactive.toFixed(3)})`)
}

window.mmp.getSettings().then(s => apply(s.frostStrength ?? FROST_DEFAULT))
window.mmp.onSettingsChanged(s => apply(s.frostStrength ?? FROST_DEFAULT))
