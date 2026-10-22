import { defineMessages } from 'react-intl';
import type { IntlShape, MessageDescriptor } from 'react-intl';

import type { ArtKind } from 'mastodon/api_types/art';

// What kind of work a piece is, named once for every place that shows it:
// the composer's picker, the piece page, the grid and the feed card. The
// keys match ArtPiece#kind in app/models/art_piece.rb; a new kind goes in
// both.
export const ART_KIND_MESSAGES: Record<ArtKind, MessageDescriptor> =
  defineMessages({
    painting: { id: 'art.kind.painting', defaultMessage: 'Painting' },
    drawing: { id: 'art.kind.drawing', defaultMessage: 'Drawing' },
    illustration: {
      id: 'art.kind.illustration',
      defaultMessage: 'Illustration',
    },
    print: { id: 'art.kind.print', defaultMessage: 'Print' },
    photograph: { id: 'art.kind.photograph', defaultMessage: 'Photograph' },
    collage: { id: 'art.kind.collage', defaultMessage: 'Collage' },
    mixed_media: { id: 'art.kind.mixed_media', defaultMessage: 'Mixed media' },
    sculpture: { id: 'art.kind.sculpture', defaultMessage: 'Sculpture' },
    installation: {
      id: 'art.kind.installation',
      defaultMessage: 'Installation',
    },
    ceramic: { id: 'art.kind.ceramic', defaultMessage: 'Ceramic' },
    glass: { id: 'art.kind.glass', defaultMessage: 'Glass' },
    textile: { id: 'art.kind.textile', defaultMessage: 'Textile' },
    jewellery: { id: 'art.kind.jewellery', defaultMessage: 'Jewellery' },
    woodwork: { id: 'art.kind.woodwork', defaultMessage: 'Woodwork' },
    metalwork: { id: 'art.kind.metalwork', defaultMessage: 'Metalwork' },
    papercraft: { id: 'art.kind.papercraft', defaultMessage: 'Papercraft' },
    calligraphy: { id: 'art.kind.calligraphy', defaultMessage: 'Calligraphy' },
    mural: { id: 'art.kind.mural', defaultMessage: 'Mural or street art' },
    other: { id: 'art.kind.other', defaultMessage: 'Other' },
  });

export const ART_KINDS = Object.keys(ART_KIND_MESSAGES) as ArtKind[];

export const artKindLabel = (intl: IntlShape, kind: ArtKind): string =>
  intl.formatMessage(ART_KIND_MESSAGES[kind]);

// The picker's order: by name in the reader's language, Other last.
export const sortedArtKinds = (intl: IntlShape): ArtKind[] => {
  const named = ART_KINDS.filter((k) => k !== 'other').sort((a, b) =>
    artKindLabel(intl, a).localeCompare(artKindLabel(intl, b), intl.locale),
  );
  return [...named, 'other'];
};
