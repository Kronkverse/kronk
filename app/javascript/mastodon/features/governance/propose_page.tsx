import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import {
  apiCreateKommonsProposal,
  apiCreateProposalTask,
  apiGetKommonsNodes,
} from 'mastodon/api/kommons_nodes';
import { Column } from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { useKorner } from 'mastodon/hooks/useKorner';
import { useKornerIcon } from 'mastodon/hooks/useKornerIcon';

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
  stepPlaceholder: {
    id: 'propose.step_placeholder',
    defaultMessage: 'A step to complete',
  },
  removeStep: { id: 'propose.remove_step', defaultMessage: 'Remove step' },
});

const TYPES = ['small', 'medium', 'large'] as const;
type ProposalType = (typeof TYPES)[number];

// Plant a proposal (Kommons' native "compose"). Reached from the Ӂ menu or a
// Space page's button. When opened with ?space=<slug> it scopes the proposal
// to that space, anchoring it to the space's index node so it lands on the
// Space page and the Kommons tree. Without a space it's an unscoped proposal.
const ProposePage: React.FC<{ multiColumn?: boolean }> = ({ multiColumn }) => {
  const intl = useIntl();
  const history = useHistory();
  const location = useLocation();
  const kommonsIcon = useKornerIcon('kommons');

  // Scope: `?space=<slug>` targets a korner (anchors to its index node);
  // `?node=<id>` targets an exact page-node (the meta-page "propose" path).
  const params = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const space = params.get('space') ?? '';
  const nodeId = params.get('node') ?? '';
  const korner = useKorner(space);
  const [nodeLabel, setNodeLabel] = useState('');

  useEffect(() => {
    if (!nodeId) return undefined;
    let active = true;
    apiGetKommonsNodes()
      .then((res) => {
        if (active)
          setNodeLabel(res.nodes.find((n) => n.id === nodeId)?.label ?? nodeId);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [nodeId]);

  const targetNodeId = nodeId || (space ? `${space}.index` : undefined);
  const scoped = Boolean(nodeId || space);
  const scopeName = nodeId
    ? nodeLabel || nodeId
    : space
      ? (korner?.name ?? space)
      : '';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ProposalType>('small');
  // The steps: an extendable list, each becomes a Task on the new proposal.
  // Start with one empty row so the affordance is visible.
  const [steps, setSteps] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

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
  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );
  const handleSize = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setType(e.currentTarget.dataset.size as ProposalType);
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
        proposal_type: type,
        // Anchor to the scoped node so it lands on that page's meta page and
        // the tree. Unscoped proposals carry no node.
        ...(targetNodeId ? { node_id: targetNodeId } : {}),
      })
        .then(async (created) => {
          // Each step becomes a Task, in order. Best-effort: a failed step
          // doesn't lose the proposal — it's already created.
          for (const step of cleanSteps) {
            await apiCreateProposalTask(created.id, step);
          }
          history.push(`/hub/kommons/p/${created.id}`);
          return undefined;
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error ? err.message : 'Could not plant the proposal.',
          );
          setSubmitting(false);
        });
    },
    [canSubmit, title, body, type, steps, targetNodeId, history],
  );

  return (
    <Column>
      <ColumnHeader
        title={intl.formatMessage(messages.title)}
        icon='kommons'
        iconComponent={kommonsIcon}
        multiColumn={multiColumn}
      />

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
            <FormattedMessage id='propose.add_step' defaultMessage='+ Add step' />
          </button>
        </fieldset>

        <fieldset className='propose-page__field'>
          <span className='propose-page__label'>
            <FormattedMessage id='propose.size_label' defaultMessage='Size' />
          </span>
          <div className='propose-page__sizes'>
            {TYPES.map((t) => (
              <button
                type='button'
                key={t}
                data-size={t}
                className={`propose-page__size ${type === t ? 'propose-page__size--active' : ''}`}
                onClick={handleSize}
              >
                {t}
              </button>
            ))}
          </div>
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
    </Column>
  );
};

export { ProposePage };
