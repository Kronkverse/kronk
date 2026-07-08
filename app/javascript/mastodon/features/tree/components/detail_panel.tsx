import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';

import type {
  TreeNode,
  TreeComment,
  Readiness,
  Priority,
} from '../types';
import { READINESSES, PRIORITIES } from '../types';
import { createComment, fetchComments, updateNode, deleteNode } from '../api';
import { pathTo, branchColorFor } from '../helpers';

const messages = defineMessages({
  close: { id: 'tree.panel.close', defaultMessage: 'Close' },
  delete: { id: 'tree.panel.delete', defaultMessage: 'Delete' },
  confirmDelete: {
    id: 'tree.panel.confirm_delete',
    defaultMessage:
      'Delete this {kind, select, layer {sub-layer and everything under it} idea {idea} other {node}}?',
  },
  name: { id: 'tree.panel.name', defaultMessage: 'Name' },
  description: { id: 'tree.panel.description', defaultMessage: 'Description' },
  status: { id: 'tree.panel.status', defaultMessage: 'Readiness' },
  priority: { id: 'tree.panel.priority', defaultMessage: 'Priority' },
  framework: { id: 'tree.panel.framework', defaultMessage: 'Framework' },
  frameworkHint: {
    id: 'tree.panel.framework_hint',
    defaultMessage: 'Free-text spec. Keep it short and load-bearing.',
  },
  comments: { id: 'tree.panel.comments', defaultMessage: 'Discussion' },
  commentPlaceholder: {
    id: 'tree.panel.comment_placeholder',
    defaultMessage: 'Add to the discussion…',
  },
  post: { id: 'tree.panel.post', defaultMessage: 'Post' },
  saving: { id: 'tree.panel.saving', defaultMessage: 'Saving…' },
  saved: { id: 'tree.panel.saved', defaultMessage: 'Saved' },
});

interface Props {
  node: TreeNode;
  nodes: TreeNode[];
  onClose: () => void;
  onNodeUpdated: (node: TreeNode) => void;
  onNodeDeleted: (id: string) => void;
}

