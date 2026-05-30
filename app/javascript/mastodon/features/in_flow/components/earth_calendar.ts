// Earth calendar — Melbourne basin phenology, month by month (0-indexed)
// Sources: Royal Botanic Gardens Victoria, Parks Victoria seasonal guides,
// CSIRO and BOM phenology records for the Melbourne/Port Phillip region.

export interface EarthMonth {
  month: number;
  season: string;
  sow: string[];
  harvest: string[];
  bloom: string[];
  observable: string; // What to go outside and notice right now
  observables: string[]; // Daily-rotating short observations (indexed by day % length)
}

export const EARTH_CALENDAR: EarthMonth[] = [
  {
    month: 0, // January
    season: 'Late summer',
    sow: ['Basil', 'Cucumber', 'Pumpkin', 'Sweet corn'],
    harvest: ['Tomato', 'Zucchini', 'Eggplant', 'Capsicum', 'Stone fruit'],
    bloom: ['Agapanthus', 'Sunflower', 'Bougainvillea', 'Frangipani'],
    observable:
      'The black cricket chorus rises from garden beds in the first hour after sunrise, loudest in the heat of the soil. Dry earth smells faintly of dust and baked grass — a scent that peaks just before the heat settles in. What does the morning smell like where you are?',
    observables: [
      'The black cricket chorus rises from garden beds in the first hour after sunrise, loudest in the heat of the soil. Dry earth smells faintly of dust and baked grass — a scent that peaks just before the heat settles in. What does the morning smell like where you are?',
      'Sulphur-crested cockatoos strip bark from large eucalypts this time of year, hunting insects beneath — the sound is like tearing cardboard, followed by a crash of falling strips. Long curls of fresh bark litter the ground below. Have you heard or seen any big cockatoos near you lately?',
      'Warm dry grass has a smell particular to high summer in the Melbourne basin — dusty and faintly sweet, strongest in the mid-morning before the heat peaks. The soil surface is cracked and pale, baked to a crust between grass clumps. What does the air smell like outside right now?',
      'Cicada shells cling to tree bark at eye height — empty cases split along the back where the adult emerged weeks ago. Above, living cicadas are deafening at midday, a solid wall of sound from the canopy. Have you heard the cicadas where you are today?',
      'Flying foxes stream toward fruiting trees at dusk as the sky holds purple and orange behind the silhouettes of gums. Fig trees and melaleucas are the usual destinations — the stream of bats follows the food. What does the sky look like from where you are right now?',
      'Native bees — small and fast — work every open flower in the full heat, covering grevillea and callistemon in a sequence that looks almost random. Large carpenter bees thrum heavily; small native bees barely make a sound. What is flying near you in the garden today?',
      'Heat shimmer rises above roads and rooftops in the mid-afternoon, bending distant trees and power lines into slow waves. Common mynas sit in the shade with beaks open, riding out the worst of the heat. What is the temperature like where you are today?',
    ],
  },
  {
    month: 1, // February
    season: 'Late summer',
    sow: ['Basil', 'Beans', 'Silver beet'],
    harvest: ['Fig', 'Tomato', 'Beans', 'Capsicum'],
    bloom: ['Waterlily', 'Agapanthus', 'Crepe myrtle'],
    observable:
      'Swifts gather at dusk as the sky turns warm and orange, circling higher and higher before their long journey north. They may be gone in days — this is the last of them until August. Have you spotted them in the sky this week?',
    observables: [
      'Swifts gather at dusk as the sky turns warm and orange, circling higher and higher before their long journey north. They may be gone in days — this is the last of them until August. Have you spotted any in the sky this week?',
      'The tawny frogmouth starts its double-thud call at dusk near water — low and ventriloquial, hard to locate in the dark. They sit motionless on horizontal branches, bill pointed skyward, disguised as broken wood. Have you heard or seen one near you lately?',
      'A ripe fig tree draws rainbow lorikeets, red wattlebirds, and common mynas into a noisy argument in the canopy. The pavement beneath gets stained purple with dropped fruit — a good sign a tree is peaking. Are there any fruiting trees near you right now?',
      'Northerlies bring heat; southerlies bring the first relief — a southerly change can drop the temperature ten degrees in an hour. The clouds stack on the southern horizon as the change approaches. What direction is the wind coming from where you are?',
      'Melbourne clay soil maps itself in cracks during long dry stretches — deep lines following the shrinkage underground. Small skinks find refuge from the heat in the deeper cracks. Have you noticed the soil or ground near you changing lately?',
      'Christmas beetles cluster around outdoor lights near eucalypts on still summer evenings, clumsy in flight and bumping into windows. The adults are short-lived; the larvae have spent a year underground. Have you seen any near lights after dark this week?',
      'Herons stand absolutely still in creek shallows, waiting — a white-faced or white-necked heron motionless for minutes before striking. The strike is faster than the eye follows. Have you spotted any birds hunting near water lately?',
    ],
  },
  {
    month: 2, // March
    season: 'Early autumn',
    sow: ['Broccoli', 'Kale', 'Lettuce', 'Peas', 'Silverbeet'],
    harvest: ['Capsicum', 'Tomato', 'Passionfruit', 'Apple'],
    bloom: ['Autumn crocus', 'Salvia', 'Cyclamen'],
    observable:
      'The first leaves are turning at the tips of deciduous trees — yellowing at the outer edges while the inner canopy stays green. Rosellas and cockatoos are picking at the drying seed pods of elms and plane trees as they fall. What trees are you watching change near you?',
    observables: [
      'The first leaves are turning at the tips of deciduous trees — yellowing at the outer edges while the inner canopy stays green. Rosellas and cockatoos are picking at the drying seed pods of elms and plane trees. What trees are you watching change near you?',
      'After 5pm, building shadows stretch across entire streets — the sun has withdrawn enough to cast long, low shadows even in the late afternoon. The light has that golden, horizontal quality that only comes in autumn. How does the light fall where you are right now?',
      'A sharper edge has entered the morning air — less humid than a month ago, cold enough now to form dew on garden beds overnight. Fine webs between plants catch the moisture and shine in the low first light. What does the morning air feel like where you are?',
      'Autumn fungi appear in leaf litter and mulched beds after rain — thin brown mycena caps first, then larger agarics pushing up through the damp mulch. They appear overnight and vanish just as quickly. Have you spotted any fungi near you after the last shower?',
      'Eastern rosellas are loud in suburban gardens now, working through fallen apples and windfall figs on the ground as often as in the branches. Their colours — red head, yellow belly, blue wing — show best when they pause to look around. What birds have you noticed in the garden this week?',
      'Orb weavers are at their largest now, their webs wide enough to catch dew by morning and visible from a distance. The spider sits at the centre or retreats to a corner connected by a signal thread. Have you come across any large spiders or webs lately?',
      "The whipbird's sharp crack-and-whip call carries through the understory of remnant bush — often a duet, the female answering the male's whip almost instantly. Dense low vegetation near creek gullies is where they stay hidden. What sounds have you been noticing outside lately?",
    ],
  },
  {
    month: 3, // April
    season: 'Autumn',
    sow: ['Broad beans', 'Carrot', 'Onion', 'Parsley', 'Spinach'],
    harvest: ['Citrus', 'Broccoli', 'Silverbeet'],
    bloom: ['Camellia', 'Clivia', 'Banksia'],
    observable:
      'Autumn fungi push up through fallen leaves in leaf litter and mulch after rain — yellow and brown caps sometimes in rings or lines following buried wood. The mycelium web beneath is still working, converting leaf to soil. Have you spotted any mushrooms near you this week?',
    observables: [
      'Autumn fungi push up through fallen leaves in leaf litter and mulch after rain — yellow and brown caps sometimes in rings or lines following buried wood. The mycelium web beneath is still working. Have you spotted any mushrooms or fungi near you this week?',
      'Eastern rosellas are on the ground as often as the branches now, working through fallen apples and figs. Their colours — red head, yellow belly, blue wing — show best when they pause and look around. What birds have you seen on the ground near you lately?',
      'The smell of leaf litter warming after a cool morning is the scent of this season — decomposing leaves, soil and rain, a richness that builds through autumn. Millipedes and slaters move through the litter beneath, converting leaf to soil. What does the air smell like near you right now?',
      'Swift parties are getting smaller each week, circling high on warm days. On the day they go, you simply notice they are no longer there. Have you spotted swifts in the sky above you lately?',
      'Late afternoon shadows in April stretch further than they went all summer — the sun throws them long and low across lawns and footpaths. Native pigeons roost on warm ledges and rooftops while the light holds. What does the light look like from where you are right now?',
      "The whipbird's territory call rings through gully scrub and dense understorey, carrying further than most bird sounds. Eastern whipbirds are sedentary — if you've heard one before near you, it's probably still there. What sounds have you been noticing lately from outside?",
      'English oaks are dropping their acorns now, a food source for sulphur-crested cockatoos and currawongs that arrive in small groups. The smell of crushed acorn underfoot is particular to this time of year. What is falling from the trees near you right now?',
    ],
  },
  {
    month: 4, // May
    season: 'Late autumn',
    sow: ['Broad beans', 'Garlic', 'Onion', 'Peas', 'Lettuce'],
    harvest: ['Kale', 'Silverbeet', 'Citrus', 'Carrot'],
    bloom: ['Camellia', 'Grevillea', 'Protea'],
    observable:
      'Even at midday the shadow stretches further than you are tall — the sun barely clears the rooftops at its peak now. Everything on the south side of a wall stays in shade all day, the cold air settling there through the morning. How does the light fall where you are at this time of day?',
    observables: [
      'Even at midday the shadow stretches further than you are tall — the sun barely clears the rooftops at its peak now. Everything on the south side of a wall stays in shade all day, cold air settling there through the morning. How does the light fall where you are at this time of day?',
      'The morning air has a real cold edge now, the kind that does not ease off even when the sun comes out. Silvereyes and wattlebirds move through bare branches all day, picking at bark and hunting insects in the cold. What birds have you seen or heard outside today?',
      'Frost forms in the hollows and low spots first — following the same cold air drainage paths every year. By the time the sun reaches it, most of the frost has already gone from the high ground. Have you seen any frost near you this week?',
      'Boobook owls begin calling their territory now — a low, soft double hoot from somewhere in the canopy, often answered by another bird. The calls start before midnight and carry further on still cold nights. Have you heard any owls after dark near you lately?',
      'Cold damp soil and a thread of wood smoke from a few streets away — that combination is May in Melbourne, and it comes and goes fast once the day warms up. The smell is most concentrated in still air just after dawn. What does the air smell like outside your window right now?',
      'Dusk arrives noticeably earlier than last month — the sky shifts through three or four colours before dark if there is a clear view to the west. The change in daylight is fastest right around now. What was the sky like at dusk today from where you are?',
      'Deciduous trees on the same street are at completely different stages — some bare, some still holding their last gold leaves. The ones clinging on go beautifully backlit by morning sun. What are the trees near you doing right now?',
    ],
  },
  {
    month: 5, // June
    season: 'Winter',
    sow: ['Garlic', 'Onion', 'Peas', 'Broad beans'],
    harvest: ['Orange', 'Lemon', 'Mandarin', 'Kale', 'Silverbeet'],
    bloom: ['Wattle (Acacia)', 'Camellia', 'Jonquil'],
    observable:
      'Wattle is the first colour of the year — dense, powdery yellow flowers bright against bare winter branches. Honeyeaters and spinebills visit the blooms from first light, moving branch to branch in the cold. Have you spotted any wattle in flower near you this week?',
    observables: [
      'Wattle is the first colour of the year — dense, powdery yellow flowers bright against bare winter branches. Honeyeaters and spinebills visit the blooms from first light, moving branch to branch in the cold. Have you spotted any wattle in flower near you this week?',
      'Boobook owls are marking territory on winter evenings — the call coming from high in a canopy tree, repeated every few seconds. Two birds answering each other means you are between their territories. Have you heard any owls after dark near you lately?',
      'Cold damp soil and wood smoke on still mornings — winter has a particular smell, and this is it. The garden holds moisture now, the earth soft enough to leave fingerprints. What does the air smell like outside today?',
      'Wattlebirds chase spinebills, spinebills chase silvereyes — a strict hierarchy plays out in the flowering wattle branches before 7am. The light is still dim but the noise is full-on. What birds have you heard or seen near you this morning?',
      "The sun's path across the sky has compressed to a low, shallow arc that barely clears the northern parts of the garden. Plants on the south side of buildings receive almost no direct light now. How does the light fall in the space outside your window right now?",
      "A barking owl's double bark — distinctly canine, coming from high in a tall tree — can stop you in your tracks the first time. In some areas a mated pair will call in alternation. What sounds have you been noticing after dark near you?",
      'In winter, twilight lingers long because the sun sets at a low angle and stays close to the horizon. After sunset the western sky shifts from orange to green to deep blue before going dark. What did the sky look like at dusk today from where you are?',
    ],
  },
  {
    month: 6, // July
    season: 'Winter',
    sow: ['Onion', 'Peas', 'Broad beans', 'Garlic'],
    harvest: ['Orange', 'Grapefruit', 'Kale', 'Spinach', 'Carrot'],
    bloom: ['Wattle', 'Magnolia', 'Daphne'],
    observable:
      'Frost crystals on grass blades and car roofs disappear from the edges inward as the sun angle deepens, leaving a wet ring behind. They form on exposed surfaces first — lawns, bare soil — and evaporate in the order the sun reaches them. Have you seen any frost near you this morning?',
    observables: [
      'Frost crystals on grass blades and car roofs disappear from the edges inward as the sun angle deepens, leaving a wet ring behind. They form on exposed surfaces first — lawns, bare soil — and evaporate in the order the sun reaches them. Have you seen any frost near you this morning?',
      'New Holland honeyeaters are the most aggressive birds around the wattle flowers now — chasing birds twice their size away from the blooms. Each flower holds a tiny drop of nectar; the honeyeaters guard whole branches. What birds have you noticed near you this week?',
      'The solstice is past and days are slowly lengthening again — the change is imperceptible day-to-day but cumulative. Kookaburras begin their first tentative spring calls from around this time. What have you been noticing about the light lately?',
      'Magnolia flowers open on bare branches before any leaves emerge — white or pink, direct from winter wood, before any other growth shows. Street magnolias become landmarks in mid-winter, their blooms standing out from every leafless tree. Have you spotted any magnolias flowering near you?',
      'The powerful owl is the largest owl in Australia — its deep double hoot carries far through treed suburban streets after dark. Old-growth trees in parks provide the hollows they nest in. Have you heard any owls calling near you lately?',
      'Winter moons ride high — nearly overhead — because the moon is opposite the sun, and the winter sun is low. The light is pale and blue-white, casting faint shadows even in suburbia. What does the moon look like from where you are tonight?',
      'A sheltered north-facing wall absorbs enough heat from the weak winter sun to feel genuinely warm to the touch by midday. On still days the warmth is real, even in July. What does the sun feel like from where you are right now?',
    ],
  },
  {
    month: 7, // August
    season: 'Late winter',
    sow: ['Beetroot', 'Carrot', 'Lettuce', 'Peas', 'Tomato (indoors)'],
    harvest: ['Citrus', 'Kale', 'Broad beans', 'Spinach'],
    bloom: ['Wattle', 'Grevillea', 'Native orchid', 'Jonquil'],
    observable:
      'Wattle on a still morning fills the air with its dusty, sweet scent — the pollen drifts visibly, coating everything nearby with yellow dust. Honeyeaters work through the flowers with their heads dusted yellow by the time they move on. Have you come across any wattle in flower near you this week?',
    observables: [
      'Wattle on a still morning fills the air with its dusty, sweet scent — the pollen drifts visibly, coating everything nearby with yellow dust. Honeyeaters work through the flowers with their heads dusted yellow by the time they move on. Have you come across any wattle in flower near you this week?',
      'Male lyrebirds in the Dandenong Ranges are at peak display now — their mimicry can move from kookaburra to car alarm to camera shutter in a single phrase. Wet gullies with tree ferns are the best habitat. Have you heard any extraordinary bird sounds lately?',
      'The first swallows are back — arriving thin and tired from migration, immediately hunting insects low and fast over dams and wetlands. Within a week they are back to their usual frantic aerobatics. Have you spotted any swallows near water recently?',
      'Spider orchids and sun orchids appear in dry grassy woodland after winter rain — small and easy to overlook, blooming for just a few days each. The timing shifts year to year with rainfall. Have you spotted any wildflowers near you recently?',
      'Jonquil and snowdrop tips are emerging around old garden beds, weeks before any warmth is felt in the air. The soil holds enough heat from sunlight to drive the growth even while mornings stay cold. Have you noticed any spring bulbs pushing up near you?',
      'Magpies are beginning their spring warbling in the early mornings — the full carolling call replacing the shorter winter notes, a signal that territory establishment is underway. A pair will exchange calls back and forth, each adding phrases the other echoes back. What birds have you been hearing first thing in the morning?',
      'Yellow-tailed black cockatoos in old gums methodically strip seed cones open, holding them in one foot. A shower of cone fragments on the path below is the first sign they are feeding above. Have you spotted or heard any cockatoos near you lately?',
    ],
  },
  {
    month: 8, // September
    season: 'Early spring',
    sow: ['Tomato', 'Capsicum', 'Basil', 'Beans', 'Cucumber'],
    harvest: ['Peas', 'Broad beans', 'Silverbeet'],
    bloom: ['Jasmine', 'Wisteria', 'Boronia', 'Cherry blossom'],
    observable:
      'The dawn chorus is building toward its October peak — fantails in the understorey, honeyeaters in the canopy, magpies everywhere. New voices arrive each week as resident birds begin nesting. What birds have you heard this morning?',
    observables: [
      'The dawn chorus is building toward its October peak — fantails in the understorey, honeyeaters in the canopy, magpies everywhere. New voices arrive each week as resident birds begin nesting. What birds have you heard this morning?',
      'Wisteria hangs heavy with purple racemes just opening on fences and walls — fragrant in warm weather, attracting bumblebees and native bees. The blooms appear before the leaves, a wash of purple against bare wood. Have you spotted any wisteria flowering near you?',
      'New Holland honeyeaters have become territorial and aggressive near their nesting sites — chasing anything that comes too close in a blur of motion and loud calling. What birds have you noticed in the garden today?',
      'The first leaves on deciduous trees emerge translucent and vivid green, backlit by morning sun. Against the morning sky, fresh growth glows a colour that exists only in spring. What does the new growth look like in the trees near you?',
      'A New Holland honeyeater moves through grevilleas in sequence — visiting each flower and leaving with a pollen smear on its head. The pace is relentless. What is flying or moving near you in the garden today?',
      'At the equinox, light and dark are briefly equal — and from tomorrow, light takes over. The mornings and evenings feel balanced in a way they will not again until autumn. What does the light feel like where you are today?',
      'Banksias covered in small birds working the flower spikes in the morning sun — spinebills probing the tubular flowers with curved bills, wattlebirds claiming whole spikes. What birds have you seen near flowers lately?',
    ],
  },
  {
    month: 9, // October
    season: 'Spring',
    sow: ['Tomato', 'Pumpkin', 'Zucchini', 'Corn', 'Capsicum'],
    harvest: ['Asparagus', 'Broad beans', 'Lettuce'],
    bloom: ['Boronia', 'Flannel flower', 'Grevillea', 'Hardenbergia'],
    observable:
      'Swifts appear after dark, their silhouette long and scimitar-shaped as they climb fast to catch the last thermals. By full dark they may still be feeding a hundred metres up, calling in thin high cries. Have you spotted swifts above you in the evening sky lately?',
    observables: [
      'Swifts appear after dark, their silhouette long and scimitar-shaped as they climb fast to catch the last thermals. By full dark they may still be feeding a hundred metres up, calling in thin high cries. Have you spotted any in the evening sky lately?',
      'Orb weaver webs catch the fading western light at dusk — visible as golden sheets suspended in the air between fences and shrubs. The spider sits at the centre, waiting for the moths that will come after dark. Have you noticed any large webs near you lately?',
      'A grevillea in a native garden draws spinebills, honeyeaters, lorikeets — and close up, small flies and beetles taking the overflow. The flower is designed to transfer pollen to a different part of each visitor. What is visiting flowers near you today?',
      'North-facing brick walls are warm to the touch by late afternoon, absorbing heat through the day. Small skinks and geckos emerge to bask on the warm surface before the light goes. Have you seen any lizards in the sun near you lately?',
      'The first soft spring growth is the most vulnerable to caterpillars — camouflaged as stems or matching the leaf colour exactly. Small wrens and thornbills are hunting them through new leaves. What small birds have you noticed near you lately?',
      'The dawn chorus in October routinely passes twenty species in inner suburbs — the peak of the year. A few minutes outside at first light, and the list grows fast. What birds have you been noticing most in the mornings?',
      'The first Christmas beetles are emerging on warm evenings near eucalypts — large and shiny, flying erratically toward light. They spent a year or more underground as larvae. Have you seen any around lights after dark this week?',
    ],
  },
  {
    month: 10, // November
    season: 'Late spring',
    sow: ['Basil', 'Beans', 'Pumpkin', 'Sweet corn', 'Eggplant'],
    harvest: ['Strawberry', 'Lettuce', 'Beetroot', 'Peas'],
    bloom: ['Jacaranda', 'Frangipani', 'Agapanthus beginning'],
    observable:
      'Jacaranda petals fall in blue-purple drifts onto pavements and windrow along the kerb. Above, the canopy is still in full bloom — the tree produces flowers for weeks before the leaves fully emerge. Are there any jacarandas near you, and what stage are they at?',
    observables: [
      'Jacaranda petals fall in blue-purple drifts onto pavements and windrow along the kerb. Above, the canopy is still in full bloom — the tree produces flowers for weeks before the leaves fully emerge. Are there any jacarandas near you, and what stage are they at?',
      'Rainbow lorikeets are the loudest birds of spring — rattling through flowering street trees in sharp, continuous calls, chasing each other through the canopy while feeding. What birds have you been hearing most in the last few days?',
      'Small brown moths circle street lights on still nights now, drawn from the warming soil and understorey. Stand near a lamp post on a calm night and dozens of species are circling in the beam. What have you been noticing after dark near you?',
      'North-facing brick walls reach serious heat by late afternoon in November — warm enough for bluetongue lizards to emerge and bask. The wall absorbs heat through the day and holds it into the evening. Have you seen any lizards out recently?',
      'Dragonflies are appearing over warm creeks now — the larvae have overwintered in the creek bed and are emerging as adults, hunting flies and mosquitoes in looping passes over open water. Have you spotted any dragonflies or insects over water near you lately?',
      'The cricket chorus builds in long grass near parks as temperatures stay warm after dark — large black field crickets producing a sound that grows louder and more varied through the month. Have you heard crickets after dark near you lately?',
      'Most native bees are solitary — each female digging her own nest in bare soil near flowering plants and provisioning it with pollen. Their burrows are small round entrances in clay, easy to miss. What insects have you been noticing near flowers lately?',
    ],
  },
  {
    month: 11, // December
    season: 'Early summer',
    sow: ['Basil', 'Beans', 'Cucumber', 'Zucchini'],
    harvest: ['Stone fruit', 'Tomato', 'Capsicum', 'Strawberry'],
    bloom: ['Agapanthus', 'Bougainvillea', 'Frangipani', 'Waterlily'],
    observable:
      'The sky pales to pink from the south-east from around 5:45am — the earliest dawn of the year. Within twenty minutes of first colour the full dawn has broken, bellbirds and kookaburras already calling in the first grey light. What time does it feel like the day starts where you are?',
    observables: [
      'The sky pales to pink from the south-east from around 5:45am — the earliest dawn of the year. Within twenty minutes of first colour the full dawn has broken, bellbirds and kookaburras already calling in the first grey light. What time does it feel like the day starts where you are?',
      'Storm anvils build to the north-west in the late afternoon — tall and flat-topped, backlit from behind by the low sun. A cool gusty wind from the south often precedes the front by an hour. What does the sky look like from your window right now?',
      'Christmas beetles cluster around outdoor lights near eucalypts at night — clumsy in flight, hitting surfaces and falling before flying again. The iridescent green and copper shells catch the light; each one has spent over a year underground. Have you seen any near lights after dark this week?',
      'At the solstice, the midday shadow points almost directly north and barely reaches your feet — the shortest shadow of the year. The angle has been building since June. What does your shadow look like outside right now?',
      'The cicada chorus builds from one or two voices to a full wall of noise as temperatures pass thirty degrees. Different species have different pitches — the greengrocer cicada is the dominant voice in Melbourne suburbs. Have you been hearing cicadas where you are lately?',
      'Grey-headed flying foxes stream out of their daytime roost colonies at dusk in long flowing ribbons toward fruiting trees. The sound of thousands of wings overhead is unmistakable. What is the sky doing where you are at dusk today?',
      'After the solstice, mornings begin to dim — though days remain long into January. The sky is already pale well before the first sunrise, and kookaburras may be calling before any colour appears. What time does the light start outside where you are?',
    ],
  },
];

export function getEarthMonth(month: number): EarthMonth {
  return (
    EARTH_CALENDAR[month] ?? {
      month,
      season: '',
      sow: [],
      harvest: [],
      bloom: [],
      observable: '',
      observables: [],
    }
  );
}

export function getDailyObservable(month: number, day: number): string {
  const data = getEarthMonth(month);
  if (data.observables.length === 0) return data.observable;
  return (
    data.observables[(day - 1) % data.observables.length] ?? data.observable
  );
}
