# Cellsea

A browser game about building an eyeless creature out of hexagonal cells and
surviving in an expanse with no edges. Open `index.html` — no build step, no
dependencies, no server needed.

## The idea

You don't pick a species, you assemble one. Every creature in the sea — yours
included — is a rigid body made of hexagonal cells roughly the size of a
fingernail, laid out on an axial hex grid. What you bolt on decides how fast
you swim, how hard you turn, what you can kill, and what kills you.

## The nine cells

| Cell | Cost | Mass | Hits to kill | What it does |
| --- | --- | --- | --- | --- |
| **Heart** | 10 | 1.4 | 2 | Lose every one and you dissolve. |
| **Normal** | 3 | 1.0 | 1 | Muscle. **Every drive needs one of these behind it** or it barely turns over. |
| **Armour** | 8 | 3.0 | 3 | A harder, whiter normal cell. Tough, heavy, and it can snap the spines that hit it. |
| **Flagellum** | 6 | 0.8 | 1 | Pushes *away from itself*. At the back it drives you forward; at the front it drives you backward. Bury it and it stops; cut the tail and it is just flesh. |
| **Jet** | 9 | 1.4 | 2 | Gas thrust. Weaker when buried but never dead, and there is no tail to cut. |
| **Poison gland** | 10 | 1.3 | 2 | Spits a glowing orb out of any clear side. What it lands on is gone; the rot creeps on from there. |
| **Angry neuron** | 9 | 1.2 | 2 | Dead weight while attached. Once its piece is cut loose, that piece hunts on its own. |
| **Detach** | 4 | 0.6 | 1 | A seam. The DETACH button burns it out and frees whatever it was holding on. |
| **Exploding** | 8 | 1.3 | 1 | Bursts when anything living touches it — or when anything kills it. |
| **Flexible** | 7 | 1.6 | 2 | *Earned.* Rubbery: spines slide off it, but rot races through and eats it outright. |
| **Parasite** | 9 | 1.1 | 1 | *Earned.* Bites what it touches, banks the life, then mends your worst-damaged cell. |

The last two are not on the bench when you start. They are the hive queen's
cells, and you take **one** of them off her corpse.

**Spikes are not cells.** A spike is a spine you bolt onto a cell you already
have, for +7 biomass and +0.6 mass, and the cell underneath keeps doing its job
— a normal cell with a spine on it is still muscle. That means arming yourself
no longer costs you speed the way a body full of dedicated spike cells did.

Spines, tails, jets and glands all point along whichever side of the body they
sit on: each cell takes the average direction of its empty neighbouring slots,
so a spine on your flank points outward from your flank, and a gland on your
nose spits forward. Line several glands along the front and you have built
something worth calling a battery.

## Controls

| Input | Action |
| --- | --- |
| `W` / left click | Beat your flagella |
| `S` | Back-paddle |
| `A` / `D` | Turn |
| Mouse | Steers when the turn keys are idle |
| `E` | Open and close the cell bench (also works while dissolved) |
| `Q` / DETACH | Burn one detach seam, outermost first |

Glands fire on their own, on a timer — there is no fire button. You aim them by
deciding which way they face when you build.

On a phone, one finger does everything — hold to swim, drag to steer — and the
BENCH and DETACH buttons replace the keys.

## Rules that matter

**Biomass is the ceiling; nutrients are the bill.** Every cell costs biomass and
you have a limit — too much armour, too many spikes, too big a body, and you
can't add anything else. Eating raises that ceiling permanently.

Eating *also* fills a reserve, and **growing spends it**. Rearranging cells you
already carry is free. Growing a cell you have lost, or adding one you never
had, costs a nutrient per point of biomass. The bench shows the bill before you
commit and refuses when you can't pay.

That reserve exists because the bench used to be a free full-body restore. Any
damage could be undone by opening it, and worse, you could detach a drone pod,
open the bench, grow it back for nothing, and detach again — an unlimited supply
of hunters for no cost at all. Now a pod costs about 28 nutrients to replace,
so the loop runs dry.

**Every drive needs flesh behind it.** One normal cell powers one flagellum or
jet. Fit more drives than you have flesh and the extras barely turn over; fit
more flesh than you have drives and it is dead weight. The bench shows
`drive 2.0 / 3` — powered over fitted — and warns you when they don't match.

This replaced a rule that sounded right and did nothing. Speed used to scale
with what *fraction* of your mass was flesh, which meant adding a normal cell
made you **slower**: the fraction barely moved and the mass definitely did.
Flesh had no job at all. Measured before and after, on the same body: four
drives with no flesh manages 22 px/s, and the same four drives with flesh behind
them manage 308.

Every body also pays some drag just for existing, so shedding cells never buys
you speed.

**A buried tail pushes nothing.** A flagellum needs open water behind it. Wall
one in with your own cells and it still costs mass and biomass, but produces no
thrust at all. This is what stops the armoured-turtle build: you cannot wrap
yourself in a complete shell and still swim on tails alone, because a complete
shell buries every tail you own. Leave the stern open and you keep the spikes —
you just accept a soft rear. The bench shows a working/total drive count and
greys out the tails that are smothered.

**A jet gets through anyway.** Gas vents between cells, so a buried jet still
finds a seam. It drops to 55% rather than to nothing. That does put the sealed
turtle back on the table — but only as a slow, expensive one: jets cost 9 each,
weigh nearly twice a tail, and a shell of armour is heavy on top of that. A
fully enclosed jet body in testing tops out around 20 px/s against 163 for an
open-tailed swimmer. It moves; it does not get away with anything.

