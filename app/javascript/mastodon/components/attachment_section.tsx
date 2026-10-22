import { useCallback, useMemo, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type {
  ApiAttachmentJSON,
  AttachmentEndpointPreview,
} from 'mastodon/api/attachments';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import { Icon } from 'mastodon/components/icon';
import { useAttachTargets } from 'mastodon/hooks/useAttachTargets';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// AttachmentSection — renders the "Attached" block on any korner
// detail page (docs/korners/adding_a_korner.md (Korner attachments) §4.2). Shows
// both ends: what this record links to and what links to it, each as
// the other record's korner icon + a link (one tile per record, however
// many links join the two). `<KornerDetail attached={…}>` mounts it.
//
// Owner detection: the section renders manage controls (add + remove)
// only when `canManage` is true. Determining ownership is the caller's
// job — this component doesn't know what "owner" means for the source
// record. The caller passes the boolean, typically `event.is_owner`
// / `album.owned_by_me` / whatever the korner already surfaces.
//
// Renders nothing when the list is empty and there's no manage
// affordance, keeping detail pages clean when there are no
// attachments and the viewer can't add any.

const messages = defineMessages({
  attach: { id: 'attachment_section.attach', defaultMessage: 'Attach…' },
  removeAttachment: {
    id: 'attachment_section.remove',
    defaultMessage: 'Remove attachment',
  },
});

interface AttachmentSectionProps {
  korner: string;
  recordId: string | number | null | undefined;
  canManage?: boolean;
  // Optional heading override. Defaults to a generic "Attached"
  // FormattedMessage so callers get i18n for free.
  heading?: React.ReactNode;
  // Records the page already shows in its own way (an emergence's event
  // card shows its Kalendar event), left out here so they don't show
  // twice. Each is the record's korner slug and id.
  exclude?: AttachmentExclude[];
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
  className,
}) => {
  const intl = useIntl();
  const { attached, attachedFrom, loading, removeLink, refresh } =
    useAttachments(korner, recordId);
  const targets = useAttachTargets(korner);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Whoever looks after the record can attach it, when its korner can
  // attach to anything (spawns are the framework's, never offered).
  const canAttach = canManage && targets.length > 0;

  // Each link as the record at its other end. The same record can sit at
  // both (a link each way): it gets one tile. What `exclude` names counts
  // as already seen, so it gets none.
  const excludeKey = (exclude ?? []).map((e) => `${e.slug}/${e.id}`).join(' ');
  const links = useMemo(() => {
    const seen = new Set<string>(excludeKey ? excludeKey.split(' ') : []);
    const rows: {
      attachment: ApiAttachmentJSON;
      other: AttachmentEndpointPreview;
      otherSlug: string;
    }[] = [];
    const add = (
      attachment: ApiAttachmentJSON,
      other: AttachmentEndpointPreview,
      otherSlug: string,
    ) => {
      const key = `${otherSlug}/${other.id ?? attachment.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ attachment, other, otherSlug });
    };
    attached.forEach((a) => {
      add(a, a.target, a.target_slug);
    });
    attachedFrom.forEach((a) => {
      add(a, a.source, a.source_slug);
    });
    return rows;
  }, [attached, attachedFrom, excludeKey]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const hidden = links.length === 0 && !canAttach;
  const suppressLoadingFlash = loading && links.length === 0 && !canAttach;
  if (suppressLoadingFlash || hidden) return null;

  return (
    <section
      className={['attachment-section', className].filter(Boolean).join(' ')}
      aria-labelledby='attachment-section__heading'
    >
      <header className='attachment-section__header'>
        <h3
          id='attachment-section__heading'
          className='attachment-section__heading'
        >
          {heading ?? (
            <FormattedMessage
              id='attachment_section.heading'
              defaultMessage='Attached'
            />
          )}
        </h3>

        {canAttach && recordId != null && (
          <button
            type='button'
            className='attachment-section__attach'
            onClick={openPicker}
          >
            <Icon id='add' icon={AddIcon} />
            <span>{intl.formatMessage(messages.attach)}</span>
          </button>
        )}
      </header>

      {links.length > 0 && (
        <div className='attachment-section__grid'>
          {links.map(({ attachment, other, otherSlug }) => (
            <AttachmentTile
              key={attachment.id}
              attachment={attachment}
              other={other}
              otherSlug={otherSlug}
              canManage={canManage}
              onRemove={removeLink}
              intl={intl}
            />
          ))}
        </div>
      )}

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

interface AttachmentTileProps {
  attachment: ApiAttachmentJSON;
  // The record at the link's far end from this page, and its korner.
  other: AttachmentEndpointPreview;
  otherSlug: string;
  canManage: boolean;
  onRemove: (id: string) => Promise<void>;
  intl: ReturnType<typeof useIntl>;
}

// Mini-hub tile — square, icon-first, label under (Tal 2026-08-31).
// Same visual family as the Hub landing tiles but simpler chrome:
// no shadow stack, thinner border, sized for a compact grid on
// detail pages. Remove control sits as a small × on the tile
// corner when the viewer looks after this record (either end can undo).
const AttachmentTile: React.FC<AttachmentTileProps> = ({
  attachment,
  other,
  otherSlug,
  canManage,
  onRemove,
  intl,
}) => {
  // useKornerIcon resolves to the other korner's material icon;
  // falls back to a Kronk-purple AccentCircle for unmanifested slugs.
  const OtherIcon = useKornerIcon(otherSlug);

  const handleRemove = useCallback(() => {
    void onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  const body = (
    <>
      <OtherIcon className='attachment-section__tile-glyph' />
      <span className='attachment-section__tile-name'>
        {other.title ?? other.slug}
      </span>
    </>
  );

  return (
    <div className='attachment-section__tile'>
      {other.url ? (
        <Link to={other.url} className='attachment-section__tile-link'>
          {body}
        </Link>
      ) : (
        <span className='attachment-section__tile-link'>{body}</span>
      )}

      {canManage && (
        <button
          type='button'
          className='attachment-section__tile-remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.removeAttachment)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </div>
  );
};
