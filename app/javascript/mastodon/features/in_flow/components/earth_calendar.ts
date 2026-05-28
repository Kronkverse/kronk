// Earth calendar — Sydney basin phenology, month by month (0-indexed)
// Sources: Australian National Botanic Gardens seasonal guides,
// NSW Office of Environment and Heritage phenology records,
// CSIRO seasonal observations for the Sydney basin.

export interface EarthMonth {
  month: number;
  season: string;
  sow: string[];
  harvest: string[];
  bloom: string[];
  naturalist: string;
}

export const EARTH_CALENDAR: EarthMonth[] = [
  {
    month: 0, // January
    season: 'Late summer',
    sow: ['Basil', 'Cucumber', 'Pumpkin', 'Sweet corn'],
    harvest: ['Tomato', 'Zucchini', 'Eggplant', 'Capsicum', 'Stone fruit'],
    bloom: ['Agapanthus', 'Sunflower', 'Bougainvillea', 'Frangipanis'],
    naturalist:
      'Sea breezes build through the afternoon heat. Cicadas reach their peak — the loudest weeks of the year in the bush.',
  },
  {
    month: 1, // February
    season: 'Late summer',
    sow: ['Basil', 'Beans', 'Silver beet'],
    harvest: ['Fig', 'Mango', 'Passionfruit', 'Tomato', 'Beans'],
    bloom: ['Waterlily', 'Agapanthus', 'Crepe myrtle'],
    naturalist:
      'The first cicadas begin to quiet. Soil holds its warmth from weeks of sun; night temperatures barely drop.',
  },
  {
    month: 2, // March
    season: 'Early autumn',
    sow: ['Broccoli', 'Kale', 'Lettuce', 'Peas', 'Silverbeet'],
    harvest: ['Capsicum', 'Tomato', 'Passionfruit', 'Apple'],
    bloom: ['Easter daisy', 'Autumn crocus', 'Salvia'],
    naturalist:
      'Days shorten noticeably after the equinox. Mornings sharpen. The first rains of autumn begin to break the dry.',
  },
  {
    month: 3, // April
    season: 'Autumn',
    sow: ['Broad beans', 'Carrot', 'Onion', 'Parsley', 'Spinach'],
    harvest: ['Citrus', 'Avocado', 'Broccoli', 'Silverbeet'],
    bloom: ['Camellia', 'Clivia', 'Banksia'],
    naturalist:
      'Deciduous trees colour and drop. Eastern rosellas flock to ripening fruit. The bush quiets as summer insects retreat.',
  },
  {
    month: 4, // May
    season: 'Late autumn',
    sow: ['Broad beans', 'Garlic', 'Onion', 'Peas', 'Lettuce'],
    harvest: ['Kale', 'Silverbeet', 'Citrus', 'Carrot'],
    bloom: ['Camellia', 'Grevillea', 'Protea'],
    naturalist:
      'The sun is low enough that shadows stretch long at midday. White-throated treecreepers call through cooler mornings.',
  },
  {
    month: 5, // June
    season: 'Winter',
    sow: ['Garlic', 'Onion', 'Peas', 'Broad beans'],
    harvest: ['Orange', 'Lemon', 'Mandarin', 'Kale', 'Silverbeet'],
    bloom: ['Wattle (Acacia)', 'Camellia', 'Jonquil'],
    naturalist:
      'Wattles begin to flower — the first yellows of the year. Frosts fall in the basins to the west; coastal Sydney stays mild.',
  },
  {
    month: 6, // July
    season: 'Winter',
    sow: ['Onion', 'Peas', 'Broad beans', 'Garlic'],
    harvest: ['Orange', 'Grapefruit', 'Kale', 'Spinach', 'Carrot'],
    bloom: ['Wattle', 'Magnolia', 'Daphne'],
    naturalist:
      "The solstice has passed — days begin to lengthen from their shortest. The bush is at its quietest but wattle's yellow insists on return.",
  },
  {
    month: 7, // August
    season: 'Late winter',
    sow: ['Beetroot', 'Carrot', 'Lettuce', 'Peas', 'Tomato (indoors)'],
    harvest: ['Citrus', 'Kale', 'Broad beans', 'Spinach'],
    bloom: ['Wattle', 'Grevillea', 'Native orchid', 'Cherry blossom'],
    naturalist:
      'Lyrebirds display in the Dandenong Ranges and Blue Mountains. Wattle is at its peak — the air carries its dusty sweetness.',
  },
  {
    month: 8, // September
    season: 'Early spring',
    sow: ['Tomato', 'Capsicum', 'Basil', 'Beans', 'Cucumber'],
    harvest: ['Peas', 'Broad beans', 'Silverbeet'],
    bloom: ['Jasmine', 'Flannel flower', 'Boronia', 'Wisteria'],
    naturalist:
      'The spring equinox passes. Honeyeaters return to flowering banksias and grevilleas. The bush exhales.',
  },
  {
    month: 9, // October
    season: 'Spring',
    sow: ['Tomato', 'Pumpkin', 'Zucchini', 'Corn', 'Capsicum'],
    harvest: ['Asparagus', 'Broad beans', 'Lettuce'],
    bloom: ['Boronia', 'Flannel flower', 'Banksia spinulosa', 'Waratah'],
    naturalist:
      'The waratah is in full flower — the most iconic bloom of the Sydney sandstone. Currawongs nest in tall eucalypts; their calls fill the morning.',
  },
  {
    month: 10, // November
    season: 'Late spring',
    sow: ['Basil', 'Beans', 'Pumpkin', 'Sweet corn', 'Eggplant'],
    harvest: ['Strawberry', 'Lettuce', 'Beetroot', 'Peas'],
    bloom: ['Jacaranda', 'Frangipanis', 'Agapanthus beginning'],
    naturalist:
      'Jacarandas carpet streets in purple-blue. Soil warms rapidly. The bush fills with the calls of newly fledged birds from spring nests.',
  },
  {
    month: 11, // December
    season: 'Early summer',
    sow: ['Basil', 'Beans', 'Cucumber', 'Zucchini'],
    harvest: ['Mango', 'Stone fruit', 'Tomato', 'Capsicum', 'Strawberry'],
    bloom: ['Agapanthus', 'Bougainvillea', 'Frangipanis', 'Waterlily'],
    naturalist:
      'The summer solstice marks the longest day. Christmas beetles cluster around street lights. Storms build from the west in the late afternoon.',
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
      naturalist: '',
    }
  );
}
