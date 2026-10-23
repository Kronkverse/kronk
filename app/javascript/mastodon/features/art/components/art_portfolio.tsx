import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory, useLocation } from 'react-router-dom';

import ChatIcon from '@/material-icons/400-24px/chat.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import type {
  ApiArtPieceJSON,
  ApiArtPortfolioJSON,
} from 'mastodon/api_types/art';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerPill } from 'mastodon/components/korner_pill';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { stripHtmlToLine } from 'mastodon/utils/strip_html';

import { artKindLabel } from '../kinds';

import { ArtPortfolioEditor } from './art_portfolio_editor';

// An artist's portfolio (docs/spaces/art.md, Portfolio): who they are and
// what they've made that reaches you, kept simple. The artist edits it from
// the Ж menu (Edit portfolio); an artist open for commissions can be asked
// through Nudges.

const messages = defineMessages({
  toProfile: {
    id: 'art.portfolio.to_profile',
    defaultMessage: "{name}'s profile",
  },
  commissionsTitle: {
    id: 'art.portfolio.commissions_title',
    defaultMessage: 'Commissions',
  },
  commissionsOpen: {
    id: 'art.portfolio.commissions_open',
    defaultMessage: 'Open for commissions. Ask and they can tell you more.',
  },
  commissionsClosed: {
    id: 'art.portfolio.commissions_closed',
    defaultMessage:
      "You're not taking commissions. Switch it on in Edit portfolio and people can ask you here.",
  },
  readMore: { id: 'art.portfolio.read_more', defaultMessage: 'Read more' },
  readLess: { id: 'art.portfolio.read_less', defaultMessage: 'Show less' },
  ask: {
    id: 'art.portfolio.ask',
    defaultMessage: 'Ask about a commission',
  },
  emptyOwn: {
    id: 'art.portfolio.empty_own',
    defaultMessage: 'Your portfolio fills as you post pieces.',
  },
  empty: {
    id: 'art.portfolio.empty',
    defaultMessage: 'No pieces to show yet.',
  },
  allMediums: { id: 'art.portfolio.all_mediums', defaultMessage: 'All' },
  mediumsLabel: {
    id: 'art.portfolio.mediums_label',
    defaultMessage: 'Mediums',
  },
  setUpTitle: {
    id: 'art.portfolio.set_up_title',
    defaultMessage: 'Set up your portfolio',
  },
  setUpBody: {
    id: 'art.portfolio.set_up_body',
    defaultMessage:
      'Four quick steps: the mediums you work in, a line about your practice, the pieces to lead with, and whether you take commissions. Skip any of them.',
  },
  setUpStart: { id: 'art.portfolio.set_up_start', defaultMessage: 'Start' },
  noneInMedium: {
    id: 'art.portfolio.none_in_medium',
    defaultMessage: 'No pieces in {medium} yet.',
  },
  edit: {
    id: 'art.page_action.edit_portfolio',
    defaultMessage: 'Edit portfolio',
  },
});

// A bio longer than this folds to three lines behind Read more.
const BIO_FOLD = 220;

interface Props {
  portfolio: ApiArtPortfolioJSON;
  onChange: (portfolio: ApiArtPortfolioJSON) => void;
}

