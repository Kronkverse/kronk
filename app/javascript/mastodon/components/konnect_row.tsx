import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { AttachmentPicker } from 'mastodon/components/attachment_picker';
import { Icon } from 'mastodon/components/icon';
import { useAttachTargets } from 'mastodon/hooks/useAttachTargets';
import type { KonnectControls, KonnectTarget } from 'mastodon/hooks/useKonnect';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// KonnectRow — what a composer will Konnect what it makes to, drawn by
// `<ComposeShell konnect={…}>` at the foot of its body (docs/design.md,
// ComposeShell). The same space tiles as a detail page's Konnected block
// (`<AttachmentSection>`): one per record waiting, with a × to drop it, and
// a Konnect tile that opens the picker in its pick-don't-save mode, since
// the record isn't made yet. `useKonnect` holds the list and Konnects it
// after the create.

const messages = defineMessages({
  konnect: { id: 'konnect_row.konnect', defaultMessage: 'Konnect' },
  drop: { id: 'konnect_row.drop', defaultMessage: 'Diskonnect {title}' },
});

interface KonnectRowProps {
  konnect: KonnectControls;
  disabled?: boolean;
}

export const KonnectRow: React.FC<KonnectRowProps> = ({
  konnect,
  disabled = false,
}) => {
  const intl = useIntl();
  const targets = useAttachTargets(konnect.korner);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  if (targets.length === 0 && konnect.pending.length === 0) return null;

  return (
    <section className='konnect-row'>
      <h3 className='korner-section-heading'>
        <FormattedMessage id='konnect_row.heading' defaultMessage='Konnected' />
      </h3>

      <ul className='space-tiles'>
        {konnect.pending.map((target) => (
          <PendingTile
            key={`${target.slug}/${target.id}`}
            target={target}
            removable={konnect.removable(target)}
            disabled={disabled}
            onRemove={konnect.remove}
          />
        ))}

        {targets.length > 0 && (
          <li>
            <button
              type='button'
              className='space-tile space-tile--action'
              onClick={openPicker}
              disabled={disabled}
            >
              <span className='space-tile__glyph' aria-hidden='true'>
                <Icon id='add' icon={AddIcon} />
              </span>
              <span className='space-tile__name'>
                {intl.formatMessage(messages.konnect)}
              </span>
            </button>
          </li>
        )}
      </ul>

      {pickerOpen && (
        <AttachmentPicker
          sourceSlug={konnect.korner}
          onClose={closePicker}
          onPick={konnect.add}
          exclude={konnect.pending}
        />
      )}
    </section>
  );
};

interface PendingTileProps {
  target: KonnectTarget;
  removable: boolean;
  disabled: boolean;
  onRemove: (target: KonnectTarget) => void;
}

// A record waiting to be Konnected: its korner's icon over its title. Not
// a link: following it would leave the composer.
const PendingTile: React.FC<PendingTileProps> = ({
  target,
  removable,
  disabled,
  onRemove,
}) => {
  const intl = useIntl();
  const KornerIcon = useKornerIcon(target.slug);
  const manifest = useKorner(target.slug);
  const title = target.title ?? manifest?.name ?? target.slug;

  const handleRemove = useCallback(() => {
    onRemove(target);
  }, [onRemove, target]);

  return (
    <li>
      <span className='space-tile space-tile--static'>
        <KornerIcon className='space-tile__glyph' />
        <span className='space-tile__name'>{title}</span>
      </span>

      {removable && (
        <button
          type='button'
          className='space-tile__remove'
          onClick={handleRemove}
          disabled={disabled}
          aria-label={intl.formatMessage(messages.drop, { title })}
          title={intl.formatMessage(messages.drop, { title })}
        >
          <Icon id='close' icon={CloseIcon} />
        </button>
      )}
    </li>
  );
};
