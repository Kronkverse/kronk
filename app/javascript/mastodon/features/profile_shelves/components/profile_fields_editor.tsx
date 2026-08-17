import { useState, useEffect, useCallback, useMemo } from 'react';

import { useIntl, defineMessages } from 'react-intl';

import classNames from 'classnames';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import {
  apiGetOwnProfileCards,
  apiUpsertProfileCard,
  apiDeleteProfileCard,
} from 'mastodon/api/profile_cards';
import { unescapeHTML } from 'mastodon/utils/html';

import type { ProfileFieldDef } from '../profile_field_catalog';
import { PROFILE_FIELD_BY_KEY } from '../profile_field_catalog';

import { FieldPicker } from './field_picker';

// The "Profile fields" area of the identity editor — the structured fields
// that replaced the freeform told cards. Shows the fields the owner has
// added, each with an answer input keyed to its catalog `answerType`, and an
// "Add fields" button that opens the pop-up grid. Fields are stored as
// profile_cards (card_type = the field key, answer in `body`); answers
// auto-save on blur, matching the rest of the identity editor.

const messages = defineMessages({
  heading: { id: 'profile.fields.heading', defaultMessage: 'Profile fields' },
  add: { id: 'profile.fields.add', defaultMessage: 'Add fields' },
  empty: {
    id: 'profile.fields.empty',
    defaultMessage: 'No fields yet — add a few to tell people about you.',
  },
  remove: { id: 'profile.fields.remove', defaultMessage: 'Remove' },
  chipsHint: {
    id: 'profile.fields.chips_hint',
    defaultMessage: 'comma, separated',
  },
  pairHint: { id: 'profile.fields.pair_hint', defaultMessage: 'she / her' },
  linkHint: { id: 'profile.fields.link_hint', defaultMessage: 'https://…' },
});

// chips render client-tokenises a comma/newline body; everything else is a
// plain block.
const renderFor = (field: ProfileFieldDef) =>
  field.answerType === 'chips' ? 'chips' : 'block';

interface FieldRowProps {
  field: ProfileFieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
  onSave: (key: string) => void;
  onRemove: (key: string) => void;
}

const FieldRow: React.FC<FieldRowProps> = ({
  field,
  value,
  onChange,
  onSave,
  onRemove,
}) => {
  const intl = useIntl();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(field.key, e.target.value);
    },
    [onChange, field.key],
  );
  const handleBlur = useCallback(() => {
    onSave(field.key);
  }, [onSave, field.key]);
  const handleRemove = useCallback(() => {
    onRemove(field.key);
  }, [onRemove, field.key]);

  const placeholder =
    field.answerType === 'chips'
      ? intl.formatMessage(messages.chipsHint)
      : field.answerType === 'pair'
        ? intl.formatMessage(messages.pairHint)
        : field.answerType === 'link'
          ? intl.formatMessage(messages.linkHint)
          : field.label;

  return (
    <div
      className={classNames('profile-fields-editor__row', {
        'profile-fields-editor__row--wide': field.answerType === 'longtext',
      })}
    >
      <div className='profile-fields-editor__row-head'>
        <span className='profile-fields-editor__label'>{field.label}</span>
        <button
          type='button'
          className='profile-fields-editor__remove'
          onClick={handleRemove}
          aria-label={intl.formatMessage(messages.remove)}
          title={intl.formatMessage(messages.remove)}
        >
          ×
        </button>
      </div>
      {field.answerType === 'longtext' ? (
        <textarea
          className='profile-fields-editor__input'
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          maxLength={4000}
          placeholder={placeholder}
        />
      ) : (
        <input
          className='profile-fields-editor__input'
          type={field.answerType === 'link' ? 'url' : 'text'}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={255}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

export const ProfileFieldsEditor: React.FC = () => {
  const intl = useIntl();

  const [cards, setCards] = useState<ApiProfileCardJSON[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiGetOwnProfileCards()
      .then((data) => {
        if (cancelled) return undefined;
        setCards(data);
        const next: Record<string, string> = {};
        data.forEach((c) => {
          // `body` comes back as the serializer's sanitised HTML
          // (`<p>…</p>`); the inputs edit plain text, so unwrap it — same
          // treatment the identity editor gives the bio.
          if (PROFILE_FIELD_BY_KEY[c.card_type])
            next[c.card_type] = unescapeHTML(c.body);
        });
        setDrafts(next);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The catalog fields currently on the profile, in card-position order.
  const selected = useMemo(
    () =>
      [...(cards ?? [])]
        .sort((a, b) => a.position - b.position)
        .flatMap((c) => {
          const def = PROFILE_FIELD_BY_KEY[c.card_type];
          return def ? [def] : [];
        }),
    [cards],
  );

  const selectedKeys = useMemo(
    () => new Set(selected.map((f) => f.key)),
    [selected],
  );

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleChange = useCallback((key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(
    (key: string) => {
      const field = PROFILE_FIELD_BY_KEY[key];
      if (!field) return;
      const body = drafts[key] ?? '';
      void apiUpsertProfileCard(key, { body, render: renderFor(field) })
        .then((saved) => {
          setCards((prev) =>
            (prev ?? []).map((c) => (c.card_type === key ? saved : c)),
          );
          return undefined;
        })
        .catch(() => undefined);
    },
    [drafts],
  );

  const handleToggle = useCallback((key: string, on: boolean): void => {
    const field = PROFILE_FIELD_BY_KEY[key];
    if (!field) return;
    if (on) {
      void apiUpsertProfileCard(key, {
        body: '',
        render: renderFor(field),
        visible: true,
      })
        .then((created) => {
          setCards((prev) => {
            const list = prev ?? [];
            return list.some((c) => c.card_type === key)
              ? list.map((c) => (c.card_type === key ? created : c))
              : [...list, created];
          });
          setDrafts((prev) => ({ ...prev, [key]: created.body }));
          return undefined;
        })
        .catch(() => undefined);
    } else {
      void apiDeleteProfileCard(key)
        .then(() => {
          setCards((prev) => (prev ?? []).filter((c) => c.card_type !== key));
          return undefined;
        })
        .catch(() => undefined);
    }
  }, []);

  // FieldRow's onRemove is keyed; removing a field is toggling it off.
  const handleRemove = useCallback(
    (key: string) => {
      handleToggle(key, false);
    },
    [handleToggle],
  );

  return (
    <div className='profile-fields-editor'>
      <div className='profile-fields-editor__head'>
        <p className='profile-fields-editor__heading'>
          {intl.formatMessage(messages.heading)}
        </p>
        <button
          type='button'
          className='profile-fields-editor__add'
          onClick={openPicker}
        >
          {intl.formatMessage(messages.add)}
        </button>
      </div>

      {selected.length > 0 ? (
        <div className='profile-fields-editor__grid'>
          {selected.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={drafts[field.key] ?? ''}
              onChange={handleChange}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : (
        <p className='profile-fields-editor__empty'>
          {intl.formatMessage(messages.empty)}
        </p>
      )}

      {pickerOpen && (
        <FieldPicker
          selectedKeys={selectedKeys}
          onToggle={handleToggle}
          onClose={closePicker}
        />
      )}
    </div>
  );
};
