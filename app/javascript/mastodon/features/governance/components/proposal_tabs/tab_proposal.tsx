import { useCallback, useState } from 'react';

import { FormattedMessage, FormattedDate } from 'react-intl';

import api from 'mastodon/api';
import { me } from 'mastodon/initial_state';

import type { Proposal } from '../../types';

const VOTE_POSITIONS = ['agree', 'abstain', 'block'] as const;
type VotePosition = (typeof VOTE_POSITIONS)[number];

export const TabProposal: React.FC<{
  proposal: Proposal;
  onVoteUpdate: (updated: Proposal) => void;
}> = ({ proposal, onVoteUpdate }) => {
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const handleVote = useCallback(
    async (position: VotePosition) => {
      setVoting(true);
      setVoteError(null);
      try {
        const res = await api().patch<Proposal>(
          `/api/v1/proposals/${proposal.id}/vote`,
          { vote: { position } },
        );
        onVoteUpdate(res.data);
      } catch (err) {
        setVoteError('Failed to record vote.');
        console.error('Vote failed:', err);
      } finally {
        setVoting(false);
      }
    },
    [proposal.id, onVoteUpdate],
  );

  const handleAgree = useCallback(
    () => { void handleVote('agree'); },
    [handleVote],
  );
  const handleAbstain = useCallback(
    () => { void handleVote('abstain'); },
    [handleVote],
  );
  const handleBlock = useCallback(
    () => { void handleVote('block'); },
    [handleVote],
  );

  const currentPosition = proposal.current_vote?.position as
    | VotePosition
    | undefined;

  return (
    <div className='governance-tab-proposal'>
      <section className='governance-tab-proposal__body'>
        <p className='governance-tab-proposal__body-text'>{proposal.body}</p>
      </section>

      {me && (
        <section className='governance-tab-proposal__vote'>
          <h4 className='governance-tab-proposal__section-heading'>
            <FormattedMessage
              id='governance.vote.heading'
              defaultMessage='Your vote'
            />
          </h4>
          {voteError && (
            <p className='governance-tab-proposal__error'>{voteError}</p>
          )}
          <div className='governance-tab-proposal__vote-buttons'>
            <button
              type='button'
              disabled={voting}
              className={`governance-tab-proposal__vote-btn governance-tab-proposal__vote-btn--agree${currentPosition === 'agree' ? ' active' : ''}`}
              onClick={handleAgree}
            >
              <FormattedMessage
                id='governance.vote.agree'
                defaultMessage='Agree'
              />
            </button>
            <button
              type='button'
              disabled={voting}
              className={`governance-tab-proposal__vote-btn governance-tab-proposal__vote-btn--abstain${currentPosition === 'abstain' ? ' active' : ''}`}
              onClick={handleAbstain}
            >
              <FormattedMessage
                id='governance.vote.abstain'
                defaultMessage='Abstain'
              />
            </button>
            <button
              type='button'
              disabled={voting}
              className={`governance-tab-proposal__vote-btn governance-tab-proposal__vote-btn--block${currentPosition === 'block' ? ' active' : ''}`}
              onClick={handleBlock}
            >
              <FormattedMessage
                id='governance.vote.block'
                defaultMessage='Block'
              />
            </button>
          </div>
          <div className='governance-tab-proposal__vote-summary'>
            <span className='governance-tab-proposal__vote-count governance-tab-proposal__vote-count--agree'>
              <FormattedMessage
                id='governance.vote.agree_count'
                defaultMessage='{n} agree'
                values={{ n: proposal.vote_summary.agree }}
              />
            </span>
            <span className='governance-tab-proposal__vote-count governance-tab-proposal__vote-count--abstain'>
              <FormattedMessage
                id='governance.vote.abstain_count'
                defaultMessage='{n} abstain'
                values={{ n: proposal.vote_summary.abstain }}
              />
            </span>
            <span className='governance-tab-proposal__vote-count governance-tab-proposal__vote-count--block'>
              <FormattedMessage
                id='governance.vote.block_count'
                defaultMessage='{n} block'
                values={{ n: proposal.vote_summary.block }}
              />
            </span>
          </div>
        </section>
      )}

      {proposal.voters.length > 0 && (
        <section className='governance-tab-proposal__voters'>
          <h4 className='governance-tab-proposal__section-heading'>
            <FormattedMessage
              id='governance.voters.heading'
              defaultMessage='Votes'
            />
          </h4>
          <ul className='governance-tab-proposal__voter-list'>
            {proposal.voters.map((voter) => (
              <li
                key={voter.id}
                className={`governance-tab-proposal__voter governance-tab-proposal__voter--${voter.position}`}
              >
                <img
                  className='governance-tab-proposal__voter-avatar'
                  src={voter.account.avatar}
                  alt={voter.account.display_name}
                />
                <div className='governance-tab-proposal__voter-info'>
                  <span className='governance-tab-proposal__voter-name'>
                    @{voter.account.username}
                  </span>
                  <span
                    className={`governance-tab-proposal__voter-position governance-tab-proposal__voter-position--${voter.position}`}
                  >
                    {voter.position}
                  </span>
                  {voter.statement && (
                    <p className='governance-tab-proposal__voter-statement'>
                      {voter.statement}
                    </p>
                  )}
                </div>
                <time className='governance-tab-proposal__voter-date'>
                  <FormattedDate
                    value={voter.created_at}
                    day='numeric'
                    month='short'
                  />
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {proposal.challenges.length > 0 && (
        <section className='governance-tab-proposal__challenges'>
          <h4 className='governance-tab-proposal__section-heading'>
            <FormattedMessage
              id='governance.challenges.heading'
              defaultMessage='Challenges'
            />
          </h4>
          {proposal.challenges.map((challenge) => (
            <div
              key={challenge.id}
              className='governance-tab-proposal__challenge'
            >
              <div className='governance-tab-proposal__challenge-header'>
                <img
                  className='governance-tab-proposal__voter-avatar'
                  src={challenge.account.avatar}
                  alt={challenge.account.display_name}
                />
                <span className='governance-tab-proposal__voter-name'>
                  @{challenge.account.username}
                </span>
              </div>
              {challenge.statement && (
                <p className='governance-tab-proposal__challenge-statement'>
                  {challenge.statement}
                </p>
              )}
              {challenge.conditions.length > 0 && (
                <ul className='governance-tab-proposal__conditions'>
                  {challenge.conditions.map((condition) => (
                    <li
                      key={condition.id}
                      className={`governance-tab-proposal__condition${condition.met ? ' governance-tab-proposal__condition--met' : ''}`}
                    >
                      <span className='governance-tab-proposal__condition-text'>
                        {condition.text}
                      </span>
                      {condition.met && condition.met_at && (
                        <time className='governance-tab-proposal__condition-met'>
                          <FormattedMessage
                            id='governance.condition.met_at'
                            defaultMessage='Met {date}'
                            values={{
                              date: (
                                <FormattedDate
                                  value={condition.met_at}
                                  day='numeric'
                                  month='short'
                                />
                              ),
                            }}
                          />
                        </time>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
