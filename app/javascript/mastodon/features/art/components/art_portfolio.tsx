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
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { SpaceCard, SpaceGrid } from 'mastodon/components/space_grid';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';

import { availabilityLabel } from '../details';
import { artKindLabel } from '../kinds';

import { ArtPortfolioEditor } from './art_portfolio_editor';

// An artist's portfolio (docs/spaces/art.md, Portfolio): who they are as an
// artist, the pieces they lead with, and everything else they've made that
// reaches you. The artist edits it from the Ж menu (Edit portfolio); an artist
// open for commissions can be asked through Nudges.

const messages = defineMessages({
  subtitle: { id: 'art.portfolio.subtitle', defaultMessage: 'Portfolio' },
  pieces: {
    id: 'art.portfolio.pieces_count',
    defaultMessage: '{count, plural, one {# piece} other {# pieces}}',
  },
  commissions: {
    id: 'art.portfolio.open_for_commissions',
    defaultMessage: 'Open for commissions',
  },
  ask: {
    id: 'art.portfolio.ask',
    defaultMessage: 'Ask about a commission',
  },
  featured: { id: 'art.portfolio.featured', defaultMessage: 'Featured' },
  allWorks: { id: 'art.portfolio.all_works', defaultMessage: 'All works' },
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

  const featuredIds = new Set(portfolio.featured.map((piece) => piece.id));
  const allRest = portfolio.pieces.filter(
    (piece) => !featuredIds.has(piece.id),
  );
  const total = new Set([...featuredIds, ...allRest.map((piece) => piece.id)])
    .size;
  const featured = portfolio.featured.filter(inMedium);
  const rest = allRest.filter(inMedium);

  const card = (piece: ApiArtPieceJSON) => (
    <SpaceCard
      key={piece.id}
      to={`/hub/art/pieces/${piece.id}`}
      image={piece.cover_url}
      title={piece.title}
      meta={[
        piece.medium?.trim()
          ? piece.medium.trim()
          : artKindLabel(intl, piece.kind),
        piece.year_made ? String(piece.year_made) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      tag={availabilityLabel(intl, piece.availability) ?? undefined}
      tagKind={piece.availability}
    />
  );

  return (
    <KornerDetail
      className='art-portfolio'
      title={
        <span className='art-portfolio__title'>
          <img className='art-portfolio__avatar' src={account.avatar} alt='' />
          {name}
        </span>
      }
      subtitle={intl.formatMessage(messages.subtitle)}
      meta={
        <KornerMeta
          items={[
            intl.formatMessage(messages.pieces, { count: total }),
            portfolio.open_for_commissions
              ? intl.formatMessage(messages.commissions)
              : null,
            <Link key='profile' to={`/@${account.acct}`}>
              @{account.acct}
            </Link>,
          ].filter(Boolean)}
        />
      }
      actions={
        portfolio.open_for_commissions && !portfolio.is_owner ? (
          <KornerActionBar>
            <KornerPill
              label={intl.formatMessage(messages.ask)}
              icon={ChatIcon}
              iconId='chat'
              variant='primary'
              onClick={ask}
            />
          </KornerActionBar>
        ) : undefined
      }
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
          {chips.map(({ name, count }) => (
            <button
              key={name}
              type='button'
              value={name}
              onClick={pickMedium}
              aria-pressed={medium === name}
              className={`art-portfolio__medium${medium === name ? ' art-portfolio__medium--on' : ''}`}
            >
              {name}
              {count > 0 && (
                <span className='art-portfolio__medium-count'>{count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {portfolio.statement && (
        <p className='art-portfolio__statement'>{portfolio.statement}</p>
      )}

      {featured.length > 0 && (
        <section className='art-portfolio__section art-portfolio__section--featured'>
          <h2 className='art-portfolio__heading'>
            {intl.formatMessage(messages.featured)}
          </h2>
          <SpaceGrid className='art-portfolio__featured'>
            {featured.map(card)}
          </SpaceGrid>
        </section>
      )}

      {rest.length > 0 && (
        <section className='art-portfolio__section'>
          {featured.length > 0 && (
            <h2 className='art-portfolio__heading'>
              {intl.formatMessage(messages.allWorks)}
            </h2>
          )}
          <SpaceGrid>{rest.map(card)}</SpaceGrid>
        </section>
      )}

      {medium && total > 0 && featured.length + rest.length === 0 && (
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
