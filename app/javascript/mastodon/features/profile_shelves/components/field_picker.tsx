import { useCallback } from 'react';
import { createPortal } from 'react-dom';

import { useIntl, defineMessages } from 'react-intl';

import type { ProfileFieldDef } from '../profile_field_catalog';
import {
  PROFILE_FIELD_CATALOG,
  PROFILE_FIELD_GROUPS,
} from '../profile_field_catalog';

// The field pop-up: a grouped checkbox grid of the catalog fields. Ticking a
// tile adds that field to the profile; unticking removes it. Presentational —
// the parent owns the selected set + the add/remove calls. The trailing custom
// tile is a placeholder until custom fields (own label + a `label` column)
// land.

const messages = defineMessages({
  title: { id: 'profile.fields.picker.title', defaultMessage: 'Add fields' },
  done: { id: 'profile.fields.picker.done', defaultMessage: 'Done' },
  custom: {
    id: 'profile.fields.picker.custom',
    defaultMessage: 'Custom field — coming soon',
  },
});

interface TileProps {
  field: ProfileFieldDef;
  checked: boolean;
  onToggle: (key: string, on: boolean) => void;
}

const FieldTile: React.FC<TileProps> = ({ field, checked, onToggle }) => {
  const handleClick = useCallback(() => {
    onToggle(field.key, !checked);
  }, [onToggle, field.key, checked]);

  return (
    <button
      type='button'
      className='field-picker__tile'
      role='checkbox'
      aria-checked={checked}
      onClick={handleClick}
    >
      <span className='field-picker__tile-check' aria-hidden='true'>
        {checked ? '✓' : null}
      </span>
      <span className='field-picker__tile-label'>{field.label}</span>
    </button>
  );
};

interface FieldPickerProps {
  selectedKeys: Set<string>;
  onToggle: (key: string, on: boolean) => void;
  onClose: () => void;
}

export const FieldPicker: React.FC<FieldPickerProps> = ({
  selectedKeys,
  onToggle,
  onClose,
}) => {
  const intl = useIntl();

  // Portal to document.body — the picker opens from the profile Arrange
  // surface, which sits inside the transformed Kronk Stage; a nested
  // `position: fixed` overlay is contained by that ancestor (the backdrop
  // darkened but the panel never showed). Rendering at the document root,
  // like the composer's AttachmentPicker, makes it a true modal overlay.
  return createPortal(
    <div className='field-picker'>
      <button
        type='button'
        className='field-picker__backdrop'
        aria-label={intl.formatMessage(messages.done)}
        onClick={onClose}
      />
      <div
        className='field-picker__panel'
        role='dialog'
        aria-label={intl.formatMessage(messages.title)}
      >
        <div className='field-picker__header'>
          <h2 className='field-picker__title'>
            {intl.formatMessage(messages.title)}
          </h2>
          <button
            type='button'
            className='field-picker__done'
            onClick={onClose}
          >
            {intl.formatMessage(messages.done)}
          </button>
        </div>

        <div className='field-picker__body'>
          {PROFILE_FIELD_GROUPS.map((group) => (
            <div className='field-picker__group' key={group}>
              <p className='field-picker__group-heading'>{group}</p>
              <div className='field-picker__grid'>
                {PROFILE_FIELD_CATALOG.filter((f) => f.group === group).map(
                  (field) => (
                    <FieldTile
                      key={field.key}
                      field={field}
                      checked={selectedKeys.has(field.key)}
                      onToggle={onToggle}
                    />
                  ),
                )}
              </div>
            </div>
          ))}

          <div className='field-picker__grid'>
            <span className='field-picker__tile field-picker__tile--custom'>
              <span className='field-picker__tile-check' aria-hidden='true'>
                +
              </span>
              <span className='field-picker__tile-label'>
                {intl.formatMessage(messages.custom)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
