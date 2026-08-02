import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { ApiProfileCardJSON } from 'mastodon/api/profile_cards';
import { apiUpsertProfileCard } from 'mastodon/api/profile_cards';

import type { Reach } from './arrange_slab';
import { REACH_ORDER } from './arrange_slab';

// The told-card composer. Opens from Arrange mode (click a card's
// name, or add a preset from the Library) and lets the owner:
//
//   * pick the render shape — block / chips / rail
//   * write the body content (format hint changes with the render)
//   * pick a reach scope for this card
//   * toggle whether it's shown on the profile
//
// Body is the single text field for every render, matching the
// backend's decision (one column absorbs all shapes). Chip and rail
// parsers on the read side (shelf_told.tsx) handle the split.

const RENDER_SHAPES = ['block', 'chips', 'rail'] as const;

const messages = defineMessages({
  heading: {
    id: 'profile_shelves.composer.heading',
    defaultMessage: 'Write your card',
  },
  render: {
    id: 'profile_shelves.composer.render',
    defaultMessage: 'Shape',
  },
  renderBlock: {
    id: 'profile_shelves.composer.render_block',
    defaultMessage: 'Paragraphs',
  },
  renderChips: {
    id: 'profile_shelves.composer.render_chips',
    defaultMessage: 'Tag list',
  },
  renderRail: {
    id: 'profile_shelves.composer.render_rail',
    defaultMessage: 'Mini-cards',
  },
  body: {
    id: 'profile_shelves.composer.body',
    defaultMessage: 'Body',
  },
  hintBlock: {
    id: 'profile_shelves.composer.hint_block',
    defaultMessage: 'Free-form writing. Blank lines break paragraphs.',
  },
  hintChips: {
    id: 'profile_shelves.composer.hint_chips',
    defaultMessage: 'One tag per line, or comma separated.',
  },
  hintRail: {
    id: 'profile_shelves.composer.hint_rail',
    defaultMessage: 'One card per line: "Heading — Text".',
  },
  reach: {
    id: 'profile_shelves.composer.reach',
    defaultMessage: 'Who sees it',
  },
  reachEveryone: {
    id: 'profile_shelves.reach.everyone',
    defaultMessage: 'Everyone',
  },
  reachKronk: { id: 'profile_shelves.reach.kronk', defaultMessage: 'Kronk' },
  reachConnections: {
    id: 'profile_shelves.reach.connections',
    defaultMessage: 'Connections',
  },
  reachVouched: {
    id: 'profile_shelves.reach.vouched',
    defaultMessage: 'Vouched',
  },
  reachOnlyMe: {
    id: 'profile_shelves.reach.only_me',
    defaultMessage: 'Only me',
  },
  visible: {
    id: 'profile_shelves.composer.visible',
    defaultMessage: 'Show on profile',
  },
  save: {
    id: 'profile_shelves.composer.save',
    defaultMessage: 'Save',
  },
  cancel: {
    id: 'profile_shelves.composer.cancel',
    defaultMessage: 'Cancel',
  },
  saving: {
    id: 'profile_shelves.composer.saving',
    defaultMessage: 'Saving…',
  },
});

const REACH_MESSAGES: Record<Reach, keyof typeof messages> = {
  everyone: 'reachEveryone',
  kronk: 'reachKronk',
  connections: 'reachConnections',
  vouched: 'reachVouched',
  only_me: 'reachOnlyMe',
};

const RENDER_MESSAGES: Record<(typeof RENDER_SHAPES)[number], keyof typeof messages> = {
  block: 'renderBlock',
  chips: 'renderChips',
  rail: 'renderRail',
};

const HINT_MESSAGES: Record<(typeof RENDER_SHAPES)[number], keyof typeof messages> = {
  block: 'hintBlock',
  chips: 'hintChips',
  rail: 'hintRail',
};

interface TellComposerProps {
  cardType: string;
  cardTitle: string;
  initial: ApiProfileCardJSON | null;
  onSaved: (card: ApiProfileCardJSON) => void;
  onCancel: () => void;
}

interface RenderPickerProps {
  value: (typeof RENDER_SHAPES)[number];
  onSelect: (value: (typeof RENDER_SHAPES)[number]) => void;
}

