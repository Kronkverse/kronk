import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import HeadphonesIcon from '@/material-icons/400-24px/headphones.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import ReportIcon from '@/material-icons/400-24px/report.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../types';

type SpaceKey =
  | 'feed'
  | 'huddle'
  | 'kalendar'
  | 'kommons'
  | 'hub'
  | 'new-space';
type ProposalType = 'bug' | 'feature';
type WizardStep =
  | 'space'
  | 'type'
  | 'bug-form'
  | 'feature-form'
  | 'new-space-form';

const SPACE_CATEGORY: Record<SpaceKey, string> = {
  feed: 'timeline',
  huddle: 'huddle',
  kalendar: 'events',
  kommons: 'governance',
  hub: 'app',
  'new-space': 'governance',
};

interface Props {
  onCreated: (proposal: Proposal) => void;
  onCancel: () => void;
}

export const SpaceProposalWizard: React.FC<Props> = ({
  onCreated,
  onCancel,
}) => {
  const [step, setStep] = useState<WizardStep>('space');
  const [selectedSpace, setSelectedSpace] = useState<SpaceKey | null>(null);

  const [bugName, setBugName] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState(1);

  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');

  const [spaceName, setSpaceName] = useState('');
  const [spaceProposal, setSpaceProposal] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Space picker
  const handleSpaceBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const space = e.currentTarget.dataset.space as SpaceKey;
      setSelectedSpace(space);
      setStep(space === 'new-space' ? 'new-space-form' : 'type');
    },
    [],
  );

  // Type picker
  const handleTypeBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const type = e.currentTarget.dataset.type as ProposalType;
      setStep(type === 'bug' ? 'bug-form' : 'feature-form');
    },
    [],
  );

  const handleBackToSpace = useCallback(() => {
    setStep('space');
    setSelectedSpace(null);
    setError(null);
  }, []);

  const handleBackToType = useCallback(() => {
    setStep('type');
    setError(null);
  }, []);

  // Field change handlers
  const handleBugNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBugName(e.target.value);
    },
    [],
  );

  const handleBugDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBugDescription(e.target.value);
    },
    [],
  );

  const handleBugSeverityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBugSeverity(Number(e.target.value));
    },
    [],
  );

  const handleFeatureNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFeatureName(e.target.value);
    },
    [],
  );

  const handleFeatureDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setFeatureDescription(e.target.value);
    },
    [],
  );

  const handleSpaceNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSpaceName(e.target.value);
    },
    [],
  );

  const handleSpaceProposalChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSpaceProposal(e.target.value);
    },
    [],
  );

  // Submission
  const handleSubmit = useCallback(
    async (title: string, formattedBody: string, space: SpaceKey) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await api().post('/api/v1/proposals', {
          proposal: {
            title,
            body: formattedBody,
            categories: [SPACE_CATEGORY[space]],
          },
        });
        onCreated(res.data as Proposal);
      } catch {
        setError('Something went wrong. Please try again.');
        setSubmitting(false);
      }
    },
    [onCreated],
  );

  const handleSubmitBug = useCallback(() => {
    if (!selectedSpace) return;
    void handleSubmit(
      bugName,
      `[Severity: ${bugSeverity}/47]\n\n${bugDescription}`,
      selectedSpace,
    );
  }, [selectedSpace, bugName, bugDescription, bugSeverity, handleSubmit]);

  const handleSubmitFeature = useCallback(() => {
    if (!selectedSpace) return;
    void handleSubmit(featureName, featureDescription, selectedSpace);
  }, [selectedSpace, featureName, featureDescription, handleSubmit]);

  const handleSubmitNewSpace = useCallback(() => {
    void handleSubmit(spaceName, spaceProposal, 'new-space');
  }, [spaceName, spaceProposal, handleSubmit]);

  if (step === 'space') {
    return (
      <div>
        <h2 className='wizard-heading'>
          <FormattedMessage
            id='governance.wizard.pick_space'
            defaultMessage='Where does this belong?'
          />
        </h2>
        <p className='wizard-subheading'>
          <FormattedMessage
            id='governance.wizard.pick_space_hint'
            defaultMessage='Choose the Kronk space this proposal is about.'
          />
        </p>

        <div className='wizard-space-picker'>
          <button
            className='wizard-space-btn'
            data-space='feed'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='home' icon={HomeIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.feed'
                defaultMessage='Feed'
              />
            </span>
          </button>

          <button
            className='wizard-space-btn'
            data-space='huddle'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='headphones' icon={HeadphonesIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.huddle'
                defaultMessage='Huddle'
              />
            </span>
          </button>

          <button
            className='wizard-space-btn'
            data-space='kalendar'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='calendar_month' icon={CalendarIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.kalendar'
                defaultMessage='₭alendar'
              />
            </span>
          </button>

          <button
            className='wizard-space-btn'
            data-space='kommons'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='gavel' icon={GavelIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.kommons'
                defaultMessage='₭ommons'
              />
            </span>
          </button>

          <button
            className='wizard-space-btn'
            data-space='hub'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='explore' icon={ExploreIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.hub'
                defaultMessage='Hub'
              />
            </span>
          </button>

          <button
            className='wizard-space-btn wizard-space-btn--new'
            data-space='new-space'
            onClick={handleSpaceBtnClick}
          >
            <Icon id='add' icon={AddIcon} />
            <span>
              <FormattedMessage
                id='governance.wizard.space.new'
                defaultMessage='New space'
              />
            </span>
          </button>
        </div>

        <button className='wizard-back-btn' onClick={onCancel}>
          <FormattedMessage
            id='governance.wizard.cancel'
            defaultMessage='Cancel'
          />
        </button>
      </div>
    );
  }

  if (step === 'type') {
    return (
      <div>
        <button className='wizard-back-btn' onClick={handleBackToSpace}>
          <FormattedMessage
            id='governance.wizard.back'
            defaultMessage='← Back'
          />
        </button>

        <h2 className='wizard-heading'>
          <FormattedMessage
            id='governance.wizard.pick_type'
            defaultMessage='What kind of seed?'
          />
        </h2>

        <div className='wizard-type-picker'>
          <button
            className='wizard-type-btn'
            data-type='bug'
            onClick={handleTypeBtnClick}
          >
            <Icon id='report' icon={ReportIcon} />
            <FormattedMessage
              id='governance.wizard.type.bug'
              defaultMessage='Bug'
            />
          </button>

          <button
            className='wizard-type-btn'
            data-type='feature'
            onClick={handleTypeBtnClick}
          >
            <Icon id='add' icon={AddIcon} />
            <FormattedMessage
              id='governance.wizard.type.feature'
              defaultMessage='New Feature'
            />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'bug-form') {
    return (
      <div>
        <button className='wizard-back-btn' onClick={handleBackToType}>
          <FormattedMessage
            id='governance.wizard.back'
            defaultMessage='← Back'
          />
        </button>

        <h2 className='wizard-heading'>
          <FormattedMessage
            id='governance.wizard.bug.heading'
            defaultMessage='Report a bug'
          />
        </h2>

        {error && <p className='governance-form__error'>{error}</p>}

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.wizard.field.name'
              defaultMessage='Name'
            />
          </span>
          <input
            className='governance-form__input'
            type='text'
            required
            maxLength={240}
            value={bugName}
            onChange={handleBugNameChange}
            placeholder='Short title for the bug'
          />
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.wizard.field.description'
              defaultMessage='Description'
            />
          </span>
          <textarea
            className='governance-form__textarea'
            required
            value={bugDescription}
            onChange={handleBugDescChange}
            placeholder='Describe what happened and how to reproduce it'
            rows={5}
          />
        </label>

        <div className='wizard-severity'>
          <span className='wizard-severity__label'>
            <FormattedMessage
              id='governance.wizard.bug.severity_label'
              defaultMessage='How bad is the bug?'
            />
          </span>
          <div className='wizard-severity__track'>
            <input
              className='wizard-severity__input'
              type='range'
              min={1}
              max={47}
              value={bugSeverity}
              onChange={handleBugSeverityChange}
            />
            <span className='wizard-severity__value'>{bugSeverity}</span>
          </div>
        </div>

        <div className='governance-form__actions'>
          <button
            className='governance-form__cancel-btn'
            onClick={handleBackToType}
            disabled={submitting}
          >
            <FormattedMessage
              id='governance.wizard.back'
              defaultMessage='← Back'
            />
          </button>
          <button
            className='governance-form__submit-btn'
            onClick={handleSubmitBug}
            disabled={submitting || !bugName.trim() || !bugDescription.trim()}
          >
            <FormattedMessage
              id='governance.wizard.submit'
              defaultMessage='Plant seed'
            />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'feature-form') {
    return (
      <div>
        <button className='wizard-back-btn' onClick={handleBackToType}>
          <FormattedMessage
            id='governance.wizard.back'
            defaultMessage='← Back'
          />
        </button>

        <h2 className='wizard-heading'>
          <FormattedMessage
            id='governance.wizard.feature.heading'
            defaultMessage='New feature idea'
          />
        </h2>

        {error && <p className='governance-form__error'>{error}</p>}

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.wizard.field.name'
              defaultMessage='Name'
            />
          </span>
          <input
            className='governance-form__input'
            type='text'
            required
            maxLength={240}
            value={featureName}
            onChange={handleFeatureNameChange}
            placeholder='Short title for the feature'
          />
        </label>

        <label className='governance-form__label'>
          <span className='governance-form__label-text'>
            <FormattedMessage
              id='governance.wizard.field.description'
              defaultMessage='Description'
            />
          </span>
          <textarea
            className='governance-form__textarea'
            required
            value={featureDescription}
            onChange={handleFeatureDescChange}
            placeholder='Describe the feature and why it would be useful'
            rows={5}
          />
        </label>

        <div className='governance-form__actions'>
          <button
            className='governance-form__cancel-btn'
            onClick={handleBackToType}
            disabled={submitting}
          >
            <FormattedMessage
              id='governance.wizard.back'
              defaultMessage='← Back'
            />
          </button>
          <button
            className='governance-form__submit-btn'
            onClick={handleSubmitFeature}
            disabled={
              submitting || !featureName.trim() || !featureDescription.trim()
            }
          >
            <FormattedMessage
              id='governance.wizard.submit'
              defaultMessage='Plant seed'
            />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className='wizard-back-btn' onClick={handleBackToSpace}>
        <FormattedMessage id='governance.wizard.back' defaultMessage='← Back' />
      </button>

      <h2 className='wizard-heading'>
        <FormattedMessage
          id='governance.wizard.new_space.heading'
          defaultMessage='Propose a new space'
        />
      </h2>

      {error && <p className='governance-form__error'>{error}</p>}

      <label className='governance-form__label'>
        <span className='governance-form__label-text'>
          <FormattedMessage
            id='governance.wizard.field.name'
            defaultMessage='Name'
          />
        </span>
        <input
          className='governance-form__input'
          type='text'
          required
          maxLength={240}
          value={spaceName}
          onChange={handleSpaceNameChange}
          placeholder='Name of the proposed space'
        />
      </label>

      <label className='governance-form__label'>
        <span className='governance-form__label-text'>
          <FormattedMessage
            id='governance.wizard.field.proposal'
            defaultMessage='Proposal'
          />
        </span>
        <textarea
          className='governance-form__textarea'
          required
          value={spaceProposal}
          onChange={handleSpaceProposalChange}
          placeholder='Describe what this space would be for and why Kronk needs it'
          rows={5}
        />
      </label>

      <div className='governance-form__actions'>
        <button
          className='governance-form__cancel-btn'
          onClick={handleBackToSpace}
          disabled={submitting}
        >
          <FormattedMessage
            id='governance.wizard.back'
            defaultMessage='← Back'
          />
        </button>
        <button
          className='governance-form__submit-btn'
          onClick={handleSubmitNewSpace}
          disabled={submitting || !spaceName.trim() || !spaceProposal.trim()}
        >
          <FormattedMessage
            id='governance.wizard.submit'
            defaultMessage='Plant seed'
          />
        </button>
      </div>
    </div>
  );
};
