import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiCreateKommonsProposal } from 'mastodon/api/kommons_nodes';

import type { KommonsNode } from '../data/nodes';

const messages = defineMessages({
  heading: {
    id: 'kommons_tree.composer.heading',
    defaultMessage: 'Plant feedback on \u201c{label}\u201d',
  },
  hint: {
    id: 'kommons_tree.composer.hint',
    defaultMessage: 'Becomes a Kommons proposal tagged with this page.',
  },
  titleLabel: { id: 'kommons_tree.composer.title_label', defaultMessage: 'Title' },
  titlePlaceholder: { id: 'kommons_tree.composer.title_placeholder', defaultMessage: 'A short summary' },
  bodyLabel: { id: 'kommons_tree.composer.body_label', defaultMessage: 'Details' },
  bodyPlaceholder: { id: 'kommons_tree.composer.body_placeholder', defaultMessage: 'What did you see? What did you expect?' },
  cancel: { id: 'kommons_tree.composer.cancel', defaultMessage: 'Cancel' },
  submit: { id: 'kommons_tree.composer.submit', defaultMessage: 'Plant it' },
  submitting: { id: 'kommons_tree.composer.submitting', defaultMessage: 'Planting\u2026' },
  success: {
    id: 'kommons_tree.composer.success',
    defaultMessage: 'Planted. It\u2019s now open on Kommons.',
  },
  error: {
    id: 'kommons_tree.composer.error',
    defaultMessage: 'Could not plant that. Try again.',
  },
  nodeLabel: { id: 'kommons_tree.composer.node_label', defaultMessage: 'Page' },
});

interface Props {
  node: KommonsNode;
  onSuccess: () => void;
  onDismiss: () => void;
}

export const Composer: React.FC<Props> = ({ node, onSuccess, onDismiss }) => {
  const intl = useIntl();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleTitleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>((e) => {
    setTitle(e.target.value);
  }, []);
  const handleBodyChange = useCallback<React.ChangeEventHandler<HTMLTextAreaElement>>((e) => {
    setBody(e.target.value);
  }, []);

  const handleSubmit = useCallback<React.FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !body.trim()) return;

    setSubmitting(true);
    setErrored(false);

    apiCreateKommonsProposal({
      title: title.trim(),
      body: body.trim(),
      node_id: node.id,
      proposal_type: 'small',
    })
      .then(() => {
        setSubmitting(false);
        onSuccess();
      })
      .catch(() => {
        setSubmitting(false);
        setErrored(true);
      });
  }, [title, body, node.id, submitting, onSuccess]);

  return (
    <div className='kommons-tree__composer' role='dialog' aria-modal='true'>
      <form onSubmit={handleSubmit}>
        <h3 className='kommons-tree__composer-heading'>
          {intl.formatMessage(messages.heading, { label: node.label })}
        </h3>
        <p className='kommons-tree__composer-hint'>{intl.formatMessage(messages.hint)}</p>

        <dl className='kommons-tree__composer-node'>
          <dt>{intl.formatMessage(messages.nodeLabel)}</dt>
          <dd><code>{node.id}</code>{' \u00b7 '}<code>{node.url}</code></dd>
        </dl>

        <label className='kommons-tree__composer-field'>
          <span>{intl.formatMessage(messages.titleLabel)}</span>
          <input
            type='text'
            value={title}
            onChange={handleTitleChange}
            placeholder={intl.formatMessage(messages.titlePlaceholder)}
            maxLength={240}
            required
          />
        </label>

        <label className='kommons-tree__composer-field'>
          <span>{intl.formatMessage(messages.bodyLabel)}</span>
          <textarea
            value={body}
            onChange={handleBodyChange}
            placeholder={intl.formatMessage(messages.bodyPlaceholder)}
            rows={4}
            required
          />
        </label>

        {errored && (
          <p className='kommons-tree__composer-error'>{intl.formatMessage(messages.error)}</p>
        )}

        <div className='kommons-tree__composer-actions'>
          <button type='button' className='button button-secondary' onClick={onDismiss}>
            {intl.formatMessage(messages.cancel)}
          </button>
          <button type='submit' className='button' disabled={submitting || !title.trim() || !body.trim()}>
            {submitting ? intl.formatMessage(messages.submitting) : intl.formatMessage(messages.submit)}
          </button>
        </div>
      </form>
    </div>
  );
};
