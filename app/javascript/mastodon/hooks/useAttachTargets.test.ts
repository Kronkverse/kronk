import type { ApiKornerJSON } from 'mastodon/api_types/korners';

import { attachTargetsFor } from './useAttachTargets';

type Korner = Pick<ApiKornerJSON, 'slug' | 'attaches' | 'accepts'>;

const takesLinks: ApiKornerJSON['accepts'] = [{ from: '*', kind: 'link' }];
const linksOut: ApiKornerJSON['attaches'] = [{ to: '*', kind: 'link' }];

const korners: Korner[] = [
  { slug: 'albutts', attaches: linksOut, accepts: takesLinks },
  { slug: 'kommons', attaches: linksOut, accepts: takesLinks },
  {
    slug: 'krew',
    attaches: linksOut,
    accepts: [{ from: 'kalendar', kind: 'link' }],
  },
  { slug: 'moments' },
];

const slugsFor = (slug: string) =>
  attachTargetsFor(
    slug,
    korners.find((k) => k.slug === slug),
    korners,
  ).map((t) => t.slug);

describe('attachTargetsFor', () => {
  it('reaches every other korner that takes a link from it', () => {
    expect(slugsFor('albutts')).toEqual(['kommons']);
  });

  it('honours a korner that takes links only from named korners', () => {
    expect(
      attachTargetsFor('kalendar', { attaches: linksOut }, korners).map(
        (t) => t.slug,
      ),
    ).toEqual(['albutts', 'kommons', 'krew']);
  });

  it('offers nothing for a korner that opts out', () => {
    expect(slugsFor('moments')).toEqual([]);
  });

  it('never offers a spawn', () => {
    expect(
      attachTargetsFor(
        'kalendar',
        { attaches: [{ to: 'albutts', kind: 'spawn' }] },
        korners,
      ),
    ).toEqual([]);
  });
});
