import { useEffect, useState, useCallback } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Link, useParams, useHistory } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import { importFetchedStatuses } from 'mastodon/actions/importer';
import {
  apiGetKrew,
  apiGetKrewMembers,
  apiGetKrewChat,
  apiSetKrewImage,
  apiJoinKrew,
  apiAttachKorner,
  apiGetKrewStatuses,
} from 'mastodon/api/krew';
import type { ApiKrewJSON, KrewKornerSlug } from 'mastodon/api/krew';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Icon } from 'mastodon/components/icon';
import { KornerGlyph } from 'mastodon/components/korner_glyph';
import { Stage } from 'mastodon/components/stage';
import StatusContainerJSX from 'mastodon/containers/status_container';
import { createAccountFromServerJSON } from 'mastodon/models/account';
import { useAppDispatch } from 'mastodon/store';

// StatusContainer is a legacy JSX/Redux `connect` component with no
// generated types — cast at the boundary so the mini-feed's map stays
// clean rather than sprinkling `@ts-expect-error` per element.
const StatusContainer = StatusContainerJSX as unknown as React.FC<{
  id: string;
  contextType?: string;
}>;

// Krew page (/hub/krew/:id) — identity, who's in it, and a Hub-style
// grid to the Krew's spaces plus Add-a-space + Chat. Redesigned
// 2026-08-31 (Tal): dropped the in-page "All krews" back chip (the
// system back covers it) and the stats / invite / archive blocks —
// Settings lives on the floating space menu; the group Chat (a Nudges KREW
// conversation) opens from the grid.

// Korners a Krew can turn on — mirrors KrewKorner::KORNERS and the
// composer's list.
const KORNER_OPTIONS: KrewKornerSlug[] = [
  'booth',
  'huddle',
  'kalendar',
  'kommons',
  'map',
  'albutts',
  'kuestions',
];

const messages = defineMessages({
  title: { id: 'krew.detail.title', defaultMessage: 'Krew' },
  loading: { id: 'krew.detail.loading', defaultMessage: 'Loading…' },
  inThisKrew: {
    id: 'krew.detail.in_this_krew',
    defaultMessage: 'In this Krew',
  },
  join: { id: 'krew.detail.join', defaultMessage: 'Join' },
  settings: { id: 'krew.detail.settings', defaultMessage: 'Settings' },
  spaces: { id: 'krew.detail.spaces', defaultMessage: 'Spaces' },
  spacesEmpty: {
    id: 'krew.detail.spaces_empty',
    defaultMessage:
      'No spaces yet — add one to give this Krew somewhere to gather.',
  },
  addSpace: { id: 'krew.detail.add_space', defaultMessage: 'Add a space' },
  chat: { id: 'krew.detail.chat', defaultMessage: 'Chat' },
  changeImage: {
    id: 'krew.detail.change_image',
    defaultMessage: 'Change image',
  },
  inviteOnly: { id: 'krew.marker.invite_only', defaultMessage: 'Invite-only' },
  archived: { id: 'krew.detail.archived', defaultMessage: 'archived' },
  feed: { id: 'krew.detail.feed', defaultMessage: "What's happening" },
  feedEmpty: {
    id: 'krew.detail.feed_empty',
    defaultMessage:
      'Nothing here yet. Posts targeting this Krew will show up here.',
  },
});

const initial = (name: string): string => {
  const first = name.trim().charAt(0);
  return first.length === 0 ? 'K' : first.toUpperCase();
};

const MemberFace: React.FC<{ account: ApiAccountJSON }> = ({ account }) => {
  const model = createAccountFromServerJSON(account);
  return (
    <Link
      to={`/@${account.acct}`}
      className='krew-detail__member'
      title={model.display_name || account.username}
    >
      <Avatar account={model} size={36} />
    </Link>
  );
};

// A tappable Hub-style space tile for an attached Korner.
const SpaceTile: React.FC<{ slug: KrewKornerSlug }> = ({ slug }) => (
  <Link to={`/hub/${slug}`} className='krew-detail__space-tile'>
    <KornerGlyph
      slug={slug}
      className='krew-detail__space-glyph'
      aria-hidden='true'
    />
    <span className='krew-detail__space-name'>{slug}</span>
  </Link>
);

