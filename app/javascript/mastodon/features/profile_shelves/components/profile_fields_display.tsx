import { useState, useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import LinkIcon from '@/material-icons/400-24px/link.svg?react';
import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import { Icon } from 'mastodon/components/icon';
import { unescapeHTML } from 'mastodon/utils/html';

import type { FieldAnswerType } from '../profile_field_catalog';
import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

// Read-side render of the structured profile fields. Calm + typed: each field
// renders as the thing it means rather than a wall of identical boxes —
// chips become pills, links become a link chip, long answers clamp until
// asked to open, everything else is quiet inline text. Borderless on a plain
// ground so the values (not their frames) carry the visual weight. Only
// filled fields show. Non-field told cards + drawn korner sections still
// render as shelves in ShelvesStack.

const messages = defineMessages({
  heading: {
    id: 'profile_shelves.fields.heading',
    defaultMessage: 'Profile fields',
  },
  more: { id: 'profile_shelves.fields.more', defaultMessage: 'Show more' },
  less: { id: 'profile_shelves.fields.less', defaultMessage: 'Show less' },
});

// chips: split the plain-text body on commas / newlines into tags.
const toChips = (text: string): string[] =>
  text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const linkHref = (raw: string): string =>
  /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

// Strip protocol / www / trailing slash so the chip shows a clean domain.
const linkLabel = (raw: string): string =>
  raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');

// Long answers clamp until asked to expand; short ones never show a toggle.
const CLAMP_AT = 220;

const LongtextValue: React.FC<{ html: string }> = ({ html }) => {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => {
    setExpanded((value) => !value);
  }, []);
  const overflows = unescapeHTML(html).length > CLAMP_AT;

  return (
    <div className='profile-fields-display__long'>
      <div
        className={classNames('profile-fields-display__longbody', {
          'profile-fields-display__longbody--clamped': overflows && !expanded,
        })}
        // Sanitised HTML from the serializer — same as ShelfTold's block.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflows && (
        <button
          type='button'
          className='profile-fields-display__more'
          onClick={toggle}
        >
          {intl.formatMessage(expanded ? messages.less : messages.more)}
        </button>
      )}
    </div>
  );
};

const FieldValue: React.FC<{ answerType: FieldAnswerType; body: string }> = ({
  answerType,
  body,
}) => {
  if (answerType === 'longtext') {
    return <LongtextValue html={body} />;
  }

  const text = unescapeHTML(body);

  if (answerType === 'chips') {
    return (
      <div className='profile-fields-display__pills'>
        {toChips(text).map((chip) => (
          <span className='profile-fields-display__pill' key={chip}>
            {chip}
          </span>
        ))}
      </div>
    );
  }

  if (answerType === 'link') {
    return (
      <a
        className='profile-fields-display__link'
        href={linkHref(text)}
        target='_blank'
        rel='noopener noreferrer'
      >
        <Icon
          id=''
          icon={LinkIcon}
          className='profile-fields-display__link-icon'
        />
        <span>{linkLabel(text)}</span>
      </a>
    );
  }

  return <span className='profile-fields-display__text'>{text}</span>;
};

interface ProfileFieldsDisplayProps {
  cards: ApiProfileCardJSON[];
}

export const ProfileFieldsDisplay: React.FC<ProfileFieldsDisplayProps> = ({
  cards,
}) => {
  const intl = useIntl();

  const fields = cards.flatMap((card) => {
    const def = PROFILE_FIELD_BY_KEY[card.card_type];
    return def && card.body.trim().length > 0 ? [{ card, def }] : [];
  });

  if (fields.length === 0) return null;

  return (
    <section className='profile-fields-display'>
      <h3 className='profile-fields-display__heading'>
        {intl.formatMessage(messages.heading)}
      </h3>
      <div className='profile-fields-display__grid'>
        {fields.map(({ card, def }) => (
          <div
            className={classNames('profile-fields-display__field', {
              'profile-fields-display__field--wide':
                def.answerType === 'longtext' || def.answerType === 'chips',
            })}
            key={card.id}
          >
            <span className='profile-fields-display__label'>{def.label}</span>
            <FieldValue answerType={def.answerType} body={card.body} />
          </div>
        ))}
      </div>
    </section>
  );
};