**Tails are real.** A flagellum's tail is a physical thing, not decoration.
Rake it with a spine or crush it between two hulls and it comes off; what is
left is an ordinary normal cell. Tails stick out further than the hull, so they
are the first thing an attacker reaches — going for someone's stern to strip
their propulsion is a real tactic, and so is preferring jets if you expect it.

**Armour fights back.** A spine that shears an armour cell chips it as usual,
but has a small chance (about one in eleven) of snapping clean off. Armour is
the counter to a spike build. This number is deliberately small: at one in four
a spine breaks before it can chew through even a single armour cell, and an
armour-nosed hunter just disarms everything that touches it.

**Rot weakens; it never kills.** A poison orb destroys the cell it lands on,
and the rot spreads from there — three rounds deep, three neighbours a round.
But a rotting cell is only ever worn down to its last hit point, never past it.
What rot actually does is *switch cells off*: rotting muscle stops counting,
rotting drives stop pushing, rotting glands stop firing, rotting parasites stop
biting. In testing a single orb disables around 14 cells and drops a swimmer to
under a quarter of its speed — and kills exactly nothing, ever.

That is deliberate, and it is the fix for a real exploit. When rot could kill,
the best strategy in the game was to spit from range, swim away, and come back
to a corpse: no risk, free food, and it worked on almost everything because
almost nothing wore armour. Now poison is a *softener*. It strips armour to
paper and leaves a body slow and quiet, but converting that into kills still
means going in.

**Armour is the one thing rot cannot finish** — a 3-hit armour cell rots down to
1 and stops there. So rot is the answer to armour, and closing in is the answer
to rot.

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
- **Spitter** — hangs back and spits rot at you. The answer to sitting inside
  armour, and the reason a sealed turtle is not a free win.
- **Popper** — fast, fragile, and carrying three mines. The answer to stacking
  armour: plate does not save you from a blast.
- **Darter** — armoured and jet-driven, so shearing its tails off is not an
  option, because it hasn't got any.

## Growing back

Take the **parasite** path and your body slowly knits itself back together — a
lost cell returns roughly every eleven seconds, but only cells you were built
with, and only where something is still there to grow from. It is a way to
recover between fights, not a way to win one.

The hive queen does the same thing a little faster.

## The hive queen

When your biomass cap reaches its maximum of 250 — when there is nothing left
to grow into — something turns up.

She is built the way you would build her by hand: three plated cells in a line,
then three rubber ones, all the way round; spines here and there; a heart in
the middle under its own armour; and three long armour sticks running out to
the rim. Those sticks cut the inside into three chambers, and **each chamber has
its own door** cut into the rim. The doors are not damage — they were never
grown.

Parked in the chambers are her drones: an angry neuron, a parasite and a tail
apiece, on a single seam. She cuts them loose and throws them at you.

She is about 500px across and the camera pulls back when you get near her, so
you can see the whole thing and pick your door.

**She knits herself back together**, a cell every nine seconds, which is a
little faster than you can if you took the parasite path. That makes her a
race: chew faster than she mends, or you will be there all day.

Kill her and you take one of her two cells for your own. One only — the other
dies with her.

## The Bloom

A while after the queen falls, something comes looking for you.

Where she was a fortress you break into, the Bloom is a hunter grown huge and
studded with poison glands, and it does the travelling. No drones, no doors, no
shell to circle — plate is scattered at random through its bulk instead of laid
on the surface, so soft ground has to be found by looking. Two hearts, so one
lucky shot through the middle is not the whole fight.

Rot goes straight past spines, so a wall of spikes is no answer to it. Either be
quick enough not to be hit, or bring enough armour and enough drive to close.

Beat it and you get the cell the queen didn't give you.

Two things about her shape are load-bearing rather than decorative:

- Her radius is a multiple of three, because the rim only divides into runs of
  three if it is. At radius 7 the pattern came out 3-and-4.
- Her doors are six cells wide, because at four the gap is 76px and a 19-cell
  armoured body is 122px across — the exact build she is meant to reward could
  not physically fit through her.

Hostiles lunge and then peel away to line up again. That recovery is when their
flank is open — a hunter that simply tracked you would keep its spiked face
pointed at you forever and there would be no way to fight it.

Prey sprint and then tire. Chase a grazer long enough and it slows down.

## Roughly how the food chain plays out

Wins out of five 45-second duels, ramming straight ahead the whole time — the
worst possible tactic, so treat these as a floor rather than a rating:

| Your build | Drifter | Grazer | Swimmer | Hunter | Spikeball | Spitter | Popper | Darter |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Starter (no spines) | 0/5 | 0/5 | you die | you die | you die | you die | you die | you die |
| 3 nose spines | 5/5 ~5s | 0/5 | 4/5 ~19s | 0/5 | 0/5 | 0/5 | 1/5 | 0/5 |
| Armoured, 5 spines | 5/5 ~5s | 5/5 ~8s | 5/5 ~13s | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 |

**Read this table carefully, because it flatters nobody.** The bot that
produced it drives straight at its target and never stops, which is the worst
possible tactic against anything with a face full of spines. Against the hunter
it scores exactly zero — but the same build attacking the hunter's *stern*
takes 4.5 cells a fight. The hunter is not unkillable; a straight charge into
its armoured nose is just a spine-on-spine stalemate, which is what an armoured
nose is for.

So treat the zeroes as "ramming does not work here", not as "this cannot be
beaten". The real answer to the right-hand columns is to stop ramming: rot them
first, take their flanks, or shoot them from outside their reach.

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
