import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { apiUpdatePortfolio } from 'mastodon/api/art';
import type { ApiArtPortfolioJSON } from 'mastodon/api_types/art';
import { ComposeShell } from 'mastodon/components/compose_shell';

// Edit portfolio (Ж menu on your own portfolio; docs/spaces/art.md,
// Portfolio): the mediums you work in, your artist statement, up to three
// pieces to lead with (in the order you tick them), and whether you're open
// for commissions.
//
// `guided` is the first-time set-up: the same four sections one at a time,
// with Back and Next, so a new artist is walked through it. Every step can
// be left empty.

const FEATURED_LIMIT = 3;
const STATEMENT_LIMIT = 2000;
const MEDIUMS_LIMIT = 12;
const MEDIUM_LENGTH = 40;

// Offered to tap; anything else can be typed.
const SUGGESTED_MEDIUMS = [
  'Oil',
  'Acrylic',
  'Watercolour',
  'Gouache',
  'Ink',
  'Pencil',
  'Charcoal',
  'Pastel',
  'Ceramics',
  'Sculpture',
  'Woodwork',
  'Metalwork',
  'Glass',
  'Textile',
  'Weaving',
  'Embroidery',
  'Printmaking',
  'Photography',
  'Collage',
  'Mixed media',
  'Jewellery',
  'Mural',
  'Calligraphy',
  'Paper',
];

type Step = 'mediums' | 'statement' | 'featured' | 'commissions';
const STEPS: Step[] = ['mediums', 'statement', 'featured', 'commissions'];

