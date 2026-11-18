import { useIntl } from 'react-intl';

import { SpaceCard } from 'mastodon/components/space_grid';

import {
  makerName,
  SAMPLE_ICONS,
  sampleFacts,
  sampleTermsName,
} from '../samples';
import type { BoothSample, BoothSamplePack } from '../types';

// A sample as a tile (docs/spaces/booth.md, Samples): its type's glyph, its
// title, who made it and its facts, and its terms as the chip.
export const SampleCard: React.FC<{
  sample: BoothSample;
  showMaker?: boolean;
}> = ({ sample, showMaker = true }) => {
  const intl = useIntl();
  const Glyph = SAMPLE_ICONS[sample.sample_type];
  const facts = sampleFacts(sample, intl);

  return (
    <SpaceCard
      to={`/hub/booth/samples/${sample.id}`}
      placeholder={<Glyph />}
      title={sample.title}
      meta={(showMaker ? [makerName(sample.account), ...facts] : facts).join(
        ' · ',
      )}
      tag={intl.formatMessage(sampleTermsName(sample.terms))}
      tagKind={`sample-${sample.terms}`}
    />
  );
};

// A pack as a wide tile: its cover, title and maker, and what's in it.
export const SamplePackCard: React.FC<{
  pack: BoothSamplePack;
  countLabel: string;
  tag: string;
}> = ({ pack, countLabel, tag }) => {
  const Glyph = SAMPLE_ICONS[pack.sample_types[0] ?? 'loop'];

  return (
    <SpaceCard
      to={`/hub/booth/packs/${pack.id}`}
      image={pack.cover_url}
      avatar={pack.cover_url ? pack.account.avatar : null}
      placeholder={<Glyph />}
      title={pack.title}
      meta={`${makerName(pack.account)} · ${countLabel}`}
      tag={tag}
      tagKind='pack'
    />
  );
};
