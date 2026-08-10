import { defineMessages, useIntl } from 'react-intl';

import type { Wallet } from './koin_wallet';

// A tiny, glance-only Koin readout — the compact alternative to
// `KoinWallet`. `KoinWallet` still ships (Kommons settings renders it
// as a proper wallet section where the fuller presentation is
// appropriate); `KoinGlance` is what the board list uses so the ₭
// balance stays legible without dominating the surface. Same data,
// one row:
//
//   ₭ 19 / 20 · 1 backed
//
// The "Backed" toggle that used to lens the list here retired
// 2026-08-10 when the Kommons view rotator gained an "Involved"
// face (any proposal you've voted / backed / commented on) —
// subsumes what the toggle did and lives in the standardised title
// slot instead of on this chip.

export type { Wallet } from './koin_wallet';

const messages = defineMessages({
  aria: {
    id: 'governance.glance.aria',
    defaultMessage:
      '{available} of {total} Koin available, {staked} backing {staked, plural, one {# proposal} other {# proposals}}',
  },
});

interface Props {
  wallet: Wallet;
}

export const KoinGlance: React.FC<Props> = ({ wallet }) => {
  const intl = useIntl();
  const { available, total, staked_seeds } = wallet;

  return (
    <div
      className='kommons-glance'
      aria-label={intl.formatMessage(messages.aria, {
        available,
        total,
        staked: staked_seeds,
      })}
    >
      <span className='kommons-glance__balance'>
        <span className='kommons-glance__kip' aria-hidden='true'>
          ₭
        </span>
        <span className='kommons-glance__num'>{available}</span>
        <span className='kommons-glance__of'>/ {total}</span>
      </span>
      <span className='kommons-glance__staked'>
        <span className='kommons-glance__staked-num'>{staked_seeds}</span>
        <span className='kommons-glance__staked-label'>backed</span>
      </span>
    </div>
  );
};