const messages = defineMessages({
  title: { id: 'art.portfolio.edit_title', defaultMessage: 'Edit portfolio' },
  setUpTitle: {
    id: 'art.portfolio.set_up_title',
    defaultMessage: 'Set up your portfolio',
  },
  save: { id: 'art.portfolio.save', defaultMessage: 'Save' },
  saving: { id: 'art.portfolio.saving', defaultMessage: 'Saving…' },
  next: { id: 'art.portfolio.next', defaultMessage: 'Next' },
  back: { id: 'art.portfolio.back', defaultMessage: 'Back' },
  step: {
    id: 'art.portfolio.step',
    defaultMessage: 'Step {current} of {total}',
  },
  mediums: {
    id: 'art.portfolio.mediums_label_edit',
    defaultMessage: 'Mediums you work in',
  },
  mediumsHint: {
    id: 'art.portfolio.mediums_hint',
    defaultMessage:
      'Tap the ones that fit, or add your own. They show under your name, and people can tap one to see those works.',
  },
  addMedium: {
    id: 'art.portfolio.add_medium',
    defaultMessage: 'Add your own',
  },
  add: { id: 'art.portfolio.add', defaultMessage: 'Add' },
  removeMedium: {
    id: 'art.portfolio.remove_medium',
    defaultMessage: 'Remove {medium}',
  },
  statement: {
    id: 'art.portfolio.statement_label',
    defaultMessage: 'Artist statement',
  },
  statementHint: {
    id: 'art.portfolio.statement_hint',
    defaultMessage:
      'A few lines about what you make and why: your materials, what draws you to them, where you work.',
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
  noPiecesYet: {
    id: 'art.portfolio.no_pieces_yet',
    defaultMessage:
      "Once you've posted pieces you can pick the ones to lead with. You can skip this for now.",
  },
  error: {
    id: 'art.portfolio.error',
    defaultMessage: "Couldn't save — try again.",
  },
});

interface Props {
  portfolio: ApiArtPortfolioJSON;
  guided?: boolean;
  onCancel: () => void;
  onSaved: (portfolio: ApiArtPortfolioJSON) => void;
}

export const ArtPortfolioEditor: React.FC<Props> = ({
  portfolio,
  guided = false,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const [mediums, setMediums] = useState<string[]>(portfolio.mediums);
  const [typed, setTyped] = useState('');
  const [statement, setStatement] = useState(portfolio.statement ?? '');
  const [open, setOpen] = useState(portfolio.open_for_commissions);
  const [featured, setFeatured] = useState<string[]>(
    portfolio.featured.map((piece) => piece.id),
  );
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const addMedium = useCallback((name: string) => {
    const clean = name.trim().slice(0, MEDIUM_LENGTH);
    if (!clean) return;
    setMediums((was) =>
      was.length >= MEDIUMS_LIMIT ||
      was.some((m) => m.toLowerCase() === clean.toLowerCase())
        ? was
        : [...was, clean],
    );
  }, []);
  const toggleSuggested = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const name = e.currentTarget.value;
      setMediums((was) =>
        was.includes(name)
          ? was.filter((m) => m !== name)
          : was.length < MEDIUMS_LIMIT
            ? [...was, name]
            : was,
      );
    },
    [],
  );
  const removeMedium = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const name = e.currentTarget.value;
    setMediums((was) => was.filter((m) => m !== name));
  }, []);
  const handleTyped = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTyped(e.target.value);
  }, []);
  const addTyped = useCallback(() => {
    addMedium(typed);
    setTyped('');
  }, [addMedium, typed]);
  const handleTypedKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTyped();
      }
    },
    [addTyped],
  );

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

  const save = useCallback(() => {
    setPending(true);
    setFailed(false);
    apiUpdatePortfolio({
      mediums,
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
  }, [mediums, statement, open, featured, onSaved]);

  const lastStep = !guided || step === STEPS.length - 1;
  const submit = useCallback(() => {
    if (lastStep) save();
    else setStep((was) => was + 1);
  }, [lastStep, save]);
  const back = useCallback(() => {
    setStep((was) => Math.max(0, was - 1));
  }, []);

  const shown = (section: Step) => !guided || STEPS[step] === section;

  return (
    <ComposeShell
      korner='art'
      label={intl.formatMessage(guided ? messages.setUpTitle : messages.title)}
      subtitle={
        guided
          ? intl.formatMessage(messages.step, {
              current: step + 1,
              total: STEPS.length,
            })
          : undefined
      }
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel={intl.formatMessage(lastStep ? messages.save : messages.next)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={pending}
      canSubmit={!pending}
    >
      <div className='art-composer art-portfolio-editor'>
        {guided && step > 0 && (
          <button
            type='button'
            className='art-portfolio-editor__previous'
            onClick={back}
            disabled={pending}
          >
            {intl.formatMessage(messages.back)}
          </button>
        )}

        {shown('mediums') && (
          <section className='art-portfolio-editor__section'>
            <h3 className='art-portfolio-editor__label'>
              {intl.formatMessage(messages.mediums)}
            </h3>
            <p className='art-composer__hint'>
              {intl.formatMessage(messages.mediumsHint)}
            </p>

            {mediums.length > 0 && (
              <ul className='art-portfolio-editor__chosen'>
                {mediums.map((name) => (
                  <li key={name} className='art-portfolio-editor__chip'>
                    {name}
                    <button
                      type='button'
                      value={name}
                      onClick={removeMedium}
                      aria-label={intl.formatMessage(messages.removeMedium, {
                        medium: name,
                      })}
                      disabled={pending}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className='art-portfolio-editor__suggested'>
              {SUGGESTED_MEDIUMS.filter((name) => !mediums.includes(name)).map(
                (name) => (
                  <button
                    key={name}
                    type='button'
                    value={name}
                    onClick={toggleSuggested}
                    className='art-portfolio-editor__suggestion'
                    disabled={pending || mediums.length >= MEDIUMS_LIMIT}
                  >
                    + {name}
                  </button>
                ),
              )}
            </div>

            <div className='art-portfolio-editor__own'>
              <input
                type='text'
                value={typed}
                onChange={handleTyped}
                onKeyDown={handleTypedKey}
                maxLength={MEDIUM_LENGTH}
                placeholder={intl.formatMessage(messages.addMedium)}
                aria-label={intl.formatMessage(messages.addMedium)}
                disabled={pending || mediums.length >= MEDIUMS_LIMIT}
              />
              <button
                type='button'
                onClick={addTyped}
                disabled={pending || !typed.trim()}
              >
                {intl.formatMessage(messages.add)}
              </button>
            </div>
          </section>
        )}

        {shown('statement') && (
          <section className='art-portfolio-editor__section'>
            <label className='art-portfolio-editor__label'>
              {intl.formatMessage(messages.statement)}
              <span className='art-composer__hint'>
                {intl.formatMessage(messages.statementHint)}
              </span>
              <textarea
                className='art-composer__description'
                value={statement}
                onChange={handleStatement}
                placeholder={intl.formatMessage(messages.statementPlaceholder)}
                maxLength={STATEMENT_LIMIT}
                disabled={pending}
              />
            </label>
          </section>
        )}

        {shown('featured') && (
          <section className='art-portfolio-editor__section'>
            <h3 className='art-portfolio-editor__label'>
              {intl.formatMessage(messages.featured, {
                limit: FEATURED_LIMIT,
              })}
            </h3>
            {portfolio.pieces.length > 0 ? (
              <>
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
                              pending ||
                              (!on && featured.length >= FEATURED_LIMIT)
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
              </>
            ) : (
              <p className='art-composer__hint'>
                {intl.formatMessage(messages.noPiecesYet)}
              </p>
            )}
          </section>
        )}

        {shown('commissions') && (
          <section className='art-portfolio-editor__section'>
            <label className='art-portfolio-editor__check'>
              <input
                type='checkbox'
                role='switch'
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
          </section>
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
