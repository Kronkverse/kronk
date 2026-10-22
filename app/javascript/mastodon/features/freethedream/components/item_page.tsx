import { useCallback, useState } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link, useHistory, useParams } from 'react-router-dom';

import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiFtdHandOverItem,
  apiFtdItem,
  apiFtdItemAction,
  apiFtdPlace,
  apiFtdRemoveItem,
  apiFtdUnplace,
} from 'mastodon/api/freethedream';
import type { FtdItem } from 'mastodon/api_types/freethedream';
import { ConfirmDialog } from 'mastodon/components/confirm_dialog';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { useSpaceBack } from 'mastodon/components/space_back';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useIdentity } from 'mastodon/identity_context';

import { act } from './act';
import { BringControl, isCounted } from './bring';
import { FromMyMycelium } from './from_my_mycelium';
import { HandOver } from './hand_over';
import { ItemComposer } from './item_composer';
import {
  categoryMessages,
  Crumbs,
  formatAmount,
  formatNeed,
  kindMessages,
  Loading,
  People,
  Person,
  projectPath,
  Section,
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
  jumpOn: { id: 'freethedream.jump_on', defaultMessage: 'Jump on board' },
  stepOff: { id: 'freethedream.step_off', defaultMessage: 'Step off' },
  claimedBy: {
    id: 'freethedream.actualisers',
    defaultMessage: 'Actualising it',
  },
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
    defaultMessage: 'It goes from every gang it shows in.',
  },
  upForGrabs: {
    id: 'freethedream.item_up_for_grabs',
    defaultMessage:
      'Whoever added this has left. Anyone in the emergence can take it over.',
  },
  onBoard: {
    id: 'freethedream.on_board',
    defaultMessage: '{count, plural, one {# on board} other {# on board}}',
  },
  nobodyOn: {
    id: 'freethedream.actualise.nobody',
    defaultMessage: 'Nobody on it yet',
  },
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
  const [confirmRemove, setConfirmRemove] = useState(false);

  const refresh = useCallback(() => {
    void act(apiFtdItem(item.id).then(onChange));
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

  // Edit is on the Ж menu, owner only (docs/design.md: no inline Edit).
  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    openEdit,
    item.can.edit && composer === null,
  );

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
    void act(
      apiFtdItemAction(item.id, item.claimed_by_me ? 'unclaim' : 'claim').then(
        onChange,
      ),
    );
  }, [item.id, item.claimed_by_me, onChange]);

  const handleTakeOver = useCallback(() => {
    void act(apiFtdItemAction(item.id, 'take_over').then(onChange));
  }, [item.id, onChange]);

  const handlePlace = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const target = e.target.value;
      if (target) void act(apiFtdPlace(item.id, target).then(onChange));
    },
    [item.id, onChange],
  );
  const handleUnplace = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const target = e.currentTarget.dataset.id;
      if (target) void act(apiFtdUnplace(item.id, target).then(onChange));
    },
    [item.id, onChange],
  );

  const askRemove = useCallback(() => {
    setConfirmRemove(true);
  }, []);
  const cancelRemove = useCallback(() => {
    setConfirmRemove(false);
  }, []);
  // The space badge goes back to the part the item lives in.
  const home = item.placements[0] ?? item.root;
  useSpaceBack({ href: projectPath(home), label: home.title });

  const handleRemove = useCallback(() => {
    void act(
      apiFtdRemoveItem(item.id).then(() => {
        history.push(projectPath(home));
      }),
    );
  }, [item.id, home, history]);

  const placed = new Set(item.placements.map((p) => p.id));
  const placeOptions = item.all_parts.filter((p) => !placed.has(p.id));
  return (
    <KornerDetail
      className='freethedream-detail'
      title={
        <>
          {item.title}
          {item.kind === 'need' && (item.quantity > 1 || item.unit) && (
            <span className='freethedream-detail__amount'>
              {formatAmount(item.quantity, item.unit)}
            </span>
          )}
        </>
      }
      subtitle={
        item.placements.length === 1 &&
        item.placements[0]?.id !== item.root.id ? (
          <Crumbs trail={item.placements} />
        ) : null
      }
      meta={
        <KornerMeta
          items={[
            intl.formatMessage(kindMessages[item.kind]),
            item.category &&
              intl.formatMessage(categoryMessages[item.category]),
            <Person key='owner' account={item.owner} />,
          ]}
        />
      }
    >
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
      {item.body && <p className='freethedream-about__text'>{item.body}</p>}

      {item.kind === 'need' && (
        // How many are coming, of how many it asks for ("20+" when more is
        // welcome).
        <div className='freethedream-status'>
          <span>
            {(item.covered ?? 0) === 0 ? (
              <FormattedMessage
                id='freethedream.bring.nobody'
                defaultMessage='Nobody bringing yet'
              />
            ) : isCounted(item) ? (
              <FormattedMessage
                id='freethedream.bring.coming_of_plus'
                defaultMessage='{coming} coming, of {wanted}'
                values={{
                  coming: formatAmount(item.covered ?? 0, item.unit),
                  wanted: formatNeed(
                    item.quantity,
                    item.unit,
                    item.more_welcome,
                  ),
                }}
              />
            ) : (
              <FormattedMessage
                id='freethedream.bring.on_its_way'
                defaultMessage='On its way'
              />
            )}
          </span>
          {(item.covered ?? 0) >= item.quantity && (
            <span className='freethedream-tag freethedream-tag--flush'>
              <FormattedMessage
                id='freethedream.bring.sorted'
                defaultMessage='Sorted'
              />
            </span>
          )}
          {item.can.offer && <FromMyMycelium item={item} onDone={refresh} />}
          {item.can.offer && <BringControl need={item} onChange={onChange} />}
        </div>
      )}

      {item.kind === 'job' && (
        <div className='freethedream-status'>
          <span>
            {item.claims.length > 0
              ? intl.formatMessage(messages.onBoard, {
                  count: item.claims.length,
                })
              : intl.formatMessage(messages.nobodyOn)}
          </span>
          {item.can.claim && <FromMyMycelium item={item} onDone={refresh} />}
          {item.can.claim && (
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
                item.claimed_by_me ? messages.stepOff : messages.jumpOn,
              )}
            </button>
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

      {(item.can.take_over || item.can.hand_over || item.can.remove) && (
        <KornerActionBar>
          {item.can.take_over && (
            <KornerPill
              variant='primary'
              label={intl.formatMessage(messages.takeOver)}
              onClick={handleTakeOver}
            />
          )}
          {item.can.hand_over && (
            <KornerPill
              label={intl.formatMessage(messages.handOver)}
              onClick={openHandOver}
            />
          )}
          {item.can.remove && (
            <KornerPill
              variant='destructive'
              label={intl.formatMessage(messages.remove)}
              onClick={askRemove}
            />
          )}
        </KornerActionBar>
      )}

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
              <Link to={projectPath(p)}>{p.title}</Link>
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
        emergenceId={item.root.id}
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
    </KornerDetail>
  );
};
