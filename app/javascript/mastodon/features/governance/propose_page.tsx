import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import {
  apiCreateKommonsProposal,
  apiCreateProposalTask,
  apiGetKommonsNodes,
} from 'mastodon/api/kommons_nodes';
import { Stage } from 'mastodon/components/stage';
import { useKorner } from 'mastodon/hooks/useKorner';

const messages = defineMessages({
  title: { id: 'propose.title', defaultMessage: 'Open a Proposal' },
  titlePlaceholder: {
    id: 'propose.title_placeholder',
    defaultMessage: 'A short, clear title',
  },
  bodyPlaceholder: {
    id: 'propose.body_placeholder',
    defaultMessage: 'What should change, and why?',
  },
  summaryPlaceholder: {
    id: 'propose.summary_placeholder',
    defaultMessage: 'One line that sums it up',
  },
  stepPlaceholder: {
    id: 'propose.step_placeholder',
    defaultMessage: 'A step to complete',
  },
  removeStep: { id: 'propose.remove_step', defaultMessage: 'Remove step' },
  removeDoc: { id: 'propose.remove_doc', defaultMessage: 'Remove document' },
});

// Plant a proposal (Kommons' native "compose"). Reached from the Ӂ menu or a
// Space page's button. When opened with ?space=<slug> it scopes the proposal
// to that space, anchoring it to the space's index node so it lands on the
// Space page and the Kommons tree. Without a space it's an unscoped proposal.
const ProposePage: React.FC<{ multiColumn?: boolean }> = () => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();

  // Scope: `?space=<slug>` targets a korner (anchors to its index node);
  // `?node=<id>` targets an exact page-node (the meta-page "propose" path).
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const space = params.get('space') ?? '';
  const nodeId = params.get('node') ?? '';
  const korner = useKorner(space);
  // The real registered nodes, so we anchor to one that actually exists.
  const [nodeIds, setNodeIds] = useState<Set<string>>(() => new Set());
  const [nodeLabels, setNodeLabels] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let active = true;
    apiGetKommonsNodes()
      .then((res) => {
        if (active) {
          setNodeIds(new Set(res.nodes.map((n) => n.id)));
          setNodeLabels(new Map(res.nodes.map((n) => [n.id, n.label])));
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Resolve the anchor node robustly against the registry. `?node=` uses that
  // node (if it exists); `?space=` prefers `<slug>.index` but many spaces have
  // no index node (pillars: feed/profile/settings…), so fall back to the space's
  // first real node, then to unscoped — never send an unregistered node_id (the
  // model rejects it with a 422).
  const targetNodeId = useMemo(() => {
    if (nodeId) return nodeIds.has(nodeId) ? nodeId : undefined;
    if (space) {
      const idx = `${space}.index`;
      if (nodeIds.has(idx)) return idx;
      const prefix = `${space}.`;
      for (const id of nodeIds) if (id.startsWith(prefix)) return id;
    }
    return undefined;
  }, [nodeId, space, nodeIds]);

  // While the node list is still loading, don't submit an unresolved scope.
  const resolving = Boolean((nodeId || space) && nodeIds.size === 0);
  const scoped = Boolean(nodeId || space);
  const scopeName = nodeId
    ? (nodeLabels.get(nodeId) ?? nodeId)
    : space
      ? (korner?.name ?? space)
      : '';

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  // The steps: an extendable list, each becomes a Task on the new proposal.
  // Start with one empty row so the affordance is visible.
  const [steps, setSteps] = useState<string[]>(['']);
  // Design docs staged locally; uploaded to the proposal once it's created.
  const [docs, setDocs] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !submitting &&
    !resolving;

  const handleStepChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const i = Number(e.currentTarget.dataset.index);
      const value = e.target.value;
      setSteps((prev) => prev.map((s, idx) => (idx === i ? value : s)));
    },
    [],
  );
  const addStep = useCallback(() => {
    setSteps((prev) => [...prev, '']);
  }, []);
  const removeStep = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const i = Number(e.currentTarget.dataset.index);
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );
  const handleSummaryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSummary(e.target.value);
    },
    [],
  );
  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );
  const handleDocs = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) setDocs((prev) => [...prev, ...picked]);
    e.target.value = '';
  }, []);
  const removeDoc = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const i = Number(e.currentTarget.dataset.index);
    setDocs((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
      apiCreateKommonsProposal({
        title: title.trim(),
        body: body.trim(),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
        // Anchor to the scoped node so it lands on that page's meta page and
        // the tree. Unscoped proposals carry no node.
        ...(targetNodeId ? { node_id: targetNodeId } : {}),
      })
        .then(async (created) => {
          // Steps become Tasks; staged design docs upload as attachments. The
          // attachment route is nested under a persisted proposal, so it must
          // run after create. Best-effort — a failure here doesn't lose the
          // proposal, which already exists.
          for (const step of cleanSteps) {
            await apiCreateProposalTask(created.id, step);
          }
          for (const file of docs) {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', 'reference');
            await api().post(
              `/api/v1/proposals/${created.id}/attachments`,
              form,
            );
          }
          history.push(`/hub/kommons/p/${created.id}`);
          return undefined;
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not plant the proposal.',
          );
          setSubmitting(false);
        });
    },
    [canSubmit, title, body, summary, steps, docs, targetNodeId, history],
  );

  return (
    <Stage label={intl.formatMessage(messages.title)}>
      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
      </Helmet>

      <form className='propose-page' onSubmit={handleSubmit}>
        <header className='propose-page__hero'>
          <h1 className='propose-page__title'>
            {scoped ? (
              <FormattedMessage
                id='propose.heading_scoped'
                defaultMessage='Propose a change to {space}'
                values={{ space: scopeName }}
              />
            ) : (
              <FormattedMessage
                id='propose.heading'
                defaultMessage='Open a Proposal'
              />
            )}
          </h1>
          <p className='propose-page__intro'>
            <FormattedMessage
              id='propose.intro'
              defaultMessage='A proposal is how Kronk changes. Say what should be different and why — others can back it, question it, and help build it.'
            />
          </p>
        </header>

        <label className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage id='propose.title_label' defaultMessage='Title' />
          </span>
          <input
            type='text'
            className='propose-page__input'
            value={title}
            onChange={handleTitleChange}
            placeholder={intl.formatMessage(messages.titlePlaceholder)}
            maxLength={240}
          />
        </label>

        <label className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage
              id='propose.summary_label'
              defaultMessage='Summary'
            />
          </span>
          <p className='propose-page__hint'>
            <FormattedMessage
              id='propose.summary_hint'
              defaultMessage='One line, shown on the proposal’s feed card. Optional.'
            />
          </p>
          <input
            type='text'
            className='propose-page__input'
            value={summary}
            onChange={handleSummaryChange}
            placeholder={intl.formatMessage(messages.summaryPlaceholder)}
            maxLength={500}
          />
        </label>

        <label className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage
              id='propose.body_label'
              defaultMessage='Description'
            />
          </span>
          <textarea
            className='propose-page__textarea'
            value={body}
            onChange={handleBodyChange}
            placeholder={intl.formatMessage(messages.bodyPlaceholder)}
            rows={5}
          />
        </label>

        <fieldset className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage id='propose.steps_label' defaultMessage='Steps' />
          </span>
          <p className='propose-page__hint'>
            <FormattedMessage
              id='propose.steps_hint'
              defaultMessage='Break the proposal into steps to tick off as each is done. Optional — add as many as you need.'
            />
          </p>
          <ol className='propose-page__steps'>
            {steps.map((step, i) => (
              <li key={i} className='propose-page__step'>
                <span className='propose-page__step-num'>{i + 1}</span>
                <input
                  type='text'
                  className='propose-page__input'
                  value={step}
                  data-index={i}
                  onChange={handleStepChange}
                  placeholder={intl.formatMessage(messages.stepPlaceholder)}
                  maxLength={240}
                />
                {steps.length > 1 && (
                  <button
                    type='button'
                    className='propose-page__step-remove'
                    data-index={i}
                    onClick={removeStep}
                    aria-label={intl.formatMessage(messages.removeStep)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ol>
          <button
            type='button'
            className='propose-page__add-step'
            onClick={addStep}
          >
            <FormattedMessage
              id='propose.add_step'
              defaultMessage='+ Add step'
            />
          </button>
        </fieldset>

        <fieldset className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage
              id='propose.docs_label'
              defaultMessage='Design docs'
            />
          </span>
          <p className='propose-page__hint'>
            <FormattedMessage
              id='propose.docs_hint'
              defaultMessage='Attach mockups, briefs, or references (PDF, image, markdown). Optional.'
            />
          </p>
          {docs.length > 0 && (
            <ul className='propose-page__docs'>
              {docs.map((doc, i) => (
                <li key={`${doc.name}-${i}`} className='propose-page__doc'>
                  <span className='propose-page__doc-name'>{doc.name}</span>
                  <button
                    type='button'
                    className='propose-page__step-remove'
                    data-index={i}
                    onClick={removeDoc}
                    aria-label={intl.formatMessage(messages.removeDoc)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className='propose-page__add-step propose-page__add-doc'>
            <FormattedMessage
              id='propose.add_doc'
              defaultMessage='+ Attach a document'
            />
            <input
              type='file'
              multiple
              accept='.pdf,.png,.jpg,.jpeg,.gif,.webp,.md,.markdown,.html,.txt'
              onChange={handleDocs}
              hidden
            />
          </label>
        </fieldset>

        {error && <p className='propose-page__error'>{error}</p>}

        <div className='propose-page__actions'>
          <button
            type='submit'
            className='propose-page__submit'
            disabled={!canSubmit}
          >
            <FormattedMessage id='propose.submit' defaultMessage='Open it' />
          </button>
        </div>
      </form>
    </Stage>
  );
};

export { ProposePage };