// A tile in the "add a space" tray — attaches the Korner on click.
const AddableTile: React.FC<{
  slug: KrewKornerSlug;
  onAttach: (slug: KrewKornerSlug) => void;
}> = ({ slug, onAttach }) => {
  const handle = useCallback(() => {
    onAttach(slug);
  }, [slug, onAttach]);
  return (
    <button
      type='button'
      className='krew-detail__space-tile krew-detail__space-tile--addable'
      onClick={handle}
    >
      <KornerGlyph
        slug={slug}
        className='krew-detail__space-glyph'
        aria-hidden='true'
      />
      <span className='krew-detail__space-name'>{slug}</span>
    </button>
  );
};

export const KrewDetail = () => {
  const intl = useIntl();
  const { id } = useParams<{ id?: string }>();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const [krew, setKrew] = useState<ApiKrewJSON | null>(null);
  const [members, setMembers] = useState<ApiAccountJSON[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Mini-feed: the ids of statuses targeting this krew, newest first. The
  // status records themselves live in Redux via `importFetchedStatuses` so
  // <StatusContainer> picks them up like any other feed item.
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [feedLoaded, setFeedLoaded] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [k, m] = await Promise.all([apiGetKrew(id), apiGetKrewMembers(id)]);
      setKrew(k);
      setMembers(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Fetch the krew's mini-feed once we have the krew loaded. Non-fatal on
  // failure — an errored feed shouldn't block the identity + members + spaces
  // above from rendering. Refetches when the id changes (route → different
  // krew), not on every re-render.
  useEffect(() => {
    if (!id) return;
    apiGetKrewStatuses(id, { limit: 20 })
      .then((statuses) => {
        dispatch(importFetchedStatuses(statuses));
        setFeedIds(statuses.map((s) => s.id));
        setFeedLoaded(true);
      })
      .catch(() => {
        setFeedLoaded(true);
      });
  }, [id, dispatch]);

  const handleJoin = useCallback(() => {
    if (!id) return;
    setBusy(true);
    apiJoinKrew(id)
      .then(refetch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, refetch]);

  const toggleAdd = useCallback(() => {
    setAddOpen((v) => !v);
  }, []);

  const handleAttach = useCallback(
    (slug: KrewKornerSlug) => {
      if (!id) return;
      setBusy(true);
      apiAttachKorner(id, slug)
        .then(refetch)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          setBusy(false);
          setAddOpen(false);
        });
    },
    [id, refetch],
  );

  const handleImageChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >(
    (e) => {
      const file = e.currentTarget.files?.[0];
      if (!file || !id) return;
      setBusy(true);
      apiSetKrewImage(id, file)
        .then(refetch)
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [id, refetch],
  );

  const handleChat = useCallback(() => {
    if (!id) return;
    setBusy(true);
    apiGetKrewChat(id)
      .then((res) => {
        history.push(`/nudges/${res.conversation_id}`);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setBusy(false);
      });
  }, [id, history]);

  const canManage = Boolean(krew?.viewer_role);
  const attachable = krew
    ? KORNER_OPTIONS.filter((slug) => !krew.korners.includes(slug))
    : [];

  return (
    <Stage label={krew?.name ?? intl.formatMessage(messages.title)}>
      <div className='scrollable krew-detail'>
        {error && <p className='krew-detail__error'>{error}</p>}

        {!krew && !error && (
          <p className='krew-detail__loading'>
            <FormattedMessage {...messages.loading} />
          </p>
        )}

        {krew && (
          <>
            <header className='krew-detail__header'>
              {krew.viewer_role === 'seeder' ? (
                <label
                  className='krew-detail__avatar krew-detail__avatar--editable'
                  data-initial={initial(krew.name)}
                  title={intl.formatMessage(messages.changeImage)}
                >
                  {krew.image_url ? (
                    <img
                      src={krew.image_url}
                      alt=''
                      className='krew-detail__avatar-img'
                    />
                  ) : (
                    initial(krew.name)
                  )}
                  <input
                    type='file'
                    accept='image/*'
                    onChange={handleImageChange}
                    disabled={busy}
                    className='krew-detail__avatar-input'
                  />
                </label>
              ) : (
                <span
                  className='krew-detail__avatar'
                  aria-hidden='true'
                  data-initial={initial(krew.name)}
                >
                  {krew.image_url ? (
                    <img
                      src={krew.image_url}
                      alt=''
                      className='krew-detail__avatar-img'
                    />
                  ) : (
                    initial(krew.name)
                  )}
                </span>
              )}
              <div className='krew-detail__identity'>
                <h1 className='krew-detail__name'>
                  {krew.name}
                  {krew.access === 'invite_only' && (
                    <span
                      className='krew-detail__marker'
                      aria-label={intl.formatMessage(messages.inviteOnly)}
                      title={intl.formatMessage(messages.inviteOnly)}
                    >
                      ⚿
                    </span>
                  )}
                </h1>
                <div className='krew-detail__submeta'>
                  <span className='krew-detail__slug'>@{krew.slug}</span>
                  {krew.archived && (
                    <span className='krew-detail__archived-badge'>
                      <FormattedMessage {...messages.archived} />
                    </span>
                  )}
                </div>
              </div>
            </header>

            {krew.description && (
              <p className='krew-detail__description'>{krew.description}</p>
            )}

            <section className='krew-detail__section'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.inThisKrew} />
                <span className='krew-detail__count'>{krew.member_count}</span>
              </h3>
              <div className='krew-detail__members'>
                {members.map((account) => (
                  <MemberFace key={account.id} account={account} />
                ))}
              </div>
            </section>

            <section className='krew-detail__section'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.spaces} />
              </h3>
              {krew.korners.length === 0 && !canManage && (
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.spacesEmpty} />
                </p>
              )}
              <div className='krew-detail__space-grid'>
                {krew.korners.map((slug) => (
                  <SpaceTile key={slug} slug={slug} />
                ))}

                {canManage && attachable.length > 0 && (
                  <button
                    type='button'
                    className='krew-detail__space-tile krew-detail__space-tile--action'
                    onClick={toggleAdd}
                    aria-expanded={addOpen}
                  >
                    <span
                      className='krew-detail__space-glyph'
                      aria-hidden='true'
                    >
                      <Icon id='add' icon={AddIcon} />
                    </span>
                    <span className='krew-detail__space-name'>
                      <FormattedMessage {...messages.addSpace} />
                    </span>
                  </button>
                )}

                {canManage && (
                  <button
                    type='button'
                    className='krew-detail__space-tile krew-detail__space-tile--action'
                    onClick={handleChat}
                    disabled={busy}
                  >
                    <span
                      className='krew-detail__space-glyph'
                      aria-hidden='true'
                    >
                      <Icon id='chat' icon={ChatIcon} />
                    </span>
                    <span className='krew-detail__space-name'>
                      <FormattedMessage {...messages.chat} />
                    </span>
                  </button>
                )}
              </div>

              {addOpen && attachable.length > 0 && (
                <div className='krew-detail__space-grid krew-detail__space-grid--tray'>
                  {attachable.map((slug) => (
                    <AddableTile
                      key={slug}
                      slug={slug}
                      onAttach={handleAttach}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className='krew-detail__section krew-detail__feed'>
              <h3 className='krew-detail__section-heading'>
                <FormattedMessage {...messages.feed} />
              </h3>
              {feedLoaded && feedIds.length === 0 && (
                <p className='krew-detail__section-hint'>
                  <FormattedMessage {...messages.feedEmpty} />
                </p>
              )}
              {feedIds.length > 0 && (
                <div className='krew-detail__feed-list'>
                  {feedIds.map((statusId) => (
                    <StatusContainer
                      key={statusId}
                      id={statusId}
                      contextType='krew'
                    />
                  ))}
                </div>
              )}
            </section>

            <div className='krew-detail__actions'>
              {!krew.archived && !krew.viewer_role && (
                <button
                  type='button'
                  onClick={handleJoin}
                  disabled={busy}
                  className='krew-detail__btn krew-detail__btn--primary'
                >
                  <FormattedMessage {...messages.join} />
                </button>
              )}

              {/* Leave lives on the Settings surface now (2026-09-04) so the
                  Krew page stays about identity + what's happening. Every
                  member (including seeders) reaches Leave from Settings. */}
              {krew.viewer_role && (
                <Link
                  to={`/hub/krew/${krew.slug}/settings`}
                  className='krew-detail__btn krew-detail__btn--secondary'
                >
                  <Icon id='settings' icon={SettingsIcon} />{' '}
                  <FormattedMessage {...messages.settings} />
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
};
