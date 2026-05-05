import { useCallback, useState } from 'react';

import { FormattedRelativeTime } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import ReportIcon from '@/material-icons/400-24px/report.svg?react';
import SmartphoneIcon from '@/material-icons/400-24px/smartphone.svg?react';
import ToysFanIcon from '@/material-icons/400-24px/toys_fan.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';
import type { IconProp } from 'mastodon/components/icon';
import { me } from 'mastodon/initial_state';


import type { Proposal } from '../types';

interface CategoryMeta {
  icon: IconProp;
  id: string;
  label: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  timeline: { icon: HomeIcon, id: 'home', label: 'Feed' },
  huddle: { icon: Diversity2Icon, id: 'diversity_2', label: 'Huddle' },
  events: { icon: CalendarIcon, id: 'calendar_month', label: '₭alendar' },
  governance: { icon: GavelIcon, id: 'gavel', label: 'Governance' },
  app: { icon: SmartphoneIcon, id: 'smartphone', label: 'App' },
};

const stripBodyMeta = (body: string) =>
  body.replace(/^(\[.*?\]\s*\n?)+/s, '').trim();

const buildStripBackground = (summary: Proposal['vote_summary']) => {
  const total = summary.agree + summary.abstain + summary.block;
  if (total === 0) return undefined;
  const agreeEnd = (summary.agree / total) * 100;
  const abstainEnd = agreeEnd + (summary.abstain / total) * 100;
  return `linear-gradient(to bottom, var(--vote-agree) 0 ${agreeEnd}%, var(--vote-abstain) ${agreeEnd}% ${abstainEnd}%, var(--vote-block) ${abstainEnd}% 100%)`;
};

const truncate = (text: string, maxLen: number) =>
  text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;

export const ProposalCard: React.FC<{
  proposal: Proposal;
  onSelect: (id: string) => void;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onSelect, onVoteUpdate }) => {
  const [fanning, setFanning] = useState(false);

  const ageSeconds = Math.round(
    (new Date(proposal.created_at).getTime() - Date.now()) / 1000,
  );
  const stripBackground = buildStripBackground(proposal.vote_summary);
  const isFanned = proposal.current_vote?.position === 'agree';
  const isBug = /\[Severity:/i.test(proposal.body);
  const displayBody = truncate(stripBodyMeta(proposal.body), 160);

  const handleClick = useCallback(() => {
    onSelect(proposal.id);
  }, [onSelect, proposal.id]);

  const handleFan = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!me || fanning) return;
      setFanning(true);
      try {
        let res;
        if (isFanned) {
          res = await api().delete<Proposal>(
            `/api/v1/proposals/${proposal.id}/unvote`,
          );
        } else {
          res = await api().post<Proposal>(
            `/api/v1/proposals/${proposal.id}/vote`,
            { vote: { position: 'agree' } },
          );
        }
        onVoteUpdate(res.data);
      } catch {
        // silently ignore
      } finally {
        setFanning(false);
      }
    },
    [proposal.id, isFanned, fanning, onVoteUpdate],
  );

  const handleFanClick = useCallback(
    (e: React.MouseEvent) => {
      void handleFan(e);
    },
    [handleFan],
  );

  const spaceTags = proposal.categories
    .map((cat) => CATEGORY_META[cat])
    .filter((m): m is CategoryMeta => m !== undefined);

  return (
    <button
      className={`governance-card governance-card--${proposal.status}${proposal.archived_at ? ' governance-card--archived' : ''}`}
      onClick={handleClick}
    >
      <span
        className='governance-card__strip'
        style={stripBackground ? { background: stripBackground } : undefined}
        aria-hidden='true'
      />

      <div className='governance-card__inner'>
        <div className='governance-card__fan-col'>
          <span className='governance-card__fan-count'>
            {proposal.vote_summary.agree}
          </span>
          {me && (
            <button
              type='button'
              className={
                'governance-card__fan-btn' + (isFanned ? ' active' : '')
              }
              onClick={handleFanClick}
              disabled={fanning}
              aria-pressed={isFanned}
              aria-label={isFanned ? 'Unfan' : 'Fan'}
            >
              <Icon id='toys-fan' icon={ToysFanIcon} />
            </button>
          )}
        </div>

        <div className='governance-card__main'>
          <div className='governance-card__tags'>
            {spaceTags.map((meta) => (
              <span
                key={meta.id}
                className='governance-card__tag governance-card__tag--space'
              >
                <Icon id={meta.id} icon={meta.icon} />
                {meta.label}
              </span>
            ))}
            <span
              className={`governance-card__tag governance-card__tag--${isBug ? 'bug' : 'feature'}`}
            >
              <Icon
                id={isBug ? 'report' : 'add'}
                icon={isBug ? ReportIcon : AddIcon}
              />
              {isBug ? 'Bug' : 'Feature'}
            </span>
          </div>

          <h3 className='governance-card__title'>{proposal.title}</h3>

          {displayBody && (
            <p className='governance-card__body'>{displayBody}</p>
          )}

          <div className='governance-card__author'>
            {proposal.created_by_account.avatar && (
              <img
                className='governance-card__avatar'
                src={proposal.created_by_account.avatar}
                alt=''
                aria-hidden='true'
              />
            )}
            <span className='governance-card__author-name'>
              @{proposal.created_by_account.username}
            </span>
            <span className='governance-card__author-dot'>·</span>
            <span className='governance-card__author-time'>
              <FormattedRelativeTime
                value={ageSeconds}
                numeric='auto'
                updateIntervalInSeconds={60}
              />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
