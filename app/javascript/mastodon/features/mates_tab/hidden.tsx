// What `/@:acct/mates` shows someone who may not see the list: not a
// Mate, signed out, or a Mate of someone who hides their connections
// (Tal, 2026-10-26: "mates list visible to their mates only").

import { defineMessages, useIntl } from 'react-intl';

import { BackToKorner } from 'mastodon/components/back_to_korner';
import { EmptyState } from 'mastodon/components/empty_state';

const messages = defineMessages({
  hidden: {
    id: 'mates_tab.hidden',
    defaultMessage: 'Only their Mates can see who their Mates are.',
  },
});

export const MatesHidden: React.FC<{ acct: string; backLabel: string }> = ({
  acct,
  backLabel,
}) => {
  const intl = useIntl();

  return (
    <div className='stage-column'>
      <div className='stage-column__inner mates-tab'>
        <BackToKorner href={`/@${acct}`} label={backLabel} />
        <EmptyState title={intl.formatMessage(messages.hidden)} />
      </div>
    </div>
  );
};
