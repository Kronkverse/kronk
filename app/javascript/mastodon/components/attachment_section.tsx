import { useCallback, useMemo, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import LinkOffIcon from '@/material-icons/400-24px/link_off.svg?react';
import type {
  ApiAttachmentJSON,
  AttachmentEndpointPreview,
  AudienceFollowsEnd,
} from 'mastodon/api/attachments';
import { apiUpdateAttachmentAudience } from 'mastodon/api/attachments';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import {
  AUDIENCE_FOLLOWERS,
  AudienceMarker,
  audienceMismatch,
  audienceText,
  krewNames,
} from 'mastodon/components/audience_marker';
import { Icon } from 'mastodon/components/icon';
import { KonnectedCard, hasCard } from 'mastodon/components/konnected_card';
import { useAttachTargets } from 'mastodon/hooks/useAttachTargets';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { useConfirmThen } from 'mastodon/hooks/useConfirmDialog';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';
import { useRecordName } from 'mastodon/hooks/useRecordName';

// AttachmentSection — the "Konnected" block on every korner detail page
// (docs/korners/adding_a_korner.md (Korner attachments) §4.2): what this
// record is Konnected to, both ways, each as the other record's korner icon
// over its title in the shared space tiles (`_space_tiles.scss`, the Krew
// page's Spaces look). One tile per record, however many links join the
// two. A record with something to show is a card instead, above the tiles
// (`<KonnectedCard>`: a Place's map, an album's photos, an event's date;
// decisions.md, 2026-10-26). `<KornerDetail attached={…}>` mounts it. In the code a Konnection is
// still an attachment (`korner_attachments`); Konnect is its name on screen
// (decisions.md, 2026-10-22), as froth is a favourite's.
//
// Whoever looks after the record (`canManage`, the caller's call) gets a
// Konnect tile at the end of the grid and a × on each tile.
//
// Audience (docs/design.md, Konnect, "Same as"; decisions.md, 2026-10-25):
// every tile says who sees its record, and the one this record's audience
// follows says "Same as". Whoever looks after a record that can follow
// gets a link button beside the × on each tile it could follow ("Make
// audience the same") or does ("Stop following"), each confirmed with what
// changes, and a line under the grid for each Konnected record whose
// people can't open this one ("Growers can't open Harvest photos"), with
// "Make it Same as …" where that would mend it. Every record is named with
// what it is ("the Ember event"), since a situation's records often share a
// title (hooks/useRecordName; decisions.md, 2026-10-26). Pages of records that
// can't follow (an event, a Krew) get the markers only.
//
// Renders nothing when there is nothing to show and nothing to add, so a
// detail page with no Konnections stays clean.

const messages = defineMessages({
  konnect: { id: 'attachment_section.konnect', defaultMessage: 'Konnect' },
  diskonnect: {
    id: 'attachment_section.diskonnect',
    defaultMessage: 'Diskonnect {title}',
  },
  follow: {
    id: 'attachment_section.follow',
    defaultMessage: 'Make audience the same as {title}',
  },
  unfollow: {
    id: 'attachment_section.unfollow',
    defaultMessage: 'Stop following {title}',
  },
  followConfirm: {
    id: 'attachment_section.follow_confirm',
    defaultMessage:
      '{own} will be seen by {audience}, the same as {other}, and change when it does.',
  },
  unfollowConfirm: {
    id: 'attachment_section.unfollow_confirm',
    defaultMessage:
      '{own} stops following {other}’s audience and keeps the one it has now: {audience}.',
  },
  followError: {
    id: 'attachment_section.follow_error',
    defaultMessage: 'Couldn’t change who sees it: {reason}',
  },
  krewsCantOpen: {
    id: 'attachment_section.krews_cant_open',
    defaultMessage: '{krews} can’t open {own}.',
  },
  notEveryoneCanOpen: {
    id: 'attachment_section.not_everyone_can_open',
    defaultMessage: 'Not everyone who sees {other} can open {own}.',
  },
  makeSame: {
    id: 'attachment_section.make_same',
    defaultMessage: 'Make it Same as {other}',
  },
});

interface AttachmentSectionProps {
  korner: string;
  recordId: string | number | null | undefined;
  canManage?: boolean;
  // Heading override. Defaults to "Konnected".
  heading?: React.ReactNode;
  // Records the page already shows in its own way (an emergence's event
  // card shows its Kalendar event), left out here so they don't show
  // twice. Each is the record's korner slug and id.
  exclude?: AttachmentExclude[];
  // Whole korners the page shows in its own way (a Krew's Albutts and
  // Kalendar tiles list its albums and events).
  excludeSlugs?: string[];
  // Tiles the page puts first in the same grid (a Krew's spaces), so a page
  // has one section of tiles rather than two.
  leading?: React.ReactNode;
  // Replaces the Konnect tile: given the function that opens the picker.
  // The Krew page's Konnect opens its tray of spaces first.
  renderKonnect?: (openPicker: () => void) => React.ReactNode;
  // This record's audience changed here (Same as set or cleared), for a
  // page that shows it.
  onAudienceChange?: () => void;
  // Under the grid, inside the section (the Krew page's tray). A function
  // gets the one that opens the picker.
  children?: React.ReactNode | ((openPicker: () => void) => React.ReactNode);
  className?: string;
}

export interface AttachmentExclude {
  slug: string;
  id: string | number;
}

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({
  korner,
  recordId,
  canManage = false,
  heading,
  exclude,
  excludeSlugs,
  leading,
  renderKonnect,
  onAudienceChange,
  children,
  className,
}) => {
  const intl = useIntl();
  const names = useRecordName();
  const { attached, attachedFrom, loading, removeLink, refresh } =
    useAttachments(korner, recordId);
  const [confirmDialog, confirmThen] = useConfirmThen();
  const [followError, setFollowError] = useState<string | null>(null);
  const targets = useAttachTargets(korner);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Whoever looks after the record can Konnect it, when its korner can
  // Konnect to anything (spawns are the framework's, never offered).
  const canKonnect = canManage && targets.length > 0 && recordId != null;

  // Each link as the record at its other end. The same record can sit at
  // both (a link each way): it gets one tile. What `exclude` names counts
  // as already seen, so it gets none.
  const excludeKey = (exclude ?? []).map((e) => `${e.slug}/${e.id}`).join(' ');
  const excludeSlugKey = (excludeSlugs ?? []).join(' ');
  const links = useMemo(() => {
    const seen = new Set<string>(excludeKey ? excludeKey.split(' ') : []);
    const skipSlugs = new Set(excludeSlugKey ? excludeSlugKey.split(' ') : []);
    const rows: KonnectedLink[] = [];
    const add = (
      attachment: ApiAttachmentJSON,
      otherEnd: AudienceFollowsEnd,
    ) => {
      const other =
        otherEnd === 'target' ? attachment.target : attachment.source;
      const otherSlug =
        otherEnd === 'target' ? attachment.target_slug : attachment.source_slug;
      const own = otherEnd === 'target' ? attachment.source : attachment.target;
      if (skipSlugs.has(otherSlug)) return;
      const key = `${otherSlug}/${other.id ?? attachment.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ attachment, other, otherSlug, own, otherEnd });
    };
    attached.forEach((a) => {
      add(a, 'target');
    });
    attachedFrom.forEach((a) => {
      add(a, 'source');
    });
    return rows;
  }, [attached, attachedFrom, excludeKey, excludeSlugKey]);

  // This record can take another's audience: its korner can follow, and
  // whoever looks after it is here.
  const canFollow = canManage && AUDIENCE_FOLLOWERS.includes(korner);

  // Set or clear Same as on one link, once confirmed.
  const changeFollow = useCallback(
    (link: KonnectedLink, follow: boolean) => {
      const own = names.The(link.own);
      const other = names.the({ ...link.other, slug: link.otherSlug });
      const question = follow
        ? intl.formatMessage(messages.followConfirm, {
            own,
            other,
            audience: audienceText(
              intl,
              link.other.audience,
              link.otherSlug,
              'long',
            ),
          })
        : intl.formatMessage(messages.unfollowConfirm, {
            own,
            other,
            audience: audienceText(intl, link.own.audience, korner, 'long'),
          });
      confirmThen(question, 'confirm', () => {
        setFollowError(null);
        apiUpdateAttachmentAudience(
          link.attachment.id,
          follow ? link.otherEnd : null,
        )
          .then(() => {
            refresh();
            onAudienceChange?.();
            return undefined;
          })
          .catch((e: unknown) => {
            const reason =
              (e as { response?: { data?: { error?: string } } }).response?.data
                ?.error ?? '';
            setFollowError(
              intl.formatMessage(messages.followError, { reason }),
            );
          });
      });
    },
    [confirmThen, intl, names, korner, refresh, onAudienceChange],
  );

  // Honest notes: Konnected records whose people can't open this one. Only
  // on a record that could take another's audience, where its owner can do
  // something about it (an event leads and never follows).
  const notes = useMemo(() => {
    if (!canFollow) return [];
    return links.flatMap((link) => {
      const mismatch = audienceMismatch(link.own.audience, link.other.audience);
      return mismatch ? [{ link, mismatch }] : [];
    });
  }, [canFollow, links]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  // Records with something to show are cards, above the tiles.
  const cards = links.filter((link) =>
    hasCard(link.otherSlug, link.other.preview),
  );
  const tiles = links.filter(
    (link) => !hasCard(link.otherSlug, link.other.preview),
  );

  const hasLeading = Boolean(leading);
  const empty = links.length === 0 && !hasLeading;
  if (empty && !canKonnect) return null;
  // No flash of an empty heading while the first load is out.
  if (empty && loading) return null;

  return (
    <section
      className={['attachment-section', className].filter(Boolean).join(' ')}
    >
      <h3 className='korner-section-heading'>
        {heading ?? (
          <FormattedMessage
            id='attachment_section.heading_konnected'
            defaultMessage='Konnected'
          />
        )}
      </h3>

      {cards.length > 0 && (
        <ul className='konnected-cards'>
          {cards.map((link) => (
            <KonnectedTile
              key={link.attachment.id}
              link={link}
              canManage={canManage}
              canFollow={canFollow && followable(link)}
              onRemove={removeLink}
              onFollow={changeFollow}
            />
          ))}
        </ul>
      )}

      <ul className='space-tiles'>
        {leading}

        {tiles.map((link) => (
          <KonnectedTile
            key={link.attachment.id}
            link={link}
            canManage={canManage}
            canFollow={canFollow && followable(link)}
            onRemove={removeLink}
            onFollow={changeFollow}
          />
        ))}

        {canKonnect &&
          (renderKonnect ? (
            renderKonnect(openPicker)
          ) : (
            <li>
              <button
                type='button'
                className='space-tile space-tile--action'
                onClick={openPicker}
              >
                <span className='space-tile__glyph' aria-hidden='true'>
                  <Icon id='add' icon={AddIcon} />
                </span>
                <span className='space-tile__name'>
                  {intl.formatMessage(messages.konnect)}
                </span>
              </button>
            </li>
          ))}
      </ul>

      {notes.map(({ link, mismatch }) => {
        const own = names.the(link.own);
        const other = names.the({ ...link.other, slug: link.otherSlug });
        return (
          <p className='attachment-section__note' key={link.attachment.id}>
            {mismatch.everyone
              ? intl.formatMessage(messages.notEveryoneCanOpen, { own, other })
              : intl.formatMessage(messages.krewsCantOpen, {
                  krews: krewNames(intl, mismatch.krews),
                  own,
                })}
            {canFollow && followable(link) && !leads(link) && (
              <NoteFix link={link} other={other} onFollow={changeFollow} />
            )}
          </p>
        );
      })}

      {followError && (
        <p className='attachment-section__note attachment-section__note--error'>
          {followError}
        </p>
      )}

      {confirmDialog}

      {typeof children === 'function' ? children(openPicker) : children}

      {pickerOpen && recordId != null && (
        <AttachmentPicker
          sourceSlug={korner}
          sourceId={recordId}
          onClose={closePicker}
          onAttached={refresh}
        />
      )}
    </section>
  );
};

// One tile's link: the record at its far end from this page (`other`, at
// `otherEnd`), and this record's own end (`own`).
interface KonnectedLink {
  attachment: ApiAttachmentJSON;
  other: AttachmentEndpointPreview;
  otherSlug: string;
  own: AttachmentEndpointPreview;
  otherEnd: AudienceFollowsEnd;
}

// This record's audience follows the tile's.
const leads = (link: KonnectedLink) =>
  link.attachment.audience_follows === link.otherEnd;

// It does, or could: a link (not a reference) to a record whose audience
// can be followed.
const followable = (link: KonnectedLink) =>
  leads(link) ||
  (link.attachment.kind === 'link' && !!link.other.audience?.followable);

const NoteFix: React.FC<{
  link: KonnectedLink;
  other: string;
  onFollow: (link: KonnectedLink, follow: boolean) => void;
}> = ({ link, other, onFollow }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onFollow(link, true);
  }, [link, onFollow]);
  return (
    <button
      type='button'
      className='attachment-section__note-fix'
      onClick={handleClick}
    >
      {intl.formatMessage(messages.makeSame, { other })}
    </button>
  );
};

interface KonnectedTileProps {
  link: KonnectedLink;
  canManage: boolean;
  // Offer Same as on this tile (make or stop).
  canFollow: boolean;
  onRemove: (id: string) => Promise<void>;
  onFollow: (link: KonnectedLink, follow: boolean) => void;
}

// The other record as a space tile: its korner's icon, its title, who sees
// it, a way there. The × (either end can undo) sits in the corner, with
// Same as beside it. A record with something to show is a card, with the
// same marker and buttons.
const KonnectedTile: React.FC<KonnectedTileProps> = ({
  link,
  canManage,
  canFollow,
  onRemove,
  onFollow,
}) => {
  const intl = useIntl();
  const names = useRecordName();
  const { attachment, other, otherSlug } = link;
  // The other korner's icon; a Kronk-purple circle for unmanifested slugs.
  const OtherIcon = useKornerIcon(otherSlug);
  const title = other.title ?? other.slug;
  // What it is, under its title, and in full for the buttons' labels.
  const noun = names.noun(otherSlug, other.noun);
  const named = names.the({ ...other, slug: otherSlug });
  const following = leads(link);

  const handleRemove = useCallback(() => {
    void onRemove(attachment.id);
  }, [attachment.id, onRemove]);
  const handleFollow = useCallback(() => {
    onFollow(link, !following);
  }, [link, following, onFollow]);

  const marker = (
    <AudienceMarker
      audience={other.audience}
      slug={otherSlug}
      leads={following}
    />
  );
  const body = (
    <>
      <OtherIcon className='space-tile__glyph' />
      <span className='space-tile__name'>{title}</span>
      {noun && <span className='space-tile__kind'>{noun}</span>}
      {marker}
    </>
  );
  const tileClass = `space-tile${following ? ' space-tile--leads' : ''}`;
  const followLabel = intl.formatMessage(
    following ? messages.unfollow : messages.follow,
    { title: named },
  );

  const controls = (
    <>
      {canFollow && (
        <button
          type='button'
          className={`space-tile__follow${following ? ' space-tile__follow--on' : ''}`}
          onClick={handleFollow}
          aria-label={followLabel}
          title={followLabel}
        >
          <Icon
            id={following ? 'link_off' : 'link'}
            icon={following ? LinkOffIcon : LinkIcon}
          />
        </button>
      )}

      {canManage && (
        <button
          type='button'
          className='space-tile__remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.diskonnect, { title: named })}
          title={intl.formatMessage(messages.diskonnect, { title: named })}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </>
  );

  if (other.preview && hasCard(otherSlug, other.preview))
    return (
      <KonnectedCard
        slug={otherSlug}
        title={title}
        noun={noun}
        url={other.url}
        preview={other.preview}
        leads={following}
        marker={marker}
        controls={controls}
      />
    );

  return (
    <li>
      {other.url ? (
        <Link to={other.url} className={tileClass}>
          {body}
        </Link>
      ) : (
        <span className={`${tileClass} space-tile--static`}>{body}</span>
      )}
      {controls}
    </li>
  );
};
