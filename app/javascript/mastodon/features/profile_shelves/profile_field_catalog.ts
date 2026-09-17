// The structured-field catalog — the ~30 predefined profile fields the
// creator offers in its pop-up grid (docs/spaces/profile.md, "profile
// creator"). Fields replace the old freeform told cards.
//
// Each entry's `key` is a `ProfileCard#card_type` (kept in sync with the
// backend CARD_TYPES enum in app/models/profile_card.rb) — a picked field is
// stored as a card of that type, its answer in the card `body`. `answerType`
// tells the pop-up + the profile render how to input / show the answer:
//
//   text     — single line              (Location: Sydney)
//   pair     — two slots joined by " / " (Pronouns: she / her)
//   chips     — comma/newline tag list   (Interests: cars, welding)
//   longtext — a short paragraph         (About me: …)
//   link     — a URL                     (Website: talitamoss.info)
//
// Custom user fields (the grid's trailing "+") are NOT in this catalog —
// they carry their own label + answer type and land in a follow-up.

export type FieldAnswerType =
  | 'text'
  | 'pair'
  | 'chips'
  | 'longtext'
  | 'link'
  | 'date';

export interface ProfileFieldDef {
  key: string;
  label: string;
  answerType: FieldAnswerType;
  group: string;
}

// Display order of the groups in the pop-up grid.
export const PROFILE_FIELD_GROUPS = [
  'Basics',
  'Character',
  'Tastes',
  'Doing',
  'Links',
  'Place',
] as const;

export const PROFILE_FIELD_CATALOG: ProfileFieldDef[] = [
  // Basics
  { key: 'pronouns', label: 'Pronouns', answerType: 'pair', group: 'Basics' },
  { key: 'location', label: 'Location', answerType: 'text', group: 'Basics' },
  {
    key: 'languages',
    label: 'Languages',
    answerType: 'chips',
    group: 'Basics',
  },
  {
    key: 'birthday',
    label: 'Birthday',
    answerType: 'date',
    group: 'Basics',
  },
  { key: 'star_sign', label: 'Star sign', answerType: 'text', group: 'Basics' },
  { key: 'height', label: 'Height', answerType: 'text', group: 'Basics' },

  // Character
  {
    key: 'about',
    label: 'About me',
    answerType: 'longtext',
    group: 'Character',
  },
  { key: 'values', label: 'Values', answerType: 'chips', group: 'Character' },
  {
    key: 'personality',
    label: 'Personality',
    answerType: 'text',
    group: 'Character',
  },
  {
    key: 'drive',
    label: 'What drives me',
    answerType: 'longtext',
    group: 'Character',
  },
  {
    key: 'fun_fact',
    label: 'Fun fact',
    answerType: 'text',
    group: 'Character',
  },
  {
    key: 'exploring',
    label: 'Currently exploring',
    answerType: 'longtext',
    group: 'Character',
  },

  // Tastes
  {
    key: 'interests',
    label: 'Interests',
    answerType: 'chips',
    group: 'Tastes',
  },
  {
    key: 'rotation',
    label: 'In rotation',
    answerType: 'chips',
    group: 'Tastes',
  },
  {
    key: 'favourite',
    label: 'Favourite…',
    answerType: 'text',
    group: 'Tastes',
  },
  {
    key: 'highlights',
    label: 'Recent highlights',
    answerType: 'longtext',
    group: 'Tastes',
  },

  // Doing
  {
    key: 'work_role',
    label: 'Work / role',
    answerType: 'text',
    group: 'Doing',
  },
  { key: 'skills', label: 'Skills', answerType: 'chips', group: 'Doing' },
  { key: 'status', label: 'Status', answerType: 'text', group: 'Doing' },
  { key: 'open_to', label: 'Open to', answerType: 'chips', group: 'Doing' },
  {
    key: 'availability',
    label: 'Availability',
    answerType: 'text',
    group: 'Doing',
  },

  // Links
  { key: 'website', label: 'Website', answerType: 'link', group: 'Links' },
  {
    key: 'collected_work',
    label: 'Collected work',
    answerType: 'link',
    group: 'Links',
  },
  {
    key: 'other_profile',
    label: 'Other profile',
    answerType: 'link',
    group: 'Links',
  },
  {
    key: 'pod_credentials',
    label: 'Pod credentials',
    answerType: 'link',
    group: 'Links',
  },

  // Place
  { key: 'timezone', label: 'Timezone', answerType: 'text', group: 'Place' },
  {
    key: 'where_been',
    label: "Where I've been",
    answerType: 'chips',
    group: 'Place',
  },
  { key: 'home_base', label: 'Home base', answerType: 'text', group: 'Place' },
];

// Lookup by card_type key.
export const PROFILE_FIELD_BY_KEY: Record<string, ProfileFieldDef> =
  Object.fromEntries(PROFILE_FIELD_CATALOG.map((f) => [f.key, f]));
