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
      'Step outside in the early morning before heat builds. Listen for the chorus of black crickets in garden beds. In parks with large eucalypts, watch for sulphur-crested cockatoos stripping bark for insects. The smell of warm dry grass is the scent of this fortnight.',
    observables: [
      'Step outside before 8am — listen for the black cricket chorus in garden beds, loudest in the heat of the soil. The dry earth smells faintly of dust and baked grass. Native bees are already working the last summer blooms before the heat peaks.',
      'Watch for sulphur-crested cockatoos stripping bark from large eucalypts, hunting insects beneath. Below the tree, long curls of fresh bark litter the ground. The noise is unmistakable — a loud ripping sound followed by the crash of falling strips.',
      'Notice the smell of warm dry grass — that is the scent of high summer in this basin. The soil surface is cracked and pale, baked to a crust between grass clumps. Grasshoppers burst away at every step through the long grass margins.',
      'Look for cicada shells clinging to tree bark at eye height — the empty cases of last season. The living cicadas above are deafening at midday, a solid wall of sound from the canopy. Run a finger along the seam at the back of the shell: that is where the adult split free.',
      'At dusk, watch for flying foxes streaming overhead toward fruiting trees in the canopy. The sky holds purple and orange behind the silhouettes of gums as the bats funnel out from their daytime roosts. Fig trees and melaleucas are the destinations — follow the stream to find them.',
      'Check flowering native plants for native bees — small, fast, working in the full heat. Grevillea and callistemon attract the most species. Listen for the difference: large carpenter bees thrum heavily; small native bees barely make a sound.',
      'Notice the heat shimmer above roads and rooftops in the mid-afternoon. The shimmer bends distant trees and power lines into slow waves. Common mynas sit in the shade with beaks open, riding out the worst of the heat.',
    ],
  },
  {
    month: 1, // February
    season: 'Late summer',
    sow: ['Basil', 'Beans', 'Silver beet'],
    harvest: ['Fig', 'Tomato', 'Beans', 'Capsicum'],
    bloom: ['Waterlily', 'Agapanthus', 'Crepe myrtle'],
    observable:
      'At dusk, watch the sky for the first swifts and swallows of the season completing their gathering before the long journey north. If you have a creek or park nearby, listen for the thudding call of the tawny frogmouth beginning its late-summer calls.',
    observables: [
      'At dusk, watch for swifts gathering — circling higher and higher before their long journey north. The sky is still warm and orange as they climb. They will be gone in days; this is the last you will see of them until August.',
      'Near water, listen at dusk for the double thud of the tawny frogmouth starting its late-summer call. The sound is low and ventriloquial — hard to locate in the dark. Look for a grey lump sitting motionless on a horizontal branch, bill pointing skyward.',
      'Look for late-ripening figs on street trees — the birds will find them before you do. A ripe fig tree draws rainbow lorikeets, red wattlebirds, and common mynas all at once. The pavement beneath will be stained purple with dropped fruit.',
      'Notice which way the wind is coming from: northerlies bring heat, southerlies the first relief. A southerly change can drop the temperature ten degrees in an hour. Watch the clouds stack on the southern horizon as the change approaches.',
      'Check garden beds for soil cracking in the dry — a map of the summer underground. The cracks reveal the shrinkage of clay-heavy Melbourne soil during long dry stretches. In deeper cracks, small skinks find refuge from the heat.',
      'On still evenings, watch for Christmas beetles clustering around outdoor lights near eucalypts. They are clumsy in flight, bumping into windows and walls. The adults are short-lived; the larvae have spent a year underground feeding on roots.',
      'Look along creek lines for herons standing absolutely still in the shallows, waiting. White-faced and white-necked herons are both present now, sometimes within metres of each other. A strike is faster than the eye follows — sudden and precise.',
    ],
  },
  {
    month: 2, // March
    season: 'Early autumn',
    sow: ['Broccoli', 'Kale', 'Lettuce', 'Peas', 'Silverbeet'],
    harvest: ['Capsicum', 'Tomato', 'Passionfruit', 'Apple'],
    bloom: ['Autumn crocus', 'Salvia', 'Cyclamen'],
    observable:
      'Walk through any park with deciduous trees and watch the first leaves turning — yellows and oranges beginning at the tips. Mornings are noticeably sharper now. On clear days after 5pm, notice the shadow of buildings stretching longer than they did a month ago.',
    observables: [
      'Walk through a park with deciduous trees — watch for the first leaves turning at the tips, yellowing. The trees have been in green all summer; now amber and gold are appearing at the outer edges. Rosellas and cockatoos pick at the seed pods of elms and plane trees as they dry and fall.',
      'After 5pm, notice how building shadows have stretched since January — the sun is withdrawing. The angle is already low enough to cast shadows across entire streets. The quality of the light changes: warmer, more golden, horizontal at dusk.',
      'On a cool morning, feel how the air has changed — sharper, less humid than a month ago. Garden beds that were dry all summer are now holding morning dew. Fine webs between plants catch the moisture and shine in the low first light.',
      'Look for the first autumn fungi appearing in leaf litter and mulched garden beds after rain. Thin brown mycena caps appear first, then larger agarics push up through the damp mulch. They appear overnight and vanish just as quickly — check again after each shower.',
      'Watch for eastern rosellas feeding loudly on fallen fruit in suburban gardens. The flock moves together through the garden, calling as they go — bright reds and yellows against green lawns. Unripe or wind-fallen apples and pears get picked over first.',
      'Notice the spider webs in the morning light — orb weavers are at their largest now. The webs are wide enough to catch dew by morning, making them visible from a distance. The spider sits at the centre, or retreats to a corner retreat connected by a signal thread.',
      "In remnant bush, listen for the whipbird's sharp crack-and-whip call in the understory. The two-part call is often a duet — the female answers the male's whip almost instantly. Dense low vegetation near creek gullies is where they stay hidden.",
    ],
  },
  {
    month: 3, // April
    season: 'Autumn',
    sow: ['Broad beans', 'Carrot', 'Onion', 'Parsley', 'Spinach'],
    harvest: ['Citrus', 'Broccoli', 'Silverbeet'],
    bloom: ['Camellia', 'Clivia', 'Banksia'],
    observable:
      "Look down as well as up — autumn fungi begin appearing in leaf litter and mulch after the first rains. Eastern rosellas are loud and visible now, feeding on fallen fruit in gardens. In remnant bush, listen for the whipbird's sharp crack-and-whip call in the understory.",
    observables: [
      'Look down as well as up — autumn fungi are appearing in leaf litter and mulch after rain. Yellow and brown caps push up through fallen leaves, often in rings or lines following buried wood. Leave them in place: the mycelium web beneath is still feeding on the roots.',
      'Listen for eastern rosellas, loud and visible as they feed on fallen fruit in gardens. They work the ground as often as the branches, picking through fallen apples and windfall figs. Their colours — red head, yellow belly, blue wing — are most visible when they pause to look around.',
      'Notice the smell of leaf litter warming after a cool morning — the scent of transition. The decomposing leaves smell of soil and rain, a richness that builds through autumn. Millipedes and slaters move through the litter beneath, converting leaf to soil.',
      "Watch for the last swifts of the season — they won't return until August. The parties become smaller each week, circling high on warm days. On the day they go, you simply notice they are no longer there.",
      "In the late afternoon, follow a long shadow — yours or a building's — as it moves across the ground. The angle of the April sun throws shadows further than they went all summer. Native pigeons roost on warm ledges and rooftops while the light holds.",
      "Listen for the whipbird's sharp call in remnant bush — its territory is loudest now. The call rings through gully scrub and dense understorey, carrying further than most bird calls. Eastern whipbirds are sedentary; if you hear one, it is probably always there.",
      'Check street trees for seed pods and nuts beginning to fall — count what you find. English oaks in particular drop their acorns now, a food source for sulphur-crested cockatoos and currawongs. The smell of crushed acorn underfoot is particular to this time of year.',
    ],
  },
  {
    month: 4, // May
    season: 'Late autumn',
    sow: ['Broad beans', 'Garlic', 'Onion', 'Peas', 'Lettuce'],
    harvest: ['Kale', 'Silverbeet', 'Citrus', 'Carrot'],
    bloom: ['Camellia', 'Grevillea', 'Protea'],
    observable:
      'Notice how low the midday sun has become — its angle is now low enough to project long shadows even at noon. On still mornings, watch for spider webs strung between fence posts and shrubs, their silk made visible by the low-angle light. First frosts may appear inland in the Dandenongs.',
    observables: [
      'Check your shadow at noon today — even at midday it stretches further than you are tall. The sun barely clears the rooftops at its peak, and everything on the south side of a wall is in shade all day. That low angle crept up gradually, and now it is undeniable.',
      'Go outside in the first hour after sunrise and just stand there for a few minutes. The air has a real cold edge to it now, the kind that does not ease off even when the sun comes out. Silvereyes or wattlebirds will probably move through the garden while you are there.',
      'If you are anywhere on the fringe of the city — Dandenongs, Yarra Valley, outer suburbs — check for frost on lawns at dawn. It forms in the hollows and low spots first, following the same cold air drainage paths every year. Worth catching before the sun burns it off.',
      'Wait until it is properly dark, then step outside and listen for a minute. Boobook owls are starting to call their territory now — a low, soft double hoot from somewhere in the canopy. Let your ears adjust. You will usually hear more than one.',
      'Before anything else in the morning — just smell the air. Cold damp soil and a thread of wood smoke from a few streets away. That combination is May in Melbourne, and it comes and goes fast once the day warms up. Worth catching deliberately.',
      'Pay attention to dusk this week — it arrives noticeably earlier than last month. If you watch from somewhere with a clear view to the west you can catch the sky shift through three or four colours before it goes dark. The change in daylight is fastest right around now.',
      'Look at the deciduous trees in your street or nearest park. Some will be completely bare, others still holding their last leaves. The ones clinging on go beautifully gold when backlit by morning sun. Small birds — silvereyes, thornbills — move through the bare branches all day, picking at bark.',
    ],
  },
  {
    month: 5, // June
    season: 'Winter',
    sow: ['Garlic', 'Onion', 'Peas', 'Broad beans'],
    harvest: ['Orange', 'Lemon', 'Mandarin', 'Kale', 'Silverbeet'],
    bloom: ['Wattle (Acacia)', 'Camellia', 'Jonquil'],
    observable:
      'The first wattles are in flower — find them along bike paths and in parks. Their yellow is the earliest colour of the year. In the evenings, listen for the piping calls of boobooks beginning their winter territories. The air smells of cold, damp soil and distant wood smoke.',
    observables: [
      'Find a wattle in flower along a bike path or park edge — its yellow is the first colour of the year. The flowers are dense and powdery, bright against bare branches and grey winter bark. Honeyeaters and spinebills visit the blooms from first light, moving branch to branch in the cold.',
      "In the evening, listen for the piping call of a boobook owl — they're marking territory now. The call comes from high in a canopy tree, repeated every few seconds. If you hear two birds answering each other, you are between their territories.",
      "Notice the smell of cold damp soil and wood smoke on still mornings — this is winter's signature. The garden holds moisture now; press your fingers into bare earth and feel how soft it has become. Earthworms are active near the surface after rain, leaving casts on the soil.",
      'Before 7am near wattles, listen for honeyeaters fighting over blooms in the cold. Wattlebirds chase spinebills; spinebills chase silvereyes — a strict hierarchy plays out in the flowering branches. The light is still dim but the noise is full-on.',
      "Watch the angle of the sun through a south-facing window — it barely clears the roofline. The sun's path across the sky has compressed to a low, shallow arc that touches just the northern parts of the garden. Plants on the south side of buildings receive almost no direct light now.",
      "Listen at night near parks for a barking owl's double bark — like a distant dog. The call is startling the first time: distinctly canine, coming from high in a tall tree. In some areas a mated pair will call in alternation.",
      'After sunset, notice how the western sky holds colour over the rooftops for a long time. In winter, twilight lingers because the sun sets at a low angle and stays close to the horizon longer. The colour shifts from orange to green to deep blue — watch all three.',
    ],
  },
  {
    month: 6, // July
    season: 'Winter',
    sow: ['Onion', 'Peas', 'Broad beans', 'Garlic'],
    harvest: ['Orange', 'Grapefruit', 'Kale', 'Spinach', 'Carrot'],
    bloom: ['Wattle', 'Magnolia', 'Daphne'],
    observable:
      'The winter solstice is past — days are now very slowly lengthening. Early morning on a clear day, watch for frost crystals on car roofs and grass blades evaporating as the sun touches them. In wattle-rich areas, you may hear honeyeaters fighting over the blooms before 7am.',
    observables: [
      'On a clear morning, watch frost crystals on grass blades evaporate as the sun touches them. The crystals form on exposed surfaces first — lawns, car roofs, bare soil. They disappear from the edges inward as the sun angle deepens, leaving a wet ring behind.',
      'In wattle-rich areas, hear honeyeaters fighting noisily over blooms before 7am. New Holland honeyeaters are the most aggressive — watch them pursue birds twice their size. The wattles are covered in yellow stamens; each flower holds a tiny drop of nectar.',
      'The solstice is past — days are slowly lengthening. Notice: is this evening a minute lighter than last week? The change is imperceptible day-to-day but cumulative. Kookaburras begin their first tentative spring calls from around this time.',
      'Look for magnolia flowers opening on bare branches before any leaves emerge. The flowers appear direct from the winter-bare wood, white or pink, before any other growth shows. Street magnolias become landmarks in mid-winter — their blooms standing out from every leafless tree.',
      "At dusk, listen for the powerful owl's deep double hoot in treed suburban streets. The powerful owl is the largest owl in Australia — its call is low and carries far. Old-growth trees in parks and large suburban blocks provide the hollows they nest in.",
      "Watch the moon's arc tonight — winter moons ride high, nearly overhead. Because the moon is opposite the sun, and the winter sun is low, the full moon rises high in the sky. The light is pale and blue-white, casting faint shadows even in suburbia.",
      'Face the weak winter sun directly for a moment — even at low angle, the warmth is real. At midday the sun is only 30° above the horizon but the UV index can still reach 2–3. On still days, a sheltered north-facing wall absorbs enough heat to feel genuinely warm to the touch.',
    ],
  },
  {
    month: 7, // August
    season: 'Late winter',
    sow: ['Beetroot', 'Carrot', 'Lettuce', 'Peas', 'Tomato (indoors)'],
    harvest: ['Citrus', 'Kale', 'Broad beans', 'Spinach'],
    bloom: ['Wattle', 'Grevillea', 'Native orchid', 'Jonquil'],
    observable:
      'Wattle is at peak bloom — stand near a flowering acacia on a still morning and you will smell its dusty-sweet scent. In the Dandenong Ranges and outer bush, lyrebirds are mid-display season: listen for extraordinary mimicry cascades. Watch for the first swallows returning low over water on warm afternoons.',
    observables: [
      'Stand near a flowering acacia on a still morning and breathe in — dusty, sweet, unmistakable. The pollen drifts visibly in still air, coating everything nearby with yellow dust. Honeyeaters work through the flowers, their heads dusted yellow by the time they move on.',
      'In the Dandenong Ranges, listen for lyrebird mimicry — it may sound like a kookaburra, then a car alarm. Male lyrebirds are at peak display now, incorporating any sound from their territory. Wet gullies with tree ferns are the best habitat; early morning is the best time.',
      'Watch for the first swallows returning — low and fast over water on warm afternoons. They arrive thin and tired from migration, immediately hunting insects over dams and wetlands. By the following week they are back to their usual frantic aerobatics.',
      'Look for native orchids appearing in dry grassy woodland after winter rain. Spider orchids and sun orchids are small and easy to overlook — search at ground level in sparse grass. Many bloom for just a few days; the timing shifts year to year with rainfall.',
      'Notice spring bulbs pushing through the soil around old garden beds. Jonquil and snowdrop tips emerge weeks before any warmth is felt in the air. The soil holds enough heat from sunlight to drive the growth even while mornings stay cold.',
      'Listen for magpies beginning their spring warbling in the early mornings. The full carolling call replaces the shorter winter notes — a signal that territory establishment is underway. A pair will exchange calls back and forth, each adding phrases the other echoes back.',
      'In parks with old gums, look up for yellow-tailed black cockatoos chewing seed cones. The birds hold cones in one foot and methodically strip them open, dropping the debris below. A shower of cone fragments on the path is the first sign they are feeding above.',
    ],
  },
  {
    month: 8, // September
    season: 'Early spring',
    sow: ['Tomato', 'Capsicum', 'Basil', 'Beans', 'Cucumber'],
    harvest: ['Peas', 'Broad beans', 'Silverbeet'],
    bloom: ['Jasmine', 'Wisteria', 'Boronia', 'Cherry blossom'],
    observable:
      'The equinox passes — days are now longer than nights. Go outside in the early morning and listen: the dawn chorus is building, new voices arriving each week as resident birds begin nesting. Look for wisteria draping over fences and walls, heavy with purple racemes. Honeyeaters are territorial and loud.',
    observables: [
      'Step outside early and count how many bird species you can hear before 8am — it grows each week. The dawn chorus in September is building toward its October peak. Walk slowly and listen: fantails in the understorey, honeyeaters in the canopy, magpies everywhere.',
      'Look for wisteria draped over fences and walls, heavy with purple racemes just opening. The racemes hang in clusters, fragrant in warm weather, attracting bumblebees and native bees. The blooms appear before the leaves — a wash of purple against bare wood.',
      'Notice how territorial honeyeaters have become — chasing each other through gardens at speed. New Holland honeyeaters are aggressive with anything near their nesting territory. A chasing pair moves through the garden in a blur, calling loudly.',
      'Watch for new leaves on deciduous trees: translucent and vivid green, backlit by morning sun. The first leaves emerge folded and pale, then unfurl and deepen over a few days. Against the morning sky, fresh growth glows a colour that exists only in spring.',
      'In native gardens, follow a New Holland honeyeater through the grevilleas. They visit each flower in sequence, hovering briefly at each and leaving with a pollen smear on their head. Count how many flowers they work in a minute — the pace is relentless.',
      'At the equinox, today light and dark are equal — tomorrow, light takes over. Stand outside at 6am and 6pm: the light is balanced at both ends of the day. From here the arc lengthens, each tomorrow carrying more light than the day before until December.',
      'Look for banksias covered in small birds working the flower spikes in the morning sun. Spinebills probe the tubular flowers with curved bills; wattlebirds claim whole spikes and chase others away. Each spike holds hundreds of individual flowers, each a tiny nectar source.',
    ],
  },
  {
    month: 9, // October
    season: 'Spring',
    sow: ['Tomato', 'Pumpkin', 'Zucchini', 'Corn', 'Capsicum'],
    harvest: ['Asparagus', 'Broad beans', 'Lettuce'],
    bloom: ['Boronia', 'Flannel flower', 'Grevillea', 'Hardenbergia'],
    observable:
      'Watch for swifts back in the sky after dark, catching insects high up. Garden spiders are building large orb webs by mid-month — check fences and shrubs at dusk when webs are backlit. In native gardens, New Holland honeyeaters and spinebills are working the grevilleas hard.',
    observables: [
      'After dark, watch for swifts hunting insects high up — their silhouette is long and scimitar-shaped. At dusk they appear, climbing fast to catch the last thermals. By full dark they may still be feeding 100m up, calling in thin high cries.',
      'At dusk, check fences and shrubs for orb weaver webs — the spiders are large and backlit now. The webs catch the fading light from the west, visible as golden sheets suspended in the air. The spider sits at the centre, waiting for the moths that will come after dark.',
      'In a native garden, count how many species visit a grevillea in ten minutes. Spinebills, honeyeaters, lorikeets — and look closely for small insects too, flies and beetles taking the overflow. The flower is engineering: pollen is transferred to different parts of each visiting animal.',
      'Notice the warmth building in north-facing brick walls after 3pm. The bricks absorb heat through the day; by late afternoon they are warm to the touch. Small lizards emerge to bask — skinks and geckos working the warm surface before the light goes.',
      'Look for caterpillars on young leaves — small wrens and thornbills are hunting them. The first soft spring growth is the most vulnerable to caterpillars. Watch carefully: they are camouflaged as stems or matching the leaf colour exactly.',
      'At dawn, count the bird species you hear in five minutes — it is peak season. The list will surprise you: the dawn chorus in October routinely passes twenty species in inner suburbs. Include the calls you cannot identify; silence is part of knowing what is missing.',
      'Watch for the first Christmas beetles emerging on warm evenings near eucalypts. The adults are large and shiny, flying erratically toward light after dark. They spend a year or more underground as larvae feeding on eucalyptus roots before emerging.',
    ],
  },
  {
    month: 10, // November
    season: 'Late spring',
    sow: ['Basil', 'Beans', 'Pumpkin', 'Sweet corn', 'Eggplant'],
    harvest: ['Strawberry', 'Lettuce', 'Beetroot', 'Peas'],
    bloom: ['Jacaranda', 'Frangipani', 'Agapanthus beginning'],
    observable:
      'Jacaranda petals carpet pavements and footpaths — look for carpets of purple-blue beneath the trees. Listen for the loud rattling calls of rainbow lorikeets in flowering street trees. Watch for small brown moths around street lights at night: their flights mark the accelerating warmth of the soil.',
    observables: [
      'Look for jacaranda petals carpeting the pavement beneath the trees in blue-purple drifts. The fallen petals are soft and accumulate in windrows along the kerb. Above, the canopy is still in full bloom — the tree produces flowers for weeks before the leaves fully emerge.',
      'Listen for rainbow lorikeets rattling through flowering street trees — the loudest birds of spring. Their call is sharp and continuous, a signature sound of Melbourne spring. In groups they become frantic, chasing each other through the canopy while feeding.',
      'At night, watch for small brown moths around street lights — the soil is warm and they are rising. The moths are drawn from the soil and understorey, emerging with the warmth. Stand near a lamp post on a calm night and you will see dozens of species circling.',
      'Notice the heat now in north-facing walls after 3pm — summer is arriving through the brick. The wall surface can reach 40°+ in direct sun by late afternoon. Bluetongue lizards emerge to bask in November, often near rock walls and brick garden edges.',
      'Look for dragonflies over water — warm creeks are producing them now. Dragonflies need water to breed; the larvae have overwintered in the creek bed and are emerging as adults. The adults hunt flies and mosquitoes in loops over open water.',
      'At dusk, listen for the cricket chorus building in long grass near parks. The sound grows louder and more varied through the month as temperatures stay warm after dark. Follow the sound and crouch to look — large black field crickets are common in Melbourne grass.',
      'Check native plants for native bee activity — small, fast, working every open flower. Most native bees are solitary; each female digs her own nest and provisions it with pollen. Look for their burrows in bare soil near flowering plants — small round entrances in clay.',
    ],
  },
  {
    month: 11, // December
    season: 'Early summer',
    sow: ['Basil', 'Beans', 'Cucumber', 'Zucchini'],
    harvest: ['Stone fruit', 'Tomato', 'Capsicum', 'Strawberry'],
    bloom: ['Agapanthus', 'Bougainvillea', 'Frangipani', 'Waterlily'],
    observable:
      "The longest day: step outside around 5:45am and watch the sky pale to pink from the south-east — Melbourne's summer solstice dawn begins early and colours beautifully. Late afternoons, watch for storm anvils building to the north-west. Christmas beetles cluster at night around any outdoor light near eucalypts.",
    observables: [
      'Step outside at 5:45am and watch the sky pale to pink from the south-east — earliest dawn of the year. The sky lightens fast; within twenty minutes of first colour the full dawn has broken. Bellbirds and kookaburras are already calling in the first grey light.',
      "Late afternoon, watch for storm anvils building to the north-west — summer's daily architecture. The anvil clouds build through the afternoon, tall and flat-topped, backlit from behind by the low sun. A cool gusty wind from the south often precedes the storm front by an hour.",
      'At night, watch for Christmas beetles clustered around outdoor lights near eucalypts. They fly erratically, hitting surfaces and falling before flying again. The iridescent green and copper shells catch the light — each one has spent over a year underground.',
      "At noon, notice the shadow you cast — it's the shortest it will be all year. Stand with your feet together and look down. At midday at the solstice your shadow points almost directly north and barely reaches your feet.",
      'Listen for the cicada chorus rising in the hottest part of the afternoon. The sound builds from one or two to a full wall of noise as temperatures pass 30°. Different species have different pitches — the greengrocer cicada is the dominant voice in Melbourne suburbs.',
      'In the evening, look for flying foxes streaming overhead toward fruiting trees. Grey-headed flying foxes roost in large colonies by day; at dusk they stream out in long flowing ribbons. The sound of thousands of wings overhead is unmistakable.',
      'At the solstice, 5:46am is the earliest sunrise — stand outside and mark it. The sky is already pale well before then, and kookaburras may be calling. After today, mornings begin to dim — though days remain long into January.',
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
