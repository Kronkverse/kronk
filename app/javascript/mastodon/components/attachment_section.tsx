import { useCallback, useMemo, useState } from 'react';

import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type { ApiAttachmentJSON } from 'mastodon/api/attachments';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import { Icon } from 'mastodon/components/icon';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// AttachmentSection — renders the "Attached" block on any korner
// detail page (docs/kronk_korner_attachments.md §4.2). Reads the
// list via `useAttachments`, groups by target_slug, and renders
// each row using the target korner's material icon + a link.
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
  className?: string;
}

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({
  korner,
  recordId,
  canManage = false,
  heading,
  className,
}) => {
  const intl = useIntl();
  const { attached, loading, removeLink, refresh } = useAttachments(
    korner,
    recordId,
  );
  const sourceManifest = useKorner(korner);
  const [pickerOpen, setPickerOpen] = useState(false);

  // "Can attach" = viewer owns the source AND the manifest declares
  // at least one non-wildcard target with a non-spawn kind (spawn is
  // framework-only). Wildcards *could* be honoured here by querying
  // every korner, but that's a candidate-list scope decision deferred
  // to Phase 3 alongside the first real adopters.
  const canAttach = useMemo(() => {
    if (!canManage) return false;
    const entries = sourceManifest?.attaches ?? [];
    return entries.some((e) => e.to !== '*' && e.kind !== 'spawn');
  }, [canManage, sourceManifest?.attaches]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const hidden = attached.length === 0 && !canAttach;
  const suppressLoadingFlash = loading && attached.length === 0 && !canAttach;
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

      {attached.length > 0 && (
        <ul className='attachment-section__list'>
          {attached.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              canManage={canManage}
              onRemove={removeLink}
              intl={intl}
            />
          ))}
        </ul>
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

interface AttachmentRowProps {
  attachment: ApiAttachmentJSON;
  canManage: boolean;
  onRemove: (id: string) => Promise<void>;
  intl: ReturnType<typeof useIntl>;
}

const AttachmentRow: React.FC<AttachmentRowProps> = ({
  attachment,
  canManage,
  onRemove,
  intl,
}) => {
  const { target } = attachment;
  // useKornerIcon resolves to the target korner's material icon;
  // falls back to a Kronk-purple AccentCircle for unmanifested slugs.
  const TargetIcon = useKornerIcon(attachment.target_slug);

  const handleRemove = useCallback(() => {
    void onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  const body = (
    <>
      <TargetIcon className='attachment-section__row-icon' />
      <span className='attachment-section__row-title'>
        {target.title ?? target.slug}
      </span>
    </>
  );

  return (
    <li className='attachment-section__row'>
      {target.url ? (
        <Link to={target.url} className='attachment-section__row-link'>
          {body}
        </Link>
      ) : (
        <span className='attachment-section__row-link'>{body}</span>
      )}

      {canManage && (
        <button
          type='button'
          className='attachment-section__remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.removeAttachment)}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </li>
  );
};
