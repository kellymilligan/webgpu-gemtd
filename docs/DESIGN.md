# Design Direction (v0.2)

A browser-native, isometric 3D tower defence built on the formula of Bryan K's
*Gem TD* for Warcraft III: random gem draws, keep-one-of-five, a maze you build
from your own leftovers, and recipes. We keep the formula and build a new
world, look and feel on top of it.

Status: **direction agreed; grey-box prototype built** (see §10 for decisions).

---

## 1. Pillars

1. **The gamble and the maze are one decision.** Every gem you place is both a
   possible tower and a permanent wall. This is the heart of Gem TD, and we
   won't dilute it.
2. **Beautiful at a glance, readable in a fight.** We aim for Dota 2-level
   fidelity, but every effect has to say *what* it is and *who* it hits.
3. **Respect the player's time.** Modern QoL is standard: speed controls,
   previews, a codex and stats. The randomness should hurt, but the UI never
   should.
4. **Deterministic core.** The simulation is seeded and reproducible from the
   start, so replays, daily seeds and multiplayer come almost for free.

## 2. World and theme (working title: **FACET**)

A sunlit, overgrown highland valley where an ancient crystal seam breaks the
surface. Each build phase you **unearth** gems from the ground. The gems you
don't keep **calcify into mossy stone** outcrops, the rocks of the original.
Over a run, moss, ferns and flowers creep over them, so your maze literally
grows into a garden.

- **The Heart:** a large crystal at the exit. Lives are shown in the world as
  fractures spreading through it, alongside the HUD counter.
- **The Blight:** creatures of chitin, bark and corrupted stone drawn to the
  Heart.
  - *Ground:* beetles, crawling root-things, armoured stone tortoises, fast
    skittering swarms.
  - *Air:* moths, lantern wisps, gliding seed-pods.
  - *Bosses:* large set pieces, such as a moss-backed colossus or a moth
    queen.
- **Checkpoints:** standing-stone waystones that glow as the path passes
  through them.

Alternative themes to consider: an *underground geode cavern* (moody, lit by
the gems themselves) or a *sky-archipelago* (floating islands, strong
silhouettes). The valley has the most room for vegetation and daylight
beauty, so it's the recommendation.

## 3. Core rules (the homage)

| Rule | Kept from Gem TD | Notes |
|---|---|---|
| 5 gems per build phase, random type | ✔ | Uniform over 8 families |
| Quality ladder | ✔ | Renamed grades, e.g. Chipped → Flawed → Clear → Flawless → Perfect |
| Keep one; the rest become stone | ✔ | Stone blocks paths and is removable for gold |
| Combine 2 identical → +1 grade, 4 → +2 | ✔ | Only among the current phase's gems |
| Recipes from the current phase's gems | ✔ | **Re-authored** recipe set (see §4) |
| Special tower upgrades in later phases | ✔ | Upgrade path per special |
| Gold buys better grade odds | ✔ | Core economic decision |
| Checkpoint route, no full blocking | ✔ | Placement that would block is rejected |
| Air ignores the maze | ✔ | Flies straight between waystones |
| ~50 waves with bosses, lives pool | ✔ | Tuned fresh |

### Gem families (identity, silhouette, projectile)

Each family has a **distinct cut and silhouette**, so it's readable at a
glance and colour-blind safe. Higher grades get larger, clearer, more
faceted and more luminous gems on more elaborate plinths.

| Family | Role | Cut / silhouette | Projectile / effect |
|---|---|---|---|
| Ruby | Splash | Oval brilliant | Molten shard lobbed in an arc; bursts into embers and a scorch decal |
| Sapphire | Slow | Cushion cut | Frost lance; target gets rime crystals and a frosted tint |
| Emerald | Poison | Step (emerald) cut | Venom droplet; lingering green motes and a sickly shimmer on target |
| Topaz | Multi-target | Pear cut | Forking amber lightning that splits across targets |
| Diamond | Burst, crits, ground | Round brilliant | Near-instant prismatic beam; crits split into a spectrum flash |
| Amethyst | Long range, air | Tall hexagonal crystal cluster | Homing violet comet with a long ribbon trail |
| Opal | Aura (attack speed) | Smooth cabochon, play-of-colour shader | No projectile; slow iridescent pulse rings over buffed towers |
| Aquamarine | Very fast, short range | Hexagonal prism | Rapid stream of water needles with splash droplets |

### Candidate new mechanics (optional, to be decided after playtest)

- **Resonance:** small bonuses for adjacent gems of complementary families,
  which rewards deliberate placement.
