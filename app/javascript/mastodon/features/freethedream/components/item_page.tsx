import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import {
  apiFtdHandOverItem,
  apiFtdItem,
  apiFtdItemAction,
  apiFtdPlace,
  apiFtdRemoveItem,
  apiFtdTakeOn,
  apiFtdUnplace,
} from 'mastodon/api/freethedream';
import type { FtdItem } from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { useIdentity } from 'mastodon/identity_context';

import { BringControl } from './bring';
import { HandOver } from './hand_over';
import { ItemComposer } from './item_composer';
import {
  Loading,
  People,
  Person,
  Progress,
  ProjectBack,
  Section,
  categoryMessages,
  formatAmount,
  kindMessages,
  useLoaded,
} from './shared';
import { Talk } from './talk';

const messages = defineMessages({
  edit: { id: 'freethedream.edit', defaultMessage: 'Edit' },
  handOver: { id: 'freethedream.hand_over', defaultMessage: 'Hand over' },
  remove: { id: 'freethedream.remove', defaultMessage: 'Remove' },
  takeOver: { id: 'freethedream.take_over', defaultMessage: 'Take this over' },
  bring: {
    id: 'freethedream.compose.bring',
    defaultMessage: 'I can bring this',
  },
  offers: { id: 'freethedream.offers', defaultMessage: "Who's bringing what" },
  claim: { id: 'freethedream.claim', defaultMessage: 'Claim' },
  letGo: { id: 'freethedream.let_go', defaultMessage: 'Let go' },
  claimedBy: { id: 'freethedream.claimed_by', defaultMessage: 'Taken by' },
  makeHappen: {
    id: 'freethedream.make_happen',
    defaultMessage: "I'll make this happen",
  },
  asPart: {
    id: 'freethedream.take_on.part',
    defaultMessage: 'As a part I run',
  },
  asJob: { id: 'freethedream.take_on.job', defaultMessage: 'As a job I take' },
  showsIn: { id: 'freethedream.shows_in', defaultMessage: 'Shows in' },
  alsoUnder: {
    id: 'freethedream.also_under',
    defaultMessage: 'Also show under…',
  },
  unplace: { id: 'freethedream.unplace', defaultMessage: 'Take out' },
  removeTitle: {
    id: 'freethedream.remove_item.title',
    defaultMessage: 'Remove {title}?',
  },
  removeBody: {
    id: 'freethedream.remove_item.body',
    defaultMessage: 'It goes from every part it shows in.',
  },
  upForGrabs: {
    id: 'freethedream.item_up_for_grabs',
    defaultMessage:
      'Whoever added this has left. Anyone in the project can take it over.',
  },
  full: { id: 'freethedream.full', defaultMessage: 'All slots taken' },
});

export const ItemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: item, failed, set } = useLoaded(id, () => apiFtdItem(id));

  if (!item) return <Loading failed={failed} />;
  return <ItemView key={item.id} item={item} onChange={set} />;
};

type Composer = 'edit' | 'hand_over' | null;

