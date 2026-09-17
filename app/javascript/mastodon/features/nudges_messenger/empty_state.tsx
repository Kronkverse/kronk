import { FormattedMessage } from 'react-intl';

// Right-pane placeholder when no conversation is selected. Kept
// deliberately quiet — chrome recedes when there is no content.
export const EmptyState: React.FC = () => (
  <div className='nudges-empty'>
    <FormattedMessage
      id='nudges.empty_pane'
      defaultMessage='Select a conversation to start reading.'
    />
  </div>
);
