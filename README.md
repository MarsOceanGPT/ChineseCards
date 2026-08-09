# Cellsea

A browser game about building an eyeless creature out of hexagonal cells and
surviving in an expanse with no edges. Open `index.html` — no build step, no
dependencies, no server needed.

## The idea

You don't pick a species, you assemble one. Every creature in the sea — yours
included — is a rigid body made of hexagonal cells roughly the size of a
fingernail, laid out on an axial hex grid. What you bolt on decides how fast
you swim, how hard you turn, what you can kill, and what kills you.

## The eight cells

| Cell | Cost | Mass | Hits to kill | What it does |
| --- | --- | --- | --- | --- |
| **Heart** | 10 | 1.4 | 2 | Lose every one and you dissolve. |
| **Normal** | 3 | 1.0 | 1 | Muscle. Your flagella can only pull as hard as the flesh behind them. |
| **Armour** | 8 | 3.0 | 3 | A harder, whiter normal cell. Tough, but heavy enough to slow you down. |
| **Spike** | 7 | 1.5 | 2 | Shears off the single cell its point is touching. Clacks harmlessly off other spikes. |
| **Flagellum** | 6 | 0.8 | 1 | Pushes *away from itself*. At the back it drives you forward; at the front it drives you backward. Bury it and it stops. |
| **Angry neuron** | 9 | 1.2 | 2 | Dead weight while attached. Once its piece is cut loose, that piece hunts on its own. |
| **Detach** | 4 | 0.6 | 1 | A seam. The DETACH button burns it out and frees whatever it was holding on. |
| **Exploding** | 8 | 1.3 | 1 | Bursts when anything living touches it — or when anything kills it. |

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
| `Q` / DETACH | Burn one detach seam, outermost first |

On a phone, one finger does everything — hold to swim, drag to steer — and the
BENCH and DETACH buttons replace the keys.

## Rules that matter

**Biomass.** Every cell costs biomass and you have a limit. Too much armour, too
many spikes, or simply too big a body and you can't add anything else. Eating
raises the ceiling; dying costs you a quarter of what you've banked.

**Muscle is a fraction, not a count.** Speed depends on what share of your mass
is normal cells, and every body pays some drag just for being in the water. That
means shedding cells never buys you speed — get your normal cells chewed off and
you are genuinely crippled, exactly the walking target you'd expect. An
all-armour body tops out at about a fifth of a healthy swimmer's speed.

**A buried tail pushes nothing.** A flagellum needs open water behind it. Wall
one in with your own cells and it still costs mass and biomass, but produces no
thrust at all. This is what stops the armoured-turtle build: you cannot wrap
yourself in a complete shell of spikes and still swim, because a complete shell
buries every tail you own. Leave the stern open and you can keep the spikes —
you just have to accept a soft rear. The bench shows a working/total tail count
and greys out the tails that are smothered.

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

**Pods.** Put an angry neuron behind a detach seam and you have built something
that leaves. Press DETACH and the seam burns out; anything no longer joined to a
heart comes away, and any piece carrying a neuron wakes up and goes hunting.
Add a flagellum so it can chase and an exploding cell so it means something, and
what you have is a suicide drone. A pod carries no flesh, so the ordinary muscle
rule would leave it crawling — the neuron drives it about twice as hard instead,
which is the whole point of an angry one. It lasts thirty seconds.

**Nothing of yours can hurt you.** Your own drones never target you, their
spikes cannot shear your cells, and a blast skips everything on your side. Pods
also drop no food when they expire, so cutting pieces off yourself is not a way
to print nutrients.

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

Wins out of five 45-second duels, ramming straight ahead the whole time — the
worst possible tactic, so treat these as a floor rather than a rating:

| Your build | Drifter | Grazer | Swimmer | Hunter | Spikeball |
| --- | --- | --- | --- | --- | --- |
| Starter (no spikes) | 0/5 | 0/5 | you die | you die | you die |
| 3 nose spikes | 5/5 ~6s | 1/5 | 4/5 ~23s | 1/5 | 0/5 |
| Armoured, 5 spikes | 5/5 ~6s | 5/5 ~15s | 5/5 ~12s | 2/5 | 0/5 |

The middle rows swing a lot between runs, because whether you ever see a flank
depends on where a hunter happens to be in its lunge cycle and which way a
spikeball happens to be facing. The shape is what matters: the starter body
cannot kill anything, three spikes make you a predator of small things, and
spikeballs need a serious build or something cleverer than ramming.

The starter body killing nothing is deliberate — the first thing the game asks
you to do is go to the bench and decide what kind of animal you want to be.

## Implementation notes

Single file, plain canvas 2D and JavaScript. Cells live on axial `(q, r)`
coordinates; mirroring across the forward axis is `(q, r) → (q + r, −r)`.
Physics runs on fixed sub-steps so collisions stay stable at any framerate,
while spawning, culling and the camera run once per frame. Your blueprint and
nutrient count are saved to `localStorage`.

## Playing it

Open `index.html` in any browser — desktop or phone, no build step.

On a phone, one finger does everything: hold to swim, drag to steer. The BENCH
button replaces the `E` key, and Remove mode replaces right click.

To host it somewhere that wraps pages in its own document skeleton, run
`python3 tools/build-artifact.py` and publish `.artifact/cellsea.html`.
