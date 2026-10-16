import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Icon } from 'mastodon/components/icon';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

// SpaceInfoDialog — the i moon's pop-up. A centred box telling a member
// what the space they are in is for: what it is, why it is here, how it
// works. Every word comes from the space's manifest (`about:`), so filling
// in a space is a YAML edit, not a client change.
//
// A space with no `about:` yet still says something: its tagline under the
// name, its `purpose` as the why. Sections with nothing to say are left
// out rather than shown empty.
//
// Portal-mounted with a dim backdrop, like `<ConfirmDialog>`; Escape, the
// backdrop and Close all dismiss it.

const messages = defineMessages({
  what: { id: 'space_info.what', defaultMessage: 'What it is' },
  why: { id: 'space_info.why', defaultMessage: 'Why it’s here' },
  how: { id: 'space_info.how', defaultMessage: 'How it works' },
  close: { id: 'space_info.close', defaultMessage: 'Close' },
});

interface Props {
  slug: string;
  onClose: () => void;
}

export const SpaceInfoDialog: React.FC<Props> = ({ slug, onClose }) => {
  const intl = useIntl();
  const korner = useKorner(slug);
  const icon = useKornerIcon(slug);
  const closeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Focus Close so the keyboard lands inside the box.
  useEffect(() => {
    closeRef.current?.querySelector('button')?.focus();
  }, []);

  if (!korner) return null;

  const about = korner.about ?? {};
  const why = about.why ?? korner.purpose ?? null;
  const how = about.how ?? [];

  return createPortal(
    <div
      className='space-info'
      role='dialog'
      aria-modal='true'
      aria-labelledby='space-info__title'
    >
      <button
        type='button'
        className='space-info__backdrop'
        onClick={onClose}
        aria-label={intl.formatMessage(messages.close)}
      />
      <div className='space-info__panel'>
        <header className='space-info__head'>
          <Icon id={slug} icon={icon} className='space-info__icon' />
          <h2 id='space-info__title' className='space-info__title'>
            {korner.name}
          </h2>
          {korner.tagline && (
            <p className='space-info__tagline'>{korner.tagline}</p>
          )}
        </header>

        <div className='space-info__body'>
          {about.what && (
            <section className='space-info__section'>
              <h3 className='space-info__heading'>
                <FormattedMessage {...messages.what} />
              </h3>
              <p className='space-info__text'>{about.what}</p>
            </section>
          )}

          {why && (
            <section className='space-info__section'>
              <h3 className='space-info__heading'>
                <FormattedMessage {...messages.why} />
              </h3>
              <p className='space-info__text'>{why}</p>
            </section>
          )}

          {how.length > 0 && (
            <section className='space-info__section'>
              <h3 className='space-info__heading'>
                <FormattedMessage {...messages.how} />
              </h3>
              <ul className='space-info__steps'>
                {how.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className='space-info__actions' ref={closeRef}>
          <KornerPill
            label={intl.formatMessage(messages.close)}
            onClick={onClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
