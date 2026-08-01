import { useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Icon } from 'mastodon/components/icon';
import { Stage } from 'mastodon/components/stage';
import { useKorners } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';

// Hub landing (/hub). Tile aesthetic from the prototype at
// public/hub-arrangeable-preview.html (retired 2.0.0-alpha.204):
// chunky aspect-ratio 1 tiles with the korner's Material icon (from
// the manifest's `icon.material`), a hover-only settings gear
// top-right, a tuned-in dot bottom-left, and an "off" treatment for
// coming-soon korners. Data + links are the real registry — every
// tile routes to /hub/<slug>.
//
// The tile glyph reads from the manifest via `kornerIcon(slug)` so
// changing `icon.material` in any manifest propagates here + to every
// other icon site (column headers, dropdowns, kommons lattice) in one
// place. Drag-to-arrange is deferred until the ordering endpoint
// (`PATCH /api/v1/kronk/hub/order`) ships.

const messages = defineMessages({
  title: { id: 'hub.title', defaultMessage: 'Hub' },
  proposeKorner: {
    id: 'hub.propose_korner',
    defaultMessage: 'Propose a new korner',
  },
  proposeKornerTip: {
    id: 'hub.propose_korner_tip',
    defaultMessage: 'Missing something? Draft it via Kommons.',
  },
});

// Route to the Kommons propose page pre-scoped to the "new korner" node.
// The propose page reads `node=kommons.new_korner` and swaps into its
// tailored korner-composer copy (title = korner name, structured fields).
//
// Must be a Location object — Kronk's history wrapper mangles a raw
// `pathname?query` string into the pathname (see components/router.tsx),
// which sends the link to /hub/kommons/… without the query and drops the
// user on the proposals list. ProposePicker hit the same rake — see
// propose_picker.tsx:64.
const PROPOSE_KORNER_TARGET = {
  pathname: '/hub/kommons/propose',
  search: '?node=kommons.new_korner',
};

// The settings gear sits above the tile link (position: absolute), so
// even without stopPropagation it never bubbles into the Link. The
// no-op handler is here because eslint's jsx-no-bind trips on inline
// arrows and we don't need one — but we keep the pattern lint-clean.
const stopClick = (e: React.MouseEvent) => {
  e.stopPropagation();
};

const KornerTile: React.FC<{ korner: ApiKornerJSON }> = ({ korner }) => {
  // New, feed-visible content the viewer hasn't seen (0 for tuned-out korners
  // and anonymous viewers). Clears when they open the korner or interact with
  // its posts in the feed. See lib/kronk/korner_seen.rb.
  const unread = korner.unread_count ?? 0;
  // A tile reads as "coming soon" only when it's neither enforced nor
  // a portal — a portal is functionally live even at enforced:false.
  const soon = korner.enforced === false && !korner.portal?.url;
  const tunedIn = korner.tuned_in !== false;
  // The hover tip uses the korner's authored `tagline` (the same copy
  // shown by <SpaceIntro> inside the korner), so the Hub and the korner
  // itself describe it identically. Falls back to the older teaser/blurb.
  const teaser =
    korner.tagline ??
    (korner.hub_teaser?.static as string | undefined) ??
    (korner.launch?.blurb as string | undefined) ??
    '';

  const handleGearClick = useCallback(stopClick, []);

  return (
    <div
      className={`hub-page__tile ${soon ? 'hub-page__tile--off' : ''}`}
      data-slug={korner.slug}
    >
      {unread > 0 && (
        <span className='hub-page__tile-badge' aria-label={`${unread} new`}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      <Link
        to={`/hub/${korner.slug}`}
        className='hub-page__tile-link'
        aria-label={korner.name}
      >
        <Icon
          id={korner.icon?.material ?? korner.slug}
          icon={kornerIcon(korner.slug, korner)}
          className='hub-page__tile-glyph'
        />
        <span className='hub-page__tile-name'>{korner.name}</span>
        {teaser && <span className='hub-page__tile-tip'>{teaser}</span>}
        {tunedIn && !soon && (
          <span className='hub-page__tile-dot' aria-hidden='true' />
        )}
      </Link>
      {!soon && (
        <Link
          to={`/hub/${korner.slug}/settings`}
          className='hub-page__tile-gear'
          onClick={handleGearClick}
          aria-label={`Settings for ${korner.name}`}
          title={`${korner.name} settings`}
        >
          <SettingsIcon />
        </Link>
      )}
    </div>
  );
};

// "+" tile — always the last tile in the live board. Missing a
// korner? Draft one via Kommons. Same shell as `KornerTile` so it sits
// inside the same grid rhythm, minus the gear + activity affordances.
const ProposeKornerTile: React.FC = () => {
  const intl = useIntl();
  const label = intl.formatMessage(messages.proposeKorner);
  const tip = intl.formatMessage(messages.proposeKornerTip);

  return (
    <div
      className='hub-page__tile hub-page__tile--propose'
      data-slug='__propose__'
    >
      <Link
        to={PROPOSE_KORNER_TARGET}
        className='hub-page__tile-link'
        aria-label={label}
      >
        <Icon id='add' icon={AddIcon} className='hub-page__tile-glyph' />
        <span className='hub-page__tile-name'>{label}</span>
        <span className='hub-page__tile-tip'>{tip}</span>
      </Link>
    </div>
  );
};

const Hub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const korners = useKorners();

  // Default order: most-tuned-in first, ties broken alphabetically.
  // Coming-soon tiles (enforced: false + no portal) fall to the end so
  // the grid reads live-first, promised-next.
  const sorted = korners.slice().sort((a, b) => {
    const diff = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  // Portal korners (e.g. YOU) ship at `enforced: false` because they
  // own no Kronk-side resources — but they have a real landing page and
  // are functionally live. Promote them out of the "Coming soon" bucket.
  const isLive = (k: ApiKornerJSON) =>
    k.enforced !== false || Boolean(k.portal?.url);
  const live = sorted.filter(isLive);
  const soon = sorted.filter((k) => !isLive(k));

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <div className='hub-page'>
        {live.length === 0 && soon.length === 0 && (
          <p className='hub-page__empty'>
            <FormattedMessage
              id='hub.empty'
              defaultMessage='No korners are loaded yet. This usually means the manifest registry is still fetching.'
            />
          </p>
        )}

        {live.length > 0 && (
          <div className='hub-page__board'>
            {live.map((k) => (
              <KornerTile key={k.slug} korner={k} />
            ))}
            <ProposeKornerTile />
          </div>
        )}

        {soon.length > 0 && (
          <>
            <h2 className='hub-page__section-label'>
              <FormattedMessage
                id='hub.soon_section'
                defaultMessage='Coming to Kronk'
              />
            </h2>
            <div className='hub-page__board hub-page__board--soon'>
              {soon.map((k) => (
                <KornerTile key={k.slug} korner={k} />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};

export { Hub };
