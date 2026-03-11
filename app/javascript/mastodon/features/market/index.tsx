import { useRef, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import BarChartIcon from '@/material-icons/400-24px/bar_chart_4_bars-fill.svg?react';
import { Column } from 'mastodon/components/column';
import type { ColumnRef } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';

const messages = defineMessages({
  heading: { id: 'market.title', defaultMessage: 'Market' },
  comingSoon: { id: 'market.coming_soon', defaultMessage: 'Coming Soon' },
  description: {
    id: 'market.description',
    defaultMessage: 'A marketplace for the Kronk community is on its way. Stay tuned!',
  },
});

const Market: React.FC<{
  multiColumn: boolean;
}> = ({ multiColumn }) => {
  const intl = useIntl();
  const columnRef = useRef<ColumnRef>(null);

  const handleHeaderClick = useCallback(() => {
    columnRef.current?.scrollTop();
  }, []);

  return (
    <Column
      bindToDocument={!multiColumn}
      ref={columnRef}
      label={intl.formatMessage(messages.heading)}
    >
      <ColumnHeader
        icon='bar_chart'
        iconComponent={BarChartIcon}
        title={intl.formatMessage(messages.heading)}
        onClick={handleHeaderClick}
        multiColumn={multiColumn}
      />

      <div
        className='scrollable'
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          gap: '16px',
        }}
      >
        <BarChartIcon
          style={{
            width: '64px',
            height: '64px',
            fill: 'var(--highlight-text-color)',
          }}
        />
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--primary-text-color)',
          }}
        >
          {intl.formatMessage(messages.comingSoon)}
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--secondary-text-color)',
            maxWidth: '400px',
            lineHeight: '1.5',
          }}
        >
          {intl.formatMessage(messages.description)}
        </p>
      </div>

      <Helmet>
        <title>{intl.formatMessage(messages.heading)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Market;
