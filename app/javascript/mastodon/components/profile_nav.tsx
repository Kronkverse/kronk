import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { NavLink } from 'react-router-dom';

import ArticleIcon from '@/material-icons/400-24px/article.svg?react';
import ChatBubbleIcon from '@/material-icons/400-24px/chat_bubble.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library.svg?react';
import PublicIcon from '@/material-icons/400-24px/public.svg?react';
import RavenIcon from '@/material-icons/400-24px/raven.svg?react';
import StarIcon from '@/material-icons/400-24px/star.svg?react';
import { Icon } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';

// ProfileNav — the one navigation for a person's space at `/@:acct`.
//
// Before this existed the profile had two: an icon pillar strip on the
// shelved profile, and a text tab row (`account__section-headline`) that the
// legacy account header rendered on `/posts`, `/featured`, `/with_replies`,
// `/media` and `/nudges`. They listed different destinations and only one
// showed at a time, so the chrome changed underneath you as you moved through
// a profile — and Featured, Media and Posts-and-replies were reachable only by
// landing on a page that happened to carry the tab row. Audit 2026-09-03;
// plan in docs/spaces/profile.md Stage 3.
//
// Icon-only, per the site-wide direction for horizontal pillar strips (Tal
// 2026-08-04). Each pillar carries its label as both `aria-label` and `title`,
// so screen readers announce it and a pointer reveals it. Note this strip is
// wider than the three it grew from — see the plan's note about whether seven
// glyphs still reads without visible labels.

const messages = defineMessages({
  nav: { id: 'profile_nav.label', defaultMessage: 'Profile sections' },
  profile: { id: 'account.sections', defaultMessage: 'Sections' },
  posts: { id: 'account.posts', defaultMessage: 'Posts' },
  featured: { id: 'account.featured', defaultMessage: 'Featured' },
  withReplies: {
    id: 'account.posts_with_replies',
    defaultMessage: 'Posts and replies',
  },
  media: { id: 'account.media', defaultMessage: 'Media' },
  nudges: { id: 'account.nudges', defaultMessage: 'Nudges' },
  mates: { id: 'account.mates', defaultMessage: 'Mates' },
});

interface Props {
  acct: string;
  // The account being viewed. Only used to decide whether the Nudges pillar
  // belongs — you don't nudge yourself.
  accountId?: string;
  signedIn?: boolean;
}

export const ProfileNav: React.FC<Props> = ({ acct, accountId, signedIn }) => {
  const intl = useIntl();

  // The shelved profile answers to `/@:acct`. `/shelves` and `/profile` are
  // legacy spellings that redirect here, so an `exact` match on the canonical
  // path alone would leave the pillar unlit for anyone mid-redirect. Match the
  // canonical path and nothing deeper.
  // Typed structurally rather than against react-router's `Location`: the
  // only thing this needs is the path, and importing the router's type here
  // resolves to `any` under the strict lint rules.
  const profileIsActive = useCallback(
    (_match: unknown, location: { pathname: string }) =>
      location.pathname === `/@${acct}`,
    [acct],
  );

  const showNudges = Boolean(signedIn) && accountId !== me;

  return (
    <nav className='profile-nav' aria-label={intl.formatMessage(messages.nav)}>
      <NavLink
        to={`/@${acct}`}
        isActive={profileIsActive}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.profile)}
        title={intl.formatMessage(messages.profile)}
      >
        <Icon id='person' icon={PersonIcon} />
      </NavLink>

      <NavLink
        to={`/@${acct}/posts`}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.posts)}
        title={intl.formatMessage(messages.posts)}
      >
        <Icon id='article' icon={ArticleIcon} />
      </NavLink>

      <NavLink
        to={`/@${acct}/with_replies`}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.withReplies)}
        title={intl.formatMessage(messages.withReplies)}
      >
        <Icon id='with-replies' icon={ChatBubbleIcon} />
      </NavLink>

      <NavLink
        to={`/@${acct}/featured`}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.featured)}
        title={intl.formatMessage(messages.featured)}
      >
        <Icon id='featured' icon={StarIcon} />
      </NavLink>

      <NavLink
        to={`/@${acct}/media`}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.media)}
        title={intl.formatMessage(messages.media)}
      >
        <Icon id='media' icon={PhotoLibraryIcon} />
      </NavLink>

      {showNudges && (
        <NavLink
          to={`/@${acct}/nudges`}
          className='profile-nav__pillar'
          activeClassName='profile-nav__pillar--active'
          aria-label={intl.formatMessage(messages.nudges)}
          title={intl.formatMessage(messages.nudges)}
        >
          <Icon id='nudges' icon={RavenIcon} />
        </NavLink>
      )}

      <NavLink
        to={`/@${acct}/mates`}
        className='profile-nav__pillar'
        activeClassName='profile-nav__pillar--active'
        aria-label={intl.formatMessage(messages.mates)}
        title={intl.formatMessage(messages.mates)}
      >
        <Icon id='mates' icon={PublicIcon} />
      </NavLink>
    </nav>
  );
};
