import { useCallback, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

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
  const [editing, setEditing] = useState(false);
  const { account } = portfolio;
  const name = account.display_name.trim() || account.username;

  const startEdit = useCallback(() => {
    setEditing(true);
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

  const featuredIds = new Set(portfolio.featured.map((piece) => piece.id));
  const rest = portfolio.pieces.filter((piece) => !featuredIds.has(piece.id));
  const total = new Set([...featuredIds, ...rest.map((piece) => piece.id)])
    .size;

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
      hero={
        <img className='art-portfolio__avatar' src={account.avatar} alt='' />
      }
      title={name}
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
      {portfolio.statement && (
        <p className='art-portfolio__statement'>{portfolio.statement}</p>
      )}

      {portfolio.featured.length > 0 && (
        <section className='art-portfolio__section art-portfolio__section--featured'>
          <h2 className='art-portfolio__heading'>
            {intl.formatMessage(messages.featured)}
          </h2>
          <SpaceGrid className='art-portfolio__featured'>
            {portfolio.featured.map(card)}
          </SpaceGrid>
        </section>
      )}

      {rest.length > 0 && (
        <section className='art-portfolio__section'>
          {portfolio.featured.length > 0 && (
            <h2 className='art-portfolio__heading'>
              {intl.formatMessage(messages.allWorks)}
            </h2>
          )}
          <SpaceGrid>{rest.map(card)}</SpaceGrid>
        </section>
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
          portfolio={portfolio}
          onCancel={stopEdit}
          onSaved={saved}
        />
      )}
    </KornerDetail>
  );
};
