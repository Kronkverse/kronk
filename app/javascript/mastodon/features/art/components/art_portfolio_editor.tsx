import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiUpdatePortfolio } from 'mastodon/api/art';
import type { ApiArtPortfolioJSON } from 'mastodon/api_types/art';
import { ComposeShell } from 'mastodon/components/compose_shell';

// Edit portfolio (Ж menu on your own portfolio; docs/spaces/art.md,
// Portfolio): your artist statement, whether you're open for commissions,
// and up to three pieces to lead with, in the order you tick them.

const FEATURED_LIMIT = 3;
const STATEMENT_LIMIT = 2000;

const messages = defineMessages({
  title: { id: 'art.portfolio.edit_title', defaultMessage: 'Edit portfolio' },
  save: { id: 'art.portfolio.save', defaultMessage: 'Save' },
  saving: { id: 'art.portfolio.saving', defaultMessage: 'Saving…' },
  statement: {
    id: 'art.portfolio.statement_label',
    defaultMessage: 'Artist statement',
  },
  statementPlaceholder: {
    id: 'art.portfolio.statement_placeholder',
    defaultMessage: 'What you make, and why',
  },
  commissions: {
    id: 'art.portfolio.commissions_label',
    defaultMessage: 'Open for commissions',
  },
  commissionsHint: {
    id: 'art.portfolio.commissions_hint',
    defaultMessage: 'People can ask you about a commission in Nudges.',
  },
  featured: {
    id: 'art.portfolio.featured_label',
    defaultMessage: 'Featured pieces (up to {limit})',
  },
  featuredHint: {
    id: 'art.portfolio.featured_hint',
    defaultMessage: 'They lead your portfolio, in the order you pick them.',
  },
  error: {
    id: 'art.portfolio.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

interface Props {
  portfolio: ApiArtPortfolioJSON;
  onCancel: () => void;
  onSaved: (portfolio: ApiArtPortfolioJSON) => void;
}

export const ArtPortfolioEditor: React.FC<Props> = ({
  portfolio,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [statement, setStatement] = useState(portfolio.statement ?? '');
  const [open, setOpen] = useState(portfolio.open_for_commissions);
  const [featured, setFeatured] = useState<string[]>(
    portfolio.featured.map((piece) => piece.id),
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleStatement = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setStatement(e.target.value);
    },
    [],
  );
  const handleOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOpen(e.target.checked);
  }, []);
  const toggleFeatured = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const id = e.target.value;
      const on = e.target.checked;
      setFeatured((was) =>
        on
          ? was.length < FEATURED_LIMIT && !was.includes(id)
            ? [...was, id]
            : was
          : was.filter((other) => other !== id),
      );
    },
    [],
  );

  const submit = useCallback(() => {
    setPending(true);
    setFailed(false);
    apiUpdatePortfolio({
      statement,
      open_for_commissions: open,
      featured_ids: featured,
    })
      .then((next) => {
        onSaved(next);
        return undefined;
      })
      .catch(() => {
        setFailed(true);
        setPending(false);
      });
  }, [statement, open, featured, onSaved]);

  return (
    <ComposeShell
      korner='art'
      label={intl.formatMessage(messages.title)}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={pending}
      canSubmit={!pending}
    >
      <div className='art-composer art-portfolio-editor'>
        <label className='art-portfolio-editor__label'>
          {intl.formatMessage(messages.statement)}
          <textarea
            className='art-composer__description'
            value={statement}
            onChange={handleStatement}
            placeholder={intl.formatMessage(messages.statementPlaceholder)}
            maxLength={STATEMENT_LIMIT}
            disabled={pending}
          />
        </label>

        <label className='art-portfolio-editor__check'>
          <input
            type='checkbox'
            checked={open}
            onChange={handleOpen}
            disabled={pending}
          />
          <span>
            {intl.formatMessage(messages.commissions)}
            <span className='art-composer__hint'>
              {intl.formatMessage(messages.commissionsHint)}
            </span>
          </span>
        </label>

        {portfolio.pieces.length > 0 && (
          <fieldset className='art-portfolio-editor__featured'>
            <legend className='art-portfolio-editor__label'>
              {intl.formatMessage(messages.featured, {
                limit: FEATURED_LIMIT,
              })}
            </legend>
            <p className='art-composer__hint'>
              {intl.formatMessage(messages.featuredHint)}
            </p>
            <ul className='art-portfolio-editor__pieces'>
              {portfolio.pieces.map((piece) => {
                const place = featured.indexOf(piece.id);
                const on = place >= 0;
                return (
                  <li key={piece.id}>
                    <label
                      className={`art-portfolio-editor__piece${on ? ' art-portfolio-editor__piece--on' : ''}`}
                    >
                      <input
                        type='checkbox'
                        value={piece.id}
                        checked={on}
                        onChange={toggleFeatured}
                        disabled={
                          pending || (!on && featured.length >= FEATURED_LIMIT)
                        }
                      />
                      {piece.cover_url ? (
                        <img src={piece.cover_url} alt='' />
                      ) : (
                        <span className='art-portfolio-editor__blank' />
                      )}
                      <span className='art-portfolio-editor__piece-title'>
                        {on ? `${place + 1}. ` : ''}
                        {piece.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {failed && (
          <p className='art-composer__error' role='alert'>
            {intl.formatMessage(messages.error)}
          </p>
        )}
      </div>
    </ComposeShell>
  );
};
