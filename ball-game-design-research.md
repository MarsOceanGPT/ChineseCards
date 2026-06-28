# Blob-Eating Game Design Research & Recommendations

*Research for a kid-built "merge the oil drops / eat smaller balls" game, with the goal of adding enough gameplay depth to publish it.*

---

## 1. What the game is right now (the starting point)

The current game is the classic **"big ball eats small ball"** loop, born from a lovely observation: oil drops on chicken soup merging when you push them with chopsticks. That core idea is genuinely good — it's the same seed that made **Agar.io** one of the most-played browser games ever. The "merge two drops into a bigger drop" mechanic is exactly Agar.io's heart.

The instinct that "it's not deep enough yet" is correct, and it's the **right** problem to have. Agar.io itself looks trivial — just circles eating circles — but it became addictive because of a small number of mechanics layered on top of the simple loop. The job now is to add **2–4 of those layers**, not to rebuild the game.

---

## 2. Why Agar.io is actually fun (the lesson)

The core loop is "bigger eats smaller," but the *depth* comes from a few tensions on top:

- **Growth makes you stronger AND weaker at the same time.** Big cells move *slower*. So getting big is a reward, but it also makes you a slow, juicy target. This single rule creates constant risk/reward — the heart of the whole game. (This is probably the #1 thing to add.)
- **Splitting.** You can split your ball in two to lunge forward and catch faster prey — but now you're in two smaller, more vulnerable pieces. Risk for reward.
- **Ejecting mass / feeding.** You can spit out a little mass — to feed a teammate, or to throw at a hazard.
- **Viruses (the spiky green dots).** Small players hide behind them safely; big players that touch them *explode into many pieces*. A great equalizer that gives small players a tool and punishes the big.
- **Predator-and-prey psychology.** Every other ball is simultaneously food and a threat, depending on size. You're never safe and never bored.

> **Key takeaway:** depth in this genre does NOT come from more art or more content. It comes from a few *rules that create tension* — especially "being big has a downside."

*Sources: [Agar.io strategy wiki](https://agario.fandom.com/wiki/Strategy), [Splitting](https://agario.fandom.com/wiki/Splitting), [Virus mechanics](https://agario.fandom.com/wiki/Virus), [Agar.io — what makes it fun](https://www.bananatic.com/games/agar-io-414/agar-io-the-simple-circle-that-consumed-the-internet-23926), [Game theory in Agar.io (Cornell)](https://blogs.cornell.edu/info2040/2015/09/20/game-theory-in-its-simplest-form-agar-io/)*

---

## 3. Mechanics worth borrowing, game by game

### Agar.io — the tension layer
- **Bigger = slower.** (Most important single addition.)
- **Split** to lunge and catch prey.
- **Spiky hazards** that pop big balls but shelter small ones.
- **Eject a bit of mass** to feed or to bait.

### Mope.io — the *evolution / food-chain* layer (closest to "Evolution of Species 2")
Mope.io is Agar.io's cousin where you **climb a food chain**: you start as a tiny mouse and evolve up ~17 tiers to a dragon by eating food and weaker animals.
- **Tiers / evolution stages.** Cross an XP threshold → become a new, bigger creature with a **new ability**. This gives players *goals* — "I want to reach the next form" — which the current game lacks.
- **Special abilities per stage** (press a button): a dash, a short hide/burrow, a grab. Higher tier = stronger ability.
- **"You can only eat things near your size."** A tiny creature can't be one-shot by the biggest one if it stays in safe zones — this keeps small players in the game instead of instantly dying.
- **Safe zones / terrain** (water, bushes, holes) where certain creatures are safe. Terrain creates strategy.

*Sources: [Mope.io Tiers](https://mopeio.fandom.com/wiki/Tiers), [Special Abilities](https://mopeio.fandom.com/wiki/Special_Abilities)*

### Deeeep.io — theme + ability variety
Same idea underwater with dozens of real sea creatures, each with a unique ability. Lesson: a **fun theme** (cute oil drops, food, sea creatures, microbes) plus **per-creature abilities** adds replay value cheaply.

### Evolution of Species 2 (the game the child already loves) — the *build-a-creature* layer
- Collect **DNA** as the currency of progress.
- **Spend DNA to evolve**: pick body parts (fins, spikes, etc.), each with strengths/weaknesses.
- **Customization = ownership.** Kids replay because *their* creature is unique and they want to make it stronger.
- **Single-player "design & practice" mode** separate from the live arena. Good model: a calm place to upgrade, and an arena to test it.

*Sources: [Evolution of Species 2 (Google Play)](https://play.google.com/store/apps/details?id=com.EvolutionOfGames.EvolutionOfSpecies2&hl=en&gl=US)*

### Tasty Planet — the *single-player level / progression* layer
A single-player game where you're a "grey goo" that eats everything and grows across **handcrafted levels** with goals. Lesson: if multiplayer is too hard to build on the platform, **levels with objectives** ("grow to size X in 60s", "eat 10 red drops", "survive the big boss drop") give structure and a sense of winning.

### Hyper-casual / arcade design — the *"juice" and feedback* layer
What makes simple games feel great to play:
- **Juice:** screen shake, a little "pop"/squish when you eat, particles, satisfying sounds. This is *huge* for "feel" and is cheap to add.
- **Power-ups that appear randomly:** temporary speed, magnet (pulls nearby food), shield, "eat anything for 5s." Variable rewards keep players hooked.
- **Hazards/obstacles** that force movement decisions.
- **Escalating difficulty / variety** so it never gets monotonous.

*Sources: [Juice in game design](https://www.bloodmooninteractive.com/articles/juice.html), [Casual game design fundamentals](https://gamedesignskills.com/game-design/casual/), [Hyper-casual design checklist](https://www.cubix.co/blog/hyper-casual-games-development-checklist/)*

---

## 4. Concrete recommendations (prioritized for a kid to build on 秒答)

Add these roughly in order. The first three give the biggest jump in depth for the least work.

**Tier 1 — add the core tension (do these first):**
1. **Big = slow.** Make the player's speed go *down* as size goes up. This alone turns "boring growth" into real strategy. (Biggest impact, smallest effort.)
2. **A "danger" element** — spiky drops/bubbles that shrink or split a big player but are harmless (or even safe) to small ones. Gives weak players a tool.
3. **Juice it up:** a satisfying *pop* + squish animation + sound when you eat, a little particle splash, and a small "+1" popup. Makes every bite feel good.

**Tier 2 — add goals so there's something to chase:**
4. **Evolution stages (Mope.io style):** 3–5 named forms (e.g. tiny drop → big drop → "oil monster" → boss blob). Crossing a size/score threshold = visible transformation + a new color/face/ability. Kids *love* hitting the next stage.
5. **One active ability** the player triggers (tap/space): a short **dash** to catch prey, OR a brief **shield/hide**. Pick one to start.

**Tier 3 — add variety and replay:**
6. **Power-up pickups** that spawn occasionally: magnet, speed, shield, "mega-eat." Temporary, flashy, fun.
7. **Smarter AI balls:** some that *flee* when you're bigger and *chase* when you're smaller (predator/prey behavior). This makes the world feel alive even without real multiplayer.
8. **A simple goal/score loop:** survive timer, high score, or short levels with objectives ("reach the oil monster stage", "eat the boss"). Add a **leaderboard / personal best** for the "one more try" hook.

**Tier 4 — if there's appetite for more (the Evolution-of-Species touch):**
9. **A currency + upgrade screen:** collect "drops/DNA" → between runs, spend them to start a bit bigger, move faster, or unlock a new face/skin. This is the "ownership" loop that keeps the child's friends coming back — and is the closest tie-in to Evolution of Species 2.

---

## 5. Open questions to think about before designing more

These are the design decisions worth discussing together as a family before building:

1. **Single-player or multiplayer?** Real multiplayer is hard on most kid platforms. A strong **single-player game with smart AI balls** (that flee/chase based on size) can feel almost as alive and is far easier to ship. Recommend starting single-player.
2. **Is the fun about *growing* or about *surviving*?** Agar.io is both. Decide which the game leans on — it changes whether you add bosses (survival) or evolution tiers (growth). Probably: growth as the main goal, survival as the spice.
3. **What's the "win"?** Right now there may be no end state. Pick one: highest score, reach the final evolution, survive a timer, or beat a boss blob. A clear goal is what's most likely missing.
4. **How does a small player stay in the game?** The genre's golden rule: small players need a *tool* (hide spots, spiky hazards, agility) so getting eaten isn't instant and hopeless. Build in at least one.
5. **What is the theme/identity?** The oil-drops-on-soup origin is charming and original — lean into it. A clear, cute theme (kitchen / food world?) helps it stand out and is a selling point if publishing.
6. **What does "earn money"/publish actually require on the platform?** Worth checking what makes a game popular/featured on 秒答 specifically — usually it's polish, a clear goal, and "juice," not raw complexity.

---

## 6. One-paragraph summary

The game's core idea is genuinely strong — it's Agar.io's mechanic with a charming original theme. What's missing is not content but **tension and goals**. Add three things first: (1) **bigger balls move slower** (instant strategy), (2) a **hazard that punishes the big and helps the small**, and (3) **juice** — satisfying pops, sounds, and effects. Then add **evolution stages** with new abilities (like Mope.io and Evolution of Species 2) so players have something to chase, **smart AI** that flees or hunts based on size, and a **clear win condition**. That turns "eat smaller balls until bored" into a game with real depth — without rebuilding what's already working.

---

### Sources
- Agar.io: [what makes it fun](https://www.bananatic.com/games/agar-io-414/agar-io-the-simple-circle-that-consumed-the-internet-23926) · [Strategy wiki](https://agario.fandom.com/wiki/Strategy) · [Splitting](https://agario.fandom.com/wiki/Splitting) · [Virus](https://agario.fandom.com/wiki/Virus) · [Game theory (Cornell)](https://blogs.cornell.edu/info2040/2015/09/20/game-theory-in-its-simplest-form-agar-io/)
- Mope.io: [Tiers](https://mopeio.fandom.com/wiki/Tiers) · [Special Abilities](https://mopeio.fandom.com/wiki/Special_Abilities)
- Evolution of Species 2: [Google Play](https://play.google.com/store/apps/details?id=com.EvolutionOfGames.EvolutionOfSpecies2&hl=en&gl=US)
- Genre alternatives (Mope.io, Deeeep.io, Tasty Planet, Nebulous): [Beebom list](https://beebom.com/best-agar-io-alternatives/) · [Top IO games 2026](https://playgama.com/blog/top-games/top-io-games-april-2026/)
- Casual/arcade design: [Juice in game design](https://www.bloodmooninteractive.com/articles/juice.html) · [Casual game design fundamentals](https://gamedesignskills.com/game-design/casual/) · [Hyper-casual checklist](https://www.cubix.co/blog/hyper-casual-games-development-checklist/)
