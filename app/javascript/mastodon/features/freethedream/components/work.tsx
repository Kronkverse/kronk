import { useCallback } from 'react';

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import { apiFtdItemAction } from 'mastodon/api/freethedream';
import type {
  FtdItemKind,
  FtdItemRow,
  FtdProject,
  FtdStillNeeded,
} from 'mastodon/api_types/freethedream';

import { act } from './act';
import { BringControl } from './bring';
import { QuickAdd } from './quick_add';
import { formatAmount } from './shared';

// An emergence's work, list by list: what's still needed, Thing Bringing
// (gear and supplies), Actualise (ideas brought to life) and what's on
// offer, each with what's in the gangs inside it. On an emergence's
// landing page they're cards you swipe through and go into (Tal,
// 2026-10-15); a gang's page shows them in full.
//
// There are no Ideas any more (Tal, 2026-10-15): whoever has an idea adds
// it to Actualise and is on it straight away, and others jump on board.

export const WORK_LISTS = ['needed', 'bring', 'actualise', 'offers'] as const;
export type WorkList = (typeof WORK_LISTS)[number];

export const isWorkList = (s: string): s is WorkList =>
  (WORK_LISTS as readonly string[]).includes(s);

// Lists that were renamed or folded in, for old links.
export const RENAMED_LISTS: Record<string, WorkList> = {
  gear: 'bring',
  jobs: 'actualise',
  ideas: 'actualise',
};

export const workMessages = defineMessages({
  needed: { id: 'freethedream.still_needed', defaultMessage: 'Still needed' },
  bring: { id: 'freethedream.bring.title', defaultMessage: 'Thing Bringing' },
  actualise: {
    id: 'freethedream.actualise.title',
    defaultMessage: 'Actualise',
  },
  offers: { id: 'freethedream.offers.title', defaultMessage: 'On offer' },
});

const hints = defineMessages({
  needed: {
    id: 'freethedream.work.needed.hint',
    defaultMessage: 'What’s missing, across every gang',
  },
  bring: {
    id: 'freethedream.work.bring.hint',
    defaultMessage: 'Gear and supplies needed',
  },
  actualise: {
    id: 'freethedream.work.actualise.hint',
    defaultMessage: 'Bring an idea to life',
  },
  offers: {
    id: 'freethedream.work.offers.hint',
    defaultMessage: 'What people can bring',
  },
});

const messages = defineMessages({
  getInvolved: {
    id: 'freethedream.work.title',
    defaultMessage: 'Get involved',
  },
  forAll: {
    id: 'freethedream.gear.for_all',
    defaultMessage: 'For all of {title}',
  },
  offerSomething: {
    id: 'freethedream.offer_something',
    defaultMessage: '+ Offer something that isn’t on the list',
  },
  jumpOn: { id: 'freethedream.jump_on', defaultMessage: 'Jump on board' },
  stepOff: { id: 'freethedream.step_off', defaultMessage: 'Step off' },
  everythingSorted: {
    id: 'freethedream.still_needed.none',
    defaultMessage: 'Nothing outstanding.',
  },
  nothingYet: {
    id: 'freethedream.work.nothing_yet',
    defaultMessage: 'Nothing here yet.',
  },
  left: { id: 'freethedream.left', defaultMessage: '{amount} left' },
  covered: { id: 'freethedream.covered', defaultMessage: 'Covered' },
  nobodyOn: {
    id: 'freethedream.actualise.nobody',
    defaultMessage: 'Nobody on it yet',
  },
});

const KIND: Record<
  Exclude<WorkList, 'needed'>,
  Exclude<FtdItemKind, 'idea'>
> = {
  bring: 'need',
  actualise: 'job',
  offers: 'offer',
};

// Offers made against a need are someone bringing it, shown on the need.
// Old ideas never reach the client (the server leaves them out).
const inList = (kind: FtdItemKind) => (item: FtdItemRow) =>
  item.kind === kind && !(kind === 'offer' && item.need);

// How many things are in each list, here and in every section inside.
export const workCount = (project: FtdProject, list: WorkList) => {
  if (list === 'needed')
    return project.progress.total - project.progress.sorted;
  const fits = inList(KIND[list]);
  return (
    project.items.filter(fits).length +
    project.inside.reduce((n, g) => n + g.items.filter(fits).length, 0)
  );
};

