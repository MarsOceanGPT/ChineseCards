# World War Mouse 🐭🎆

A 3D browser game. You are a mouse soldier fighting the invading cat army:
cat-shaped tanks with firework cannons in their mouths that deploy walking
cat troopers. Scavenge fireworks scattered across the battlefield, blast
your way through the cat lines, and storm the castle to defeat the
**CAT KING**.

## How to play

Just open `index.html` in a browser (double-click it — no server or build
step needed).

| Control | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| Mouse / trackpad | Aim camera (click on a cat to fire at it) |
| Left click / `F` | Fire a firework rocket |
| `Space` | Jump (parkour!) |
| `1` / `2` / `Q` | Switch firework type |
| `Shift` | Sprint |
| `Esc` | Pause (release mouse) |

On touch devices: virtual joystick to move, drag to aim, tap a cat to
fire at it, plus on-screen fire and jump buttons.

## Rules

- **Fireworks are ammo.** You start empty-handed. Pick up the firework
  rockets glowing around the map (they respawn), plus the firework boxes
  inside the mouse house. Blue **seeker fireworks** home in on the nearest
  cat.
- **Cat tanks** guard the way. Each one fires firework shells at you and
  periodically deploys humanoid cat soldiers. Two armored **imperial cat
  guards** with spears protect the Cat King — tough, hard-hitting, slow.
- **Protect the Mouse King!** He lives in the big mouse house at your end
  of the map, patrolled by two royal mouse guards. Cat raiders will come
  for him — if he falls, you lose.
- **Allied mice** scavenge fireworks on their own and fire them at cats.
- **Popcorn** in the house restores your HP, and HP slowly regenerates if
  you avoid damage for a few seconds.
- **Climb the ladder** on the right-front corner of the house (walk into
  it and hold a direction; jump to let go) to reach the rooftop — the
  Attic Conference of Mouse World Leaders has a gift for anyone who makes
  the climb.
- **The war escalates over three levels.** Level 1 is a skirmish against
  a cat scout patrol. Level 2 is the full armored invasion, with raiders
  hunting the Mouse King. In level 3 the CAT KING himself arrives at the
  castle with his imperial guard and an escort column.
- **Win** by destroying the Cat King (the big crowned tank) in level 3.
  Lose if your HP hits zero — or the Mouse King's does.

## Tech

Plain HTML + JavaScript with [Three.js](https://threejs.org/) (vendored in
`lib/three.min.js`, so the game works fully offline). All models are simple
primitives — boxes, cones, and cylinders — and sound effects are synthesized
with the Web Audio API, so there are no external assets.
