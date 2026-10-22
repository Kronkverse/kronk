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

// AttachmentSection — the "Konnected" block on every korner detail page
// (docs/korners/adding_a_korner.md (Korner attachments) §4.2): what this
// record is Konnected to, both ways, each as the other record's korner icon
// over its title in the shared space tiles (`_space_tiles.scss`, the Krew
// page's Spaces look). One tile per record, however many links join the
// two. `<KornerDetail attached={…}>` mounts it. In the code a Konnection is
// still an attachment (`korner_attachments`); Konnect is its name on screen
// (decisions.md, 2026-10-22), as froth is a favourite's.
//
// Whoever looks after the record (`canManage`, the caller's call) gets a
// Konnect tile at the end of the grid and a × on each tile.
//
// Renders nothing when there is nothing to show and nothing to add, so a
// detail page with no Konnections stays clean.

const messages = defineMessages({
  konnect: { id: 'attachment_section.konnect', defaultMessage: 'Konnect' },
  unkonnect: {
    id: 'attachment_section.unkonnect',
    defaultMessage: 'Unkonnect {title}',
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
  children,
  className,
}) => {
  const intl = useIntl();
  const { attached, attachedFrom, loading, removeLink, refresh } =
    useAttachments(korner, recordId);
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
      if (skipSlugs.has(otherSlug)) return;
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
  }, [attached, attachedFrom, excludeKey, excludeSlugKey]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

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

      <ul className='space-tiles'>
        {leading}

        {links.map(({ attachment, other, otherSlug }) => (
          <KonnectedTile
            key={attachment.id}
            attachment={attachment}
            other={other}
            otherSlug={otherSlug}
            canManage={canManage}
            onRemove={removeLink}
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

interface KonnectedTileProps {
  attachment: ApiAttachmentJSON;
  // The record at the link's far end from this page, and its korner.
  other: AttachmentEndpointPreview;
  otherSlug: string;
  canManage: boolean;
  onRemove: (id: string) => Promise<void>;
}

// The other record as a space tile: its korner's icon, its title, a way
// there. The × (either end can undo) sits in the corner.
const KonnectedTile: React.FC<KonnectedTileProps> = ({
  attachment,
  other,
  otherSlug,
  canManage,
  onRemove,
}) => {
  const intl = useIntl();
  // The other korner's icon; a Kronk-purple circle for unmanifested slugs.
  const OtherIcon = useKornerIcon(otherSlug);
  const title = other.title ?? other.slug;

  const handleRemove = useCallback(() => {
    void onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  const body = (
    <>
      <OtherIcon className='space-tile__glyph' />
      <span className='space-tile__name'>{title}</span>
    </>
  );

  return (
    <li>
      {other.url ? (
        <Link to={other.url} className='space-tile'>
          {body}
        </Link>
      ) : (
        <span className='space-tile space-tile--static'>{body}</span>
      )}

      {canManage && (
        <button
          type='button'
          className='space-tile__remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.unkonnect, { title })}
          title={intl.formatMessage(messages.unkonnect, { title })}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </li>
  );
};
