# TESSERA

A 2.5D top-down, grid-based RPG with a heavy retro look: procedural pixel-art
sprites, an ASCII-character UI that dissolves and re-forms when windows open,
and a WebGL CRT screen with scanlines, curvature and a soft glow.

Every world is generated from a seed: stretched and morphed biome splotches,
rivers, lakes, mountains and forests; civilizations with their own cultures;
villages, towns and walled cities full of villagers who live out daily
schedules, and towns that actually run: kitchens, taxes, laws, trials,
funerals and trading trips, whether or not you're there to see them.

No dependencies and no build step: it's plain JavaScript modules and a canvas.

![Title screen](docs/title.jpg)

| | |
| --- | --- |
| ![A city plaza with market stalls](docs/city.jpg) | ![A village at night](docs/night.jpg) |
| ![Inside a house: the roof is cut away](docs/interior.jpg) | ![The world map](docs/map.jpg) |
| ![Sitting at the tavern bar](docs/tavern.jpg) | ![Talking to the village cook](docs/dialogue.jpg) |
| ![A hearing at the village jail](docs/hearing.jpg) | ![Falling asleep](docs/sleep.jpg) |

## Running

```sh
npm start          # serves the folder on http://localhost:8080
```

Any static web server works (the game uses ES modules, so it must be served
over HTTP rather than opened as a `file://`). Then open the page and press
**N** on the title screen for a random world, or **S** to type a seed.

```sh
npm test           # world generation, settlement and NPC simulation tests
```

Useful URL parameters for testing: `?autostart&seed=123` skips the title
screen, `&time=1320` starts at 22:00, `&goto=city` (or a settlement name, a
style like `sun`, or `abandoned`) teleports you there, and `&nocrt` starts
with the CRT effect off. `window.__game` exposes the running game.

## Controls

| Action | Keys |
| --- | --- |
| Move (tile by tile) | WASD / arrow keys, hold Shift to sprint |
| Select belt slot | 1–9 or mouse wheel |
| Interact (doors, chests, workbench, furnace, anvil, torches, beds, signs, wells…) | Click the block, or E / right-click |
| Mine | Hold left mouse on a block with a tool or an empty hand |
| Place block | Select a block item and click (hold to keep placing) |
| Rotate the block you're about to place | R |
| Lock the mining/placing layer | Z / X (Shift + wheel), V returns to AUTO |
| Attack | Left-click a creature or person (a bow shoots arrows at range) |
| Talk | Right-click a villager, then pick topics with 1–9 (T trade, G gift) |
| Sit | Click a chair, bench or stool; move to stand up |
| Sleep | Click a bed at night (your own, or your host family's guest bed); any key wakes you |
| Toss item | Q (Ctrl+Q throws the whole stack), or drag it out of a window |
| Eat held food | F or right-click |
| Fish | Hold a fishing rod and right-click water |
| Inventory / crafting / map / journal / help | Tab, C, M, J, H |
| Menu (save, load, CRT toggle, new world) | Esc |
| Toggle CRT / debug overlay | F2 / F3 |

## What's in the world

**Rendering.** The world is a grid of cubes: x/z across the map and 16
vertical layers. It's drawn in an oblique 3/4 view (each cube shows its top
and its south face) with the painter's algorithm, hidden-face culling, soft
edge shading, and entities sorted into the rows they stand in. Walking indoors
cuts the roof and upper walls away so you can see inside; anything that hides
you fades out and can be clicked through. Lighting is a flood-filled light map
(walls block it, windows and open doors let it spill) sampled per visible
surface in screen space, over a day/night sky colour. Torches and lanterns glow
at night, chimneys smoke, weather drifts between clear skies, rain, snow and
fog, and the whole frame goes through the CRT shader.

**World map.** Each map square is one region of 2×2 screens (64×36 tiles).
Biomes are splotches: jittered seed points with random stretch and rotation,
evaluated through a domain-warped distance field, so shapes are irregular and
can be sampled both per map square and per tile. The continent is ringed by
ocean with beaches; mountain splotches become ridged ranges; rivers flow
downhill from the highlands to the sea (or pool into lakes) and meander at tile
level. Press M for the map: it fills in as you explore, villagers' rumours
reveal distant places, and V shows civilization territories.

**Biomes.** Plains, forest, taiga, tundra, desert, savanna, jungle, swamp,
mountains, beach and ocean. Each has its own ground blocks with patchy floor
variants, trees (oak, birch, pine, snowy pine, palm, jungle, acacia, willow,
dead trees, cacti), plants (grass, ferns, flowers, bushes, berries, reeds,
mushrooms, herbs), rocks, ponds or swamp pools, and ores underground.

