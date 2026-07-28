// Detail panel — a compact card below the timeline that describes
// the current subject. Relationship to viewer, invite lineage stats,
// mate counts. Sits inside the canvas column so it flows with the
// timeline as the subject changes.

import { FormattedMessage } from 'react-intl';

import type { TimelineMember } from './use_mates_timeline';

interface TileInfo {
  member: TimelineMember;
  x: number;
  label: string;
  detail?: string;
}

interface DetailPanelProps {
  subject: TimelineMember;
  viewer: TimelineMember | null;
  mates: readonly TileInfo[];
  invitees: readonly TileInfo[];
  inviter: TimelineMember | null;
}

const formatShort = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const findMateDate = (
  subjectId: string,
  viewerId: string,
  mates: readonly TileInfo[],
): string | null => {
  // The mates list here is the subject's mates; if viewer is one of
  // them, find the bond date via the detail string ("mate since <iso>").
  const bond = mates.find((tile) => tile.member.id === viewerId);
  if (!bond?.detail) return null;
  return bond.detail.replace('mate since ', '');
};

export const DetailPanel = ({
  subject,
  viewer,
  mates,
  invitees,
  inviter,
}: DetailPanelProps) => {
  const isViewer = viewer?.id === subject.id;
  const mateDateWithViewer =
    viewer && !isViewer ? findMateDate(subject.id, viewer.id, mates) : null;

  return (
    <section className='mates-tab__detail'>
      <header className='mates-tab__detail-head'>
        <div className='mates-tab__detail-name'>
          {subject.display_name}
          <span className='mates-tab__detail-handle'>@{subject.handle}</span>
        </div>
        {subject.vouch_count > 0 && (
          <span className='mates-tab__detail-vouch' title='Vouches (Anthemos)'>
            ✧ {subject.vouch_count}
          </span>
        )}
      </header>

      {viewer && !isViewer && (
        <p className='mates-tab__detail-rel'>
          {mateDateWithViewer ? (
            <FormattedMessage
              id='mates_tab.detail.mate_since'
              defaultMessage='Your mate since {date}'
              values={{ date: formatShort(mateDateWithViewer) }}
            />
          ) : (
            <FormattedMessage
              id='mates_tab.detail.not_mate'
              defaultMessage='Not a direct mate of yours'
            />
          )}
        </p>
      )}

      <dl className='mates-tab__detail-grid'>
        <div>
          <dt>
            <FormattedMessage
              id='mates_tab.detail.joined'
              defaultMessage='Joined'
            />
          </dt>
          <dd>{formatShort(subject.joined_at)}</dd>
        </div>
        <div>
          <dt>
            <FormattedMessage
              id='mates_tab.detail.inviter'
              defaultMessage='Invited by'
            />
          </dt>
          <dd>
            {inviter ? (
              `@${inviter.handle}`
            ) : (
              <FormattedMessage
                id='mates_tab.detail.no_inviter'
                defaultMessage='—'
              />
            )}
          </dd>
        </div>
        <div>
          <dt>
            <FormattedMessage
              id='mates_tab.detail.mate_count'
              defaultMessage='Mates'
            />
          </dt>
          <dd>{mates.length}</dd>
        </div>
        <div>
          <dt>
            <FormattedMessage
              id='mates_tab.detail.invited_count'
              defaultMessage='Invited'
            />
          </dt>
          <dd>{invitees.length}</dd>
        </div>
      </dl>

      {subject.korners.length > 0 && (
        <div className='mates-tab__detail-korners'>
          <span className='mates-tab__detail-korners-label'>
            <FormattedMessage
              id='mates_tab.detail.korners'
              defaultMessage='Korners'
            />
          </span>
          <span className='mates-tab__detail-korners-list'>
            {subject.korners.map((k) => (
              <span key={k} className='mates-tab__detail-korner-chip'>
                {k}
              </span>
            ))}
          </span>
        </div>
      )}
    </section>
  );
};
