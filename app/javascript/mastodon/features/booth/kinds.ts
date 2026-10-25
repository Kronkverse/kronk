import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import type { BoothKind } from './types';

// The kinds of set, in the order the upload form and Musik offer them.

export const KINDS: readonly BoothKind[] = [
  'mix',
  'live_recording',
  'track',
  'podcast',
  'spoken_word',
];

const messages = defineMessages({
  mix: { id: 'booth.kind.mix', defaultMessage: 'Mix' },
  live_recording: {
    id: 'booth.kind.live_recording',
    defaultMessage: 'Live recording',
  },
  track: { id: 'booth.kind.track', defaultMessage: 'Track' },
  podcast: { id: 'booth.kind.podcast', defaultMessage: 'Podcast' },
  spoken_word: { id: 'booth.kind.spoken_word', defaultMessage: 'Spoken word' },
});

export const kindMessage = (kind: BoothKind): MessageDescriptor =>
  messages[kind];