**Settlements.** Villages (1 map square), towns (2) and walled cities (2×2)
belong to civilizations whose culture (Valeborn, Nordvolk, Sunreach,
Verdani, Kharduum) sets the names and building style. Materials also depend on
the local biome (log cabins and snowy roofs in the north, adobe with flat,
cluttered rooftops in the desert, stone and slate in the highlands). The
settlement's condition matters too: prosperous places get glass windows,
cobbled roads, lamp posts and flower beds; poor ones get cracked and mossy
walls, holes in the roof and dirt roads; abandoned villages are cobwebbed ruins
with loot and monsters at night. Rivers get plank bridges, and water gets piers
and fishing spots. There are houses sized to each household, taverns,
temples with graveyards, smithies, shops, bakeries, libraries, town halls,
guardhouses with training dummies, manors, farms with fenced fields and
scarecrows, market stalls, wells and statues, all furnished inside.

**Villagers.** Population depends on the settlement's size, condition and
culture. Every villager gets a job (farmer, guard, blacksmith, innkeeper,
merchant, priest, scholar, fisher, miner, lumberjack, noble…), a personality
(bravery, sociability, diligence, temper, kindness and early-bird/night-owl
leanings, shown as traits), one to three hobbies (fishing, reading, music,
dice, praying, gardening, sword practice, stargazing…), equipment from their
job and hobbies, a home and a workplace. Only families (partners, children and
grandparents) share a home. Schedules are built from all of this and offset
per person: sleep, breakfast, commute, work, lunch at home or the tavern,
hobbies, dinner, evening socializing and a weekly rest day. Villagers path
tile by tile, open and close doors, claim seats, beds and work spots, and show
what they're doing with little emotes.

When threatened, villagers decide based on personality and job: the brave
fight back (or step in when a friend or relative is hurt), others shout for the
guards, who come running, and the timid run home.

Villagers also talk among themselves. Two neighbours idling side by side
trade a few lines about the tavern's food, taxes, the weather, the latest
notice on the board, someone they're mourning, each other (partners, friends,
rivals, children playing tag) or you, if you're within earshot.

**Towns that run.** Every villager record carries coins, an inventory, skills,
hunger and mood; every business has a till and a store; every household has a
pantry; every settlement starts with a treasury that ranges from nearly empty
(poor villages) to overflowing (prosperous cities). Trappers head out beyond
the walls with bows and swords, check and re-lay their snares, and bring meat
back to the tavern; fishers and farmers sell their catch and harvest; the
cook turns it into meals whose quality depends on skill: *burnt gruel* makes
people (and you) sick, a *savory feast* is a treat. People need to eat every
day: they buy from the kitchen or eat from the family pantry, parents pay for
their children, and when a family can't afford food, the parents (or the older
children) go out foraging and hunting instead. The mayor (a village elder in
villages) reviews the books each morning: raising or lowering taxes, paying for
bread for the hungry, raising fines after thefts, banning drawn weapons after
violence, and throwing a feast day when the coffers are full. The notice board
on the square shows the treasury, taxes, laws and recent events. Traveling
merchants pack local goods, walk out of town, and turn up days later in other
settlements, where you can trade with them on the square.

When you're far away, a settlement isn't stepped frame by frame: its books are
caught up hour by hour (the same rules, fast) the next time it matters, and
merchants and visitors arrive as events.

