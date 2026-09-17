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
      'The black cricket chorus peaks in the hour after sunrise, rising from the heat of the soil. Dry grass smells faintly of dust and sun: the particular scent of high summer in this basin. Worth catching before the heat settles in.',
    observables: [
      'The black cricket chorus peaks in the hour after sunrise, rising from the heat of the soil. Dry grass smells faintly of dust and sun: the particular scent of high summer in this basin. Worth catching before the heat settles in.',
      'Sulphur-crested cockatoos strip bark from large eucalypts hunting for insects, the sound carrying well before the birds come into view. Long curls of fresh timber litter the ground below. The bigger the tree, the more likely the birds.',
      'The soil surface is cracked and pale, baked to a crust between grass clumps. Grasshoppers burst from the long grass margins at every step, landing a metre ahead and going still. The land is dry and moving at the same time.',
      'Cicada shells cling to tree bark at eye height: the split cases where adults emerged weeks ago. Above them, the living cicadas are deafening at midday, a wall of sound from the canopy. The empty shells last for months after the chorus fades.',
      'Flying foxes stream out of their daytime roosts at dusk, funnelling toward fruiting trees as the sky holds warm colour. Fig trees and melaleucas are the usual destinations. The bats follow the food.',
      'Native bees work the open flowers in the full heat, visiting grevillea and callistemon in sequences that look almost random. Large carpenter bees thrum heavily. Small native bees barely make a sound.',
      'Heat shimmer rises above roads and rooftops in the mid-afternoon, bending distant trees into slow waves. Common mynas sit in the shade with beaks open, riding out the worst of the heat. The day contracts around the hottest hours.',
    ],
  },
  {
    month: 1, // February
    season: 'Late summer',
    sow: ['Basil', 'Beans', 'Silver beet'],
    harvest: ['Fig', 'Tomato', 'Beans', 'Capsicum'],
    bloom: ['Waterlily', 'Agapanthus', 'Crepe myrtle'],
    observable:
      'Swifts circle higher and higher at dusk, gathering before their long journey north. The sky is still warm and orange as they climb. They may be gone in days.',
    observables: [
      'Swifts circle higher and higher at dusk, gathering before their long journey north. The sky is still warm and orange as they climb. They may be gone in days.',
      'The tawny frogmouth starts its double-thud call at dusk near water: low, ventriloquial, hard to place. A grey lump sitting motionless on a horizontal branch, bill pointing skyward, is often close by. They are easy to mistake for part of the tree.',
      'A ripe fig tree draws lorikeets, wattlebirds, and mynas into the canopy at once. The birds work through it loudly, arguing over position. The pavement beneath goes purple with dropped fruit.',
      'Northerlies bring heat. Southerlies bring relief: a change can drop the temperature ten degrees in an hour, sometimes faster. The shift comes with a gust and a change in the smell of the air.',
      'Melbourne clay opens in long dry stretches, mapping its own structure on the surface. Small skinks find the deeper cracks useful in the heat. The cracks follow the same lines every summer.',
      'Christmas beetles cluster around outdoor lights near eucalypts on still evenings, clumsy and persistent in flight. The adults are short-lived. The larvae spent a year underground before this.',
      'Herons stand motionless in creek shallows for minutes at a time, then strike faster than the eye follows. White-faced and white-necked herons are both present now. Patience is the method.',
    ],
  },
  {
    month: 2, // March
    season: 'Early autumn',
    sow: ['Broccoli', 'Kale', 'Lettuce', 'Peas', 'Silverbeet'],
    harvest: ['Capsicum', 'Tomato', 'Passionfruit', 'Apple'],
    bloom: ['Autumn crocus', 'Salvia', 'Cyclamen'],
    observable:
      'The first leaves are turning at the tips of deciduous trees, yellowing at the outer edges while the inner canopy holds green. Rosellas and cockatoos pick at the drying seed pods as they fall. The change started weeks ago; now it is visible.',
    observables: [
      'The first leaves are turning at the tips of deciduous trees, yellowing at the outer edges while the inner canopy holds green. Rosellas and cockatoos pick at the drying seed pods as they fall. The change started weeks ago; now it is visible.',
      'After 5pm, building shadows stretch across entire streets. The sun has pulled back enough that everything angles differently now. The light is golden and low in a way it was not in February.',
      'A sharper edge has entered the morning air, less humid than a month ago. Garden beds hold dew overnight now. Fine webs catch it and shine in the first light.',
      'Autumn fungi appear in leaf litter and mulch after rain: thin caps first, then larger ones pushing up overnight. They vanish just as quickly. Worth checking again after each shower.',
      'Eastern rosellas work through fallen fruit on the ground as often as in the branches now. Their colours show best when they pause and look around. The garden floor is worth watching.',
      'Orb weavers are at their largest this month, their webs wide enough to catch dew by morning. The spider sits at the centre or retreats to a corner connected by a signal thread. The webs are most visible in the early light.',
      "The whipbird's crack-and-whip call carries through the understory of remnant bush, often a duet with the second bird answering almost instantly. Dense low vegetation near creek gullies is where they stay. The call travels further than the bird.",
    ],
  },
  {
    month: 3, // April
    season: 'Autumn',
    sow: ['Broad beans', 'Carrot', 'Onion', 'Parsley', 'Spinach'],
    harvest: ['Citrus', 'Broccoli', 'Silverbeet'],
    bloom: ['Camellia', 'Clivia', 'Banksia'],
    observable:
      'Autumn fungi push through fallen leaves after rain, sometimes in rings or lines following buried wood. The mycelium beneath is still working, converting leaf to soil. Worth crouching down to look.',
    observables: [
      'Autumn fungi push through fallen leaves after rain, sometimes in rings or lines following buried wood. The mycelium beneath is still working, converting leaf to soil. Worth crouching down to look.',
      'Eastern rosellas are on the ground as often as the branches now, working through fallen fruit. Their colours show best when they pause and look around. The garden floor is worth watching.',
      'Leaf litter warming after a cool morning has a particular smell: decomposing leaves, damp soil, a richness that builds through the season. Millipedes and slaters move through the layers beneath. The smell is the soil working.',
      'The swift parties are smaller each week, circling high on warm days. On the day they go, you simply notice they are no longer there. Some time in April, they leave.',
      'Late afternoon shadows stretch further than they went all summer. The April sun throws them long and low across lawns and paths. Native pigeons roost on warm ledges while the light holds.',
      "The whipbird's territory call rings through gully scrub, carrying further than most bird sounds. Eastern whipbirds are sedentary. The bird calling now has probably always been there.",
      'English oaks are dropping acorns now, drawing sulphur-crested cockatoos and currawongs in small groups. The smell of crushed acorn underfoot is particular to this time of year. Worth noting on a walk.',
    ],
  },
  {
    month: 4, // May
    season: 'Late autumn',
    sow: ['Broad beans', 'Garlic', 'Onion', 'Peas', 'Lettuce'],
    harvest: ['Kale', 'Silverbeet', 'Citrus', 'Carrot'],
    bloom: ['Camellia', 'Grevillea', 'Protea'],
    observable:
      'Even at midday the shadow stretches further than you are tall. The sun barely clears the rooftops at its peak, and everything on the south side of a wall stays in shade all day. The cold settles there and holds.',
    observables: [
      'Even at midday the shadow stretches further than you are tall. The sun barely clears the rooftops at its peak, and everything on the south side of a wall stays in shade all day. The cold settles there and holds.',
      'The morning air has a real cold edge now, the kind that does not ease off even when the sun comes out. Silvereyes and wattlebirds move through bare branches all day, picking at bark in the cold. The garden is still busy; it is just harder to see.',
      'Frost finds the low ground first. Cold air drains downhill overnight and pools in the hollows. The slopes stay clear. Worth a look on your walk.',
      'Boobook owls begin calling their territory from around now: a low, soft double hoot from somewhere in the canopy, often answered by another bird. The calls start before midnight on still nights. The cold carries sound further.',
      'Cold damp soil and a thread of wood smoke from a few streets away: that combination is May in Melbourne, and it comes and goes fast once the day warms up. The smell is most concentrated in still air just after dawn. Worth catching deliberately.',
      'Dusk arrives noticeably earlier than last month. The sky shifts through several colours before dark if there is a clear view west. The change in daylight is fastest right around now.',
      'Deciduous trees on the same street are at completely different stages: some bare, some still holding their last gold leaves. The ones clinging on go beautifully backlit by morning sun. Small birds move through the bare branches all day.',
    ],
  },
  {
    month: 5, // June
    season: 'Winter',
    sow: ['Garlic', 'Onion', 'Peas', 'Broad beans'],
    harvest: ['Orange', 'Lemon', 'Mandarin', 'Kale', 'Silverbeet'],
    bloom: ['Wattle (Acacia)', 'Camellia', 'Jonquil'],
    observable:
      'Wattle is the first colour of the year: dense, powdery yellow flowers bright against bare winter branches. Honeyeaters and spinebills visit from first light, moving branch to branch in the cold. Worth finding one nearby.',
    observables: [
      'Wattle is the first colour of the year: dense, powdery yellow flowers bright against bare winter branches. Honeyeaters and spinebills visit from first light, moving branch to branch in the cold. Worth finding one nearby.',
      'Boobook owls are marking territory on winter evenings, the call coming from high in a canopy tree and repeated every few seconds. Two birds answering each other means you are between their territories. The cold nights carry the sound well.',
      'Cold damp soil and wood smoke on still mornings: winter has a particular smell, and this is it. The garden holds moisture now, the earth soft and changed. The smell comes and goes with the wind.',
      'Wattlebirds chase spinebills, spinebills chase silvereyes: a strict hierarchy plays out in the flowering branches before 7am. The light is still dim but the noise is full on. The wattle brings everything in.',
      "The sun's path across the sky has compressed to a low, shallow arc. Plants on the south side of buildings receive almost no direct light now. The garden divides into those that have sun and those that do not.",
      "A barking owl's double bark, distinctly canine, comes from high in a tall tree and stops people in their tracks the first time. Some areas have a mated pair calling in alternation. The call is startling and unmistakable.",
      'In winter, twilight lingers long after sunset because the sun sets at a shallow angle. The western sky shifts from orange to green to deep blue before going dark. The colours take their time.',
    ],
  },
  {
    month: 6, // July
    season: 'Winter',
    sow: ['Onion', 'Peas', 'Broad beans', 'Garlic'],
    harvest: ['Orange', 'Grapefruit', 'Kale', 'Spinach', 'Carrot'],
    bloom: ['Wattle', 'Magnolia', 'Daphne'],
    observable:
      'Frost crystals on grass blades and car roofs disappear from the edges inward as the sun angle deepens, leaving a wet ring behind. They form on exposed surfaces first and evaporate in the order the sun reaches them. The whole sequence takes less than an hour.',
    observables: [
      'Frost crystals on grass blades and car roofs disappear from the edges inward as the sun angle deepens, leaving a wet ring behind. They form on exposed surfaces first and evaporate in the order the sun reaches them. The whole sequence takes less than an hour.',
      'New Holland honeyeaters are the most aggressive birds around the wattle flowers, chasing birds twice their size from the blooms. Each flower holds a tiny drop of nectar. The hierarchy is enforced constantly.',
      'The solstice is past and days are slowly lengthening again. The change is imperceptible day to day but cumulative. Kookaburras begin their first tentative spring calls from around this time.',
      'Magnolia flowers open on bare branches before any leaves emerge: white or pink, direct from winter wood. Street magnolias become landmarks in mid-winter, their blooms standing out from every leafless tree. The flowers precede everything else.',
      'The powerful owl is the largest owl in Australia. Its deep double hoot carries far through treed suburban streets after dark. Old-growth trees provide the hollows they nest in.',
      'Winter moons ride high, nearly overhead, because the moon is opposite the sun and the winter sun is low. The light is pale and blue-white, casting faint shadows. Worth going outside to see it.',
      'A sheltered north-facing wall absorbs enough heat from the weak winter sun to feel genuinely warm to the touch by midday. On still days, the warmth is real. Plants know this and lean toward it.',
    ],
  },
  {
    month: 7, // August
    season: 'Late winter',
    sow: ['Beetroot', 'Carrot', 'Lettuce', 'Peas', 'Tomato (indoors)'],
    harvest: ['Citrus', 'Kale', 'Broad beans', 'Spinach'],
    bloom: ['Wattle', 'Grevillea', 'Native orchid', 'Jonquil'],
    observable:
      'Wattle on a still morning fills the air with its dusty, sweet scent. The pollen drifts visibly in still air, coating everything nearby yellow. Honeyeaters work through the flowers with their heads dusted by the time they move on.',
    observables: [
      'Wattle on a still morning fills the air with its dusty, sweet scent. The pollen drifts visibly in still air, coating everything nearby yellow. Honeyeaters work through the flowers with their heads dusted by the time they move on.',
      'Male lyrebirds in the Dandenong Ranges are at peak display now. Their mimicry moves from kookaburra to car alarm to camera shutter in a single phrase. Wet gullies with tree ferns, early morning.',
      'The first swallows are back, arriving thin from migration and immediately hunting insects low and fast over water. Within a week they are back to their usual frantic aerobatics. Their return is one of the cleaner seasonal markers.',
      'Spider orchids and sun orchids appear in dry grassy woodland after winter rain, small and easy to overlook. Many bloom for just a few days. The timing shifts year to year with rainfall.',
      'Jonquil and snowdrop tips are emerging in old garden beds, weeks before any warmth is felt in the air. The soil holds enough heat from sunlight to drive the growth while mornings stay cold. The bulbs know the season before the air does.',
      'Magpies are beginning their spring warbling in the early mornings: the full carolling call replacing the shorter winter notes. A pair will exchange calls back and forth, each adding phrases the other echoes back. The territory work has started.',
      'Yellow-tailed black cockatoos in old gums strip seed cones open methodically, holding them in one foot. A shower of cone fragments on the path below is the first sign they are feeding above. Worth looking up.',
    ],
  },
  {
    month: 8, // September
    season: 'Early spring',
    sow: ['Tomato', 'Capsicum', 'Basil', 'Beans', 'Cucumber'],
    harvest: ['Peas', 'Broad beans', 'Silverbeet'],
    bloom: ['Jasmine', 'Wisteria', 'Boronia', 'Cherry blossom'],
    observable:
      'The dawn chorus is building toward its October peak. New voices arrive each week as resident birds begin nesting. A few minutes outside at first light and the list grows fast.',
    observables: [
      'The dawn chorus is building toward its October peak. New voices arrive each week as resident birds begin nesting. A few minutes outside at first light and the list grows fast.',
      'Wisteria hangs heavy with purple racemes just opening on fences and walls. The blooms appear before the leaves, a wash of purple against bare wood. Fragrant on warm mornings.',
      'New Holland honeyeaters have become territorial near their nesting sites, chasing anything that comes close in a blur of motion and calling. The aggression marks the season. Spring is loud.',
      'The first leaves on deciduous trees emerge translucent and vivid green, backlit by morning sun. Fresh growth glows a colour that only exists in spring. The change happens fast once it starts.',
      'A New Holland honeyeater moves through grevilleas in sequence, visiting each flower and leaving with a pollen smear on its head. The pace is relentless. The flower is designed for exactly this.',
      'At the equinox, light and dark are briefly equal. From tomorrow, light takes over. The mornings and evenings feel balanced in a way they will not again until autumn.',
      'Banksias covered in small birds working the flower spikes in the morning sun: spinebills probing with curved bills, wattlebirds claiming whole spikes. Each spike holds hundreds of individual flowers. The birds work through them all.',
    ],
  },
  {
    month: 9, // October
    season: 'Spring',
    sow: ['Tomato', 'Pumpkin', 'Zucchini', 'Corn', 'Capsicum'],
    harvest: ['Asparagus', 'Broad beans', 'Lettuce'],
    bloom: ['Boronia', 'Flannel flower', 'Grevillea', 'Hardenbergia'],
    observable:
      'Swifts appear after dark, their silhouette long and scimitar-shaped as they climb fast to catch the last thermals. By full dark they may still be feeding high up, calling in thin high cries. They are back.',
    observables: [
      'Swifts appear after dark, their silhouette long and scimitar-shaped as they climb fast to catch the last thermals. By full dark they may still be feeding high up, calling in thin high cries. They are back.',
      'Orb weaver webs catch the fading western light at dusk, visible as golden sheets suspended between fences and shrubs. The spider sits at the centre, waiting for the moths that come after dark. The webs are largest now.',
      'A grevillea in a native garden draws spinebills, honeyeaters, and lorikeets, and close up, small flies and beetles working the overflow. The flower is designed to transfer pollen to a different part of each visitor. Worth watching closely for a few minutes.',
      'North-facing brick walls are warm to the touch by late afternoon. Small skinks and geckos emerge to bask on the warm surface before the light goes. The wall holds heat longer than the air.',
      'The first soft spring growth is the most vulnerable to caterpillars, camouflaged as stems or matching the leaf colour exactly. Small wrens and thornbills are hunting them through new leaves. The birds know where to look.',
      'The dawn chorus in October routinely passes twenty species in inner suburbs. It is the peak of the year. A few minutes outside at first light and the list grows fast.',
      'The first Christmas beetles are emerging on warm evenings near eucalypts: large, shiny, flying erratically toward light. They spent a year or more underground before this. The season has turned.',
    ],
  },
  {
    month: 10, // November
    season: 'Late spring',
    sow: ['Basil', 'Beans', 'Pumpkin', 'Sweet corn', 'Eggplant'],
    harvest: ['Strawberry', 'Lettuce', 'Beetroot', 'Peas'],
    bloom: ['Jacaranda', 'Frangipani', 'Agapanthus beginning'],
    observable:
      'Jacaranda petals fall in blue-purple drifts, accumulating along the kerb. Above, the canopy is still in full bloom: the tree produces flowers for weeks before the leaves fully emerge. The best weeks of a Melbourne spring.',
    observables: [
      'Jacaranda petals fall in blue-purple drifts, accumulating along the kerb. Above, the canopy is still in full bloom: the tree produces flowers for weeks before the leaves fully emerge. The best weeks of a Melbourne spring.',
      'Rainbow lorikeets are the loudest birds of spring, rattling through flowering street trees in sharp continuous calls and chasing each other through the canopy. They announce themselves well before they arrive. The noise is part of the season.',
      'Small brown moths circle street lights on still nights, drawn from the warming soil and understorey. Stand near a lamp post on a calm night and dozens of species are circling in the beam. Worth a look before bed.',
      'North-facing brick walls reach serious heat by late afternoon in November. Bluetongue lizards emerge to bask: slow, unhurried, warming through. The wall holds heat longer than the air.',
      'Dragonflies are appearing over warm creeks, the larvae having overwintered in the creek bed and emerged as adults. They hunt in looping passes over open water. The season produces them in numbers.',
      'The cricket chorus builds in long grass near parks as temperatures stay warm after dark. Large black field crickets produce a sound that grows louder and more varied through the month. The warmth is in the ground now.',
      'Most native bees are solitary: each female digging her own nest in bare soil near flowering plants, provisioning it with pollen. Their burrows are small round entrances in clay, easy to miss. Worth crouching to look near flowering plants.',
    ],
  },
  {
    month: 11, // December
    season: 'Early summer',
    sow: ['Basil', 'Beans', 'Cucumber', 'Zucchini'],
    harvest: ['Stone fruit', 'Tomato', 'Capsicum', 'Strawberry'],
    bloom: ['Agapanthus', 'Bougainvillea', 'Frangipani', 'Waterlily'],
    observable:
      'The sky pales to pink from the south-east from around 5:45am: the earliest dawn of the year. Within twenty minutes of first colour the full dawn has broken, bellbirds and kookaburras already calling. The days will not get any longer than this.',
    observables: [
      'The sky pales to pink from the south-east from around 5:45am: the earliest dawn of the year. Within twenty minutes of first colour the full dawn has broken, bellbirds and kookaburras already calling. The days will not get any longer than this.',
      'Storm anvils build to the north-west in the late afternoon: tall, flat-topped, backlit by the low sun. A cool gusty wind from the south often precedes the front by an hour. Worth watching from somewhere with a clear view.',
      'Christmas beetles cluster around outdoor lights near eucalypts at night, clumsy and persistent. Each one spent over a year underground before this. The iridescent shells catch the light.',
      'At the solstice, the midday shadow points almost due north and barely reaches your feet. The angle has been building since June and peaks today. The shortest shadow of the year.',
      'The cicada chorus builds from one or two voices to a wall of sound as temperatures climb. Different species have different pitches. The greengrocer is the dominant voice in Melbourne suburbs.',
      'Grey-headed flying foxes stream out of their roost colonies at dusk in long flowing ribbons, heading toward fruiting trees. The sound of thousands of wings overhead is unmistakable. They are out every evening now.',
      'After the solstice, mornings begin to dim, though days remain long into January. The sky is pale well before 5:46am. Kookaburras may be calling before any colour appears.',
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
