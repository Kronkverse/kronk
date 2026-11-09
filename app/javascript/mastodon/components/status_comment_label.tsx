import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import CommentIcon from '@/material-icons/400-24px/comment.svg?react';
import { Icon } from 'mastodon/components/icon';

// Above a post in Froths or Bookmarks that stands in for a comment on it: a
// comment never shows as a post of its own, so the list shows its post and
// this says which comment it was, linking to it highlighted on the post's
// page (docs/spaces/feed.md (Comments)).
export const StatusCommentLabel: React.FC<{
  acct: string;
  statusId: string;
  commentId: string;
  list: 'favourites' | 'bookmarks';
}> = ({ acct, statusId, commentId, list }) => (
  <div className='status__prepend'>
    <div className='status__prepend__icon'>
      <Icon id='comment' icon={CommentIcon} />
    </div>
    <Link to={`/@${acct}/${statusId}?comment=${commentId}`}>
      {list === 'favourites' ? (
        <FormattedMessage
          id='status.frothed_comment'
          defaultMessage='You frothed a comment on this'
        />
      ) : (
        <FormattedMessage
          id='status.bookmarked_comment'
          defaultMessage='You bookmarked a comment on this'
        />
      )}
    </Link>
  </div>
);