- **Waystone modifiers:** occasional waves with a twist (hasted, armoured,
  splitting) shown one wave ahead.

We only add these once the pure formula is playable and fun on its own.

## 4. Recipes

We keep the *shape* of the original (about 13 specials, 3–4 ingredients each,
spread from early Chipped recipes to late Perfect ones), but write our own
names, ingredients and signature mechanics. All recipes live in a data table
so we can rebalance them without code changes. A draft table comes after the
grey-box milestone.

## 5. Quality of life

- **Live path preview:** hovering a tile shows the new route and the change
  in path length (+/− tiles) before you place.
- **Blocking feedback:** an invalid tile shows *why*: it would cut off a
  given waystone.
- **Recipe codex:** always available. Recipes you can make from this phase's
  gems are highlighted, and "one gem away" hints are shown.
- **Keep screen:** clearly lists every option (keep any single gem, each
  possible combine, each possible recipe) with stat previews.
- **Next-wave preview:** type (ground, air, boss, fast, armoured), count and
  HP.
- **Speed control:** pause, 1×, 2× and 4×. Pause is allowed any time in solo
  play.
- **Tower info:** DPS, kills, damage dealt, range ring and targeting
  priority (first, last, strongest, fastest, air).
- **Autosave and resume,** a **seeded daily run,** and an **end-of-run
  summary** with the damage breakdown and maze length over time.
- **Undo the last placement** during a build phase, *before* its gem is
  revealed. We need to decide whether gems are revealed on placement (see
  open questions).
- **Keyboard shortcuts,** rebindable. Full mouse-only play, with touch
  planned for later.

## 6. Visual and audio targets

- **Camera:** isometric-style perspective (narrow FOV), smooth pan and zoom,
  and a limited orbit that snaps back to the classic angle.
- **Lighting:** PBR, a warm directional sun with soft cascaded shadows, sky
  or IBL ambient, ambient occlusion, bloom, filmic tone mapping, colour
  grading and light atmospheric haze.
- **Gems:** a custom gem shader with transmission and refraction, chromatic
  dispersion, internal facet reflections (baked facet normals or a cubemap
  trick), an emissive core that grows with grade, and sparkle glints.
- **Vegetation:** GPU-instanced grass, ferns and flowers with wind sway that
  bend away from creeps, plus hero trees and rocks around the play area. Moss
  grows over stones through the run.
- **Creeps:** skinned and animated, with hit reactions, status tints (frost,
  poison, burn) and satisfying deaths (shatter or dissolve).
- **VFX:** GPU particles through compute shaders, ribbons and trails,
  decals, and a signature impact effect for each family.
- **UI:** a minimal HUD with lives, gold and wave in one corner and the
  phase or action prompt at the bottom centre. Contextual panels appear only
  when needed. Frosted glass, restrained typography, no chunky frames.
- **Audio:** each gem family gets its own tonal voice, with ambient valley
  sounds that fade as the Blight advances.
- **Performance:** 60 fps on a mid-range laptop at "Medium", with quality
  presets (Low to Ultra).

## 7. Technical architecture

```
src/
  sim/      Pure TypeScript, deterministic, no rendering imports
            grid, pathing, draw/keep/combine/recipes, waves, combat, economy
  data/     gems, grades, recipes, waves, balance tables (JSON/TS)
  render/   three.js WebGPURenderer + TSL: scene, gem shader, vegetation,
            creeps, VFX (compute particles), post-processing
  ui/       lightweight DOM overlay (HUD, keep screen, codex)
  audio/
  app/      game loop, input, save/load, settings
```

- **Language and build:** TypeScript, Vite, Vitest for sim tests.
- **Renderer:** **three.js `WebGPURenderer` with TSL node materials.** It is
  native WebGPU with compute and a node-based post-processing stack, falls
  back to WebGL2 automatically, and has mature glTF and skinned animation
  support. Raw WebGPU would cost months of engine work before we could
  reach the visual goal. We drop to raw WGSL through TSL/compute wherever we
  need custom work.
- **Simulation:** fixed timestep (e.g. 30 Hz) with render interpolation and a
  seeded PRNG. All randomness comes from the sim RNG, and no float
  behaviour depends on the renderer.
- **Pathing:** grid BFS or flow field for each waystone leg, recomputed on
  placement. Validation runs the same search on a hypothetical grid.
- **Multiplayer later:**
  - **Race mode:** every player gets the same seed and plays their own
    maze. Only inputs and progress are shared, so a small relay server is
    enough.
  - Deterministic input replays make validation and spectating
    straightforward.

## 8. Roadmap

