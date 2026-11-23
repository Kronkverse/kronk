import { defineMessages } from 'react-intl';

import type {
  KollectionCategory,
  KollectionPlatform,
} from 'mastodon/api/kollection';

// The words for an app's details (docs/spaces/kollection.md, An app's
// page): its category and the platforms it runs on, from the small fixed
// sets in KollectionApp::CATEGORIES and PLATFORMS.

export const categoryMessages = defineMessages<KollectionCategory>({
  wellbeing: {
    id: 'kollection.category.wellbeing',
    defaultMessage: 'Wellbeing',
  },
  social: { id: 'kollection.category.social', defaultMessage: 'Social' },
  creative: { id: 'kollection.category.creative', defaultMessage: 'Creative' },
  learning: { id: 'kollection.category.learning', defaultMessage: 'Learning' },
  tools: { id: 'kollection.category.tools', defaultMessage: 'Tools' },
  games: { id: 'kollection.category.games', defaultMessage: 'Games' },
  other: { id: 'kollection.category.other', defaultMessage: 'Other' },
});

export const platformMessages = defineMessages<KollectionPlatform>({
  web: { id: 'kollection.platform.web', defaultMessage: 'Web' },
  android: { id: 'kollection.platform.android', defaultMessage: 'Android' },
  ios: { id: 'kollection.platform.ios', defaultMessage: 'iOS' },
});