export const DetailPanel: React.FC<Props> = ({
  node,
  nodes,
  onClose,
  onNodeUpdated,
  onNodeDeleted,
}) => {
  const intl = useIntl();

  // Draft state — decoupled from the persisted node so unsaved edits stay
  // local until the user clicks Save.
  const [name, setName] = useState(node.name);
  const [description, setDescription] = useState(node.description);
  const [status, setStatus] = useState<Readiness | null>(node.status);
  const [priority, setPriority] = useState<Priority | null>(node.priority);
  const [framework, setFramework] = useState(node.framework ?? '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [comments, setComments] = useState<TreeComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Re-hydrate drafts when the selected node changes.
  useEffect(() => {
    setName(node.name);
    setDescription(node.description);
    setStatus(node.status);
    setPriority(node.priority);
    setFramework(node.framework ?? '');
    setSavedFlash(false);
  }, [node.id, node.name, node.description, node.status, node.priority, node.framework]);

  // Load comments lazily when a new node is selected.
  useEffect(() => {
    let cancelled = false;
    fetchComments(node.id)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id]);

  const dirty =
    name !== node.name ||
    description !== node.description ||
    status !== node.status ||
    priority !== node.priority ||
    (framework || null) !== (node.framework || null);

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const updated = await updateNode(node.id, {
        name,
        description,
        status: node.kind === 'idea' ? status : null,
        priority: node.kind === 'idea' ? priority : null,
        framework: node.kind === 'idea' ? framework || null : null,
      });
      onNodeUpdated(updated);
      setSavedFlash(true);
      window.setTimeout(() => {
        setSavedFlash(false);
      }, 1200);
    } finally {
      setSaving(false);
    }
  }, [
    dirty,
    saving,
    node.id,
    node.kind,
    name,
    description,
    status,
    priority,
    framework,
    onNodeUpdated,
  ]);

  const handleDelete = useCallback(async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(intl.formatMessage(messages.confirmDelete, { kind: node.kind }))) {
      return;
    }
    await deleteNode(node.id);
    onNodeDeleted(node.id);
  }, [intl, node.id, node.kind, onNodeDeleted]);

  const handlePostComment = useCallback(async () => {
    const body = commentDraft.trim();
    if (!body || postingComment) return;
    setPostingComment(true);
    try {
      const newComment = await createComment(node.id, body);
      setComments((prev) => [...prev, newComment]);
      setCommentDraft('');
    } finally {
      setPostingComment(false);
    }
  }, [commentDraft, postingComment, node.id]);

  const crumbs = pathTo(nodes, node.id)
    .slice(0, -1)
    .map((n) => n.name)
    .join(' › ');

  const accent = branchColorFor(nodes, node);

  return (
    <aside
      className='tree-panel'
      style={{ '--panel-accent': accent } as React.CSSProperties}
    >
      <header className='tree-panel__header'>
        <div className='tree-panel__crumbs'>{crumbs || ' '}</div>
        <button
          type='button'
          className='tree-panel__close'
          aria-label={intl.formatMessage(messages.close)}
          onClick={onClose}
        >
          <CloseIcon width={18} height={18} />
        </button>
      </header>

      <div className='tree-panel__body'>
        <label className='tree-panel__field'>
          <span className='tree-panel__label'>
            {intl.formatMessage(messages.name)}
          </span>
          <input
            type='text'
            className='tree-panel__input tree-panel__input--title serif'
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            maxLength={200}
          />
        </label>

        <label className='tree-panel__field'>
          <span className='tree-panel__label'>
            {intl.formatMessage(messages.description)}
          </span>
          <textarea
            className='tree-panel__input'
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            rows={3}
            maxLength={5000}
          />
        </label>

        {node.kind === 'idea' && (
          <>
            <div className='tree-panel__row'>
              <label className='tree-panel__field'>
                <span className='tree-panel__label'>
                  {intl.formatMessage(messages.status)}
                </span>
                <select
                  className='tree-panel__input'
                  value={status ?? ''}
                  onChange={(e) => {
                    setStatus((e.target.value || null) as Readiness | null);
                  }}
                >
                  <option value=''>—</option>
                  {READINESSES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className='tree-panel__field'>
                <span className='tree-panel__label'>
                  {intl.formatMessage(messages.priority)}
                </span>
                <select
                  className='tree-panel__input'
                  value={priority ?? ''}
                  onChange={(e) => {
                    setPriority((e.target.value || null) as Priority | null);
                  }}
                >
                  <option value=''>—</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className='tree-panel__field'>
              <span className='tree-panel__label'>
                {intl.formatMessage(messages.framework)}
              </span>
              <p className='tree-panel__hint'>
                {intl.formatMessage(messages.frameworkHint)}
              </p>
              <textarea
                className='tree-panel__input'
                value={framework}
                onChange={(e) => {
                  setFramework(e.target.value);
                }}
                rows={4}
                maxLength={20000}
              />
            </label>
          </>
        )}

        <div className='tree-panel__actions'>
          <button
            type='button'
            className='tree-panel__delete'
            onClick={handleDelete}
          >
            <DeleteIcon width={14} height={14} />
            <span>{intl.formatMessage(messages.delete)}</span>
          </button>
          <button
            type='button'
            className='tree-panel__save'
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving
              ? intl.formatMessage(messages.saving)
              : savedFlash
                ? intl.formatMessage(messages.saved)
                : (
                    <FormattedMessage id='tree.panel.save' defaultMessage='Save' />
                  )}
          </button>
        </div>

        <section className='tree-panel__comments'>
          <h4 className='tree-panel__section-title'>
            {intl.formatMessage(messages.comments)}
          </h4>
          <ul className='tree-panel__comment-list'>
            {comments.map((c) => (
              <li key={c.id} className='tree-panel__comment'>
                <span className='tree-panel__comment-author'>
                  @{c.account.acct}
                </span>
                <p className='tree-panel__comment-body'>{c.body}</p>
              </li>
            ))}
            {comments.length === 0 && (
              <li className='tree-panel__comment-empty'>
                <FormattedMessage
                  id='tree.panel.comments_empty'
                  defaultMessage='No discussion yet.'
                />
              </li>
            )}
          </ul>

          <div className='tree-panel__comment-composer'>
            <textarea
              className='tree-panel__input'
              value={commentDraft}
              onChange={(e) => {
                setCommentDraft(e.target.value);
              }}
              rows={2}
              placeholder={intl.formatMessage(messages.commentPlaceholder)}
              maxLength={5000}
            />
            <button
              type='button'
              className='tree-panel__comment-post'
              disabled={commentDraft.trim().length === 0 || postingComment}
              onClick={handlePostComment}
            >
              {intl.formatMessage(messages.post)}
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
};