export const ArtPortfolio: React.FC<Props> = ({ portfolio, onChange }) => {
  const intl = useIntl();
  const history = useHistory();
  // false, or how the editor opens: every section at once, or step by step
  // (the first-time set-up).
  const [editing, setEditing] = useState<false | 'all' | 'guided'>(false);
  // A piece page's medium chip links here with ?medium=, already filtered.
  const { search } = useLocation();
  const [bioOpen, setBioOpen] = useState(false);
  const toggleBio = useCallback(() => {
    setBioOpen((was) => !was);
  }, []);
  const [medium, setMedium] = useState<string | null>(() =>
    new URLSearchParams(search).get('medium'),
  );
  const { account } = portfolio;
  const name = account.display_name.trim() || account.username;

  const startEdit = useCallback(() => {
    setEditing('all');
  }, []);
  const startSetUp = useCallback(() => {
    setEditing('guided');
  }, []);
  const pickMedium = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const value = e.currentTarget.value;
    setMedium(value === '' ? null : value);
  }, []);
  const stopEdit = useCallback(() => {
    setEditing(false);
  }, []);
  const saved = useCallback(
    (next: ApiArtPortfolioJSON) => {
      onChange(next);
      setEditing(false);
    },
    [onChange],
  );
  useRegisterPageAction(
    {
      key: 'edit-portfolio',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    startEdit,
    portfolio.is_owner && !editing,
  );

  const ask = useCallback(() => {
    history.push(`/nudges/with/${account.id}`);
  }, [history, account.id]);

  // A medium chip narrows the works to the pieces put in it. A piece from
  // before pieces had mediums is matched on its materials and kind instead
  // ("Ceramics" finds "Stoneware ceramics" and anything of the Ceramic kind).
  const pieceIn = (piece: ApiArtPieceJSON, name: string) => {
    const wanted = name.toLowerCase();
    if (piece.mediums.length > 0)
      return piece.mediums.some((m) => m.toLowerCase() === wanted);
    const kind = artKindLabel(intl, piece.kind).toLowerCase();
    return (
      `${piece.medium ?? ''} ${kind}`.toLowerCase().includes(wanted) ||
      wanted.includes(kind)
    );
  };
  const inMedium = (piece: ApiArtPieceJSON) =>
    medium === null || pieceIn(piece, medium);

  // The chips: the portfolio's mediums, then any its pieces use that it
  // doesn't list, each with how many pieces are in it.
  const everyPiece = [
    ...portfolio.featured,
    ...portfolio.pieces.filter(
      (piece) => !portfolio.featured.some((f) => f.id === piece.id),
    ),
  ];
  const chipNames = (() => {
    const seen = new Map<string, string>();
    [
      ...portfolio.mediums,
      ...everyPiece.flatMap((piece) => piece.mediums),
    ].forEach((name) => {
      if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    });
    return [...seen.values()];
  })();
  const chips = chipNames.map((name) => ({
    name,
    count: everyPiece.filter((piece) => pieceIn(piece, name)).length,
  }));

  // One flow of work: the pieces the artist leads with first, then the rest,
  // newest first.
  const featuredIds = new Set(portfolio.featured.map((piece) => piece.id));
  const works = [
    ...portfolio.featured,
    ...portfolio.pieces.filter((piece) => !featuredIds.has(piece.id)),
  ];
  const total = works.length;
  const shown = works.filter(inMedium);

  // Their artist statement; if they haven't written one, their profile bio.
  const statement = portfolio.statement?.trim() ?? '';
  const bio =
    statement !== '' ? statement : stripHtmlToLine(account.note).trim();

  const card = (piece: ApiArtPieceJSON) => (
    <SpaceCard
      key={piece.id}
      to={`/hub/art/pieces/${piece.id}`}
      image={piece.cover_url}
      title={piece.title}
      meta={[
        piece.mediums[0] ??
          (piece.medium?.trim()
            ? piece.medium.trim()
            : artKindLabel(intl, piece.kind)),
        piece.year_made ? String(piece.year_made) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    />
  );

  // Top to bottom (@mangobee, 2026-10-23: simpler, the artist and the
  // work): their picture, which goes to their profile, and name; their
  // bio; their mediums; all their work; then commissions.
  return (
    <KornerDetail
      className='art-portfolio'
      hero={
        <Link
          to={`/@${account.acct}`}
          className='art-portfolio__picture'
          aria-label={intl.formatMessage(messages.toProfile, { name })}
        >
          <img src={account.avatar} alt='' />
        </Link>
      }
      title={name}
    >
      {portfolio.is_owner && !portfolio.set_up && !editing && (
        <section className='art-portfolio__set-up'>
          <h2 className='art-portfolio__heading'>
            {intl.formatMessage(messages.setUpTitle)}
          </h2>
          <p>{intl.formatMessage(messages.setUpBody)}</p>
          <KornerActionBar>
            <KornerPill
              label={intl.formatMessage(messages.setUpStart)}
              variant='primary'
              onClick={startSetUp}
            />
          </KornerActionBar>
        </section>
      )}

      {bio && (
        <div className='art-portfolio__bio-wrap'>
          <p
            className={`art-portfolio__bio${bioOpen ? '' : ' art-portfolio__bio--folded'}`}
          >
            {bio}
          </p>
          {bio.length > BIO_FOLD && (
            <button
              type='button'
              className='art-portfolio__read-more'
              onClick={toggleBio}
              aria-expanded={bioOpen}
            >
              {intl.formatMessage(
                bioOpen ? messages.readLess : messages.readMore,
              )}
            </button>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div
          className='art-portfolio__mediums'
          role='group'
          aria-label={intl.formatMessage(messages.mediumsLabel)}
        >
          <button
            type='button'
            value=''
            onClick={pickMedium}
            aria-pressed={medium === null}
            className={`art-portfolio__medium${medium === null ? ' art-portfolio__medium--on' : ''}`}
          >
            {intl.formatMessage(messages.allMediums)}
          </button>
          {chips.map(({ name: chip, count }) => (
            <button
              key={chip}
              type='button'
              value={chip}
              onClick={pickMedium}
              aria-pressed={medium === chip}
              className={`art-portfolio__medium${medium === chip ? ' art-portfolio__medium--on' : ''}`}
            >
              {chip}
              {count > 0 && (
                <span className='art-portfolio__medium-count'>{count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <SpaceGrid layout='masonry' className='art-portfolio__works'>
          {shown.map(card)}
        </SpaceGrid>
      )}

      {medium && total > 0 && shown.length === 0 && (
        <EmptyState
          title={intl.formatMessage(messages.noneInMedium, { medium })}
        />
      )}

      {total === 0 && (
        <EmptyState
          title={intl.formatMessage(
            portfolio.is_owner ? messages.emptyOwn : messages.empty,
          )}
        />
      )}

      {/* Commissions close the page: open, with the way to ask; or, for
          the artist alone, where to switch them on. */}
      {(portfolio.open_for_commissions || portfolio.is_owner) && (
        <section className='art-portfolio__commissions'>
          <h2 className='art-portfolio__heading'>
            {intl.formatMessage(messages.commissionsTitle)}
          </h2>
          <p>
            {intl.formatMessage(
              portfolio.open_for_commissions
                ? messages.commissionsOpen
                : messages.commissionsClosed,
            )}
          </p>
          {portfolio.open_for_commissions && !portfolio.is_owner && (
            <KornerActionBar>
              <KornerPill
                label={intl.formatMessage(messages.ask)}
                icon={ChatIcon}
                iconId='chat'
                variant='primary'
                onClick={ask}
              />
            </KornerActionBar>
          )}
        </section>
      )}

      {editing && (
        <ArtPortfolioEditor
          guided={editing === 'guided'}
          portfolio={portfolio}
          onCancel={stopEdit}
          onSaved={saved}
        />
      )}
    </KornerDetail>
  );
};
