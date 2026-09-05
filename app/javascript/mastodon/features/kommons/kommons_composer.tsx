import { useCallback, useEffect, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { useLocation } from 'react-router-dom';

import api from 'mastodon/api';
import {
  apiCreateKommonsProposal,
  apiCreateProposalTask,
  apiGetKommonsNodes,
} from 'mastodon/api/kommons_nodes';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { useKorner } from 'mastodon/hooks/useKorner';

// Kommons — open a proposal. The shared `<ComposeShell>` overlay at
// `/hub/kommons/composer` (legacy `/hub/kommons/propose` still
// resolves to the same overlay). Was the full-page `ProposePage`
// mounted inside a `<Stage>` until 2026-08-12.
//
// Scope query params (?space=<slug> or ?node=<id>) come from the
// picker at `/hub/kommons/pick` — the Ж bubble opens the picker
// first, which then routes here with the chosen scope. Unscoped
// proposals (no ?space / ?node) land unattached to any node.

const messages = defineMessages({
  title: { id: 'propose.title', defaultMessage: 'Open a Proposal' },
  titleScoped: {
    id: 'propose.title_scoped',
    defaultMessage: 'Propose a change to {space}',
  },
  titleNewKorner: {
    id: 'propose.title_new_korner',
    defaultMessage: 'Propose a new Korner',
  },
  intro: {
    id: 'propose.intro',
    defaultMessage:
      'A proposal is how Kronk changes. Say what should be different and why — others can back it, question it, and help build it.',
  },
  introNewKorner: {
    id: 'propose.intro_new_korner',
    defaultMessage:
      'A Korner is a space in Kronk — Kalendar, Kommons, Booth. Say what this new space is for, who it serves, and what one action it makes possible. Others can back the idea; a shipped proposal ends with a new manifest under config/korners/.',
  },
  submit: { id: 'propose.submit', defaultMessage: 'Open it' },
  submitting: { id: 'propose.submitting', defaultMessage: 'Opening…' },
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
  nodesError: {
    id: 'propose.nodes_error',
    defaultMessage:
      "Couldn't load the Kommons map — your proposal will land unscoped.",
  },
  nodesRetry: { id: 'propose.nodes_retry', defaultMessage: 'Retry' },
});

interface Props {
  onCancel: () => void;
  // Fires after a successful create — parent decides where to navigate
  // (the Kommons directory sends the caller to the fresh proposal's
  // detail page).
  onCreated: (proposalId: string) => void;
}

// Plant a proposal (Kommons' native "compose"). Reached from the Ж menu
// (via the picker at /pick, which scopes then routes here) or from a
// Space page's button. When opened with ?space=<slug> it scopes the
// proposal to that space, anchoring it to the space's index node so it
// lands on the Space page and the Kommons tree. Without a space it's an
// unscoped proposal.
export const KommonsComposer: React.FC<Props> = ({ onCancel, onCreated }) => {
  const intl = useIntl();
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
  type NodesStatus = 'loading' | 'ready' | 'error';
  const [nodesStatus, setNodesStatus] = useState<NodesStatus>('loading');
  const [nodesReloadKey, setNodesReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setNodesStatus('loading');
    apiGetKommonsNodes()
      .then((res) => {
        if (active) {
          setNodeIds(new Set(res.nodes.map((n) => n.id)));
          setNodeLabels(new Map(res.nodes.map((n) => [n.id, n.label])));
          setNodesStatus('ready');
        }
        return undefined;
      })
      .catch(() => {
        if (active) setNodesStatus('error');
      });
    return () => {
      active = false;
    };
  }, [nodesReloadKey]);

  const retryLoadNodes = useCallback(() => {
    setNodesReloadKey((k) => k + 1);
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

  // While the node list is still in-flight, don't submit an unresolved scope
  // — but if the fetch errored, don't stay locked forever either. `error`
  // surfaces a retry (see below) and unblocks submission; the anchor falls
  // back to unscoped rather than never-submittable.
  const resolving = Boolean((nodeId || space) && nodesStatus === 'loading');
  const scoped = Boolean(nodeId || space);
  const scopeName = nodeId
    ? (nodeLabels.get(nodeId) ?? nodeId)
    : space
      ? (korner?.name ?? space)
      : '';
  // Tailored copy path — a proposal anchored at `kommons.new_korner`
  // is a request to add a whole new space to Kronk, not a change to
  // an existing one. Heading + intro + body placeholder swap so the
  // form reads as "propose a new space" instead of "propose a change
  // to Propose a new Korner".
  const isNewKorner = nodeId === 'kommons.new_korner';

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

  // Korner Composer — the structured form when isNewKorner. Captures the
  // manifest-shape fields (name, slug, glyph, icon suggestion, purpose)
  // as first-class inputs. On submit these get composed into the
  // proposal's title + summary + body so the generic Proposal model
  // still stores them — we don't need a new model, just a shaped intake.
  const [kornerName, setKornerName] = useState('');
  const [kornerSlug, setKornerSlug] = useState('');
  const [kornerGlyph, setKornerGlyph] = useState('');
  const [kornerIcon, setKornerIcon] = useState('');
  const [kornerPurpose, setKornerPurpose] = useState('');

  const handleKornerNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKornerName(e.target.value);
    },
    [],
  );
  const handleKornerSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Normalise to the L1-legal shape (lowercase alphanumerics only) as
      // the user types — a live cue rather than a submit-time surprise.
      setKornerSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
    },
    [],
  );
  const handleKornerGlyphChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Glyph is a single visible character; trim to one grapheme.
      setKornerGlyph(Array.from(e.target.value)[0] ?? '');
    },
    [],
  );
  const handleKornerIconChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKornerIcon(e.target.value);
    },
    [],
  );
  const handleKornerPurposeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKornerPurpose(e.target.value);
    },
    [],
  );

  // L1 requires a single lowercase word for the slug; also reject the
  // handful of manifest-file-names already in use so the form catches
  // the obvious collisions client-side.
  const slugValid = kornerSlug.length > 0 && /^[a-z0-9]+$/.test(kornerSlug);
  const kornerFormReady =
    kornerName.trim().length > 0 &&
    slugValid &&
    kornerPurpose.trim().length > 0;

  const canSubmit = isNewKorner
    ? kornerFormReady && body.trim().length > 0 && !submitting && !resolving
    : title.trim().length > 0 &&
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

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    // Korner Composer path — compose the structured fields into a
    // proposal title + summary + body so a shipped proposal has all
    // the manifest-shape hints the eventual `config/korners/<slug>.yaml`
    // will need (name, slug, glyph, icon, purpose). Freeform proposals
    // send whatever the user typed.
    const payload = isNewKorner
      ? (() => {
          const nameTrimmed = kornerName.trim();
          const slugTrimmed = kornerSlug.trim();
          const iconTrimmed = kornerIcon.trim();
          const glyphTrimmed = kornerGlyph.trim();
          const purposeTrimmed = kornerPurpose.trim();
          const structured = [
            `**Name**: ${nameTrimmed}`,
            `**Slug**: \`${slugTrimmed}\``,
            glyphTrimmed ? `**Glyph**: ${glyphTrimmed}` : null,
            iconTrimmed ? `**Icon**: \`${iconTrimmed}\`` : null,
            `**Purpose**: ${purposeTrimmed}`,
            '',
            '---',
            '',
            body.trim(),
          ]
            .filter((line): line is string => line !== null)
            .join('\n');
          return {
            title: `New Korner: ${nameTrimmed}`,
            body: structured,
            summary: purposeTrimmed,
          };
        })()
      : {
          title: title.trim(),
          body: body.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
        };
    apiCreateKommonsProposal({
      ...payload,
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
          await api().post(`/api/v1/proposals/${created.id}/attachments`, form);
        }
        onCreated(created.id);
        // Parent unmounts us on success — no need to reset state.
        return undefined;
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Could not plant the proposal.',
        );
        setSubmitting(false);
      });
  }, [
    canSubmit,
    title,
    body,
    summary,
    steps,
    docs,
    targetNodeId,
    onCreated,
    isNewKorner,
    kornerName,
    kornerSlug,
    kornerGlyph,
    kornerIcon,
    kornerPurpose,
  ]);

  // Shell chrome — the header label + subtitle switch based on scope
  // (new-korner / scoped-to-space / unscoped). Both are computed here
  // as strings so ComposeShell can render them into its own header.
  const shellLabel = isNewKorner
    ? intl.formatMessage(messages.titleNewKorner)
    : scoped
      ? intl.formatMessage(messages.titleScoped, { space: scopeName })
      : intl.formatMessage(messages.title);
  const shellSubtitle = intl.formatMessage(
    isNewKorner ? messages.introNewKorner : messages.intro,
  );

  return (
    <ComposeShell
      korner='kommons'
      label={shellLabel}
      subtitle={shellSubtitle}
      submitLabel={intl.formatMessage(messages.submit)}
      submittingLabel={intl.formatMessage(messages.submitting)}
      submitting={submitting}
      canSubmit={canSubmit}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    >
      <div className='propose-page'>
        {isNewKorner ? (
          // Korner Composer fields — manifest-shape hints captured as
          // first-class inputs. Title / summary are composed from these
          // at submit-time so a shipped proposal cleanly maps to a
          // `config/korners/<slug>.yaml`.
          <>
            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.korner_name_label'
                  defaultMessage='Name'
                />
              </span>
              <p className='propose-page__hint'>
                <FormattedMessage
                  id='propose.korner_name_hint'
                  defaultMessage='The display name the space is known by, in Kronk vocabulary. E.g. Kalendar, Booth, Krews.'
                />
              </p>
              <input
                type='text'
                className='propose-page__input'
                value={kornerName}
                onChange={handleKornerNameChange}
                placeholder='Kitchen'
                maxLength={40}
                required
              />
            </label>

            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.korner_slug_label'
                  defaultMessage='Slug'
                />
              </span>
              <p className='propose-page__hint'>
                <FormattedMessage
                  id='propose.korner_slug_hint'
                  defaultMessage='One lowercase word — a–z and 0–9 only. This becomes the URL mount at /hub/{slugName} and the manifest filename.'
                  values={{ slugName: 'slug' }}
                />
              </p>
              <input
                type='text'
                className='propose-page__input'
                value={kornerSlug}
                onChange={handleKornerSlugChange}
                placeholder='kitchen'
                maxLength={30}
                aria-invalid={kornerSlug.length > 0 && !slugValid}
                required
              />
            </label>

            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.korner_glyph_label'
                  defaultMessage='Glyph (optional)'
                />
              </span>
              <p className='propose-page__hint'>
                <FormattedMessage
                  id='propose.korner_glyph_hint'
                  defaultMessage='A single hand-picked character that reads as the space (Ƙ, ◉, ✦). Skip if unsure — the community can pick one later.'
                />
              </p>
              <input
                type='text'
                className='propose-page__input'
                value={kornerGlyph}
                onChange={handleKornerGlyphChange}
                placeholder='Ķ'
                maxLength={4}
              />
            </label>

            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.korner_icon_label'
                  defaultMessage='Icon (optional)'
                />
              </span>
              <p className='propose-page__hint'>
                <FormattedMessage
                  id='propose.korner_icon_hint'
                  defaultMessage='A Material Icon name suggestion for the Hub tile — e.g. kitchen, event, favorite. See fonts.google.com/icons.'
                />
              </p>
              <input
                type='text'
                className='propose-page__input'
                value={kornerIcon}
                onChange={handleKornerIconChange}
                placeholder='kitchen'
                maxLength={40}
              />
            </label>

            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.korner_purpose_label'
                  defaultMessage='Purpose'
                />
              </span>
              <p className='propose-page__hint'>
                <FormattedMessage
                  id='propose.korner_purpose_hint'
                  defaultMessage='One line — what this space is for. Reads as the proposal’s summary and eventually as the manifest’s `purpose:` field.'
                />
              </p>
              <input
                type='text'
                className='propose-page__input'
                value={kornerPurpose}
                onChange={handleKornerPurposeChange}
                placeholder='To help kronkers share meals and cooking rhythms.'
                maxLength={200}
                required
              />
            </label>
          </>
        ) : (
          <>
            <label className='propose-page__field'>
              <span className='propose-page__label'>
                <FormattedMessage
                  id='propose.title_label'
                  defaultMessage='Title'
                />
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
          </>
        )}

        <label className='propose-page__field'>
          <span className='propose-page__label'>
            {isNewKorner ? (
              <FormattedMessage
                id='propose.korner_narrative_label'
                defaultMessage='What it enables'
              />
            ) : (
              <FormattedMessage
                id='propose.body_label'
                defaultMessage='Description'
              />
            )}
          </span>
          {isNewKorner && (
            <p className='propose-page__hint'>
              <FormattedMessage
                id='propose.korner_narrative_hint'
                defaultMessage='Who does this space serve, what does it make possible that no existing space can, and what does using it feel like?'
              />
            </p>
          )}
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

        {nodesStatus === 'error' && (
          <p className='propose-page__error propose-page__error--soft'>
            {intl.formatMessage(messages.nodesError)}{' '}
            <button
              type='button'
              className='propose-page__error-retry'
              onClick={retryLoadNodes}
            >
              {intl.formatMessage(messages.nodesRetry)}
            </button>
          </p>
        )}

        {error && <p className='propose-page__error'>{error}</p>}
      </div>
    </ComposeShell>
  );
};
