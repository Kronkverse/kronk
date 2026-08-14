import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import { Link } from 'react-router-dom';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import type { ApiAttachmentJSON } from 'mastodon/api/attachments';
import { Icon } from 'mastodon/components/icon';
import { useAttachments } from 'mastodon/hooks/useAttachments';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// AttachmentSection — renders the "Attached" block on any korner
// detail page (docs/kronk_korner_attachments.md §4.2). Reads the
// list via `useAttachments`, groups by target_slug, and renders
// each row using the target korner's material icon + a link.
//
// Phase 2 scope: read + owner remove. The add flow (via
// `<AttachmentPicker>`) is deferred to Phase 2b because it needs a
// per-korner candidate-search API. Callers that need to add rows
// programmatically (e.g. Kalendar composer's spawn_album checkbox)
// call `useAttachments` directly and drive `addLink` themselves.
//
// Owner detection: the section renders a remove control only when
// `canManage` is true. Determining ownership is the caller's job —
// this component doesn't know what "owner" means for the source
// record. The caller passes the boolean, typically `event.is_owner`
// / `album.owned_by_me` / whatever the korner already surfaces.
//
// Renders nothing when the list is empty and there's no add control,
// keeping detail pages clean when there are no attachments.

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
  const { attached, loading, removeLink } = useAttachments(korner, recordId);

  if (loading && attached.length === 0) return null;
  if (attached.length === 0) return null;

  return (
    <section
      className={['attachment-section', className].filter(Boolean).join(' ')}
      aria-labelledby='attachment-section__heading'
    >
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

      <ul className='attachment-section__list'>
        {attached.map((a) => (
          <AttachmentRow
            key={a.id}
            attachment={a}
            canManage={canManage}
            onRemove={removeLink}
          />
        ))}
      </ul>
    </section>
  );
};

interface AttachmentRowProps {
  attachment: ApiAttachmentJSON;
  canManage: boolean;
  onRemove: (id: string) => Promise<void>;
}

const AttachmentRow: React.FC<AttachmentRowProps> = ({
  attachment,
  canManage,
  onRemove,
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
          aria-label='Remove attachment'
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </li>
  );
};
