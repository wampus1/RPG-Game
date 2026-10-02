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
**N** on the title screen for a random world, or **S** to type a seed; either
way you make your character first. **C** continues your latest save and **L**
lists all of them.

```sh
npm test           # world generation, settlement and NPC simulation tests
```

Useful URL parameters for testing: `?autostart&seed=123` skips the title
screen (and the character screen; add `&origin=crash` or `&origin=native` for
a random character with that origin), `&time=1320` starts at 22:00,
`&goto=city` (or a settlement name, a style like `sun`, or `abandoned`)
teleports you there, `&nocrt` starts with the CRT effect off and `&nomusic`
with the music off; `&nointro` skips a new character's opening scene.
`window.__game` exposes the running game.

## Controls

| Action | Keys |
| --- | --- |
| Move (tile by tile) | WASD / arrow keys, hold Shift to sprint |
| Select belt slot | 1–9 or mouse wheel |
| Interact (doors, chests, workbench, furnace, anvil, trade benches, torches, beds, signs, posters, wells…) | Click the block, or F / right-click |
| Mine | Hold left mouse on a block with a tool or an empty hand |
| Place block | Select a block item and click (hold to keep placing) |
| Rotate the block you're about to place | R |
| Turn the camera a quarter turn | Q / E |
| Lock the mining/placing layer | Z / X (Shift + wheel), V returns to AUTO |
| Attack | Left-click a creature or person (a bow, crossbow or sling shoots at range; a javelin is thrown); hold the click for a heavy blow |
| Fight with two blades | Right-click a one-handed weapon in your pack to carry it in the off hand (where a shield goes) |
| Carry a light in the off hand | Right-click a torch, lantern or the Everlight in your pack (it goes where a shield would) |
| Use a Kavorent gadget, or fit an Alloy Edge or Plating | Right-click with it in hand |
| Set down a relic | Hold it and click the ground; click it again to take it up |
| Skip an opening scene | Enter |
| Block / parry | Hold right mouse with a shield (or a weapon) in a fight; raise it just before a blow lands to parry |
| Dodge roll | Space (in the way you're moving, or facing) |
| Talk | Right-click a villager, then pick topics with 1–9 (T trade, G gift) |
| Sit | Click a chair, bench or stool; move to stand up |
| Wait while seated | T, then pick 1–24 hours |
| Raft | Hold a raft and right-click water; A/D turn, W paddles, S back-paddles, F steps ashore |
| Sleep | Click a bed at night (your own, or your host family's guest bed); any key wakes you |
| Toss item | G (Ctrl+G throws the whole stack), or drag it out of a window |
| Set what you hold down on the ground (it stays until you mine it back up) | B (Ctrl+B sets down the whole stack) |
| Eat or drink what you hold, read a newspaper, or put on held armour and clothes | F or right-click |
| Fish | Hold a fishing rod and right-click water |
| Horses | Right-click a wild horse holding an apple, carrot, wheat, berries or cabbage to win it over; right-click your horse holding a saddle to saddle it, then again to ride; F gets down |
| Leads | Make one from 3 string. Right-click an animal holding a lead to lead it; right-click a fence while leading to tie it up; right-click it again to let go (the lead comes back) |
| Wagons | Hold a wagon and right-click the ground to set it down; right-click your horse near it to hitch it, then the wagon to drive; right-click anyone's wagon to climb in the back (move to climb out) |
| Research (as a licensed researcher, at a writing desk in an academy or library) | A/D or ←/→ turn the selected ring, W/S or ↑/↓ pick a ring, Space records the insight once all three marks line up |
| Inventory / crafting / map / journal / help | Tab, C, M, J, H |
| Menu (save and load slots, settings, new game) | Esc |
| Toggle CRT / debug overlay | F2 / F3 |
| Command console (teleport, reveal the map, trigger events…) | ` or / |

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
leanings, shown as traits, plus a quirk such as gossipy, generous, stingy,
superstitious or devout that colours how they talk, pay and haggle), a look of
their own (skin tones, hair colours and styles from afros to topknots, hats,
glasses, earrings, freckles, old scars, patterned shirts), one to three hobbies (fishing, reading, music,
dice, praying, gardening, sword practice, stargazing…), equipment from their
job and hobbies, a home and a workplace. Only families (partners, children and
grandparents) share a home. Schedules are built from all of this and offset
per person: sleep, breakfast, commute, work, lunch at home or the tavern,
hobbies, dinner, evening socializing and a weekly rest day. Villagers path
tile by tile, open and close doors, claim seats, beds and work spots, and show
what they're doing with little emotes.

When threatened, villagers decide based on personality and job: the brave
fight back (or step in when a friend or relative is hurt), others shout for the
guards, who come running, and the timid run home. Trappers never run from
animals: a beast that gets close meets their blade.

Villagers also talk among themselves. Two neighbours idling side by side
trade a few lines about the tavern's food, taxes, the weather, the latest
notice on the board, someone they're mourning, each other (partners, friends,
rivals, children playing tag) or you, if you're within earshot.

**Towns that run.** Every villager record carries coins, an inventory, skills,
hunger and mood; every business has a till and a store; every household has a
pantry; every settlement starts with a treasury that ranges from nearly empty
(poor villages) to overflowing (prosperous cities), kept as coin in the town
hall's chests (take some and the treasury really is poorer). Trappers head out
beyond the walls with bows and swords, set new snares on their hunting grounds
and make rounds to check them, and bring meat back to the tavern; farmers
harvest ripe crops by hand and sow the rows again, and the fields grow back
over the following days (wheat, carrots and cabbage each have their own pace
and stages); fishers and farmers sell their catch and harvest; the
cook turns it into meals whose quality depends on skill: *burnt gruel* makes
people (and you) sick, a *savory feast* is a treat. People need to eat every
day: they buy from the kitchen or eat from the family pantry, parents pay for
their children, and when a family can't afford food, the parents (or the older
children) go out foraging and hunting instead. The mayor (a village elder in
villages) reviews the books each morning: raising or lowering taxes, paying for
bread for the hungry, raising fines after thefts, banning drawn weapons after
violence, and throwing a feast day when the coffers are full. The notice board
on the square has two tabs (←/→ or Tab, or click them). **Town** shows the
treasury, taxes, laws and the realm. **News** shows recent events and news
from other towns. (Taxes and laws aren't on the HUD; check the board.) A town that
loses all its guards asks one of its able adults to take up the spear; if
nobody is left who can, its people pack up and move to another settlement
(their own civilization's if they can), and the place stands deserted. Traveling
merchants pack local goods, walk out of town, and turn up days later in other
settlements, where you can trade with them on the square.

**Towns that grow.** Builders make daily rounds and mend whatever gets broken
(a smashed wall, a missing window, a door), block by block from the original
plan. Every town keeps the trades its other trades depend on: a tavern needs a
cook, and a cook needs farmers, trappers or fishers; a smith needs a miner, a
baker a farmer, a carpenter a lumberjack, a tailor a trapper. When a link is
missing the town retrains someone who can be spared, and when a building is
missing (a tavern, a smithy, a bakery) the council pays for one and the
builders put it up on an open lot (see *Streets and lots* below) and someone
is hired to work it. If nobody can be spared, the
mayor writes for settlers, and newcomers take the job. A forge with no rock to
mine nearby gets its ore by cart from the town's merchants. Miners walk out to
the rock with pickaxes and dig stone, coal and ore out of the face (or down
into a quarry pit), sell the ore to the smithy, and in towns with more than
three guards one of them goes along to keep watch. Families short of room get
a new house from the council, couples with a spare bed have children now and
then, and comfortably-off households pay to have their homes enlarged.
Now and then a band of **nomads** pitches its tents (and lights a fire) on
open ground just outside town, by one of the roads in, and weighs the place up:
room for the whole family, full bellies, safety, fair taxes, and whether anyone
put in a good word (you can). They settle and take up the work the town lacks,
or move on; if all that stops them is a roof, the council may build them one.
A nomad family can even bring a deserted town back to life. Either way, the
tents come down when they've made up their minds. Visiting merchants camp the
same way for their stay: a striped tent, a crate and a barrel of stock. Where
you can see it, the tents go up a piece at a time with one of the party there.

Places grow. Building takes **timber and stone** as well as coin: lumberjacks,
miners and labourers fill the council's stores, and when they run low the
council buys some in from passing traders. As people arrive (babies, nomads,
settlers) the council keeps a bed or two to spare by putting up houses, and
adds the trades a bigger place should have. With enough people, buildings and
money, a **village becomes a town** (a general store, a carpentry, a
guardhouse) and a **town becomes a city** (a library, a tailor, a temple),
with a feast on the square to celebrate. A new city **walls itself in**: its
builders raise a crenellated stone wall round the old edge of town, leaving
the roads open as gates. A walled city that has run out of room pulls down a
stretch of its wall and builds beyond it, and houses and lots outside the old
bounds still belong to the town. The notice board shows the town's stores and
how close it is to growing; the mayor will gladly take timber, stone or coin
from you for the building fund (and remember you for it).

Life goes on: when a mayor dies the town chooses another after a couple of
days, single folk from different families marry and set up home together,
children come of age and take up the family trade (or what the town lacks),
and in the night beasts come to the edge of town, driven off by the watch,
or not, if there's no watch to speak of. People who've gone hungry two days
running forage, bake their own wheat into bread, or are fed by the council.

**Growing up and growing old.** Lives run much faster than in the real world.
A child grows up in about three and a half weeks of game days. A grown-up
works for three to four months before growing old: their hair greys and they
stoop and slow down. Elders give up the hard trades (guards, miners,
lumberjacks, builders, labourers, trappers, fishers and farmers), and the town
finds someone else for the work. Shopkeepers, priests and mayors keep at it.
Old age comes to everyone in the end. It usually takes a few weeks, and each
night the chance gets higher. The notice board notes who is getting on in
years, and the dead are buried and mourned as usual. All of this happens in
every town, including ones you've never visited, and the towns keep their
numbers up with weddings, babies and newcomers.

**Realms.** Each civilization is ruled from its capital, its largest city,
by a ruler who lives there like anyone else. What they're called depends on
the realm: a monarch (a jarl, a thane, a sultan, an emir, a caliph, a satrap,
a protector...), a council of three under its speaker, or a high elder.
Rulers grow old and die like everyone else. A monarch is succeeded by their
eldest grown child, or by a noble of the court. A council fills its empty
seat, and a high elder's place goes to the eldest in the capital. The news
goes up on every notice board in the realm. If another city clearly
outgrows the capital, the court moves there.

The ruler reviews the realm once a week and may issue a decree every town
must keep on top of its own laws:

- a least tax, when the realm is short;
- a weapons ban, when there's trouble across the realm (always, in a martial
  realm);
- a tariff on a hostile realm's merchants, who then pay a cut of their sales
  to the town.

Every town sends a share of its morning taxes to the capital (less under a
kind ruler, more under a hard one). Every other day the capital spends some
of it on a poorer town of the realm. It sends coin for a watch that can't be
paid, or a guard from its own watch where there's none. It can also pay for a
road to the capital, a wall for a town that beasts keep raiding, or coin for
an empty treasury. The notice board shows the realm, its ruler, the decrees,
the tribute and any help received. You can also ask people about the realm
and its ruler.

**Relations between realms.** Two realms are friendly, wary or hostile.
Several things move them:

- trade between their merchants warms them;
- towns of both reaching for the same land cools them (a border dispute goes
  up on both notice boards);
- merchants jeered and short-changed in the other realm's markets cool them;
- a merchant killed by one of the other realm's citizens cools them a lot;
- tariffs rankle;
- gifts between towns across the border warm them.

Relations drift back toward where they started (realms that value the same
things start on better terms).

Hostility has consequences. Merchants won't take their wares into a hostile
realm, towns refuse its letters, the ruler brings in a tariff, and a citizen
of a hostile realm pays more at the market.

**Adventurers** travel from realm to realm, a handful of them in the world at
any time. In each place they stop they pitch a tent and light a fire just
outside town for a day or two. They sell what the road gave them (hides,
bone, ore, a gem now and then) to the shops, subject to the same stock
limits, and buy meals, salves, arrows and better armour from the smithy.
Each day they leave their mark on the town:

- tales at the tavern;
- a bout with the watch;
- beasts hunted down (for a bounty, if the treasury can pay);
- bread for the hungry;
- driving off a night raid.

In a town you're in you'll see them at the market, walking the streets,
sparring with the guards or holding forth at the tavern. You can also meet
them on the road between towns.

Adventurers are far better armed than townsfolk. They carry decent iron, and
the renowned ones wear jewelled armour and carry a jewelled blade and bow.
They are hard to beat in a fight:

- they slip blows and roll clear;
- they turn arrows aside with a blade;
- they keep their distance with a bow;
- they drink a salve when it's going badly;
- they call up their stones in earnest: a ring of fire, a burst of frost, a
  second wind, a thunderclap or a shockwave.

Attack one and lose, and they'll let you live, but take a quarter of your
purse. Kill one and their gear is yours, though in town it's murder like any
other.

How they treat you depends on who you are:

- **You're a citizen somewhere:** you're a local to them. They ask about the
  place, and for ¤30 they'll stay an extra night and stand watch over your
  town.
- **You belong nowhere:** they treat you as one of their own. You can swap
  stories (a place they've been goes on your map), ask for somewhere worth a
  look (a town beasts are troubling), challenge them to a friendly bout for a
  wager, and get a traveller's discount when you trade. A bout is no crime:
  it ends when one of you is down to a quarter of your strength.

Mayors write to each other by the hands of traveling merchants (or a courier,
or you, for a fee): asking for money when the treasury runs low, for guards or
settlers, sending gifts to cool neighbours, proposing closer trade (more
merchants on the road), building a **road** between them (laid tile by tile over
the days that follow, bridged with planks over water, drawn on the map as ═,
and halving the journey), and warning the neighbours about criminals. A town
that was warned about you greets you coolly and thinks less of you. The mayor
may ask you to carry a sealed dispatch to another town's mayor: they tell you
which way it is and how many hours' walk, and mark it on your map (the letter
goes in your journal). Ask a mayor about the neighbouring towns and they'll
tell you where each one lies, who governs it and how the two towns get on.

Traveling merchants carry the news both ways: what's happened in their home
town goes with them, and they bring back word from where they've been. Ask
around ("Any news?") or read it on the notice board under *News from afar*,
where it fades as it goes stale and comes down after two days.
Out in the country you may meet a merchant on the road between two towns
(along the new road, if there is one), pack on their back, happy to trade
from it before walking on. Travellers keep to the land: down the road where
one's finished, otherwise the long way round lakes and rivers. Someone on foot
with no way round pushes a raft out and paddles across; a rider or a wagon
looks hard for a way round first and fords the river only if there isn't one.
Townsfolk visiting another town just look about: only merchants cry their
wares.

Furniture, barrels and other props are never placed where they'd block a
doorway, and whoever you're talking to (or trading with) stops to listen.
Voices inside a building stay inside: you only see what people say indoors
when you're in there with them, or near an open door. About a third of the
guards in a town of three or more keep the night watch. While you sleep and
time races, everyone else keeps pace, and so do the animals and monsters
within forty tiles or so of you (further off, they carry on as normal).

**Weather** is the same for everyone: rain, snow and fog come and go over each
part of the world in spells of a few hours, whether you're there or not.
People talk about it (farmers are glad of the rain, children want to build
snowmen), and in rain or snow the lazier and gloomier outdoor workers knock
off early and go home, while the hardworking carry on. Rain soaks the fields
(the soil darkens), and **moist farmland grows crops twice as fast**; it
dries out a day after the rain stops. On dry days farmers fill a bucket at the
well and water their rows, and so can you: craft a wooden bucket (or buy one),
fill it at a well or open water, and pour it over a patch of farmland.

When you're far away, a settlement isn't stepped frame by frame: its books are
caught up hour by hour (the same rules, fast) the next time it matters (up to
the last month and a half), towns you've been to keep ticking over in the
background, building work carries on through those days, and merchants and
visitors arrive as events. Leave a town for a few weeks and come back to find
new faces, new houses and perhaps a different mayor.

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

Killing a beast that was after someone earns their gratitude, and their
family's, and anyone who saw it thinks better of you too. Such deeds (and
favours, dispatches carried, bounties, a good word for newcomers) add up to
**renown** with a town: enough and you're its *Friend*, more and its *Hero*.
People greet you by your title, think better of you from the start, and the
mayor offers you the good-worker price; your best title shows in the journal
and on your profile.

**Favours.** Ask "Need a hand with anything?" and people may want something:
a cook needs meat, a blacksmith ore, a hungry neighbour a meal, a child some
flowers, a guard or farmer wants beasts put down near town, and someone wants
a letter carried to their partner or a friend. Requests are tracked in the
journal (J), pay what the person can afford (or the treasury, for official
ones), build goodwill, and lapse, with some disappointment, if you take too
long.

**Crime and punishment.** A crime only counts if someone sees it, and people
only see what's in front of them: walls and closed doors block their view
(windows and open doors don't), and someone with their back turned only
notices what happens right behind them. Crimes include stealing from
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
killed someone. Break out instead and an empty cell tells its own story: you're
wanted, guards who spot you try to arrest you, and one of them goes to patch the
jail up, bar by bar. Citizenship is revoked, and repeat serious offenders are
exiled (guards attack on sight) or executed. A citizen the town has come to
hate gets a visit from the mayor: mend your ways within a few days, or lose
your citizenship.

**Death and graveyards.** Every settlement has a fenced graveyard with room to
grow; when someone dies (old age, a wolf, you) a gravestone with their name,
trade, day and epitaph is added, and the yard is extended when it fills up.
Families and friends mourn: they visit the grave, go quiet, talk about who they
lost, and gather for a funeral the next afternoon with the priest.

**Citizenship.** Ask the mayor in the town hall to become a citizen. You're
taken in by a family with a spare bed while the town's builders put up a
cottage for you on an open lot with a street at its door (if none is free, it
waits for the next one) over the next day or two (you can watch it go
up, block by block, as soon as the builders are on site). While you stay with
them, their home is yours: sleep in any free bed, use their chests. Citizens pay a little tax each day, get better prices and
warmer greetings, and your profile reads "Citizen of ..." instead of
"Adventurer". Ask the mayor (or a builder) to enlarge your house, from a
cottage to a proper house to a family home with six beds: builders put it up
around the old one, keeping your door. The mayor takes a quarter off for
citizens who've done good work for the town; a builder pockets the fee, and
charges friends less. Every building has a hanging sign with its trade (or the
family's name) that you can read.

**Work.** The mayor licenses official professions. Citizens with a clean record
can join the **town watch**: you're sworn in with an iron sword, a bow and
arrows and a guard badge, wear the uniform (which softens blows), are paid from
the treasury for the hours you spend walking your beat between 6:00 and 20:00,
and earn a bounty for every beast killed near town. Guards may carry weapons
where arms are banned, but a guard held on trial, or one who insults the
mayor, is thrown off the watch and hands back the badge and kit. Licensed **trappers**,
**fishers** and **farmers** get starter tools, a premium from the town's traders
for their goods, and the right to empty the town's snares or harvest its
fields, and once or twice a day townsfolk seek you out to buy your goods.
Shopkeepers may take you on (if they like you and their till can afford it).
You're paid at closing for work actually done: each shift brings chores (take
stock of the shop's chests and barrels, bring in supplies and put them away),
and customers come in to buy from the shop's stock through you. On shift you
may use the shop's containers freely; you also get a staff discount.
Insulting or attacking your employer gets you fired on the spot, and skipping
too many days gets you let go. Discounts show in the trade window as the old
price struck through in red. You can **hire a guard** as an escort for a few
hours up to three days (if the town can spare one): they follow you anywhere,
fight off beasts, keep you company, won't stand against the law, and walk
home when the contract ends. Good friends (people who like you a lot) will
come along as **companions** for free until you send them home, or until you
lose their respect. The journal (J) shows your job and chores, escort,
requests and criminal record. People you've just done a favour for won't ask
again for a day or two.

**Player.** Walk tile by tile, mine with tools or bare hands (blocks drop
items you pick up by walking over them), place blocks and rotate asymmetric
ones, switch the working layer, fight with melee weapons or a bow, toss items,
craft at a workbench, furnace or anvil, trade with shopkeepers (their stock and
purse are real), eat, sit, sleep in beds to pass the night (the world dims and
time races to dawn) and set your spawn point, push through leafy canopies,
till farmland with a hoe and plant wheat seeds, carrots or cabbage seeds (a hoe
also brings in a bigger harvest), and save your game (Esc → Save; the game
also saves itself every morning at 7:00). **Fishing** takes patience: cast
into water with a rod, watch the bobber (nibbles make it twitch), press SPACE
when it goes under, then hold SPACE to keep the green catch zone over the fish
until the line is in. Fishers in town have their lines in the water too. The
first drink from each well you find, and the first night's sleep in each
village, make you a little hardier (+1 max HP each, up to a limit). The
Wanted banner fades once you're away from the town that wants you.

**Who you are.** A new game starts on the character screen: your name, skin,
hair, face, shirt, trousers and accent colour (with a turning preview), your
starting gear (wanderer, soldier, fisher, farmer, builder or merchant), four
stats to spread points across (Strength for harder blows and quicker digging,
Agility for speed, Endurance for health, Charm for prices and making
friends), two specialties (Angler, Haggler, Forager, Digger, Brawler, Green
Thumb, Light Step, Herbalist) and up to two traits (Honest Face, Tough,
Strong Swimmer, Lucky, Early Riser, or a flaw like Frail, Blunt or
Heavy-Footed that gives a stat point back). Then pick where you come from:
**Crash Landing** wakes you on a beach beside the wreck of your ship, with a
battered chest of what washed ashore and nobody on the island who knows you;
**Island Native** starts you at home in one of the island's towns, a
citizen living with your family, and everyone there knows you and likes you.

**Armour and clothes.** Fifteen pieces to wear on your head, body, legs and
feet: leather caps, tunics, trousers and boots, iron helmets, chainmail,
breastplates, greaves and boots, straw hats, wool hoods, linen shirts, a fine
coat and a gold circlet. They show on your character, take a share off every
blow (up to 60%), sit in the Worn column of the inventory (right-click one to
put it on, click a worn piece to take it off), can be sewn by hand or forged
at the anvil, and are sold (and bought) by smiths, tailors and trappers.

**Saves.** Five save slots and an autosave (written every morning at 7:00),
each showing who, where and when; save or load from the menu, or pick up
where you left off from the title screen. Games are compressed and kept in the
browser's database, which has far more room than its small local storage, so
saving doesn't fail on a big world. Older saves still load.

**Town life, continued.** Children out playing find each other and start a
game of **tag** (whoever's it chases the rest until they catch one) or
**hide-and-seek** (one counts at the base while the others tuck themselves in
behind walls, barrels and trees, then goes looking), on the streets, round
their houses or on the square. Meals, lessons (morning and afternoon classes)
and guard shifts are staggered, so a town is never all at lunch at once.
Every town has an **alarm bell** (two in a town, four in a city, spread out so
one is always near): a night guard who spots trouble while the rest of the
watch sleeps runs to the nearest bell and rings it, and every guard turns
out. You can ring one too, but the watch won't thank you for a false alarm.
Taxes are really collected: fractions of a coin carry over, so even small
earners pay and a higher rate brings in more (the notice board shows what was
collected), and citizens pay a small head tax plus the rate on what they
earned in town (the journal shows the last bill). Builders who like you knock
10-30% off enlarging your house, and knocking bits out of your own house
upsets nobody. Market stalls face the square, three counters wide with the
awning up on posts so you can see who's selling. New lots and extensions keep
clear of gates and the roads out of them. Weather covers wider areas, changes
in six-hour spells and drifts slowly across the island.

**Laws.** Every town has its own laws, from six: a weapons ban, a curfew
(nobody in the streets from ten at night to five; guards send you home, then
fine you), a tariff on outsiders, a game law (only licensed trappers hunt
near town), a tree law (no felling in town) and an open market (cheaper
prices). Each has townsfolk for and against it: trappers like the game law,
barkeeps hate a curfew. Every morning the mayor weighs public feeling and
what's been happening (violence, night-time trouble, poaching, felling, the
state of the coffers) and may pass or repeal one. You can take a hand: ask
the mayor to consider a petition, go round the town collecting signatures
(people sign or refuse depending on their own views and what they think of
you), and bring it back. Ask anyone about the laws and they'll tell you what
they make of them.

**Trades.** Licences depend on the size of the place: trapper, fisher,
farmer, woodcutter and miner anywhere; herbalist, baker, smith and tailor in
towns and cities; scribe and jeweller only in cities. Townsfolk come to buy
only what their own work needs (a cook wants your meat, a smith your ore),
or plain food for the table.

**Voices.** Everyone speaks in their own consistent way: mayors, nobles and
priests formally, miners and trappers roughly ("aye", "nothin'"), the
hot-headed gruffly, the shy tersely, children brightly, with a word they
call you by and habits they come back to. Townsfolk talk among themselves
about their work, the laws (and argue), funerals, weddings and babies, the
new mayor, the alarm bell, news from other towns, shared hobbies and old
times. When someone dies, a relative carries a gravestone out to the
graveyard a little later, and family and friends gather for the funeral the
next afternoon, whatever else they had planned. Children don't always play
games: they wander, stand about, sit on benches; in tag the tagger runs off
shouting "You're it!" while the new one counts to three.

**Settings.** Music and sound volume, the CRT effect with its curvature and
glow, screen shake, damage numbers and window animations, from the title
screen (O) or the menu, and remembered between games. The character screen
has tabs (basics, looks, stats, skills, traits) with hats, beards and face
details, clothes styles and patterns, shoes, stance, more colours and eleven
starting kits.

**Sound and music.** Footsteps that sound like what you walk on, chopping,
chipping and harvesting, armour clanks, bows, buckets, the fishing reel and
the bite, a bell, children squealing, chests, sleep and a fanfare for new
titles; birds, crickets, owls, frogs, gulls, waves, wind and wolves by place
and time of day. The music is made up as
it plays and follows you: a theme for each biome (a pentatonic stroll on the
plains, a Hijaz scale in the desert, a cold sparse tune on the tundra), one
for villages, towns and cities (quieter at night) and taverns, an eerie one
in ruins and abandoned places, a slow tolling one in graveyards, and battle
music when beasts or the town guard come for you. Set its volume in the
settings.

**Rafts.** Craft one at a workbench (planks, sticks and string) or buy one
from a fisher or a carpenter. Push it out onto open water and climb on: it
turns on the spot with A and D, picks up speed gradually as you paddle and
drifts to a stop. It moves smoothly, not tile by tile, and the logs are
turned pixel by pixel to face any heading, with you sitting on top. Merchants
travelling between two towns on the same river or coast go by raft too,
which is quicker than the road.

**Streets and lots.** Towns grow along their roads. When a town runs short of
open lots, or something is waiting for one, its builders lay a new street
(two tiles wide, a stretch at a time) out from the end of an existing one, and
the town's ground grows to take it in. Lots are marked out along both sides,
each a doorstep back from the street with a sign on it (read it to see the
lot's size and what's waiting to be built). Every new building, including
your workshop and your house, needs an open lot with a street at its door. If
none is free, it waits its turn and goes up as soon as one is.

**Towns building.** When a town puts up a new building, the builders lay a
road from the lot to the nearest street first. A sign on the site says what
is going up, when it was started, how far along it is and who is working on
it; it comes down once the frame is up. New lots keep a couple of blocks
clear of the houses already there, and their doors face the nearest street.

Nothing appears out of thin air. Streets, doorsteps, lot signs, paths to new
lots, city walls and the sets for weddings and feasts are all put in by the
builders, block by block. In a town you're in, a block only goes in within
reach of a builder, and the crew walks along the job as it goes. A wall goes
up a stretch at a time round the town, and each stretch is finished before
the next. A town's crew takes one job at a time: a wedding or feast set
first, then whatever was started first. Roads between towns are laid a tile
at a time from both ends during the working day, until they meet. A road
starts at the end of one of the town's main streets (in a city, at one of
its gates), runs straight out for a stretch, then heads across country. On
the world map a road is a thin, faint line along the way it really runs,
drawn over the land, and only the stretches built so far and in places
you've seen. While you
sleep or wait, the work carries on at the usual pace.

**Towns you've never seen.** Every town, including those in lands you haven't
found yet, draws up its plans a few seconds into the game. From then on it
grows, trades, lays streets, orders and builds buildings, and holds its
weddings and feasts, whether or not you're there to see it.

**Shops and shopping.** Shopkeepers, smiths, tailors, carpenters, herbalists,
scholars and stallholders earn only what they sell. Their takings come from
people who need what they stock, and those people walk to the shop or stall
and buy it over the counter (you'll hear them ask for it, and the shopkeeper
name the price). People shop for:
- worn-out tools of their trade: a miner's pickaxe, a trapper's arrows, a
  farmer's hoe, a fisher's line;
- new clothes now and then, and something fine if they can afford it;
- things for the house, bought by whoever keeps it;
- salves when they're ill or hurt;
- books and ink, for readers;
- armour, and now and then something jewelled, for guards.

Shops restock from outside suppliers and keep enough back for wages.

**Selling to traders.** A trader doesn't want a heap of one thing. Once
they have a couple of something, each one you sell them pays a little less,
and at eight they won't take any more. The trade window tells you when
they're getting full up. A little of the surplus goes to passing traders
each day, so in time they'll buy again. This doesn't apply to the goods
their trade runs on: a cook or innkeeper takes all the fish, meat and
vegetables you bring, a smith all the ore, coal and ingots, a carpenter all
the logs and planks, a tailor all the leather and cloth, and so on.

**Merchants** come in three standings: peddlers, traders and master merchants
(master merchants only from a realm with Guild Charters).
The better the merchant, the more they start with (a master merchant's stock
includes gems, gold, fine clothes and jewelled weapons), the bigger their
purse, and the more they make on a trading trip. Their standing shows as their
title when you talk to them.

**Blue hearts.** Drinking from a well (where the realm knows Clean Wells) or
sleeping in a town's bed (where it knows Hospitality) gives you blue hearts on
top of your red ones. They take damage first and break when the day ends.
Townsfolk who sleep in proper beds wake with them too.

**Alarm bells and healing.** Townsfolk run to ring the alarm bell when
something attacks. Guards deal with the threat themselves and only ring a
bell that is within ten tiles. A badly hurt guard rings the bell if one is
close, or falls back to the other guards. Wounded townsfolk heal by eating,
or by praying at the temple, where a priest may bless them.

**Morning hearings.** Arrested at night, you stay locked in the cell until
morning, when the mayor, the guard and the witnesses are up. You can sleep on
the cot while you wait. Witnesses are also harder to come by: it's harder to
see in the dark, people further away often miss things, and people busy with
work or a meal notice less.

**Couriers.** A mayor with a letter and no merchant heading that way pays
someone from town to take it. They walk it there and come back to collect
their pay.

**Weather and waiting.** Clear spells are longer. Deserts, savannas and
beaches rarely see rain and never see snow. Weather moves faster when time
is sped up, for example while sleeping or waiting. The notice board keeps a
longer history, which you can scroll with the mouse wheel or the arrow keys.
The title screen has music once you click or press a key; browsers don't
allow sound before that.

**Turning the camera.** Q and E turn the view a quarter turn either way, so
you can see behind buildings. The world visibly swings round to the new view.
Market stall canopies keep their stripes and colour whichever way you look.
While the view turns, time and you stand still. The HUD, falling rain and snow
and people's speech bubbles stay upright while the world swings round under
them; fog and the grey of a wet day turn with it, dimmed by the night as ever.
Movement keys always move you across the screen,
the minimap turns with the view (N marks north), and the placement arrow shows
which way a block will face. A new world always starts with north up; a saved
game keeps the view you left it in.

**Pointing and building.** Whatever is drawn under the mouse is what you point
at, down to the pixel: a lamp post, a person in front of a wall, or the top or
front of a block. Blocks go onto the face you point at, and the tooltip says
what your tool will do and why a block can't go somewhere. An icon in it shows
the tool that mines the block best, and its outline turns red when the block is
out of reach.

**Belonging to a town.** As a citizen you count in the town's population (the
notice board says "you among them"), and on the watch you count as one of its
guards. Losing your citizenship costs the town a citizen. Joining the watch
gives you a uniform in the civilization's colours (a tabard, a helmet and
boots) to wear from your pack; the uniform is what protects you, and it goes
back when you leave the watch. Night duty pays a quarter more than day duty.

**Licences and workshops.** Every licence has a fee. The more a town needs a
trade, the less it charges; citizens pay a quarter less, and joining the watch
is free. Trades that need a building (tailor, herbalist, scribe, jeweller,
baker, smith) cost more, and the builders put up a workshop for you on an open
lot, with your bench inside. If no lot is free, the workshop is ordered and
waits for the next one. Ask the mayor, or any builder or carpenter, "How's my
workshop coming along?" (or your house): they'll tell you whether it's still
waiting (and how far the new street has got), how far along it is and how many
builders are on it.

**Trade benches.** Each trade has its own bench, which only a licensed holder
can use:
- Tailor's loom: clothes dyed in seven colours, which add charisma so people
  warm to you.
- Herbalist's still: potions. Vigor gives blue hearts; Might, Swiftness,
  Fortitude and Charm raise an ability for a few hours.
- Scribe's desk: pick up to four stories from the town's record and news from
  afar, and print copies of a newspaper on paper and ink. Hand them out when
  you talk to people: they read it, talk about it, and may pay a coin.
- Jeweller's bench: set a cut gem into a weapon or armour through a timing
  game under a loupe: the stone sits in a gold collet with four claws round
  it, and a gleam of light runs round the rim. Press as the gleam crosses a
  claw and the pusher bends it down over the stone; each slip puts a crack
  through the stone, and a third shatters it. Each gem raises an ability, and what else it does depends on what
  it's set in (see *Gems* below). Jewelled gear looks like the plain piece,
  wrapped in a pulsing glow the colour of its stone (a thinner one out in the
  world than in your pack). Worn jewelled armour has a faint glow round its
  outline, on you or a guard.

**Gems.** A stone works differently in a blade, a bow or armour, and the same
effects work for guards who carry jewelled gear:

| Stone | In a blade | In a bow | In armour |
| --- | --- | --- | --- |
| Ruby | each swing throws an arc of flame toward the mouse pointer (at their foe, for a guard); it spreads a few paces and sets alight whoever it catches, so mind where you swing it in town | arrows burst into flame where they land, scorching all around | whoever strikes you catches fire |
| Sapphire | swings faster, and chills (slows) what it cuts | arrows fly faster and frost what they hit | whoever strikes you is chilled |
| Emerald | each hit mends you a little | each arrow that strikes mends you | your wounds slowly close by themselves |
| Topaz | hits sometimes leap as lightning to another foe | arrows call down a dazzling flash | attackers may be dazzled |
| Amethyst | blows stagger and throw foes back | arrows knock their target back | part of every blow is turned back on the attacker |

Each ability shows: flame arcs, frost rings, green crosses for mending, lightning
between foes, violet shock rings. Anything on fire burns with animated flames,
embers and smoke; a stunned foe has stars circling its head, and a chilled one
sparkles with frost.

Guards with coin to spare buy jewelled pieces from master merchants, or from
you if you're a jeweller. Miners who turn up a rough gem or some gold bring it
to a jeweller to sell.

Wooden recipes take any kind of plank or log.

**Born here.** Starting as a native gives you your family's surname, parents
and brothers and sisters who treat you as family, and their house as your
home. People think of you as one of their own, not a newcomer. The mayor can
have a place of your own built, cheaper than for incomers.

**Guards** don't walk through people: they push through crowds ("Make way!"),
and a prisoner on their rope is pulled through after them.

**In the cell overnight.** Locked up at night with the hearing in the morning,
you can sleep on the cot until seven.

**Names.** People, families (including trade surnames like Cooper and
Fletcher), civilizations (a Sultanate, a Jarldom, the Free Cities...), taverns
and shops (The Red Anvil, The Golden Crust...) are drawn from much bigger
pools of names.

**Children** spend less time playing. They wander the streets or tag along with
a parent at work, helping out.

**Towns on the map** grow their icons as they grow: one cell for a village,
two for a town, a block of four for a city, with a double outline once walled.
A town that has grown only spreads into a neighbouring square of the map once
one of its streets actually runs into it.

**Weddings and feast days.** A wedding, a feast day or the celebration of a
town growing is announced two days ahead on the notice board. The day before,
someone goes round town putting up posters (a heart for a wedding, a sun for a
feast) that you can read. On the day, the builders put up the set:
- for a wedding, a flower arch, lights, a rug aisle and rows of benches;
- for a feast, laden tables, bunting strung between posts, and something to
  dance round. What that is depends on the people:

| People | Dance round | Lights | Colours and banners |
| --- | --- | --- | --- |
| Valeborn | a ribboned maypole | lanterns | red, gold, blue and green; a gold star on red |
| Nordvolk | a bonfire | torches | blue, white and red; a white cross on blue |
| Sunreach | a lantern post in a ring of rugs | lanterns | gold, crimson, teal and indigo; a crescent on crimson |
| Verdani | a fire pit, with flowers where people stand | torches | orange, green, pink and yellow; zigzags on green |
| Kharduum | an anvil | lanterns | dark red, gold and iron grey; a hammer on red |

The builders also go all round town: bunting strung across the streets from
house to house, banners by the doors of the hall, the tavern and the temple and
at the roads in (more for a town's own celebration), all in the town's
colours. A wedding's are white and pink, with flowers at the couple's door.
The more a town has grown, the more of it they dress.

In the hour or so before it starts, guests drift in a few at a time: the
couple and whoever leads it first, then the keen and the early risers, with
the lazy and the scatterbrained just in time or a little late. Not everyone
goes. Family and friends of the couple nearly always do, as do the outgoing
and the cheerful. The shy, the gloomy, the grieving, the unwell, anyone in a
low mood and most of the watch stay away, and they'll tell you why if you ask.

At a wedding, family and friends take the benches, the priest (or the mayor)
marries the couple under the arch, and everyone cheers. Guests standing keep
a little room around them, and it's a quiet affair: a remark now and then,
one at a time. At a feast, people eat
at the tables, the cooks serve, and dancers go round and round the maypole.
Everyone who went is in better spirits afterwards, and turning up yourself
earns you some goodwill. The next morning the builders take it all down and
the posters come down.

**Outings.** Now and then someone in town decides to go and see another town of
the realm, more often when there's a wedding, a feast or a celebration on
there. They ask a friend or two along (their partner, family and friends first),
and the watch usually sends a guard with them. The mayor and the people the town
can't do without (the guards, the cook, the herbalist, the priest, the smith, the
builders) rarely go, and never more than about a fifth of a town is away at once.
They take the town's wagon and horses if they're free, and otherwise walk.
Where you're a citizen and the one planning it likes you, they come and ask you
along: say yes and they'll wait for you by the road out of town when it's time to
go. At the other end they stay for the do (or a day), look round the town, go to
the tavern of an evening and tie their horses at the hitching post. Back home
they talk about it to the ones who went with them and to the ones who didn't, and
they'll tell you about it if you ask. Once in a while someone liked the place so
much that they pack up and move there.

**Horses and wagons.** A town keeps a few horses and, once it has a carpenter
with timber and coin, a wagon or two (a village one or two horses, a city up to
six and three wagons). An animal handler (taken on from the labourers, farmers
or anyone else the town has plenty of) breaks in wild horses; wild horses graze
the plains and savanna. They stand tied to a hitching post by the road into
town, with the wagons beside them. The town's merchants take a wagon (more goods,
quicker) or a horse (quicker still) when one is free, as do townsfolk on an
outing. Riders and drivers get down when they reach their camp or their
destination, and tie their horses to a post with a lead. Townsfolk on an outing
ride in the back of the wagon. Once a town has two horses and money to spare it
builds stables, with a stall for each horse; the handler works there, and the
wagons stand out front. Until then the horses are tied to the hitching post.

**Your own horse.** Wild horses on the plains and savanna can be won over with
food: offer two to four apples, carrots, wheat, berries or cabbages and it's
yours. Put a saddle on it (made at a workbench) and you can ride it, a good deal
quicker than on foot. F gets you down, and it waits where you leave it.

**Town horses.** The animal handler saddles the town's horses one by one
(with leather from the stores, or bought in). As a citizen you can right-click
one of the town's horses to untie it and take it out. If it's saddled, ride
it; if not, you can put your own saddle on. Get down near its stables or
hitching post and it goes back in (your own saddle comes back to you). Anyone
else is told to keep their hands off. If you break the post a horse or any
other animal is tied to, it pulls free and wanders off. A town's or a
trader's horse turns up back at its post about half a day later.

**Leads.** A lead (3 string, by hand) goes on any animal or beast: hold it
and right-click the creature. It follows you about. Right-click a fence post
to tie it there, and right-click it again to take it back on the lead or let
it go. Calm animals never break free. A beast that wants a fight (a wolf, a
slime, a skeleton, a boar you've angered) strains against it. A bar over its
head fills up, and after about 14 seconds (20 for an angry boar) it snaps the
lead and comes for you. While it's tied up it bites anyone who stands too
close. If you get too far ahead, the lead slips out of your hand. Animals
aren't kept in a save, so any leads on them come back to your pack when you
load.

**Cooking with fire.** Meat from a beast that dies while it's on fire (from
a ruby blade, a ruby arrow or a ruby-set armour's flames) drops already roasted.

**Your own wagon.** A wagon is made at a workbench. Set it down, bring a horse of
yours close and right-click the horse to back it into the shafts (or ride up to
the wagon and right-click it). Then right-click the wagon to take the reins.
Anyone's wagon, yours or a town's or a trader's, you can climb into the back of
and sit a while. A covered wagon keeps its canvas up over you, with the sides
rolled up so you (and anyone else riding in the back) can be seen.

**Trading companies.** Three companies of traders wander the roads and never
settle anywhere. Each has a banner on its wagons' canvas and on its horses'
saddle cloths, one or two wagons pulled by horses, a trader or two, a driver and
a guard on horseback. They travel by day. At night they pitch a striped tent by
the roadside, light a fire, park the wagons and tie up the horses, and set off
again at first light. Reaching a town, they camp outside it for a day or two and
trade: their goods from far away go to the shop, the smith, the tailor and the
herbalist and to townsfolk with coin to spare, and they buy food and the
town's produce for the road. You can trade with them, and ask where they're
bound, about the company and about the road.

**Nomads** turn up a little more often, and some bands travel with a plain
wagon and a horse or two, with no banners.

**Breaking away.** A town far from its capital that pays its tribute and gets
little back grows restless, and more so under a harsh ruler, a high tax floor or
a hostile realm next door. The notice board shows how much support there is for
leaving. When enough people want it, the town declares itself a free state,
with its own colours on the map, and its old realm counts it as hostile. A town
close enough to another realm's border may swear itself to that realm instead,
which its old realm takes even worse.

**Walls and gates.** City gates have real gates. They stand open by day. At
night a guard on watch shuts them ("Closing the gates for the night!") and opens
them again for anyone who needs to pass, closing them about five seconds after. From inside you can lift the bar
yourself; from outside, with no guard nearby, the gate stays barred till morning.
When a walled city has grown past its walls, the builders put up a new ring of
wall round the houses outside, with gates where the roads go through.

**Herbalists** are fairly common in villages and towns as well as cities. Outside
cities they sell herbs and salves, not potions (and nobody brews potions until
the realm has learned Alchemy). Townsfolk who are ill or hurt go
to them to be tended.

**Setting things down.** You can put what you're holding down on the ground (B).
It stays where it is: walking over it doesn't pick it up, and it doesn't get in
anyone's way. Mine it to take it back. Pointing at it shows what it is and whose.
Something on a table or counter sits on top of it, so it's drawn above
neighbouring blocks that are lower down.

Townsfolk only set things down for a reason. At the tavern a barkeep, innkeeper
or cook brings a meal to the table for someone who's paid for one. They sit and
eat a while and leave a dirty dish, which the staff come round and clear. A
merchant sets out a thing or two they have plenty of on the counter beside them.
It's still for sale, and they take it off when it sells out. Taking something
that isn't yours (someone's dinner, a piece off the counter) is theft if someone
sees, and a piece taken off a merchant's counter is gone from their stock. If
nobody sees, the merchant notices it's missing later.

**Thefts add up.** Several things taken from the same building (or the same
owner) within an hour or so count as one theft of all of it, not a string of
separate ones.

**Curfew.** Where there's a curfew, a guard on night watch who sees you out in
the streets after ten comes over and tells you to get indoors. If you're still
out a little later, they fine you. Guards also send townsfolk still out after
curfew home.

**Funerals.** Mourners stand spread out along the graveyard paths and just
outside the gate, a pace apart, with the priest at the foot of the grave.

**Bigger towns.** Villages and towns start with a few more people and a few more
guards, and a place needs more people (26 for a town, 50 for a city), buildings
and money to move up a size.

**Busy hands.** You can see what people are doing. Dice players throw two real
dice onto the table and cheer or groan at the faces. Food goes down a bite at a
time: the plate's picture gets smaller and crumbs and chunks of the food fall
off it (you get them too when you eat). At the tavern the barkeep pours, a mug
of ale is set down in front of whoever's drinking, foam flies with every sip,
and when they're done an empty mug is left on the table for the staff to clear.
Cooks go back and forth to the hearth or oven with the pot on and steam
rising, and someone at home puts breakfast on of a morning. Smiths throw
sparks, carpenters sawdust, bakers flour; pipes smoke, lutes give off notes,
scribes blot ink. Merchants toss the coin and hand over what you bought.

**Roads between towns** don't run straight. They find a way across the land,
with bends and corners, and they're built a stretch at a time by the builders
of the towns at each end, working out from both. Go to the end of a road being
built during working hours and you'll find the crew there, digging. They walk
out from town to it in the morning and back along it in the evening (and when
it's finished), never just appearing or vanishing where you can see. Every
realm pays for its roads from the capital, however far it is from you: out
from the capital to each of its towns first, then between its towns, then to
a friendly neighbour. Free towns on good terms with a neighbour ask for one by
letter. On the world
map a road shows as a line through each square it crosses: straight across,
straight down, or round a corner. Every town starts with a builder, and takes
another on if it loses theirs. When a ruler or a mayor dies, someone always
takes their place.

**What the realm knows.** Every realm (and every free town) works through a
tree of learning: four branches of seven arts, each starting from one root,
splitting into two lines and joining again at a capstone that needs both. An
art needs the one before it on its line.

| Branch | Root | One line | The other line | Capstone |
| --- | --- | --- | --- | --- |
| Economy | Bookkeeping: taxes bring in a tenth more | Guild Charters (master merchants) → Gemcraft (jewellers, jewelled gear) → Banking (treasuries earn interest) | Market Days (merchants come nearly twice as often) → Caravan Law (merchants travel faster and are harried less) | Trade League: trade warms relations half again as fast, tariffs rankle half as much |
| Warfare | Drilled Watch: guards are tougher and hit harder | Archery (guards carry bows) → Cavalry (the watch rides out, armies field riders) | Muster Rolls (levies half again as large) → Field Fortifications (log walls in battle, town walls sooner) | Steelworking (steel swords), then Siegecraft: a won battle takes the town behind it far more often, capitals too |
| Law & Society | Written Law: the ruler sets how many stand watch | Alchemy (potions) → Hospitality (blue hearts from beds) → Schools (research a quarter faster) | Prisons (a great prison for the capital, fewer escapes) → Conscription (elders and children may be drafted) | Embassies: alliances come easier, wars are declared half as often |
| Engineering | Masonry: building goes a quarter faster | Clean Wells (blue hearts from wells) → Watermills (fields yield more) → Aqueducts (more children born) | Surveying (roads half again as fast) → Cranes (building faster still) | Fortification: walled towns hold far better |

Some realms start with a first step their culture holds dear. The ruler (a free
town's mayor) chooses what's studied next: their own leanings, their people's,
and what's going on (raids and war call for arms, an empty treasury for trade,
unrest for law). Ask a mayor "What are our scholars studying?" to see the tree:
the four branches run out from the realm's crest in the middle, each art an
icon. Hover one to see what it does, scroll (or +/-) to zoom, drag (or the
arrow keys) to look around, and click an art to fly to it and open a side panel
with what it does, its story, how much study it needs and what it leads to.
Learned arts glow, the one being studied shows how far along it is, Home or
Space brings the view back to the middle, and Esc closes the tree.

**Research.** The study is done by researchers at an academy (scholars at the
library help a little before there is one). A realm's capital, and later its
cities, build an academy once they can afford it and take researchers on. You
can be one too: ask the mayor for the researcher's licence (a town or city with
an academy or library). At a writing desk there, an astrolabe of three brass
rings turns slowly, each with a marked glyph. Turn the selected ring with
A/D or the arrows (the ring inside it turns half as far the other way), pick a
ring with W/S, and when all three marks sit under the pointer, press Space to
write the insight down before the candle burns out. Each one moves the work on
and the town pays you for it.

**Borders.** A realm's land on the map grows as it grows (more people, a
bigger watch, more learning, a full treasury) and shrinks when it loses towns
or wears itself out in a war. Land next to its own towns that a neighbour holds
is wanted most: a stronger realm sets boundary stones there, which is a border
dispute, and sometimes takes the land. A free village surrounded by a realm's
land may swear itself to it. Press V on the map to see the territories.

**Alliances.** Realms on good terms swear alliances, unless their ways clash
(the pious won't stand beside a people who put books above the gods, war-chiefs
won't bind themselves to shopkeepers, farmers and sea-traders can't agree on
anything, and a free state hasn't forgiven the realm it broke away from).
Enemies of the same realm make friends more easily. Allies grow closer, but an
ally's tariff on your merchants is a broken promise, and an alliance that sours
far enough is broken. A small realm long allied to a much larger one of like
mind may join it outright.

**The watch and the draft.** Towns keep their watch up, taking people on when
it runs short. Once laws are written down, the ruler decides how big the watch
is: a light watch in quiet, poor times, a heavy one (a quarter of the grown
folk) when raids come or war is on. A realm that knows Conscription, losing a
war, can draft the elders, and in a desperate one the children too. Draftees
keep day hours, and go home when the draft ends.

**Raids.** Hostile realms send small raiding parties over the border at night:
three to five of the watch and the boldest of a border town, after coin and
stores, not land. Riders are seen on the road beforehand: merchants and
caravans keep away from the town, and the notice board warns of it. The watch
turns out, and rides out on horseback to meet them where the town keeps horses
or the realm knows Cavalry. If you're in town, the raid happens in front of you:
raiders in their realm's dark colours, hooded, some with torches, come in over
the fields making for the square, fight whoever stands in their way, grab what
they can and run. Townsfolk scatter and ring the bell. Fighting raiders is no
crime. A raided town builds its wall sooner (for less, with Field
Fortifications), and every raid sours the two realms further.

**War** is rare and needs a reason: land the two keep quarrelling over, raid
after raid, merchants beaten and robbed, a town that broke away to be brought
back, a vassal that threw off its lord, broken promises. The two realms must
already hate each other, and the attacker must think it can win. A realm at war
calls on its allies (one that won't come breaks the alliance) and its vassals.

Every few days the armies meet near the front, out in the fields before
whichever town is on the back foot. It's announced the day before in the towns
on both sides and marked on the map with an X. Each side's captain picks a plan:
a frontal assault, a flanking attack (better with cavalry, on open ground), a
pincer when they have the numbers, holding good ground (woods, rocks, a ford), a
fortified line of log walls and stakes (Field Fortifications), a feigned retreat
that turns on the chasers, or, badly outnumbered, falling back (or making a
stand with the town at their backs). Plans beat other plans, and the ground
favours some. The soldiers are real people from real towns, and those who fall
are buried at home. A decisive win can take the town behind the field.

**Called up.** If you're a citizen of a realm at war, you're called to its
battles: when one is planned you're told where and when (it's marked on your
map), and reminded within the hour. Be on the field when it starts and stay in
the fight (the other side knows which line you're in), and the realm pays you
for it. Stay away, or leave the field, and you're named a deserter, wanted in
every town of the realm until you answer for it in one of them (the charge is
then dropped everywhere). Locked up at the time? You're excused. Fall in the
battle and you may only be knocked senseless: you lie there till it's over, and
if your side loses you wake up a prisoner of war in a cell in the enemy's
capital, your weapons taken. They let you go after a few days, or at the
peace, or you can try to break out.

**How big an army is.** Each side can call on its watch (the garrisons of its
towns, a few left at home) and a levy of its grown folk (bigger in martial
realms and with Muster Rolls, smaller among merchants and scholars), so a large
realm with a big watch can field far more than a small one. How many actually
march is the leader's call: at least a third of what they could raise, more for
an all-out assault or a pincer, fewer to hold ground or fall back, more when
they're defending their own fields or brave by nature, fewer when the war has
worn them down or they're badly outnumbered. Levies carry spears. The battle
report says how strong each side was and who led it.

**Prisoners.** Not everyone who falls in a battle or a raid dies: many are
knocked out, and those left lying on the field when their side loses are taken
prisoner. Captives are marched to the captor's capital and locked in a cell in
the jail. When the cells run out, the capital builds a stockade, or with the
Prisons art (Law & Society) a great prison with room for scores. You can visit
them: by day they sit in their cells and will talk, at night they sleep. Two
realms holding each other's people trade them, prisoner for prisoner; a realm
with coin to spare buys its people back (¤40 a head, more readily from a kind
ruler and once the fighting's over); and captives from a realm the captor isn't
at war with (raiders caught after a raid, say) are let go after ten days or so. A rare prisoner
picks the lock at night and runs for home; the watch gives chase, and a crowded
stockade leaks more than a prison. When peace is made everyone held is set
free.

If you're nearby, the battle is fought out in front of you: two lines in their
realms' colours, wings swinging round, walls going up, the hurt falling back,
and the side that breaks running for home. You can join in, on either side.

Wars wear realms down. Every week, every lost battle, adds to the weariness,
which makes towns restless: some break away, and a town near the front on the
losing side may open its gates to the enemy. Allies on a losing side may make
their own peace, or betray it and go over to the enemy. In the end the wearier
side sues for peace: a truce and nothing won, a town ceded and coin paid, or,
badly beaten, service to the victor, paying tribute every week until it's
strong enough (or angry enough) to throw the yoke off. The notice board shows
your realm's allies, lord or vassals, its war and how it's going.

**By raft.** Raiders don't only come over the border. A realm with a town on
the sea, a lake or a river can put a party on rafts and strike a town on the
water much further off (beyond any border). The rafts are sighted a night or
two before; if you're there, you see them paddle in off the water, drag
themselves up the bank and make for the square. An army bound for a town far
over the water goes by raft too.

**Peoples and their ways.** Each people cooks its own food: herb pottage and
apple tart in the vales, fish chowder and smoked herring in the north, spiced
lentils and flatbread in the south, maize tamales and hot cocoa in the
jungle, goulash and oatcakes in the mountains. Taverns cook the hot dish and
bakers bake the rest. They dress in their own colours and patterns, build
in their own stone and timber, and hold their own feasts (Harvest Home,
Midwinter Blot, Lantern Night, the Rain Dance, Forge Day and more).

**Faith.** Every realm has a faith of its own, with its own god, symbol, holy
day and feast; a free town keeps the folk ways of its people. Each faith
asks something of the faithful: no meat, no fish, no strong drink, no work
on the holy day, no hunting near town, no felling the old trees, no weapon in
a temple. Break a custom in front of people and they think a little less of
you (and say so), but it isn't a crime. Ask anyone about their faith and
customs, and nothing a faith forbids is ever on its tavern's menu.

**History and legends.** Every town has a past: who founded it and when,
fires, floods, sieges, plagues and omens, what it's famous for, and the old
story told round the fire. It's cut on the plaque by the statue on the square,
written in the library's books, and told by anyone you ask (children tell the
ghost story). What happens now goes into it: raids, battles, a new ruler, a
town become a city, bandits seen off. A hero of the town gets a statue on the
square (you, when you're named Hero; the bravest soldier of a decisive
battle; whoever stood out in a fight you were drafted into).

**Crime among the townsfolk.** A rare few have a vice: light fingers, a short
temper, no love for the laws. Now and then they act on it in front of you: a
purse lifted, a brawl in the street, a rant on the square against the taxes.
Whoever sees it shouts, the nearest guard comes, takes them in and walks
them to the cells, and the mayor hears it in the morning: a fine, a day or
two in the cells, or, for a third offence, exile. The exiled take to the road
as adventurers, start again in another realm, go off with the nomads, or join
the bandits.

**Bandits.** Exiles and outlaws band together in the wilds: a ring of tents and
a fire well away from any town. They rob merchants on the road, raid weak
villages by night (fought out in front of you if you're there), and move camp
every week or so. Go too near their fire and they warn you off, then set on
you. The towns they hurt put a price on their heads, posted under WANTED on
the notice board; bring one down and claim it from the mayor, and rid a town
of a whole band for its gratitude. Adventurers go after the bounties too. A
realm losing a war, with coin to spare, may hire a hungry band to fight for
it.

**Markets.** Sell a flood of something in one town, or buy it all up, and its
price moves there and, over the next days, in the towns round about. The
trade window says when something's cheap or dear here, the notice board lists
what's going cheap and what's short, and folk mention it. Merchants come to
buy up what's cheap and carry it where it's dear (and prefer to take their
goods where they're short), which evens it out; left alone, a market settles.
Keep a town supplied with something for weeks and it builds to use it: steady
iron brings a new smithy, timber a workshop, grain a bakery, cloth and leather
a tailor's, herbs an herbalist's (if the stone, timber and coin are there).

**Lives.** People change jobs, take up a trade the town lacks, open a shop of
their own with their savings (and run it), go out of business when trade dries
up (CLOSED on the sign), get made Captain of the Watch, or leave to seek their
fortune and turn up years later as a merchant visiting home. There are
affairs, partings, families feuding and shopkeepers who can't stand each other;
the gossips will tell you, and feuding neighbours have words when they pass.
People move for work, for love, or for a better mayor.

**Good times and bad.** A thriving town (coin in the coffers, people fed and
cheerful, shops open) hangs banners in its colours by the hall, the tavern and
the temple; its streets and its tavern are busy and its music quick and
bright. A struggling one boards up the windows of its poorer houses, has
beggars on the square and a quiet tavern, and its tune goes slow and minor.
Each people's music has its own sound, and it all changes back as the town's
luck does.

**Fighting.** Nobody strikes in an instant: every blow is wound up first (a
red "!" over the attacker and the ground it will hit lit red), so you can see
it coming. Your own blows too: barely a moment with a fist, a long haul back
with a war hammer, and once a swing has started you're committed to it (no
stepping away, no rolling out of it); if they've moved off by the time it
comes round, it whiffs. With a weapon in hand a click always swings (at the
air, if nothing's there; it never digs). Roll clear with Space (on the move
too): a quick tumble, faster than running, that carries you past someone in
your way, then a moment's slower step as you find your feet. Take it on a
shield (hold the right mouse), or hit them first and knock them off their
stroke. Raise your guard in the last instant before a blow lands and it's a
parry: a crack of light, the world holds still a moment and slows, sparks fly,
and they reel back dazed for a few seconds, wide open to a riposte.

Stamina is counted in points (about ten, more with Endurance; the pips under
your hearts): a punch costs one, a blade two, heavier arms three to five, a
heavy blow twice that; rolling and taking blows on a shield cost some too, and
it comes back slowly when you ease off. Run out and your guard breaks.

Blows land with weight: the moment holds for an instant on a hit, sparks and
dust fly, the target's knocked back, and the swing itself is drawn big (the
weapon hauled back and trembling, then whipped round in a wide arc with a smear
of light, or jabbed straight out; the body lunges in after it). Take a hit
yourself and the screen jolts and reddens at the edges.

Each weapon fights its own way: a sword cuts, a spear or halberd thrusts two
paces, an axe chops slow and heavy, a mace or flail staggers (a flail swings
round the edge of a shield), a dagger stabs twice, a quarterstaff, greatsword
or battle axe sweeps everything in front of you, a war hammer flattens. Heavier
arms come round slower, for enemies as for you. Two-handed arms (greatsword,
battle axe, war hammer, halberd, quarterstaff, and every bow and crossbow)
leave no hand for a shield: it's slung on your back while one's out. A
one-handed blade can go in the shield arm instead, for a second blow hard on
the heels of the first; some guards, bandits and adventurers fight that way
too. At range: a hunting bow, a longbow (further, harder, slower), a crossbow
(bolts that punch through a raised shield), a sling (it throws any cobble) and
javelins (thrown, and left lying to be picked up). Smiths forge the new arms;
the trapper sells slings and longbows, the carpenter quarterstaves.

**Shooting.** Hold the mouse button to draw a bow (wind a sling, crank a
crossbow), aim with the mouse, and let go to loose: the arrow flies the way
you aimed and strikes the first thing in its way (a wall stops it). A dotted
line shows where it will go and how far, turning gold at full draw; a full
draw flies further and hits harder, and one let go too early is let down
again (you keep the arrow). Drawing slows your step and costs a little
breath, holding a full draw more (a cocked crossbow holds for free), and
there's no rolling with an arrow on the string; right-click lets it down.
Aim at someone's head and an arrow that takes them there strikes half as hard
again; archers can do the same to you. Anyone carrying a shield and facing
the archer turns most arrows (crossbow bolts often go through). A bow never
digs; a javelin is thrown at once, where you aim.

Each beast fights its own way (wolves lunge, or snap quickly close in; slimes
slam the ground all round; a boar lowers its head and charges), and someone
fighting bare-handed jabs, or now and then throws a big swing from the
shoulder. Skeletons carry what they found: a sword, an axe, a spear, a club,
or a bow (and keep their distance with it, loosing arrows). At night there
are worse things: ghouls, quick and low in twos and threes, that rake three
times from one wind-up (each stroke taken on a shield costs breath; roll or
parry rather than hide) or spring at you from two paces off; and
will-o'-the-wisps, drifting lights that keep away from you and lob balls of
cold fire where you stand, marked on the ground before they burst (keep
moving, and run them down; they flit off when you get close). The watch is
hard to beat: guards hit harder, string two or three blows together (each
reaching only as far as their weapon does), and if you only step aside as a
blow comes they follow you and strike where you are (roll, or block). They
carry all sorts: swords and shields, sabres, spears and halberds, axes, maces
and flails, greatswords, bows (where the realm has learned archery). Sworn in
as a guard yourself, you're issued whatever the watch's rack has that day.

**Stones in a fight.** A gem set in a shield works when the shield turns a
blow (and more so on a parry): a ruby singes whoever struck it, a sapphire
chills them and makes parrying a touch easier, an emerald halves the breath a
block costs and mends you a little, a topaz may dazzle them, an amethyst
throws them back a pace. One set in armour works when you roll as well: a
ruby leaves a burst of flame where you were, a sapphire makes rolling cheaper,
an emerald brings your breath back quicker, a topaz makes the first blow out
of a roll a sure, hard one, and an amethyst knocks aside whoever you roll
past.

**Dice.** With dice in hand, right-click to throw them on the table in front
of you (or the floor), like anyone in a tavern. Someone at the table who
plays may take you on: they throw after you, and the higher throw takes a
coin off the other.

**Wildlife.** Butterflies over the grass on a fine day; songbirds nesting in
the crowns of the trees, flitting down to peck about and off again if you
come close (and asleep in the nest at night); owls on the branches after
dark, hooting, eyes catching the light, gliding from tree to tree. Pigs,
sheep and cows graze out on the grass, and every farming town keeps a few by
its fields.

**Potions for a fight.** Herbalists (where the realm knows alchemy) brew a
Tonic of Deep Breath (more stamina), a Second Wind Elixir (it comes back
faster), Berserker's Brew (harder blows) and a Quicksilver Draught (quicker
ones), each good for two or three hours.

**Who you are.** Seventeen specialties and eighteen traits on the character
screen, among them Duelist, Shield Wall, Marksman, Tracker, Tinker, Cook,
Scholar, Horseman and Sailor; Nimble, Tireless, Sure-Footed, Iron Stomach,
Devout and Silver Tongue; and flaws such as Clumsy, Short of Breath, Outlander
and Notorious, each of which gives a stat point back.

**Talk.** Ask anyone "How are things?" and they make small talk that's
made up as it's said, about what's around them: the weather (when it's foul,
everyone's talking about it), their own trade, their partner and children by
name, the neighbour who never gave the ladder back, what's dear or cheap on the
market, hard times or good ones, a war, the next feast, the town down the road,
what the scholars are working on and what they've just mastered, the town's
ship, where the portal on the square goes, the prisoners out at the quarry,
aches and cures, the goat that got out, old stories, chores.
Underneath is a phrase grammar (sentence frames with choices in them, so a few
hundred frames make many thousands of sentences) and word chains trained on
what the frames make: everyone's talk on a topic is learned once and shared,
and each kind of speaker (their people, manner, quirks and trade) adds a small
chain of their own on top, so it finds new sentences without gluing half a
line about rain to half a line about bread; lines that trail off or repeat
themselves are thrown back. (The talk itself lives in game/talk/corpus.js:
adding lines is adding frames.) One thought leads to
another now and then ("Mind you, ..."). Then it's said in their people's way
(northerners say aye and bairns; southerners call you cousin), their own manner
(formal, rough, chirpy, terse, gruff) and their quirks (pious, gloomy,
superstitious, gossipy, nosy, stingy, absent-minded...). Folk in the street
chatter the same way.

**Building styles.** Northern longhouses have horns on their gable ends and
shuttered windows; southern houses hang striped awnings over the door and
keep pots of flowers on their flat roofs; forest folk let their thatch
overhang the walls, grow vines up them and set carved posts by the door;
highlanders raise stone pinnacles at the corners of their roofs; the vale
folk keep window boxes.

**What a realm knows.** Nothing the tree hasn't unlocked: no forge or
blacksmith without Metalworking (an early step, which smithing peoples start
with; elsewhere the watch carries wooden spears, clubs and stone), no bows in
the watch without Archery, no steel without Steelworking. Every town has
somewhere to study (a small Scholar's Study if nothing better) and at least
one researcher, so free towns learn too; the mayor spends coin, timber and
stone fitting it out, three times over, and each makes the study faster. The
perks are stronger, and some show once they've settled in (days later, the
capital first): a square paved in stone (masonry), gravelled lanes and cobbled
streets (surveying), helms on the watch (drill), archery butts (archery), hay
stacked by the barns (watermills), children with their books (schools), guild
awnings over the shops (guild charters).

Every realm starts out knowing something already: one to seven steps of the
tree, more for a big realm of cities, fewer for a handful of villages, chosen
mostly by its people (highlanders build and forge, northerners fight,
southerners trade, forest peoples keep law and healing, valley folk farm and
build) and what it holds dear, a little by chance; nothing past the middle of
the tree.

**Travellers you follow.** Follow a trading company (or a merchant, an
adventurer, settlers, townsfolk on an outing) down the road and into the town
they're bound for, and they arrive there with you: the company makes camp, the
merchant sets up at the market, the villager goes home, from the spot where
they walked in, even if their journey's reckoning had them arriving later (or
earlier). The world map marks a trader where they really are when they're on
the road near you, one mark per company.

**The world map.** Smoke rises over a town raided in the last few days; a
bandit camp shows once someone has told you of it (or you've seen its smoke;
a Tracker from further off); armies march toward tomorrow's battlefield under
their banner; and a few gold specks move along the roads where the merchants
are.

**Raids.** Bandits on a raid go through the houses for the chests, throw
torches onto roofs that will burn (a haystack or a fence, if the roofs are
slate), and leave the town marked as raided. Fire spreads a little, burns
away what it catches, and rain puts it out sooner. A band hired for a war
stands on the flank of the battle in no colours, and runs the moment the day
looks lost.

**Hard times and good ones.** Farmers sow whatever's short (or whatever fills
a belly, in a famine); a smith out of iron sends to wherever it's cheap, or
mends pots and makes stone tools till it comes, and turns to swords and mail
when iron's cheap. Those who leave to seek their fortune may become merchants
who visit home, settle far away, come home rich, come home with nothing, or
never be heard of again. Famine and long poverty send families away in waves
to better-off towns, bring crowds to the town hall, drive the desperate to the
bandits, and give a starving realm a reason to go to war over its neighbour's
fields. Now and then a crowded town sends a few families out to found a
village: you can follow them down the road and over the wilds, see them pitch
their tents and watch their builder raise the first houses; it goes on the
map like any other village.

**Rulers with a dream.** Some rulers (not all) chase one: a merchant prince
builds roads twice as fast and market halls in every town; a zealot sends
missionaries over the border and forces the faith on what the realm
conquers; a warlord takes any border quarrel as cause for war.

**Faiths.** Each faith has its own clergy (godi, shamans, forge-priests,
star-readers...), a virtue it prizes, its own way with the dead (pyres, boats,
cairns, burial, a tree planted over them) and a sacred beast; new taboos too
(mushrooms, digging near a mountain town, harming the sacred beast). Faiths
travel the roads with the merchants until a town turns; a conquered town keeps
its old gods unless its new masters force their own on it, and then it
resents the new taboos for weeks (and a realm of the old faith has cause for a
holy war). The devout go on pilgrimage to their faith's holy city.

**Histories.** A town's past fits its people: northern towns remember raiders
from over the sea and the Long Winter, southern ones droughts, star-readers and
caravans, forest towns fevers and floods, mountain towns mine collapses and
silver strikes; its realm's values add their own (a war memorial, a guild
charter, a holy relic). Founders, legends and haunted places are each
people's own.

**Choices on the tree.** The tree has 48 steps, and seven of them come in
pairs where a realm must choose: free trade or customs houses, banking or
guild monopolies, a shield wall or great weapons, longbows or crossbows,
clemency or iron law, schools or apprenticeships, aqueducts or granaries.
Learning one side bars the other for good (crossed through on the tree), so
realms grow apart; rulers lean to the side that suits their people and their
temper. Every step says exactly what it does ("Taxes bring in 20% more in
every town"). Work on a step that gets barred, or that's put aside, isn't
lost: it's kept, and picked up again if it can be.

**A town's share.** Each town's study counts toward its realm's, and the town
remembers what it put in. When it changes banner (taken in war, sworn to
another realm, or breaking free) it loses whatever its new realm doesn't know,
but its work goes with it: a town that did a fifth of the work on
metalworking brings a fifth of metalworking to its new realm (all of it, and
the realm learns it there and then).

**Great works.** The far ends of the tree:
- *Battering rams and catapults.* Armies bring them to battle: catapults
  behind the line, each with a crew, lobbing stones into the enemy (they
  fall where they're aimed, and hurt whoever's there; roll clear), and a ram
  rolled up to the wall of a walled town. If the attackers carry the field
  and take the town, you see the ram go on to the wall and break through; the
  town's builders mend the breach later. You can hack an engine to pieces.
- *Trade ships.* A town on a river or the coast builds a pier and a great
  ship. Up to five of its merchants sail together to ports abroad, faster
  than by road and with three times the goods; you see them walk the pier,
  the ship cast off and sail out of sight, and come home days later with a
  good profit for the town.
- *Portals.* Every town of the realm raises an arch on its square. Step
  through (a small fare if you're not of the realm) to any other town of the
  realm; merchants, visitors and armies use them too. A town taken by another
  realm goes dark: its arch is closed to its old realm (and lights again if
  its new masters know the art).
- *Prison labour.* By day the prisoners go out to quarry stone and cut wood
  for the town, one guard for every two (as many as can be spared; none,
  and they stay in the cells). Each day worked takes two off a sentence, and
  prisoners of war go home after eight days' work.

**Wars on the ground.** An army on the march is where the map shows it:
mustering in its town, then a column on the road to the field. Battles come
the same day they're called, a few hours on, and begin as soon as both lines
are drawn up. Soldiers walk up to their places and off again afterwards;
nobody appears or vanishes in front of you.

## Round 26: old places, the Kavorent, and where you come from

**Openings.** A new character's story opens with where they come from.
*Castaways* begin on the deck of the ship that brought them, out on open
water at sundown: walk the deck (WASD) and talk to the crew (F): the captain
at the wheel, the first mate, the navigator, the cook, the deckhands, the
lookout, a scholar bound for the Kavorent spires, the cabin child. Each has a
few things to say and to be asked, and between them they'll tell you where
you're bound and why you were aboard (it depends on what you brought). Then
the wind rises: cloud comes over, the rain starts, then it pours slantwise;
lightning walks over the sea, the crew run about shouting, seas come over
the rail, until a bolt strikes the mainmast, the canvas burns, the deck
heaves and everything goes black. A few lines in the dark, and you wake on
the beach. *Natives* watch their home town build itself up out of the bare
ground as its history is told year by year (the hall and the square first,
then outward street by street, each house rising floor by floor, the walls
last), then see it as it is today, its people about their day, and the
camera comes down at their family's door. Enter skips either.

**Old places.** The world is bigger now (40 by 29 regions), and in its wilds
are the places of its past: barrows (sealed doors in the turf), collapsed
mines (shafts), drowned crypts (sinkholes in ruined chapels), bandit
holdouts (cave mouths), and the Kavorent spires. Every one has a story (who
was laid in the barrow and when; how many were lost when the mine fell in;
how the crypt drowned; whose band holed up in the caves) told in the history
of the town nearest it. You find them by wandering, or ask anyone in town
about "old places round here" and they'll tell you one (and mark it on your
map). Going in takes you to a place apart, made as you reach each floor and
kept as you leave it: two to four floors of rooms and corridors built from
hand-made room kits (guard rooms, ossuaries, flooded halls, shrines,
collapsed passages, galleries, store rooms, and more of each kind's own),
dressed in the stone of the people who made them, linked by stairs and
ladders. Nothing down there runs while you're away.

**Below ground.** It's dark down there: torches matter, and you can set your
own as you go (and carry one in your off hand, as anyone can). Wisps light
their rooms; kill one and it's darker. Skeleton patrols with mixed arms,
ghouls that wait in niches or burst out of coffins when you come close,
drowned things in the black water, and things you won't see on the surface.
Traps and puzzles: pressure plates that set off arrow slits; levers that
open gates elsewhere on the floor; cracked floors that drop you a level;
weak walls with hidden rooms behind; three braziers to light; a flooded
hall a lever drains; and one sealed room a floor, opened only by the sigil
its captain carries. Once its master is dead, a place is done, and its way
in falls shut behind you. You find old coin (a fair price anywhere), old
blueprints (bring them to a mayor: coin, renown, and a push to whatever the
scholars are studying), and relics.

**Relics.** Set one down and a circle of turning runes lights the ground
round it, in its colour: a Hearthstone closes everyone's wounds near it,
slowly; a Vigil Lamp keeps night things out of its circle and burns the dead
in it; a War Totem makes blows struck near it land a fifth harder; a Warding
Idol makes them land a fifth lighter; a Windcharm brings breath back twice
as fast; a Seed of Plenty grows the crops near it twice as fast. Take them
up again any time.

**The Kavorent.** A people before people, not human, whose works make
today's realms look like children's toys. What's left on the surface are
their spires: five-by-five pillars taller than anything, with runes rising
up the middle of each face, fading and coming again. Set a cut stone in the
hollow of a face and it opens on a lift down into the ruin: an utterly vast
place of dark alloy seamed with cold light, a good few days to see all of,
ruined but not dead. Its makers' guardians still keep it, each in its own
way, and they work together: sentinel drones that hang back and fire beams
down a line at you, wardens whose shields turn any blow from the front (and
shelter the drones and menders beside them), menders that weld their hurt
kin back together, arc mites that swarm, golems that stand dormant till
you're close, a Prime in its foundry, and at the bottom the Overseer,
shielded while the power nodes round its hall still burn. Their traps: emitters firing across a hall in turn, walls of light
that drop for the plate that matches a console's glyph, plates to tread in
the order shown, rings of power nodes to put out, vaults under glyph seals.
Their loot is mostly Kavorent Scrap (it sells well, and a smith or a furnace
turns it into iron), Gem Shards (five of a colour fuse into a stone, four at
a jeweller's), now and then a Kavorent Core (one to four in a whole ruin),
and rarely their gear: the Phase Blade (it slips past shields and armour),
the Arc Lance (each thrust throws a lance of light four paces), the Pulse
Caster (it needs no ammunition, only breath), carapace, visor, greaves,
treads, the Aegis Projector (a wall of light no arrow gets through), the
Blink Shard, the Mending Cell, the Field Projector, the Lodestar, the
Everlight, and Alloy Edges and Plating that better a weapon or armour for
good.

**The Ancient Technology Tree.** Give a Kavorent Core to a mayor: a good
deal of coin and a lot of standing, and the realm's scholars begin to learn
the Kavorent's arts. With a core in hand (or once you've given one), the
council's tree has a second page (T): the Ancient Technology Tree, rings of
glowing seals round a turning core, nothing like the realm's own tree. Its
arts cost one to four cores, and some need others first: the Growth Lattice
(crops grow twice as fast under lattices of alloy), Coldfire Lamps (cold
light along every street; night things keep further off), the Glyph Archive
(research twice as fast), the Alloy Forge (the watch's arms edged with
alloy), the Mending Spring (a basin by the well that closes your wounds;
nobody in town stays sick), Ward Pylons (round the town's edge, striking
anything that comes at it), the Kavorent Panoply (every guard in carapace and
visor), the Storm Engine (battles open with lightning falling on the enemy
line) and the Skyward Beacon (a pillar of light from the capital, seen for
days around; trade booms). Every town of the realm puts them up.

**Adventurers below.** Adventurers go down into old places on their own or
in bands, whether you're there or not: they come back stronger, with old
coin and better, or don't come back at all (their gear waits where they
fell). What they bring up they set in their blades or wear. The bravest go
into Kavorent ruins and, rarely, bring a town a core. Places they've been
are lighter of loot and of guards when you get there.

**Fighting, and the body.** A swing at the air lands on whoever's standing
there, foe or not (and a blade in the other hand follows it round). Training
dummies rock and show each blow's damage, and a tally of a run of blows.
Raising a shield or a blade brings it up across you. Wounds no longer close
on their own: food, sleep, potions, herbalists and stones mend you. Each day
you go without sleep takes a point off your stamina (shown on the HUD) until
you sleep it off. Sprinting costs little breath when you're whole, and much
more the more you're hurt. A ghoul feeding on your breath is plain to see.

**Stones.** Every stone works its own way set in a shield. Three new rare
stones: onyx (shadow: blows echoed by your shade, arrows that split, armour
that slips you out of sight), moonstone (moonlight: crescents thrown off the
blade, arrows that mark, armour that wards you) and bloodstone (blood:
wounds that bleed, and armour that hits harder the nearer you are to death).

## Round 27: deeper down

**Floors.** Rooms come in every shape and size now: plain halls, round
chambers, eight-sided halls with their corners cut away, cross-shaped
chapels, L-shaped rooms and ragged caverns, from cramped closets to great
halls. Each kind of place keeps to its own: a barrow's chambers are round
and its passages wander a little; a mine is all caverns and long galleries
joined by twisting drifts; a crypt is laid out by masons, eight-sided halls
and cross-shaped chapels on straight passages; a holdout is caves walled off
square. Passages are routed round the rooms, turning square, rather than
scraping along their walls. The sealed vault, a treasure room and the
master's hall each have exactly one way in, so a sigil door is a single
door across its passage, facing the right way. There's always a way across
a room between its doorways (rubble, pillars and fittings are cleared from
the line if they'd block it). Each place has its own fittings: urns, roots
and cobwebs in a barrow; stalagmites, glowing fungus, ore carts and powder
kegs in a mine; candles, statues, chains and heaped skulls in a crypt;
weapon racks, war banners, powder kegs and alarm gongs in a holdout. Below
ground nobody climbs onto the fittings or the bookshelves, or up onto the
walls. A floor that gives way drops you into the nearest room on the floor
below (never into rock or onto a wall, nor into the master's hall).

**Their own dangers.** In a mine the roof comes down now and then where you
stand (dust trickles first: move). In a barrow the dead reach up out of the
earth for your ankles (roll free). In a crypt a cold draught snuffs your
flame for a moment. In a holdout, whoever spots you runs to strike the
nearest gong, and the whole place comes for you (break the gongs first).
A powder keg broken open, or caught by fire, goes up and sets off any keg
near it, hurting whoever's close, theirs or yours. Each place has its own
dark, its own sounds (drips and whispers, a mine's groans and scuttling, a
crypt's chains, a holdout's fires and far-off voices) and its own motes in
the air (barrow mist, falling grit, pale ghost-lights, smoke and embers).

**Music.** Every kind of place has three tunes: one for exploring, one for
a fight, and one for its master.

**The masters.** The master's hall is behind a great gate. Open it and go
in, and it crashes down behind you. The master wakes, and its name and
title drop in across the top of the screen with its health bar: red, with
a pale trail that catches up after each blow, a white flash as a blow
lands, and a pulse when it's nearly done. When it falls you see
VANQUISHED, the gate grinds up, and it leaves you a relic. A master never
leaves its hall; get out and stay out a few seconds and it settles back
to wait (a little healed). Each kind of place has three masters, one
chosen at random:
- *Barrow*: **the Barrow King** (now also a spectral charge, and rings of
  grave-cold rolling out from him), **the Mound Witch** (blinks away when
  you close in, leaving a chilling mist; sets hexes kindling round you;
  ties a thread of your life to hers that you must break by getting away
  or out of her sight; raises wights), **the Pale Huntsman** (his barrow
  hounds, volleys of three arrows, snares set where you'll step, and a
  mark that doubles it all).
- *Mine*: **the Deep Worm** (now also spits pools of acid), **Foreman
  Gask** (throws fizzing blasting charges, brings the roof down across the
  hall and leaves the rock where it fell, calls his dead miners back to
  work), **the Brood Mother** (webs that hold you, venom that pools, egg
  sacs that hatch broodlings unless you burst them, and she climbs up into
  the dark and drops onto you).
- *Crypt*: **the Drowned Priest** (now also a whirlpool that drags you
  in), **the Ossuary Horror** (now also spikes of bone bursting along the
  floor four ways), **the Hollow Saint** (splits into images of herself and
  trades places with one, throws grave-light in threes, and consecrates her
  hall's floor one square in two, then the other half).
- *Holdout*: **the Bandit Warlord** (now also a war cry and a shield
  charge), **the Twins** (Rook and Wren, together, one bar between them:
  Rook's hammer and charge, Wren's knives and Wren behind you while Rook
  winds up; they swap places when Rook is hurt; when one falls the other
  goes berserk), **Mother Nettle** (flasks that leave the floor poisoned,
  caltrops when you crowd her, and smoke she steps out of behind you).
Lingering dangers (poison, webs, snares, caltrops, whirlpools, mist,
smoke) are drawn on the floor in their colour while they last.

**Loot.** The first floor's chests are poor (odds and ends, a coin or two),
and they get better the deeper you go: potions and ingots, then gold,
gems and good steel. A chest holds only a few kinds of thing, and far
fewer coins than before. Relics are rare in chests now; every master
(outside the Kavorent's ruins) keeps one. Old coin is worth half a gold
piece: any merchant changes them, two for one.

**Adventurers.** Nobody goes down into the old places in the first twelve
days, and after that bands go far less often. Only a place already worn
down by three bands can lose its master to them, and even then rarely.

**Fixes and smaller things.** Agility gives a little more stamina. The
Deep Mines and Catapults upgrades have icons. Labels on the tech tree no
longer overlap (each tries below, above, then further out; the one you
point at always shows). The world map shows a square's name when you
point at it. The HUD has the stamina bar under the health bar, with coins,
what you hold and where you are below it. The journal scrolls (wheel,
arrows, W/S, Page Up/Down). Bird nests are rarer. A beast hit by an arrow
runs from whoever shot it. Waking from a bed in a house puts you beside
the bed, not on the roof. A torch in the off hand is held upright in your
hand. A shield on your arm no longer stops you eating, drinking or using
things. A duel counts down ("Three... Two... One... Fight!") before your
opponent comes at you, unless you swing first. Hot dishes (stews,
chowder, pottage, goulash, tamales, cocoa, ale) give a little health at
once and more over the next several seconds, more in all than food that
mends at once (the tooltip says how much, and how long). Healing flashes
the screen's edges green. More sounds: eating, gulping, healing, a
heartbeat when you're nearly dead, bones on bone, arrows thudding into the
ground, wings, urns shattering, gongs, fuses, the gate slamming, a roar
and a sting as a master wakes, a victory.

## Round 28: the spire wakes

**The spire.** A Kavorent spire throws a beacon up into the sky from its
top: a column of light with bands climbing it and rings going out. The
ground round it (sixteen paces out) is blighted: the turf violet, the
trees' leaves gone purple, and strange things grow there (voidblooms that
open and close, clusters of glowing crystal, tendrils taller than you with
lights at their tips, watcher stalks whose eyes turn to follow you), with
violet motes drifting up. Its keystones (four of them round the door) have
a hollow cut in them the shape of a gem. As you come near, the camera draws
back to take it in and a dark, alien song plays. Set a cut stone in the
hollow and it opens in a scene: bars come in at the top and bottom of the
screen, the music swells, the camera rises toward the top of the spire,
the door's face comes apart into light, the runes up its sides wake in
every colour and change faster and faster, and then the beacon bursts to
full force with a flash and a boom. The runes on its sides no longer show
once you're inside it.

**Kavorent floors.** Each of a ruin's six floors is lit its own colour:
cyan, then violet, amber, green, crimson and, at the bottom, a pale gold.
The light in the alloy, the glow round every light, the tint of what's lit
and the motes in the air all take the floor's colour. The halls are a good
deal less dark than before. They're dressed to overawe you: sentinels of
alloy twice your height with blades of light, black monoliths with glyphs
climbing them, light-screens throwing a turning glyph into the air,
bundles of conduits with pulses running along them, the husks of fallen
constructs, and vents in the floor that breathe out steam. Halls have
ranks of sentinels; the Overseer's hall has them down both sides, with
monoliths between and conduits along the back. The machinery breathes and
sparks round you (vents puffing and hissing, sparks off the monoliths and
screens, conduits spitting), with deep pulses of sound. The sentinel drone
no longer has a haze of light over its face.

**The masters.** Every master is drawn half as big again, breathing, with
its own colour pooled on the floor round it, a ring of signs turning in
the pool (faster when it's badly hurt), a rim of its light round its body
(white as a blow comes), motes coming off it (embers among them when it's
badly hurt), and a glow of its colour that lights the dark round it. Three
of them walk on legs of their own: the Brood Mother on eight hairy legs,
the Ossuary Horror on six legs of bone with a skull at each knee, and the
Overseer on four alloy legs with glowing joints, its great eye turned on
you. Each foot stays planted where it falls, and steps only when the body
has gone too far from it, half the legs at a time; heavy feet thud and
raise dust. They have new bodies too: the Brood Mother's banded abdomen
with its red hourglass and her working fangs, the Horror's heap of the
dead with red light through its ribs, the Overseer's great ring of alloy.
The Hollow Saint's images look just as she does. Masters are tougher:
30% more health and 15% harder blows.

**Two scenes.** The first time you go into a master's hall, the camera goes
to it as it wakes, the hall's fires catching one after another, then a
roar and a shockwave, and back to you (nothing moves while it plays). When
it falls, the world slows to a crawl, the camera goes to it as it flickers
white and comes apart in its own light, then a flash, rings of light, a
boom and the fanfare.

**What you find below.** Anything you find in an old place isn't yours
until you've brought it back up. Die down there and it all spills out
where you fall (half your coin with it) into your pack, left lying on that
floor, glinting so you can find it; go back down for it (you're told when
you come near it). Climb out alive and it's yours for good. The HUD shows
how many things you're carrying that you'd lose. (A place you've beaten and
that's shut behind you takes nothing from you.)

**New below ground.** Some chests, deeper down, have teeth: reach for one and
it wakes as a mimic, and gives up what it held when you kill it. Rows of
spikes in some passages come up in turn (a rattle and a puff of grit first):
time it and go through between. An old idol stands in some floors with its
eyes burning: lay a hand on it for a blessing (an hour of harder blows,
quicker swings or quicker breath, or your wounds closed), once. Cracked
floors that give way are gone.

**Fixes and smaller things.** Peddlers and merchants on the road change up
to a hundred old coins a day (a shop in town, thirty); the trade window
says how many more they'll take today. A spear thrust north or south now
points the way it goes, and thrusting north it's drawn behind you, not over
your head. The holdout's cave mouth is cut into its rock face in the rock's
own texture, at the right height. Enemies close by find new paths sooner
(and as soon as you move). With no room in your pack, things on the ground
are no longer drawn toward you. A wisp outside can no longer lob its light
into a building.

## Command console

Press **`** (or **/**) to open the command console. Type a command and press
Enter; Tab completes a command name and the arrow keys go back through what
you've typed. These are for exploring and testing, and they change your game.

| Command | What it does |
| --- | --- |
| `help [command]` | lists the commands, or explains one |
| `tp <town>` / `tp <x> <z>` / `tp home` | teleports you to a town (by name, or the start of one), a spot in the world, or your spawn |
| `teleport [on\|off]` | while on, click anywhere you've seen on the world map (M) to go there |
| `reveal [off]` | shows the whole world map |
| `towns`, `where` | every place, nearest first; where you are |
| `wedding [now] [town]` | two single grown-ups get engaged; the wedding is in two days, or within a few hours with `now` |
| `feast [now] [town]`, `fete [now] [town]` | a feast day, or a celebration of the town |
| `street [town]` | the builders lay out a new street with lots |
| `finish [town]` | everything under construction there is finished at once |
| `time <hh:mm>` / `time +<hours>` | waits until then (any key stops it) |
| `give <item> [count]`, `coins <n>`, `heal` | items, money, health |
| `god [on\|off]` | nothing can hurt you (the console no longer does this by itself) |
| `skip <days>` (or `ff`) | fast-forwards that many days (1–120), the whole world living them |
| `war list`, `war <realm> on <realm>`, `war peace [realm]` | lists the realms, starts a war between two, or makes peace |
| `learn <step> [realm]`, `learn all [realm]`, `learn list` | a realm (yours, the one you're in, or one named at the end) learns a step of the tree at once, with whatever it needs first ("learn portals", "learn trade ships"); `all` learns everything it can (one side of each choice); `list` names the steps |

Map teleporting and the revealed map are kept with your save.

## Code layout

```
src/
  config.js            grid, screen and world constants
  main.js              bootstrap, main loop, title/save/load/new-game hooks
  util/                seeded RNG + hashing, simplex noise, binary heap
  world/               blocks, items, recipes, biomes, names,
                       worldgen (world map), terrain (per-column sampling),
                       regiongen (tiles), trees, settlement (layouts,
                       buildings, interiors, walls), weather, loot,
                       sites (old places on the map: barrows, mines,
                       crypts, holdouts, Kavorent spires), dungeongen
                       (floors from room kits: shaped rooms, routed
                       passages, sealed rooms, dressing), voyage (the ship in the
                       castaway's opening), region/world storage
  entities/            player, npc (AI), npcgen (jobs, personality, hobbies,
                       schedules, families), acts (what people look like
                       doing things: dice, meals, drinks, cooking), warrior
                       (raiders, soldiers and riders on the ground),
                       creature, monsters (what lives below ground, its
                       ways of fighting, hazards and lingering ground),
                       bosses (the masters of the old places), item
                       drops, A* pathing
  render/              font (bitmap ASCII), textures + sprites (procedural
                       pixel art), renderer (oblique painter), fx (flame
                       arcs, lightning, shock rings, burning), dice (rolling
                       3D dice on tables), dungeontex + dungeonart (the
                       stone and alloy below ground), bossart (the masters
                       drawn big: auras, rims of light, walking legs),
                       oldplaces (spire runes, beacons, relic circles),
                       lighting, crt
  ui/                  character grid + dissolve animation, UI manager/HUD,
                       windows (inventory/profile, journal, containers,
                       crafting, trade, dialogue, map, help, pause, title,
                       save slots), create (the character screen),
                       research (the tech tree and the study minigame),
                       ancient (the Ancient Technology Tree), crewtalk
                       (talking to the ship's crew), portal (where an
                       arch can take you)
  game/                game rules, input, dialogue, villager chatter, crop
                       growth and soil moisture, fishing, children's games,
                       hero (character creation and perks), combat (wind-
                       ups, blocks, parries, rolls, stamina, weapon and beast
                       styles), archery (drawing, aiming and loosing;
                       arrows striking, blocked and in the head),
                       dicegame (your throws, and a coin on it), wildlife
                       (butterflies, nesting birds, owls), markov (small
                       talk: what's on their mind and how they say it),
                       talk/ (the corpus of
                       sentence frames, the phrase grammar and the word
                       chains), engines (siege engines in battle), shipping
                       (great ships on the water), fire
                       (burning roofs and haystacks), save slots,
                       settings, voices, commands (the console), gems
                       (what set stones do in blades, bows and armour),
                       riding (your own horses and wagons, and a town's
                       horse taken out by a citizen), leads, dungeon
                       (being down below: floors, traps, puzzles), relics,
                       kavtech (the Kavorent's gear and gadgets),
                       cutscene (the openings: the ship and the storm,
                       the hometown's history), scenes (short scenes in
                       the middle of things: a spire opening, a master
                       waking and falling),
                       audio (synthesized SFX and ambience), music
                       (adaptive procedural chiptune)
  sim/                 town simulation: economy (meals, trades, taxes, mayors,
                       merchants, abstract catch-up), justice (crimes,
                       suspicion, arrests, hearings, jail repairs), careers
                       (professions, shop work, customers, escorts,
                       companions), favours, civic upkeep (guards, supply
                       chains, housing, births, deserted towns), works
                       (repairs, new buildings, house expansions, all
                       placed where the builders stand), roads (new streets,
                       lots, and what waits for a lot), shops (shopping,
                       stalls, merchant standing),
                       diplomacy (letters, winding roads and their road
                       crews, travellers' ways by land, warnings), realms
                       (capitals, rulers, decrees, tribute, aid, roads the
                       realm pays for, relations
                       between realms, breaking away), adventurers,
                       nomads, camps (tents for nomads, merchants,
                       adventurers and trading companies), stables
                       (horses, wagons, animal handlers), caravans (the
                       wandering trading companies and their road
                       camps), outings (townsfolk visiting other towns
                       in small groups), town
                       life (elections, weddings, growing up and growing
                       old, beast raids), tech (the tree of learning,
                       academies, researchers), politics (borders,
                       alliances, merging, vassals, disputes, the size of
                       the watch, the draft), war (raids between realms,
                       wars, armies and levies, battles and tactics,
                       fought live near you, prisoners, cells,
                       exchanges, ransoms and escapes, you called up,
                       deserting, taken prisoner),
                       events (posters, stages, guests for weddings and
                       feasts), the press (newspapers),
                       growth (materials, town sizes, walls), laws
                       (public opinion, reviews, petitions), culture
                       (cuisine, dress, faiths, feasts, customs and
                       taboos), history (town histories, legends,
                       statues), society (vices, crimes and trials among
                       the townsfolk, exile, careers, affairs and feuds,
                       moving away), bandits (camps, robberies, raids,
                       bounties, hired bands), market (regional prices
                       and supply-driven building), prosperity (how a
                       town is doing and how that shows), hardship
                       (famine and poverty, migration waves, unrest),
                       founding (settlers and new villages), ships
                       (harbours and voyages), portals, labor (prison
                       labour), religion
                       (faiths spreading, conquest, missions, holy wars,
                       pilgrimages), dungeons (old places' records,
                       rumours, adventurers' delves), ancient (the
                       Kavorent's arts in each realm), and the
                       Sim hub (reputation, renown, graves, mourning,
                       citizenship and house building, treasury chests,
                       saving)
tests/                 node:test suites (run headlessly with stubs)
tools/serve.mjs        zero-dependency static server
```
