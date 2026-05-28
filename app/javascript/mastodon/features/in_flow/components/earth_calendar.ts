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
  },
  {
    month: 1, // February
    season: 'Late summer',
    sow: ['Basil', 'Beans', 'Silver beet'],
    harvest: ['Fig', 'Tomato', 'Beans', 'Capsicum'],
    bloom: ['Waterlily', 'Agapanthus', 'Crepe myrtle'],
    observable:
      'At dusk, watch the sky for the first swifts and swallows of the season completing their gathering before the long journey north. If you have a creek or park nearby, listen for the thudding call of the tawny frogmouth beginning its late-summer calls.',
  },
  {
    month: 2, // March
    season: 'Early autumn',
    sow: ['Broccoli', 'Kale', 'Lettuce', 'Peas', 'Silverbeet'],
    harvest: ['Capsicum', 'Tomato', 'Passionfruit', 'Apple'],
    bloom: ['Autumn crocus', 'Salvia', 'Cyclamen'],
    observable:
      'Walk through any park with deciduous trees and watch the first leaves turning — yellows and oranges beginning at the tips. Mornings are noticeably sharper now. On clear days after 5pm, notice the shadow of buildings stretching longer than they did a month ago.',
  },
  {
    month: 3, // April
    season: 'Autumn',
    sow: ['Broad beans', 'Carrot', 'Onion', 'Parsley', 'Spinach'],
    harvest: ['Citrus', 'Broccoli', 'Silverbeet'],
    bloom: ['Camellia', 'Clivia', 'Banksia'],
    observable:
      "Look down as well as up — autumn fungi begin appearing in leaf litter and mulch after the first rains. Eastern rosellas are loud and visible now, feeding on fallen fruit in gardens. In remnant bush, listen for the whipbird's sharp crack-and-whip call in the understory.",
  },
  {
    month: 4, // May
    season: 'Late autumn',
    sow: ['Broad beans', 'Garlic', 'Onion', 'Peas', 'Lettuce'],
    harvest: ['Kale', 'Silverbeet', 'Citrus', 'Carrot'],
    bloom: ['Camellia', 'Grevillea', 'Protea'],
    observable:
      'Notice how low the midday sun has become — its angle is now low enough to project long shadows even at noon. On still mornings, watch for spider webs strung between fence posts and shrubs, their silk made visible by the low-angle light. First frosts may appear inland in the Dandenongs.',
  },
  {
    month: 5, // June
    season: 'Winter',
    sow: ['Garlic', 'Onion', 'Peas', 'Broad beans'],
    harvest: ['Orange', 'Lemon', 'Mandarin', 'Kale', 'Silverbeet'],
    bloom: ['Wattle (Acacia)', 'Camellia', 'Jonquil'],
    observable:
      'The first wattles are in flower — find them along bike paths and in parks. Their yellow is the earliest colour of the year. In the evenings, listen for the piping calls of boobooks beginning their winter territories. The air smells of cold, damp soil and distant wood smoke.',
  },
  {
    month: 6, // July
    season: 'Winter',
    sow: ['Onion', 'Peas', 'Broad beans', 'Garlic'],
    harvest: ['Orange', 'Grapefruit', 'Kale', 'Spinach', 'Carrot'],
    bloom: ['Wattle', 'Magnolia', 'Daphne'],
    observable:
      'The winter solstice is past — days are now very slowly lengthening. Early morning on a clear day, watch for frost crystals on car roofs and grass blades evaporating as the sun touches them. In wattle-rich areas, you may hear honeyeaters fighting over the blooms before 7am.',
  },
  {
    month: 7, // August
    season: 'Late winter',
    sow: ['Beetroot', 'Carrot', 'Lettuce', 'Peas', 'Tomato (indoors)'],
    harvest: ['Citrus', 'Kale', 'Broad beans', 'Spinach'],
    bloom: ['Wattle', 'Grevillea', 'Native orchid', 'Jonquil'],
    observable:
      'Wattle is at peak bloom — stand near a flowering acacia on a still morning and you will smell its dusty-sweet scent. In the Dandenong Ranges and outer bush, lyrebirds are mid-display season: listen for extraordinary mimicry cascades. Watch for the first swallows returning low over water on warm afternoons.',
  },
  {
    month: 8, // September
    season: 'Early spring',
    sow: ['Tomato', 'Capsicum', 'Basil', 'Beans', 'Cucumber'],
    harvest: ['Peas', 'Broad beans', 'Silverbeet'],
    bloom: ['Jasmine', 'Wisteria', 'Boronia', 'Cherry blossom'],
    observable:
      'The equinox passes — days are now longer than nights. Go outside in the early morning and listen: the dawn chorus is building, new voices arriving each week as resident birds begin nesting. Look for wisteria draping over fences and walls, heavy with purple racemes. Honeyeaters are territorial and loud.',
  },
  {
    month: 9, // October
    season: 'Spring',
    sow: ['Tomato', 'Pumpkin', 'Zucchini', 'Corn', 'Capsicum'],
    harvest: ['Asparagus', 'Broad beans', 'Lettuce'],
    bloom: ['Boronia', 'Flannel flower', 'Grevillea', 'Hardenbergia'],
    observable:
      'Watch for swifts back in the sky after dark, catching insects high up. Garden spiders are building large orb webs by mid-month — check fences and shrubs at dusk when webs are backlit. In native gardens, New Holland honeyeaters and spinebills are working the grevilleas hard.',
  },
  {
    month: 10, // November
    season: 'Late spring',
    sow: ['Basil', 'Beans', 'Pumpkin', 'Sweet corn', 'Eggplant'],
    harvest: ['Strawberry', 'Lettuce', 'Beetroot', 'Peas'],
    bloom: ['Jacaranda', 'Frangipani', 'Agapanthus beginning'],
    observable:
      'Jacaranda petals carpet pavements and footpaths — look for carpets of purple-blue beneath the trees. Listen for the loud rattling calls of rainbow lorikeets in flowering street trees. Watch for small brown moths around street lights at night: their flights mark the accelerating warmth of the soil.',
  },
  {
    month: 11, // December
    season: 'Early summer',
    sow: ['Basil', 'Beans', 'Cucumber', 'Zucchini'],
    harvest: ['Stone fruit', 'Tomato', 'Capsicum', 'Strawberry'],
    bloom: ['Agapanthus', 'Bougainvillea', 'Frangipani', 'Waterlily'],
    observable:
      "The longest day: step outside around 5:45am and watch the sky pale to pink from the south-east — Melbourne's summer solstice dawn begins early and colours beautifully. Late afternoons, watch for storm anvils building to the north-west. Christmas beetles cluster at night around any outdoor light near eucalypts.",
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
    }
  );
}