const RenderPicker: React.FC<RenderPickerProps> = ({ value, onSelect }) => {
  const intl = useIntl();
  return (
    <div className='profile-shelves__composer-picker'>
      {RENDER_SHAPES.map((shape) => (
        <RenderPickerOption
          key={shape}
          shape={shape}
          label={intl.formatMessage(messages[RENDER_MESSAGES[shape]])}
          active={value === shape}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

interface RenderPickerOptionProps {
  shape: (typeof RENDER_SHAPES)[number];
  label: string;
  active: boolean;
  onSelect: (value: (typeof RENDER_SHAPES)[number]) => void;
}

const RenderPickerOption: React.FC<RenderPickerOptionProps> = ({
  shape,
  label,
  active,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(shape);
  }, [onSelect, shape]);
  return (
    <button
      type='button'
      className={`profile-shelves__composer-pill${active ? ' profile-shelves__composer-pill--active' : ''}`}
      aria-pressed={active}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

interface ReachPickerProps {
  value: Reach;
  onSelect: (value: Reach) => void;
}

const ReachPicker: React.FC<ReachPickerProps> = ({ value, onSelect }) => {
  const intl = useIntl();
  return (
    <div className='profile-shelves__composer-picker'>
      {REACH_ORDER.map((reach) => (
        <ReachPickerOption
          key={reach}
          reach={reach}
          label={intl.formatMessage(messages[REACH_MESSAGES[reach]])}
          active={value === reach}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

interface ReachPickerOptionProps {
  reach: Reach;
  label: string;
  active: boolean;
  onSelect: (value: Reach) => void;
}

const ReachPickerOption: React.FC<ReachPickerOptionProps> = ({
  reach,
  label,
  active,
  onSelect,
}) => {
  const handleClick = useCallback(() => {
    onSelect(reach);
  }, [onSelect, reach]);
  return (
    <button
      type='button'
      className={`profile-shelves__composer-pill profile-shelves__composer-pill--reach-${reach}${active ? ' profile-shelves__composer-pill--active' : ''}`}
      aria-pressed={active}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

export const TellComposer: React.FC<TellComposerProps> = ({
  cardType,
  cardTitle,
  initial,
  onSaved,
  onCancel,
}) => {
  const intl = useIntl();

  const [render, setRender] = useState<(typeof RENDER_SHAPES)[number]>(() => {
    const initialRender = initial?.render;
    return (RENDER_SHAPES as readonly string[]).includes(initialRender ?? '')
      ? (initialRender as (typeof RENDER_SHAPES)[number])
      : 'block';
  });
  const [body, setBody] = useState(initial?.body ?? '');
  const [reach, setReach] = useState<Reach>(initial?.visibility ?? 'kronk');
  const [visible, setVisible] = useState(initial?.visible ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.currentTarget.value);
    },
    [],
  );
  const handleVisibleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setVisible(e.currentTarget.checked);
    },
    [],
  );

  const handleSave = useCallback(() => {
    setSaving(true);
    setError(false);
    void apiUpsertProfileCard(cardType, {
      body,
      render,
      visibility: reach,
      visible,
    })
      .then((saved) => {
        setSaving(false);
        onSaved(saved);
      })
      .catch(() => {
        setSaving(false);
        setError(true);
      });
  }, [body, cardType, onSaved, reach, render, visible]);

  return (
    <div
      className='profile-shelves__composer-scrim'
      role='dialog'
      aria-modal
      aria-label={cardTitle}
    >
      <div className='profile-shelves__composer'>
        <header className='profile-shelves__composer-head'>
          <div className='profile-shelves__composer-kicker'>
            {intl.formatMessage(messages.heading)}
          </div>
          <h2 className='profile-shelves__composer-title'>{cardTitle}</h2>
        </header>

        <div className='profile-shelves__composer-section'>
          <label className='profile-shelves__composer-label'>
            {intl.formatMessage(messages.render)}
          </label>
          <RenderPicker value={render} onSelect={setRender} />
        </div>

        <div className='profile-shelves__composer-section'>
          <label
            className='profile-shelves__composer-label'
            htmlFor='profile-shelves-composer-body'
          >
            {intl.formatMessage(messages.body)}
          </label>
          <textarea
            id='profile-shelves-composer-body'
            className='profile-shelves__composer-body'
            value={body}
            onChange={handleBodyChange}
            rows={render === 'block' ? 8 : 6}
            maxLength={4000}
            disabled={saving}
          />
          <div className='profile-shelves__composer-hint'>
            {intl.formatMessage(messages[HINT_MESSAGES[render]])}
          </div>
        </div>

        <div className='profile-shelves__composer-section'>
          <label className='profile-shelves__composer-label'>
            {intl.formatMessage(messages.reach)}
          </label>
          <ReachPicker value={reach} onSelect={setReach} />
        </div>

        <div className='profile-shelves__composer-section profile-shelves__composer-inline'>
          <label className='profile-shelves__composer-checkbox'>
            <input
              type='checkbox'
              checked={visible}
              onChange={handleVisibleChange}
              disabled={saving}
            />
            <span>{intl.formatMessage(messages.visible)}</span>
          </label>
        </div>

        {error && (
          <div className='profile-shelves__composer-error' role='alert'>
            {intl.formatMessage(messages.saving)}
          </div>
        )}

        <div className='profile-shelves__composer-actions'>
          <button
            type='button'
            className='profile-shelves__composer-cancel'
            onClick={onCancel}
            disabled={saving}
          >
            {intl.formatMessage(messages.cancel)}
          </button>
          <button
            type='button'
            className='profile-shelves__composer-save'
            onClick={handleSave}
            disabled={saving}
          >
            {intl.formatMessage(saving ? messages.saving : messages.save)}
          </button>
        </div>
      </div>
    </div>
  );
};
