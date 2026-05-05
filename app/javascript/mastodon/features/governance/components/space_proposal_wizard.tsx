import { useCallback, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import CalendarIcon from '@/material-icons/400-24px/calendar_month.svg?react';
import CodeIcon from '@/material-icons/400-24px/code.svg?react';
import Diversity2Icon from '@/material-icons/400-24px/diversity_2.svg?react';
import ExploreIcon from '@/material-icons/400-24px/explore.svg?react';
import GavelIcon from '@/material-icons/400-24px/gavel.svg?react';
import HomeIcon from '@/material-icons/400-24px/home.svg?react';
import MailIcon from '@/material-icons/400-24px/mail.svg?react';
import PersonAddIcon from '@/material-icons/400-24px/person_add.svg?react';
import ReportIcon from '@/material-icons/400-24px/report.svg?react';
import SettingsIcon from '@/material-icons/400-24px/settings.svg?react';
import SmartphoneIcon from '@/material-icons/400-24px/smartphone.svg?react';
import TuneIcon from '@/material-icons/400-24px/tune.svg?react';
import api from 'mastodon/api';
import { Icon } from 'mastodon/components/icon';

import type { Proposal } from '../types';

type SpaceKey =
  | 'feed'
  | 'huddle'
  | 'kalendar'
  | 'kommons'
  | 'hub'
  | 'app'
  | 'general'
  | 'new-space';

type GeneralSubcategory = 'signup-flow' | 'invitations' | 'governance' | 'code';
type ProposalType = 'bug' | 'feature' | 'refine';

const SPACE_CATEGORY: Record<SpaceKey, string> = {
  feed: 'timeline',
  huddle: 'huddle',
  kalendar: 'events',
  kommons: 'governance',
  hub: 'app',
  app: 'app',
  general: 'governance',
  'new-space': 'governance',
};

const GENERAL_SUBCATEGORY_LABELS: Record<GeneralSubcategory, string> = {
  'signup-flow': 'Signup Flow',
  invitations: 'Invitations',
  governance: 'Governance',
  code: 'Code',
};

interface Props {
  onCreated: (proposal: Proposal) => void;
  onCancel: () => void;
}

export const SpaceProposalWizard: React.FC<Props> = ({
  onCreated,
  onCancel,
}) => {
  const [selectedSpace, setSelectedSpace] = useState<SpaceKey | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<GeneralSubcategory | null>(null);
  const [selectedType, setSelectedType] = useState<ProposalType | null>(null);

  const [bugName, setBugName] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState(1);

  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');

  const [refineName, setRefineName] = useState('');
  const [refineDescription, setRefineDescription] = useState('');

  const [spaceName, setSpaceName] = useState('');
  const [spaceProposal, setSpaceProposal] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSpaceBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const space = e.currentTarget.dataset.space as SpaceKey;
      setSelectedSpace(space);
      setSelectedSubcategory(null);
      setSelectedType(null);
      setError(null);
    },
    [],
  );

  const handleSubcategoryBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const sub = e.currentTarget.dataset.sub as GeneralSubcategory;
      setSelectedSubcategory(sub);
      setSelectedType(null);
      setError(null);
    },
    [],
  );

  const handleTypeBtnClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const type = e.currentTarget.dataset.type as ProposalType;
      setSelectedType(type);
      setError(null);
    },
    [],
  );

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

  const handleRefineNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRefineName(e.target.value);
    },
    [],
  );

  const handleRefineDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRefineDescription(e.target.value);
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
    const subLabel =
      selectedSubcategory !== null
        ? `[${GENERAL_SUBCATEGORY_LABELS[selectedSubcategory]}] `
        : '';
    void handleSubmit(
      bugName,
      `${subLabel}[Severity: ${bugSeverity}/47]\n\n${bugDescription}`,
      selectedSpace,
    );
  }, [
    selectedSpace,
    selectedSubcategory,
    bugName,
    bugDescription,
    bugSeverity,
    handleSubmit,
  ]);

  const handleSubmitFeature = useCallback(() => {
    if (!selectedSpace) return;
    const subLabel =
      selectedSubcategory !== null
        ? `[${GENERAL_SUBCATEGORY_LABELS[selectedSubcategory]}] `
        : '';
    void handleSubmit(
      featureName,
      `${subLabel}${featureDescription}`,
      selectedSpace,
    );
  }, [
    selectedSpace,
    selectedSubcategory,
    featureName,
    featureDescription,
    handleSubmit,
  ]);

  const handleSubmitRefine = useCallback(() => {
    if (!selectedSpace) return;
    const subLabel =
      selectedSubcategory !== null
        ? `[${GENERAL_SUBCATEGORY_LABELS[selectedSubcategory]}] `
        : '';
    void handleSubmit(
      refineName,
      `${subLabel}[Refine]\n\n${refineDescription}`,
      selectedSpace,
    );
  }, [
    selectedSpace,
    selectedSubcategory,
    refineName,
    refineDescription,
    handleSubmit,
  ]);
  const handleSubmitNewSpace = useCallback(() => {
    void handleSubmit(
      spaceName,
      '[New Space]\n\n' + spaceProposal,
      'new-space',
    );
  }, [spaceName, spaceProposal, handleSubmit]);

  const showSubcategoryRow = selectedSpace === 'general';
  const showTypeRow =
    selectedSpace !== null &&
    selectedSpace !== 'new-space' &&
    (selectedSpace !== 'general' || selectedSubcategory !== null);
  const showNewSpaceForm = selectedSpace === 'new-space';
  const showBugForm = showTypeRow && selectedType === 'bug';
  const showFeatureForm = showTypeRow && selectedType === 'feature';
  const showRefineForm = showTypeRow && selectedType === 'refine';

  return (
    <div className='wizard'>
      {/* Row 1: Space picker */}
      <div className='wizard-space-picker'>
        <button
          className={`wizard-space-btn${selectedSpace === 'feed' ? ' wizard-space-btn--selected' : ''}`}
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
          className={`wizard-space-btn${selectedSpace === 'huddle' ? ' wizard-space-btn--selected' : ''}`}
          data-space='huddle'
          onClick={handleSpaceBtnClick}
        >
          <Icon id='diversity_2' icon={Diversity2Icon} />
          <span>
            <FormattedMessage
              id='governance.wizard.space.huddle'
              defaultMessage='Huddle'
            />
          </span>
        </button>

        <button
          className={`wizard-space-btn${selectedSpace === 'kalendar' ? ' wizard-space-btn--selected' : ''}`}
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
          className={`wizard-space-btn${selectedSpace === 'kommons' ? ' wizard-space-btn--selected' : ''}`}
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
          className={`wizard-space-btn${selectedSpace === 'hub' ? ' wizard-space-btn--selected' : ''}`}
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
          className={`wizard-space-btn${selectedSpace === 'app' ? ' wizard-space-btn--selected' : ''}`}
          data-space='app'
          onClick={handleSpaceBtnClick}
        >
          <Icon id='smartphone' icon={SmartphoneIcon} />
          <span>
            <FormattedMessage
              id='governance.wizard.space.app'
              defaultMessage='App'
            />
          </span>
        </button>

        <button
          className={`wizard-space-btn${selectedSpace === 'general' ? ' wizard-space-btn--selected' : ''}`}
          data-space='general'
          onClick={handleSpaceBtnClick}
        >
          <Icon id='settings' icon={SettingsIcon} />
          <span>
            <FormattedMessage
              id='governance.wizard.space.general'
              defaultMessage='General'
            />
          </span>
        </button>

        <button
          className={`wizard-space-btn wizard-space-btn--new${selectedSpace === 'new-space' ? ' wizard-space-btn--selected' : ''}`}
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

      {/* Row 2a: General subcategory picker */}
      {showSubcategoryRow && (
        <div className='wizard-type-picker'>
          <button
            className={`wizard-type-btn${selectedSubcategory === 'signup-flow' ? ' wizard-type-btn--selected' : ''}`}
            data-sub='signup-flow'
            onClick={handleSubcategoryBtnClick}
          >
            <Icon id='person_add' icon={PersonAddIcon} />
            <FormattedMessage
              id='governance.wizard.general.signup_flow'
              defaultMessage='Signup Flow'
            />
          </button>

          <button
            className={`wizard-type-btn${selectedSubcategory === 'invitations' ? ' wizard-type-btn--selected' : ''}`}
            data-sub='invitations'
            onClick={handleSubcategoryBtnClick}
          >
            <Icon id='mail' icon={MailIcon} />
            <FormattedMessage
              id='governance.wizard.general.invitations'
              defaultMessage='Invitations'
            />
          </button>

          <button
            className={`wizard-type-btn${selectedSubcategory === 'governance' ? ' wizard-type-btn--selected' : ''}`}
            data-sub='governance'
            onClick={handleSubcategoryBtnClick}
          >
            <Icon id='gavel' icon={GavelIcon} />
            <FormattedMessage
              id='governance.wizard.general.governance'
              defaultMessage='Governance'
            />
          </button>

          <button
            className={`wizard-type-btn${selectedSubcategory === 'code' ? ' wizard-type-btn--selected' : ''}`}
            data-sub='code'
            onClick={handleSubcategoryBtnClick}
          >
            <Icon id='code' icon={CodeIcon} />
            <FormattedMessage
              id='governance.wizard.general.code'
              defaultMessage='Code'
            />
          </button>
        </div>
      )}

      {/* Row 2b: Bug / New Feature picker (all spaces except general-without-subcategory and new-space) */}
      {showTypeRow && (
        <div className='wizard-type-picker'>
          <button
            className={`wizard-type-btn${selectedType === 'bug' ? ' wizard-type-btn--selected' : ''}`}
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
            className={`wizard-type-btn${selectedType === 'feature' ? ' wizard-type-btn--selected' : ''}`}
            data-type='feature'
            onClick={handleTypeBtnClick}
          >
            <Icon id='add' icon={AddIcon} />
            <FormattedMessage
              id='governance.wizard.type.feature'
              defaultMessage='New Feature'
            />
          </button>

          <button
            className={`wizard-type-btn${selectedType === 'refine' ? ' wizard-type-btn--selected' : ''}`}
            data-type='refine'
            onClick={handleTypeBtnClick}
          >
            <Icon id='tune' icon={TuneIcon} />
            <FormattedMessage
              id='governance.wizard.type.refine'
              defaultMessage='Refine'
            />
          </button>
        </div>
      )}

      {/* Refine form */}
      {showRefineForm && (
        <div className='wizard-form'>
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
              value={refineName}
              onChange={handleRefineNameChange}
              placeholder='Short title for what needs refining'
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
              value={refineDescription}
              onChange={handleRefineDescChange}
              placeholder='Describe how this feature could be improved'
              rows={5}
            />
          </label>

          <div className='governance-form__actions'>
            <button
              className='governance-form__cancel-btn'
              onClick={onCancel}
              disabled={submitting}
            >
              <FormattedMessage
                id='governance.form.cancel'
                defaultMessage='Cancel'
              />
            </button>
            <button
              className='governance-form__submit-btn'
              onClick={handleSubmitRefine}
              disabled={
                submitting || !refineName.trim() || !refineDescription.trim()
              }
            >
              <FormattedMessage
                id='governance.wizard.submit'
                defaultMessage='Plant seed'
              />
            </button>
          </div>
        </div>
      )}

      {/* Bug form */}
      {showBugForm && (
        <div className='wizard-form'>
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
              onClick={onCancel}
              disabled={submitting}
            >
              <FormattedMessage
                id='governance.form.cancel'
                defaultMessage='Cancel'
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
      )}

      {/* Feature form */}
      {showFeatureForm && (
        <div className='wizard-form'>
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
              onClick={onCancel}
              disabled={submitting}
            >
              <FormattedMessage
                id='governance.form.cancel'
                defaultMessage='Cancel'
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
      )}

      {/* New space form */}
      {showNewSpaceForm && (
        <div className='wizard-form'>
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
              onClick={onCancel}
              disabled={submitting}
            >
              <FormattedMessage
                id='governance.form.cancel'
                defaultMessage='Cancel'
              />
            </button>
            <button
              className='governance-form__submit-btn'
              onClick={handleSubmitNewSpace}
              disabled={
                submitting || !spaceName.trim() || !spaceProposal.trim()
              }
            >
              <FormattedMessage
                id='governance.wizard.submit'
                defaultMessage='Plant seed'
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
