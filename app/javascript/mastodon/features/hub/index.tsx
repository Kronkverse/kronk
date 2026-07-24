import { useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import type { ApiKornerJSON } from 'mastodon/api_types/korners';
import { Icon } from 'mastodon/components/icon';
import { Stage } from 'mastodon/components/stage';
import { WavingHandBadge } from 'mastodon/components/waving_hand_badge';
import { useKorners } from 'mastodon/hooks/useKorner';
import { kornerIcon } from 'mastodon/hooks/useKornerIcon';
import { selectUnreadKornerSlugs } from 'mastodon/selectors/notifications';
import { useAppSelector } from 'mastodon/store';

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
});

// The settings gear sits above the tile link (position: absolute), so
// even without stopPropagation it never bubbles into the Link. The
// no-op handler is here because eslint's jsx-no-bind trips on inline
// arrows and we don't need one — but we keep the pattern lint-clean.
const stopClick = (e: React.MouseEvent) => {
  e.stopPropagation();
};

const KornerTile: React.FC<{ korner: ApiKornerJSON; alert?: boolean }> = ({
  korner,
  alert,
}) => {
  const soon = korner.enforced === false;
  const tunedIn = korner.tuned_in !== false;
  const teaser =
    (korner.hub_teaser?.static as string | undefined) ??
    (korner.launch?.blurb as string | undefined) ??
    '';

  const handleGearClick = useCallback(stopClick, []);

  return (
    <div
      className={`hub-page__tile ${soon ? 'hub-page__tile--off' : ''}`}
      data-slug={korner.slug}
    >
      {alert && (
        <WavingHandBadge
          className='hub-page__tile-alert'
          label='New activity'
        />
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

const Hub: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const korners = useKorners();
  // Korners with an unread korner/system notification get the waving-hand
  // alert on their tile (e.g. Kommons when a proposal is ready to finalise).
  const unreadKornerSlugs = useAppSelector(selectUnreadKornerSlugs);

  // Default order: most-tuned-in first, ties broken alphabetically.
  // Coming-soon tiles (enforced: false) fall to the end so the grid
  // reads live-first, promised-next.
  const sorted = korners.slice().sort((a, b) => {
    const diff = (b.tune_in_count ?? 0) - (a.tune_in_count ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  const live = sorted.filter((k) => k.enforced !== false);
  const soon = sorted.filter((k) => k.enforced === false);

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
              <KornerTile
                key={k.slug}
                korner={k}
                alert={unreadKornerSlugs.has(k.slug)}
              />
            ))}
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
                <KornerTile
                  key={k.slug}
                  korner={k}
                  alert={unreadKornerSlugs.has(k.slug)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};

export { Hub };