1. **Scaffold:** Vite, TypeScript, three WebGPU, the sim/render split and
   CI (tests and typecheck).
2. **Grey-box gameplay:** the full loop with placeholder shapes on a grid,
   path preview, draw, keep, combine, waves, gold, odds upgrades and lives.
   *Goal: fun with cubes.*
3. **Content pass:** the full tower stats, the re-authored recipe table, the
   wave table and a balance simulator (headless runs).
4. **Art pass I:** terrain, lighting, post-processing, the gem shader and gem
   cuts, and vegetation.
5. **Art pass II:** creeps and animation, the projectile and impact VFX
   families, and the Heart.
6. **UI, QoL and audio polish:** codex, stats, saves, settings and the daily
   seed.
7. **Multiplayer:** race mode.

## 9. Decisions (agreed)

1. **Theme:** the overgrown valley ("FACET").
   - **Time of day rotates by level:** day → dusk → night → dawn, three waves
     each.
   - Each phase has its own lighting, glow level and creep roster:
     - **Day:** sparkly gems, beetles.
     - **Dusk:** warm light, tortoises and moths.
     - **Night:** heavy glow, wisps and rootlings.
     - **Dawn:** a mix.
   - Some specials react to the light: Moonstone is fierce at night, and
     Alexandrite changes behaviour between day and night.
2. **Reveal timing:** the original, where each gem is revealed as it's
   placed. The tension and the need for flexible placement are core to the
   game.
3. **Art:** CC0 packs to start (e.g. Quaternius, KayKit). A later pass may
   use paid or generated assets to unify the look. Creeps generated in code
   are an option depending on how stylised we go.
4. **Performance:** 60 fps on mid-range hardware is the bar. The aim is
   "beautiful and interesting in a web context", not literally Dota 2.

## 10. Current state (grey-box milestone)

- **Sim:** the complete loop runs in `src/sim`:
  - draw, keep, combine, recipes and special upgrades;
  - stones, pathing with block prevention, and waves with the day cycle;
  - combat effects: splash, slow, poison, multi-target, chain, crit, auras
    and armour shred;
  - odds upgrades, stone removal, autosave and resume.
- **Render:** three.js WebGPU, with an automatic WebGL 2 fallback:
  - a gem cut per family with a physical transmissive material;
  - mossy stones, waystones and the Heart;
  - time-of-day lighting with bloom;
  - primitive creep silhouettes;
  - projectiles, beams, chain lightning, hit flashes and death bursts.
- **UI:**
  - HUD;
  - odds card;
  - build prompt with live path-length change;
  - next-wave card;
  - keep panel with stat previews;
  - tower panel with a targeting choice;
  - codex with "Ready" and "One away" highlights;
  - toasts and the game-over summary.
- **Balance:** a greedy headless bot reaches a median of wave ~38
  (`npm run balance`). The early game is spiky, and the draft recipe stats
  still need a real pass.

## 11. Progression and variety (v0.3)

- **Board combining:** between waves, select any gem on the board.
  - 2 matching gems combine one grade up; 4 combine two grades up.
  - The result stays on the tower you selected, and the consumed gems
    calcify into stone so the maze is unchanged.
  - Specials can be forged from board gems, and upgraded by feeding them a
    board gem.
  - Each grade step is roughly ×2.2 damage, so combining always beats
    keeping two separate towers.
- **Master gems:** Sunheart, Eclipse, Prismheart and Worldroot, forged from
  two specials plus a Perfect gem.
- **Visual grades:** Chipped is a rough chunk, Flawed a tumbled pebble,
  Clear a simple cut, Flawless the family cut and Perfect a finely faceted
  version. Clarity and polish rise with grade.
- **World UI:** actions appear in a popover anchored to the selected gem.
  Tags over this round's gems and badges over board towers advertise
  combines (▲) and forges (✦). Hovering an option marks the result tile and
  the gems it will consume.
- **Creeps:** 47 archetypes across day, dusk, night and dawn, in three
  tiers, built from 18 body plans.
  - Abilities: evasion, shields, splitting, healers, haste auras, leaping,
    burrowing, enrage, brood spawning, slow and poison immunity, and brittle
    shells.
  - Waves are seeded per run: packs with support creeps (support creeps
    travel at the pack's pace), back-to-back packs, and mixed ground-and-air
    waves.
  - Elites appear at waves 15, 25, 35 and 45; bosses every 10 waves.
- **Balance:**
  - Waves 1–5 are eased, and the first air wave is at 6.
  - Ruby now hits air, and Amethyst is stronger.
  - The flight path brightens before air waves.
