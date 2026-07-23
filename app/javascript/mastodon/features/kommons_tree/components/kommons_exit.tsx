import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

// A clearly-labeled exit from Kommons back to the Hub. Pinned and visually
// distinct from the in-Directory breadcrumb, so "leave Kommons" never reads the
// same as "move within the Directory" (per the Kommons UI proposal on
// kommons.index).
export const KommonsExit: React.FC = () => (
  <Link to='/hub' className='kommons-exit'>
    <span aria-hidden='true'>⟵</span>{' '}
    <FormattedMessage id='kommons.exit_hub' defaultMessage='Hub' />
  </Link>
);
