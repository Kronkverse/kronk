import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import MapIcon from '@/material-icons/400-24px/australia.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import LocationIcon from '@/material-icons/400-24px/location_on.svg?react';
import { apiDeleteMapPlace, apiGetMapPlace } from 'mastodon/api/map_places';
import type { ApiMapPlaceJSON } from 'mastodon/api/map_places';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { MapPinPreview } from 'mastodon/components/map_pin_preview';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';

// A Place's page, /hub/map/places/:id (the `path:` on map.yaml's primary
// resource, so every Konnection to a Place opens here). Built from the
// kit: <KornerDetail> with the pin as its hero, the address as subtitle,
// who made it in <KornerMeta>, and the Konnected block (`attached`)
// listing what links to it, with Konnect for its maker.

const messages = defineMessages({
  back: { id: 'map.place.back', defaultMessage: 'Map' },
  loading: { id: 'map.place.loading', defaultMessage: 'Loading place…' },
  gone: {
    id: 'map.place.gone',
    defaultMessage: "This place isn't here any more.",
  },
  madeBy: { id: 'map.place.made_by', defaultMessage: 'Added by {name}' },
  seeOnMap: { id: 'map.place.see_on_map', defaultMessage: 'See on the map' },
  delete: { id: 'map.place.delete', defaultMessage: 'Delete place' },
  deleteConfirm: {
    id: 'map.place.delete_confirm',
    defaultMessage:
      'Delete this place? Everything Konnected to it stays, but loses its link here.',
  },
});

export const PlacePage: React.FC<{ id: string }> = ({ id }) => {
  const intl = useIntl();
  const history = useHistory();
  const [confirmDialog, confirmThen] = useConfirmThen();
  const [place, setPlace] = useState<ApiMapPlaceJSON | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    void apiGetMapPlace(id)
      .then((found) => {
        if (cancelled) return;
        setPlace(found);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('gone');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const seeOnMap = useCallback(() => {
    history.push(`/hub/map?place=${id}`);
  }, [history, id]);

  const handleDelete = useCallback(() => {
    if (deleting) return;
    confirmThen(intl.formatMessage(messages.deleteConfirm), 'delete', () => {
      setDeleting(true);
      void apiDeleteMapPlace(id)
        .then(() => {
          history.replace('/hub/map');
        })
        .catch(() => {
          setDeleting(false);
        });
    });
  }, [confirmThen, deleting, history, id, intl]);

  if (state === 'loading') {
    return (
      <div className='stage-column'>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </div>
    );
  }

  if (state === 'gone' || !place) {
    return (
      <div className='stage-column'>
        <EmptyState title={intl.formatMessage(messages.gone)} />
      </div>
    );
  }

  return (
    <KornerDetail
      className='map-place-page'
      back={{ href: '/hub/map', label: intl.formatMessage(messages.back) }}
      hero={
        <MapPinPreview
          lng={place.longitude}
          lat={place.latitude}
          zoom={16}
          className='map-place-page__preview'
        />
      }
      title={place.name}
      titleIcon={LocationIcon}
      titleIconId='location_on'
      subtitle={place.address}
      meta={
        place.maker ? (
          <KornerMeta
            items={[
              intl.formatMessage(messages.madeBy, {
                name: (
                  <Link key='maker' to={`/@${place.maker.acct}`}>
                    {place.maker.display_name}
                  </Link>
                ),
              }),
            ]}
          />
        ) : undefined
      }
      actions={
        <KornerActionBar>
          <KornerPill
            label={intl.formatMessage(messages.seeOnMap)}
            icon={MapIcon}
            iconId='australia'
            onClick={seeOnMap}
          />
          {place.is_owner && (
            <KornerPill
              label={intl.formatMessage(messages.delete)}
              icon={DeleteIcon}
              iconId='delete'
              variant='destructive'
              disabled={deleting}
              onClick={handleDelete}
            />
          )}
        </KornerActionBar>
      }
      attached={{ korner: 'map', id: place.id, canManage: place.is_owner }}
    >
      {confirmDialog}
    </KornerDetail>
  );
};
