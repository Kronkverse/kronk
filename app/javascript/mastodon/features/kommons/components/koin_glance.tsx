import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

// A tiny, glance-only Koin readout — replaces the old card-sized
// `KoinWallet` + `.kommons-backed` pair that dominated the top of the
// Kommons page (see the 2026-08-06 screenshot). Same data, one row:
//
//   ₭ 19 available  ·  1 backed
//
// The "N backed" segment is a toggle — active state means the list is
// lensed to just the proposals the viewer is backing. Reads as one
// line in the head strip; never the visual anchor of the page.

export interface Wallet {
  available: number;
  staked: number;
  staked_seeds: number;
  total: number;
}

const messages = defineMessages({
  aria: {
    id: 'governance.glance.aria',
    defaultMessage:
      '{available} of {total} Koin available, {staked} backing {staked, plural, one {# proposal} other {# proposals}}',
  },
  toggleAria: {
    id: 'governance.glance.toggle_aria',
    defaultMessage: 'Show only proposals I back',
  },
});

interface Props {
  wallet: Wallet;
  backedActive: boolean;
  onToggleBacked: () => void;
}

export const KoinGlance: React.FC<Props> = ({
  wallet,
  backedActive,
  onToggleBacked,
}) => {
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
      <button
        type='button'
        className={`kommons-glance__backed${backedActive ? ' active' : ''}`}
        onClick={onToggleBacked}
        aria-pressed={backedActive}
        aria-label={intl.formatMessage(messages.toggleAria)}
      >
        <span className='kommons-glance__backed-num'>{staked_seeds}</span>
        <span className='kommons-glance__backed-label'>
          <FormattedMessage id='governance.backed' defaultMessage='Backed' />
        </span>
      </button>
    </div>
  );
};