const ItemView: React.FC<{ item: FtdItem; onChange: (i: FtdItem) => void }> = ({
  item,
  onChange,
}) => {
  const intl = useIntl();
  const history = useHistory();
  const { accountId } = useIdentity();
  const [composer, setComposer] = useState<Composer>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(() => {
    void apiFtdItem(item.id).then(onChange);
  }, [item.id, onChange]);

  const close = useCallback(() => {
    setComposer(null);
  }, []);
  const openEdit = useCallback(() => {
    setComposer('edit');
  }, []);
  const openHandOver = useCallback(() => {
    setComposer('hand_over');
  }, []);

  const handleSaved = useCallback(
    (saved: FtdItem) => {
      setComposer(null);
      if (saved.id === item.id) onChange(saved);
      else refresh();
    },
    [item.id, onChange, refresh],
  );

  const handleHandOver = useCallback(
    (to: string) =>
      apiFtdHandOverItem(item.id, to).then((next) => {
        onChange(next);
        setComposer(null);
      }),
    [item.id, onChange],
  );

  const handleClaim = useCallback(() => {
    void apiFtdItemAction(
      item.id,
      item.claimed_by_me ? 'unclaim' : 'claim',
    ).then(onChange);
  }, [item.id, item.claimed_by_me, onChange]);

  const handleTakeOver = useCallback(() => {
    void apiFtdItemAction(item.id, 'take_over').then(onChange);
  }, [item.id, onChange]);

  const toggleChoosing = useCallback(() => {
    setChoosing((c) => !c);
  }, []);

  const handleTakeOn = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const as = e.currentTarget.dataset.as === 'job' ? 'job' : 'part';
      void apiFtdTakeOn(item.id, as).then((result) => {
        history.push(
          result.type === 'part'
            ? `/hub/freethedream/p/${result.id}`
            : `/hub/freethedream/i/${result.id}`,
        );
      });
    },
    [item.id, history],
  );

  const handlePlace = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const target = e.target.value;
      if (target) void apiFtdPlace(item.id, target).then(onChange);
    },
    [item.id, onChange],
  );
  const handleUnplace = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const target = e.currentTarget.dataset.id;
      if (target) void apiFtdUnplace(item.id, target).then(onChange);
    },
    [item.id, onChange],
  );

  const askRemove = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);
  const handleRemove = useCallback(() => {
    const home = item.placements[0] ?? item.root;
    void apiFtdRemoveItem(item.id).then(() => {
      history.push(`/hub/freethedream/p/${home.id}`);
    });
  }, [item.id, item.placements, item.root, history]);

  const placed = new Set(item.placements.map((p) => p.id));
  const placeOptions = item.all_parts.filter((p) => !placed.has(p.id));
  const full = (item.claimed ?? 0) >= item.quantity;
  return (
    <div className='freethedream-page'>
      <ProjectBack
        root={item.root}
        between={item.placements.length === 1 ? item.placements : []}
      />

      <header className='freethedream-page__head'>
        <span className='freethedream-page__kind'>
          {intl.formatMessage(kindMessages[item.kind])}
          {item.category &&
            ` · ${intl.formatMessage(categoryMessages[item.category])}`}
        </span>
        <h2 className='freethedream-page__title'>
          {item.title}
          {item.kind === 'need' && (item.quantity > 1 || item.unit) && (
            <span className='freethedream-page__amount'>
              {formatAmount(item.quantity, item.unit)}
            </span>
          )}
        </h2>
        <div className='freethedream-page__meta'>
          <Person account={item.owner} />
        </div>
        {item.source_idea && (
          <p className='freethedream__quiet'>
            <FormattedMessage
              id='freethedream.from_idea'
              defaultMessage='Started from the idea {idea}'
              values={{
                idea: (
                  <Link to={`/hub/freethedream/i/${item.source_idea.id}`}>
                    {item.source_idea.title}
                  </Link>
                ),
              }}
            />
          </p>
        )}
        {item.body && <p className='freethedream-page__body'>{item.body}</p>}
      </header>

      {item.kind === 'need' && (
        <div className='freethedream-status'>
          <Progress done={item.covered ?? 0} of={item.quantity} />
          <span>
            {(item.left ?? 0) > 0 ? (
              <FormattedMessage
                id='freethedream.left'
                defaultMessage='{amount} left'
                values={{ amount: formatAmount(item.left ?? 0, item.unit) }}
              />
            ) : (
              <FormattedMessage
                id='freethedream.covered'
                defaultMessage='Covered'
              />
            )}
          </span>
          {(item.spare ?? 0) > 0 && (
            <span className='freethedream-tag'>
              <FormattedMessage
                id='freethedream.spare'
                defaultMessage='{count} spare'
                values={{ count: item.spare }}
              />
            </span>
          )}
          {item.can.offer && <BringControl need={item} onChange={onChange} />}
        </div>
      )}

      {item.kind === 'job' && (
        <div className='freethedream-status'>
          <Progress done={item.claimed ?? 0} of={item.quantity} />
          {item.can.claim && (item.claimed_by_me || !full) && (
            <button
              type='button'
              className={
                item.claimed_by_me
                  ? 'freethedream__button freethedream__button--quiet'
                  : 'freethedream__button'
              }
              onClick={handleClaim}
            >
              {intl.formatMessage(
                item.claimed_by_me ? messages.letGo : messages.claim,
              )}
            </button>
          )}
          {full && !item.claimed_by_me && (
            <span className='freethedream__quiet'>
              {intl.formatMessage(messages.full)}
            </span>
          )}
        </div>
      )}

      {item.kind === 'idea' && (
        <div className='freethedream-status'>
          {item.taken_on ? (
            <p>
              <FormattedMessage
                id='freethedream.became'
                defaultMessage='Now {link}'
                values={{
                  link: (
                    <Link
                      to={
                        item.taken_on.type === 'part'
                          ? `/hub/freethedream/p/${item.taken_on.id}`
                          : `/hub/freethedream/i/${item.taken_on.id}`
                      }
                    >
                      {item.taken_on.title}
                    </Link>
                  ),
                }}
              />
            </p>
          ) : (
            item.can.take_on &&
            (choosing ? (
              <>
                <button
                  type='button'
                  className='freethedream__button'
                  data-as='part'
                  onClick={handleTakeOn}
                >
                  {intl.formatMessage(messages.asPart)}
                </button>
                <button
                  type='button'
                  className='freethedream__button'
                  data-as='job'
                  onClick={handleTakeOn}
                >
                  {intl.formatMessage(messages.asJob)}
                </button>
              </>
            ) : (
              <button
                type='button'
                className='freethedream__button'
                onClick={toggleChoosing}
              >
                {intl.formatMessage(messages.makeHappen)}
              </button>
            ))
          )}
        </div>
      )}

      {item.kind === 'offer' && item.need && (
        <p className='freethedream-status'>
          <FormattedMessage
            id='freethedream.offer_for'
            defaultMessage='for {need}'
            values={{
              need: (
                <Link to={`/hub/freethedream/i/${item.need.id}`}>
                  {item.need.title}
                </Link>
              ),
            }}
          />
          {' · '}
          <FormattedMessage
            id='freethedream.amount'
            defaultMessage='{count} offered'
            values={{ count: item.quantity }}
          />
        </p>
      )}

      <div className='freethedream-actions'>
        {item.can.take_over && (
          <button
            type='button'
            className='freethedream__button'
            onClick={handleTakeOver}
          >
            {intl.formatMessage(messages.takeOver)}
          </button>
        )}
        {item.can.edit && (
          <button
            type='button'
            className='freethedream__link'
            onClick={openEdit}
          >
            {intl.formatMessage(messages.edit)}
          </button>
        )}
        {item.can.hand_over && (
          <button
            type='button'
            className='freethedream__link'
            onClick={openHandOver}
          >
            {intl.formatMessage(messages.handOver)}
          </button>
        )}
        {item.can.remove && (
          <button
            type='button'
            className='freethedream__link freethedream__link--danger'
            onClick={askRemove}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        )}
      </div>

      {item.up_for_grabs && item.can.take_over && (
        <p className='freethedream__quiet'>
          {intl.formatMessage(messages.upForGrabs)}
        </p>
      )}

      {item.offers.length > 0 && (
        <Section title={intl.formatMessage(messages.offers)}>
          <ul className='freethedream-rows'>
            {item.offers.map((offer) => (
              <li key={offer.id}>
                <Link
                  to={`/hub/freethedream/i/${offer.id}`}
                  className='freethedream-row'
                >
                  <span className='freethedream-row__title'>{offer.title}</span>
                  <span className='freethedream-row__meta'>
                    {offer.owner?.display_name} ·{' '}
                    {formatAmount(offer.quantity, offer.unit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {item.claims.length > 0 && (
        <Section title={intl.formatMessage(messages.claimedBy)}>
          <People accounts={item.claims} />
        </Section>
      )}

      <Section title={intl.formatMessage(messages.showsIn)}>
        <ul className='freethedream-links'>
          {item.placements.map((p) => (
            <li key={p.id}>
              <Link to={`/hub/freethedream/p/${p.id}`}>{p.title}</Link>
              {item.can.unplace && (
                <button
                  type='button'
                  className='freethedream__link'
                  data-id={p.id}
                  onClick={handleUnplace}
                >
                  {intl.formatMessage(messages.unplace)}
                </button>
              )}
            </li>
          ))}
        </ul>
        {item.can.place && placeOptions.length > 0 && (
          <select
            className='freethedream__input freethedream__input--inline'
            value=''
            onChange={handlePlace}
            aria-label={intl.formatMessage(messages.alsoUnder)}
          >
            <option value=''>{intl.formatMessage(messages.alsoUnder)}</option>
            {placeOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {'  '.repeat(p.depth)}
                {p.title}
              </option>
            ))}
          </select>
        )}
      </Section>

      <Talk
        subjectType='item'
        subjectId={item.id}
        comments={item.comments}
        canComment={item.can.comment}
      />

      {composer === 'edit' && (
        <ItemComposer
          kind={item.kind}
          editing={item}
          onCancel={close}
          onSaved={handleSaved}
        />
      )}
      {composer === 'hand_over' && (
        <HandOver
          rootId={item.root.id}
          title={item.title}
          selfId={accountId}
          onHandOver={handleHandOver}
          onCancel={close}
        />
      )}
      {confirmRemove && (
        <ConfirmDialog
          title={intl.formatMessage(messages.removeTitle, {
            title: item.title,
          })}
          message={intl.formatMessage(messages.removeBody)}
          confirmLabel={intl.formatMessage(messages.remove)}
          destructive
          onConfirm={handleRemove}
          onCancel={cancelRemove}
        />
      )}
    </div>
  );
};
