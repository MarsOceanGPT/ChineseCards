# Cellsea

A browser game about building an eyeless creature out of hexagonal cells and
surviving in an expanse with no edges. Open `index.html` — no build step, no
dependencies, no server needed.

## The idea

You don't pick a species, you assemble one. Every creature in the sea — yours
included — is a rigid body made of hexagonal cells roughly the size of a
fingernail, laid out on an axial hex grid. What you bolt on decides how fast
you swim, how hard you turn, what you can kill, and what kills you.

## The five cells

| Cell | Cost | Mass | Hits to kill | What it does |
| --- | --- | --- | --- | --- |
| **Heart** | 10 | 1.4 | 2 | Lose every one and you dissolve. |
| **Normal** | 3 | 1.0 | 1 | Muscle. Your flagella can only pull as hard as the flesh behind them. |
| **Armour** | 8 | 3.0 | 3 | A harder, whiter normal cell. Tough, but heavy enough to slow you down. |
| **Spike** | 7 | 1.5 | 2 | Shears off the single cell its point is touching. Clacks harmlessly off other spikes. |
| **Flagellum** | 6 | 0.8 | 1 | Pushes *away from itself*. At the back it drives you forward; at the front it drives you backward. |

Spikes and flagella attach to whichever side of the body you put them on: each
one orients itself along the average direction of its empty neighbouring slots,
so a spike on your flank points outward from your flank.

## Controls

| Input | Action |
| --- | --- |
| `W` / left click | Beat your flagella |
| `S` | Back-paddle |
| `A` / `D` | Turn |
| Mouse | Steers when the turn keys are idle |
| `E` | Open and close the cell bench (also works while dissolved) |

## Rules that matter

**Biomass.** Every cell costs biomass and you have a limit. Too much armour, too
many spikes, or simply too big a body and you can't add anything else. Eating
raises the ceiling; dying costs you a quarter of what you've banked.

**Muscle is a fraction, not a count.** Speed depends on what share of your mass
is normal cells, and every body pays some drag just for being in the water. That
means shedding cells never buys you speed — get your normal cells chewed off and
you are genuinely crippled, exactly the walking target you'd expect. An
all-armour body tops out at about a fifth of a healthy swimmer's speed.

**Spikes take one cell at a time.** A spike destroys the cell its tip touches,
not the creature. Spike-on-spike does no damage — but a spike is not a shield
either: if the tip can still reach a soft cell, that cell is what comes off.
Without that exception two spiked creatures deadlock at tip-to-tip range and
neither can ever land a hit.

**Bodies fall apart.** When a cell dies, anything no longer joined to a heart
drifts away as debris. Punch a hole in a spikeball's shell, chew the armour
behind it, and the whole crust sloughs off the heart at once.

**Symmetry.** The bench mirrors across your forward axis. A mirrored pair is
placed atomically — if the pair doesn't fit the biomass budget, neither cell
lands, because half a symmetric pair is worse than none.

## What lives out there

- **Drifter** — one tail, no weapons. The bottom of the food chain.
- **Grazer** — bigger and faster, but it tires when it runs.
- **Swimmer** — spiked face, flagella behind, comes at you.
- **Hunter** — an armoured swimmer with a longer reach.
- **Spikeball** — a slowly tumbling fortress. It can barely chase you, and a
  light build cannot crack it. Its shell alternates spikes with soft cells;
  the soft radials are the only way in.

Hostiles lunge and then peel away to line up again. That recovery is when their
flank is open — a hunter that simply tracked you would keep its spiked face
pointed at you forever and there would be no way to fight it.

Prey sprint and then tire. Chase a grazer long enough and it slows down.

## Roughly how the food chain plays out

Averaged over repeated 45-second duels while ramming head-on (the worst possible
tactic, so treat these as a floor):

| Your build | Drifter | Grazer | Swimmer | Hunter | Spikeball |
| --- | --- | --- | --- | --- | --- |
| Starter (no spikes) | — | — | you die | you die | you die |
| 3 nose spikes | kill ~7s | wounds it | kill ~24s | 3 of 5 | wounds it |
| Armoured, 5 spikes | kill ~7s | kill ~13s | kill ~12s | 2 of 5 | 2 of 5 |

The starter body cannot kill anything. That's deliberate — the first thing the
game asks you to do is go to the bench and decide what kind of animal you want
to be.

## Implementation notes

Single file, plain canvas 2D and JavaScript. Cells live on axial `(q, r)`
coordinates; mirroring across the forward axis is `(q, r) → (q + r, −r)`.
Physics runs on fixed sub-steps so collisions stay stable at any framerate,
while spawning, culling and the camera run once per frame. Your blueprint and
nutrient count are saved to `localStorage`.
