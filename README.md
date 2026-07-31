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
| Mouse | Aim camera |
| Left click | Fire a firework rocket |
| `Shift` | Sprint |
| `Esc` | Pause (release mouse) |

## Rules

- **Fireworks are ammo.** You start empty-handed. Pick up the firework
  rockets glowing around the map (+4 rockets each) and find more when you
  run out.
- **Cat tanks** guard the way. Each one fires firework shells at you and
  periodically deploys humanoid cat soldiers that chase and scratch you.
- **You have a health bar.** Stay out of blast range; HP slowly regenerates
  if you avoid damage for a few seconds.
- **Win** by reaching the castle at the far end of the battlefield and
  destroying the Cat King (the big crowned tank). Lose if your HP hits zero.

## Tech

Plain HTML + JavaScript with [Three.js](https://threejs.org/) (vendored in
`lib/three.min.js`, so the game works fully offline). All models are simple
primitives — boxes, cones, and cylinders — and sound effects are synthesized
with the Web Audio API, so there are no external assets.
