import { FormattedMessage } from 'react-intl';

import { NavLink } from 'react-router-dom';

// One map, two modes. The Skeleton and the Lattice are two views of the same
// tree, node ids and proposal store; this switch lets a user flip between them
// mid-task and land on the same place. Shared by both views so it reads as one
// surface with a preference, not two hidden URLs.
export const ViewToggle: React.FC = () => (
  <nav className='kommons-view-toggle' aria-label='Map view'>
    <NavLink
      to='/hub/kommons/skeleton'
      className='kommons-view-toggle__opt'
      activeClassName='is-active'
    >
      <FormattedMessage id='kommons.view.skeleton' defaultMessage='Skeleton' />
    </NavLink>
    <NavLink
      to='/hub/kommons/lattice'
      className='kommons-view-toggle__opt'
      activeClassName='is-active'
    >
      <FormattedMessage id='kommons.view.lattice' defaultMessage='Lattice' />
    </NavLink>
  </nav>
);
