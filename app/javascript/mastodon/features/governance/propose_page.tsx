import { useCallback, useMemo, useState } from 'react';

import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { Helmet } from 'react-helmet';
import { useHistory, useLocation } from 'react-router-dom';

import { apiCreateKommonsProposal } from 'mastodon/api/kommons_nodes';
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

  const space = useMemo(
    () => new URLSearchParams(location.search).get('space') ?? '',
    [location.search],
  );
  const korner = useKorner(space);
  const spaceName = korner?.name ?? space;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ProposalType>('small');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

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
      apiCreateKommonsProposal({
        title: title.trim(),
        body: body.trim(),
        proposal_type: type,
        // Anchor to the space's index node so it lands on the Space page and
        // the tree. Unscoped proposals carry no node.
        ...(space ? { node_id: `${space}.index` } : {}),
      })
        .then((created) => {
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
    [canSubmit, title, body, type, space, history],
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
            {space ? (
              <FormattedMessage
                id='propose.heading_scoped'
                defaultMessage='Propose a change to {space}'
                values={{ space: spaceName }}
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
            <FormattedMessage id='propose.body_label' defaultMessage='Details' />
          </span>
          <textarea
            className='propose-page__textarea'
            value={body}
            onChange={handleBodyChange}
            placeholder={intl.formatMessage(messages.bodyPlaceholder)}
            rows={8}
          />
        </label>

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