// The landing page's way into the work: one card per list, swiped
// sideways.
export const WorkCards: React.FC<{ project: FtdProject }> = ({ project }) => {
  const intl = useIntl();
  return (
    <section className='freethedream-section'>
      <header className='freethedream-section__head'>
        <h3 className='freethedream-section__title'>
          {intl.formatMessage(messages.getInvolved)}
        </h3>
      </header>
      <ul className='freethedream-work'>
        {WORK_LISTS.map((list) => (
          <li key={list}>
            <Link
              to={`/hub/freethedream/p/${project.id}/${list}`}
              className='freethedream-work__card'
            >
              <span className='freethedream-work__title'>
                {intl.formatMessage(workMessages[list])}
                <span className='freethedream-work__count'>
                  {workCount(project, list)}
                </span>
              </span>
              <span className='freethedream-work__hint'>
                {intl.formatMessage(hints[list])}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

// One list in full: what's on the emergence (or gang) itself, a way to add
// to it, then what's in each gang inside.
export const WorkBody: React.FC<{
  project: FtdProject;
  list: WorkList;
  refresh: () => void;
  onOffer: () => void;
}> = ({ project, list, refresh, onOffer }) => {
  const intl = useIntl();
  const member = project.membership === 'member';

  const handleClaim = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const { id, mine } = e.currentTarget.dataset;
      if (!id) return;
      void act(
        apiFtdItemAction(id, mine === 'true' ? 'unclaim' : 'claim').then(
          refresh,
        ),
      );
    },
    [refresh],
  );

  if (list === 'needed')
    return project.still_needed.length === 0 ? (
      <p className='freethedream__quiet'>
        {intl.formatMessage(messages.everythingSorted)}
      </p>
    ) : (
      <ul className='freethedream-rows'>
        {project.still_needed.map((item) => (
          <NeededRow
            key={item.id}
            item={item}
            member={member}
            onClaim={handleClaim}
            onChange={refresh}
          />
        ))}
      </ul>
    );

  const kind = KIND[list];
  const fits = inList(kind);
  const own = project.items.filter(fits);
  const groups = project.inside
    .map((g) => ({ section: g.section, items: g.items.filter(fits) }))
    .filter((g) => g.items.length > 0);
  const row = (item: FtdItemRow) => (
    <ItemRow
      key={item.id}
      item={item}
      member={member}
      onClaim={handleClaim}
      onChange={refresh}
    />
  );

  if (own.length === 0 && groups.length === 0 && !project.can.add)
    return (
      <p className='freethedream__quiet'>
        {intl.formatMessage(messages.nothingYet)}
      </p>
    );

  return (
    <>
      {groups.length > 0 && (
        <h4 className='freethedream-section__sub'>
          {intl.formatMessage(messages.forAll, { title: project.title })}
        </h4>
      )}
      {own.length > 0 && <ul className='freethedream-rows'>{own.map(row)}</ul>}
      {project.can.add &&
        (kind === 'offer' ? (
          <button
            type='button'
            className='freethedream__link freethedream-section__more'
            onClick={onOffer}
          >
            {intl.formatMessage(messages.offerSomething)}
          </button>
        ) : (
          <QuickAdd kind={kind} projectId={project.id} onAdded={refresh} />
        ))}
      {groups.map((group) => (
        <div key={group.section.id}>
          <h4 className='freethedream-section__sub'>
            <Link to={`/hub/freethedream/p/${group.section.id}`}>
              {group.section.title}
            </Link>
          </h4>
          <ul className='freethedream-rows'>{group.items.map(row)}</ul>
        </div>
      ))}
    </>
  );
};

const ItemRow: React.FC<{
  item: FtdItemRow;
  member: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: () => void;
}> = ({ item, member, onClaim, onChange }) => {
  switch (item.kind) {
    case 'need':
      return <NeedRow need={item} member={member} onChange={onChange} />;
    case 'job':
      return <JobRow job={item} member={member} onClaim={onClaim} />;
    default:
      return <OfferRow offer={item} />;
  }
};

// Who's bringing what, then what's left: "Sam 12 · Jo 14 · 4 left".
const Contributors: React.FC<{ need: FtdItemRow }> = ({ need }) => {
  const intl = useIntl();
  const left = need.left ?? 0;
  return (
    <span className='freethedream-row__meta'>
      {(need.contributors ?? []).map((c) => (
        <span key={c.offer_id} className='freethedream-contrib'>
          {c.account?.display_name} {formatAmount(c.quantity, need.unit)}
        </span>
      ))}
      <span className='freethedream-contrib'>
        {left > 0
          ? intl.formatMessage(messages.left, {
              amount: formatAmount(left, need.unit),
            })
          : intl.formatMessage(messages.covered)}
      </span>
    </span>
  );
};

// A need: the full amount, who's bringing what, and your Bring.
const NeedRow: React.FC<{
  need: FtdItemRow;
  member: boolean;
  onChange: () => void;
}> = ({ need, member, onChange }) => (
  <li className='freethedream-row freethedream-row--item'>
    <Link
      to={`/hub/freethedream/i/${need.id}`}
      className='freethedream-row__main'
    >
      <span className='freethedream-row__title'>
        {need.title}
        <span className='freethedream-row__count'>
          {formatAmount(need.quantity, need.unit)}
        </span>
        {(need.spare ?? 0) > 0 && (
          <span className='freethedream-tag'>
            <FormattedMessage
              id='freethedream.spare'
              defaultMessage='{count} spare'
              values={{ count: need.spare }}
            />
          </span>
        )}
      </span>
      <Contributors need={need} />
    </Link>
    {member && (
      <span className='freethedream-row__side'>
        <BringControl need={need} onChange={onChange} />
      </span>
    )}
  </li>
);

const ClaimButton: React.FC<{
  item: FtdItemRow;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ item, onClaim }) => {
  const intl = useIntl();
  return (
    <span className='freethedream-row__side'>
      <button
        type='button'
        className={
          item.claimed_by_me
            ? 'freethedream__link'
            : 'freethedream__button freethedream__button--small'
        }
        data-id={item.id}
        data-mine={item.claimed_by_me ? 'true' : 'false'}
        onClick={onClaim}
      >
        {intl.formatMessage(
          item.claimed_by_me ? messages.stepOff : messages.jumpOn,
        )}
      </button>
    </span>
  );
};

// Something in Actualise: who's on it, and Jump on board. Open-ended:
// anyone can, however many are on it already.
const JobRow: React.FC<{
  job: FtdItemRow;
  member: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ job, member, onClaim }) => {
  const intl = useIntl();
  const names = (job.claimers ?? [])
    .map((a) => a?.display_name)
    .filter(Boolean);
  return (
    <li className='freethedream-row freethedream-row--item'>
      <Link
        to={`/hub/freethedream/i/${job.id}`}
        className='freethedream-row__main'
      >
        <span className='freethedream-row__title'>{job.title}</span>
        <span className='freethedream-row__meta'>
          {names.length > 0
            ? names.join(', ')
            : intl.formatMessage(messages.nobodyOn)}
        </span>
      </Link>
      {member && <ClaimButton item={job} onClaim={onClaim} />}
    </li>
  );
};

const OfferRow: React.FC<{ offer: FtdItemRow }> = ({ offer }) => (
  <li>
    <Link to={`/hub/freethedream/i/${offer.id}`} className='freethedream-row'>
      <span className='freethedream-row__title'>
        {offer.title}
        {(offer.quantity > 1 || offer.unit) && (
          <span className='freethedream-row__count'>
            {formatAmount(offer.quantity, offer.unit)}
          </span>
        )}
      </span>
      <span className='freethedream-row__meta'>
        {offer.owner?.display_name}
      </span>
    </Link>
  </li>
);

// A row in Still needed: what's left (or that nobody is on it), which gang
// it's in, one tap to bring or jump on board.
const NeededRow: React.FC<{
  item: FtdStillNeeded;
  member: boolean;
  onClaim: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: () => void;
}> = ({ item, member, onClaim, onChange }) => {
  const intl = useIntl();
  const job = item.kind === 'job';
  return (
    <li className='freethedream-row freethedream-row--item'>
      <Link
        to={`/hub/freethedream/i/${item.id}`}
        className='freethedream-row__main'
      >
        <span className='freethedream-row__title'>{item.title}</span>
        <span className='freethedream-row__meta'>
          {item.section && `${item.section.title} · `}
          {job
            ? intl.formatMessage(messages.nobodyOn)
            : intl.formatMessage(messages.left, {
                amount: formatAmount(item.left ?? item.quantity, item.unit),
              })}
        </span>
      </Link>
      {member &&
        (job ? (
          <ClaimButton item={item} onClaim={onClaim} />
        ) : (
          <span className='freethedream-row__side'>
            <BringControl need={item} onChange={onChange} />
          </span>
        ))}
    </li>
  );
};