**Reputation.** Each villager you meet has an opinion of you, from *Hated* to
*Trusted*. Gifts (especially food for the hungry or something for their hobby),
kind conversation and fair trades raise it; insults, violence and stealing
lower it, and a bad name with most of a town sours everyone else there too.
Opinion changes prices, how people greet you (rarely, and only if they like you
or you're a neighbour), how warmly they answer and what they'll talk about.
Conversations have real topics. "Ask about..." covers who they are (ask again
and they tell you something new), what they're doing, their work, local news
(which also reveals other towns on your map), life in town, family (offer
condolences, or ask what happened to someone they lost), directions, the laws,
and anyone they know: their opinion of that person, where to find them right
now, and gossip. Small talk sometimes turns into a question for you ("Have you
tried the tavern's food?"), and your answer pleases or annoys them depending on
who they are. Then there are gifts, trading, favours, and job-specific topics
(citizenship and professions with the mayor, work with a shopkeeper, hiring or
surrendering to a guard, a blessing from the priest).

**Favours.** Ask "Need a hand with anything?" and people may want something:
a cook needs meat, a blacksmith ore, a hungry neighbour a meal, a child some
flowers, a guard or farmer wants beasts put down near town, and someone wants
a letter carried to their partner or a friend. Requests are tracked in the
journal (J), pay what the person can afford (or the treasury, for official
ones), build goodwill, and lapse, with some disappointment, if you take too
long.

**Crime and punishment.** A crime only counts if someone sees it: stealing from
a chest or a snare, harvesting a town's fields, smashing things, trespassing in
a home at night, brandishing a weapon where it's banned, assault and murder.
Witnesses shout, think less of you, and call the guards. Even an unseen murder
or theft is found out eventually: the town asks who was seen near the scene
around that time, and if that was you, you become a suspect. Guards order you
to halt. Come quietly and a guard takes your weapons, ties your hands and leads
you to the cell on a rope; resist and you're beaten unconscious and disarmed
(the town never kills you, unless you've been banished). The mayor, a guard
and the witnesses (each at their own spot) come to the jail and talk it over,
and the hearing decides what can be proven, from what people saw directly and
who was seen nearby, and sets the fine or the hours you'll serve if you can't
pay (sleep on the cot to pass the time). You can plead for mercy. Released
prisoners walk out of the opened cell and get their weapons back, unless they
killed someone. Citizenship is revoked, and repeat serious offenders are
exiled (guards attack on sight) or executed.

**Death and graveyards.** Every settlement has a fenced graveyard with room to
grow; when someone dies (old age, a wolf, you) a gravestone with their name,
trade, day and epitaph is added, and the yard is extended when it fills up.
Families and friends mourn: they visit the grave, go quiet, talk about who they
lost, and gather for a funeral the next afternoon with the priest.

**Citizenship.** Ask the mayor in the town hall to become a citizen. You're
taken in by a family with a spare bed while the town's builders put up a
cottage for you on an empty lot over the next day or two (you can watch it go
up, block by block). Citizens pay a little tax each day, get better prices and
warmer greetings, and your profile reads "Citizen of ..." instead of
"Adventurer". Every building has a hanging sign with its trade (or the
family's name) that you can read.

**Work.** The mayor licenses official professions. Citizens with a clean record
can join the **town watch**: you're sworn in with an iron sword, a bow and
arrows and a guard badge, wear the uniform (which softens blows), are paid from
the treasury for the hours you spend walking your beat between 6:00 and 20:00,
and earn a bounty for every beast killed near town. Licensed **trappers**,
**fishers** and **farmers** get starter tools, a premium from the town's traders
for their goods, and the right to empty the town's snares or harvest its
fields. Shopkeepers may take you on (if they like you and their till can
afford it): be in the shop during their hours and you're paid by the hour at
closing, with a staff discount; skip too many days and you're let go. You can
also **hire a guard** as an escort for a few hours up to three days (if the
town can spare one): they follow you anywhere, fight off beasts, keep you
company, won't stand against the law, and walk home when the contract ends.
The journal (J) shows your job, escort, requests and criminal record.

**Player.** Walk tile by tile, mine with tools or bare hands (blocks drop
items you pick up by walking over them), place blocks and rotate asymmetric
ones, switch the working layer, fight with melee weapons or a bow, toss items,
craft at a workbench, furnace or anvil, trade with shopkeepers (their stock and
purse are real), eat, sit, sleep in beds to pass the night (the world dims and
time races to dawn) and set your spawn point, push through leafy canopies,
and save your game (Esc → Save).

## Code layout

```
src/
  config.js            grid, screen and world constants
  main.js              bootstrap, main loop, title/save/load hooks
  util/                seeded RNG + hashing, simplex noise, binary heap
  world/               blocks, items, recipes, biomes, names,
                       worldgen (world map), terrain (per-column sampling),
                       regiongen (tiles), trees, settlement (layouts,
                       buildings, interiors), loot, region/world storage
  entities/            player, npc (AI), npcgen (jobs, personality, hobbies,
                       schedules, families), creature, item drops, A* pathing
  render/              font (bitmap ASCII), textures + sprites (procedural
                       pixel art), renderer (oblique painter), lighting, crt
  ui/                  character grid + dissolve animation, UI manager/HUD,
                       windows (inventory/profile, journal, containers,
                       crafting, trade, dialogue, map, help, pause, title)
  game/                game rules, input, dialogue, villager chatter, audio
                       (synthesized SFX)
  sim/                 town simulation: economy (meals, trades, taxes, mayors,
                       merchants, abstract catch-up), justice (crimes,
                       suspicion, arrests, hearings), careers (professions,
                       shop work, hired escorts), favours, and the Sim hub
                       (reputation, graves, mourning, citizenship and house
                       building, saving)
tests/                 node:test suites (run headlessly with stubs)
tools/serve.mjs        zero-dependency static server
```
