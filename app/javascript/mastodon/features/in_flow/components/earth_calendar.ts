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
      'Step outside before 8am — listen for the black cricket chorus in garden beds, loudest in the heat of the soil.',
      'Watch for sulphur-crested cockatoos stripping bark from large eucalypts, hunting insects beneath.',
      'Notice the smell of warm dry grass. That is the scent of high summer in this basin.',
      'Look for cicada shells clinging to tree bark at eye height — the empty cases of last season.',
      'At dusk, watch for flying foxes streaming overhead toward fruiting trees in the canopy.',
      'Check flowering native plants for native bees — small, fast, working in the full heat.',
      'Notice the heat shimmer above roads and rooftops in the mid-afternoon. The air is alive.',
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
      'At dusk, watch for swifts gathering — circling higher and higher before their long journey north.',
      'Near water, listen at dusk for the double thud of the tawny frogmouth starting its late-summer call.',
      'Look for late-ripening figs on street trees — the birds will find them before you do.',
      'Notice which way the wind is coming from: northerlies bring heat, southerlies the first relief.',
      'Check garden beds for soil cracking in the dry — a map of the summer underground.',
      'On still evenings, watch for Christmas beetles clustering around outdoor lights near eucalypts.',
      'Look along creek lines for herons standing absolutely still in the shallows, waiting.',
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
      'Walk through a park with deciduous trees — watch for the first leaves turning at the tips, yellowing.',
      'After 5pm, notice how building shadows have stretched since January. The sun is withdrawing.',
      'On a cool morning, feel how the air has changed — sharper, less humid than a month ago.',
      'Look for the first autumn fungi appearing in leaf litter and mulched garden beds after rain.',
      'Watch for eastern rosellas feeding loudly on fallen fruit in suburban gardens.',
      'Notice the spider webs in the morning light — orb weavers are at their largest now.',
      "In remnant bush, listen for the whipbird's sharp crack-and-whip call in the understory.",
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
      'Look down as well as up — autumn fungi are appearing in leaf litter and mulch after rain.',
      'Listen for eastern rosellas, loud and visible as they feed on fallen fruit in gardens.',
      'Notice the smell of leaf litter warming after a cool morning — the scent of transition.',
      "Watch for the last swifts of the season. They won't return until August.",
      "In the late afternoon, follow a long shadow — yours or a building's — as it moves across the ground.",
      "Listen for the whipbird's sharp call in remnant bush. Its territory is loudest now.",
      'Check street trees for seed pods and nuts beginning to fall. Count what you find.',
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
      'At noon, notice how low the sun sits — shadows fall long even at midday now.',
      'On a still morning, look for spider webs between fence posts, silk lit by the low-angle light.',
      'In the Dandenongs or outer suburbs, watch for the first frosts whitening lawns at dawn.',
      'Listen in the evening for the first boobook owls calling, claiming their winter territory.',
      'Step outside and smell the air — mornings carry cold damp soil and distant wood smoke.',
      'Notice how quickly light fades after 5pm. Count the minutes since last week.',
      'Look for the last deciduous leaves clinging to branches before the wind takes them.',
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
      'Find a wattle in flower along a bike path or park edge — its yellow is the first colour of the year.',
      "In the evening, listen for the piping call of a boobook owl. They're marking territory now.",
      "Notice the smell of cold damp soil and wood smoke on still mornings — this is winter's signature.",
      'Before 7am near wattles, listen for honeyeaters fighting over blooms in the cold.',
      'Watch the angle of the sun through a south-facing window — it barely clears the roofline.',
      "Listen at night near parks for a barking owl's double bark — like a distant dog.",
      'After sunset, notice how the western sky holds colour over the rooftops for a long time.',
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
      'On a clear morning, watch frost crystals on grass blades evaporate as the sun touches them.',
      'In wattle-rich areas, hear honeyeaters fighting noisily over blooms before 7am.',
      'The solstice is past — days are slowly lengthening. Notice: is this evening a minute lighter than last week?',
      'Look for magnolia flowers opening on bare branches before any leaves emerge.',
      "At dusk, listen for the powerful owl's deep double hoot in treed suburban streets.",
      "Watch the moon's arc tonight — winter moons ride high, nearly overhead.",
      'Face the weak winter sun directly for a moment. Even at low angle, the warmth is real.',
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
      'Stand near a flowering acacia on a still morning and breathe in — dusty, sweet, unmistakable.',
      'In the Dandenong Ranges, listen for lyrebird mimicry: it may sound like a kookaburra, then a car alarm.',
      'Watch for the first swallows returning — low and fast over water on warm afternoons.',
      'Look for native orchids appearing in dry grassy woodland after winter rain.',
      'Notice spring bulbs pushing through the soil around old garden beds.',
      'Listen for magpies beginning their spring warbling in the early mornings.',
      'In parks with old gums, look up for yellow-tailed black cockatoos chewing seed cones.',
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
      'Step outside early and count how many bird species you can hear before 8am. It grows each week.',
      'Look for wisteria draped over fences and walls, heavy with purple racemes just opening.',
      'Notice how territorial honeyeaters have become — chasing each other through gardens at speed.',
      'Watch for new leaves on deciduous trees: translucent and vivid green, backlit by morning sun.',
      'In native gardens, follow a New Holland honeyeater through the grevilleas.',
      'At the equinox: today light and dark are equal. Tomorrow, light takes over.',
      'Look for banksias covered in small birds working the flower spikes in the morning sun.',
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
      'After dark, watch for swifts hunting insects high up — their silhouette is long and scimitar-shaped.',
      'At dusk, check fences and shrubs for orb weaver webs — the spiders are large and backlit now.',
      'In a native garden, count how many species visit a grevillea in ten minutes.',
      'Notice the warmth building in north-facing brick walls after 3pm.',
      'Look for caterpillars on young leaves — small wrens and thornbills are hunting them.',
      'At dawn, count the bird species you hear in five minutes. Peak season.',
      'Watch for the first Christmas beetles emerging on warm evenings near eucalypts.',
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
      'Look for jacaranda petals carpeting the pavement beneath the trees in blue-purple drifts.',
      'Listen for rainbow lorikeets rattling through flowering street trees — the loudest birds of spring.',
      'At night, watch for small brown moths around street lights: the soil is warm and they are rising.',
      'Notice the heat now in north-facing walls after 3pm. Summer is arriving through the brick.',
      'Look for dragonflies over water — warm creeks are producing them now.',
      'At dusk, listen for the cricket chorus building in long grass near parks.',
      'Check native plants for native bee activity — small, fast, working every open flower.',
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
      'Step outside at 5:45am and watch the sky pale to pink from the south-east. Earliest dawn of the year.',
      "Late afternoon, watch for storm anvils building to the north-west — summer's daily architecture.",
      'At night, watch for Christmas beetles clustered around outdoor lights near eucalypts.',
      "At noon, notice the shadow you cast — it's the shortest it will be all year.",
      'Listen for the cicada chorus rising in the hottest part of the afternoon.',
      'In the evening, look for flying foxes streaming overhead toward fruiting trees.',
      'At the solstice: 5:46am is the earliest sunrise. Stand outside and mark it.',
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
