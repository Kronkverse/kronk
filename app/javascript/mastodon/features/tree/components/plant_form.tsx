import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import type { NodeKind, TreeNode } from '../types';
import { createNode } from '../api';

const messages = defineMessages({
  ideaPlaceholder: {
    id: 'tree.plant.idea_placeholder',
    defaultMessage: 'Name an idea to plant here…',
  },
  layerPlaceholder: {
    id: 'tree.plant.layer_placeholder',
    defaultMessage: 'Name a new sub-layer…',
  },
  planting: {
    id: 'tree.plant.planting',
    defaultMessage: 'Planting…',
  },
  plant: {
    id: 'tree.plant.submit',
    defaultMessage: 'Plant',
  },
});

interface Props {
  parent: TreeNode;
  kind: NodeKind;
  onCreated: (node: TreeNode) => void;
  onCancel: () => void;
}

export const PlantForm: React.FC<Props> = ({ parent, kind, onCreated, onCancel }) => {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || submitting) return;
      setSubmitting(true);
      try {
        const node = await createNode({
          parent_id: parent.id,
          kind,
          name: trimmed,
        });
        onCreated(node);
        setName('');
      } finally {
        setSubmitting(false);
      }
    },
    [name, submitting, parent.id, kind, onCreated],
  );

  const placeholder = kind === 'idea' ? messages.ideaPlaceholder : messages.layerPlaceholder;

  return (
    <form
      className={`tree-plant tree-plant--${kind}`}
      onSubmit={handleSubmit}
    >
      <input
        ref={inputRef}
        type='text'
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
        placeholder={intl.formatMessage(placeholder)}
        maxLength={200}
        className='tree-plant__input'
      />
      <button
        type='submit'
        className='tree-plant__submit'
        disabled={name.trim().length === 0 || submitting}
      >
        {submitting
          ? intl.formatMessage(messages.planting)
          : intl.formatMessage(messages.plant)}
      </button>
      <button
        type='button'
        className='tree-plant__cancel'
        onClick={onCancel}
      >
        ×
      </button>
    </form>
  );
};
