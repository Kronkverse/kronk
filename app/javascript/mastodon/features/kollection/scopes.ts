import { defineMessages } from 'react-intl';

import type { KollectionScope } from 'mastodon/api/kollection';
import { isKollectionScope } from 'mastodon/api/kollection';

// What each scope lets an app see or do, in plain words
// (docs/spaces/kollection.md). One line per scope Kollection offers
// (KollectionApp::SCOPES).
export const scopeMessages = defineMessages<KollectionScope>({
  openid: {
    id: 'kollection.scope.openid',
    defaultMessage: 'Who you are on Kronk, so it can sign you in',
  },
  profile: {
    id: 'kollection.scope.profile',
    defaultMessage: 'Your name, username and profile picture',
  },
  read: {
    id: 'kollection.scope.read',
    defaultMessage:
      'Everything your account can see: posts, Mates, Nudges and settings',
  },
  write: {
    id: 'kollection.scope.write',
    defaultMessage: 'Post and act on Kronk as you',
  },
});

// The scopes among `scopes` Kollection can name, in its order.
export const knownScopes = (scopes: string[]): KollectionScope[] =>
  scopes.filter(isKollectionScope);
