import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  ComposeField,
  ComposeHint,
  ComposeInput,
  ComposeRow,
  ComposeSection,
  ComposeSelect,
} from 'mastodon/components/compose_fields';
import { KornerPill } from 'mastodon/components/korner_pill';

import {
  SAMPLE_TERMS,
  SAMPLE_TYPES,
  isSampleType,
  sampleTermsHint,
  sampleTermsName,
  sampleTypeName,
} from '../samples';
import type { BoothSampleTerms, BoothSampleType, BoothVibe } from '../types';

import { VibesField } from './vibes_field';

// What a sample is, on the share and edit forms (docs/spaces/booth.md,
// Samples): its type, key, tempo, genre and vibes, and its terms. In a pack
// they apply to every sample shared; each can be changed on its own page.

export interface SampleDetails {
  sampleType: BoothSampleType;
  musicalKey: string;
  bpm: string;
  genre: string;
  vibes: BoothVibe[];
  terms: BoothSampleTerms;
}

export const blankDetails: SampleDetails = {
  sampleType: 'loop',
  musicalKey: '',
  bpm: '',
  genre: '',
  vibes: [],
  terms: 'free',
};

export const detailsPayload = (details: SampleDetails) => ({
  sample_type: details.sampleType,
  musical_key: details.musicalKey.trim(),
  bpm: details.bpm.trim(),
  genre: details.genre.trim(),
  vibes: details.vibes,
  terms: details.terms,
});

const messages = defineMessages({
  type: { id: 'booth.sample.field.type', defaultMessage: 'What is it?' },
  key: { id: 'booth.sample.field.key', defaultMessage: 'Key (optional)' },
  keyPlaceholder: {
    id: 'booth.sample.field.key_placeholder',
    defaultMessage: 'A minor',
  },
  bpm: { id: 'booth.sample.field.bpm', defaultMessage: 'BPM (optional)' },
  genre: { id: 'booth.sample.field.genre', defaultMessage: 'Genre (optional)' },
  terms: {
    id: 'booth.sample.field.terms',
    defaultMessage: 'How can people use it?',
  },
});

const TermsPill: React.FC<{
  terms: BoothSampleTerms;
  chosen: BoothSampleTerms;
  disabled?: boolean;
  onChoose: (terms: BoothSampleTerms) => void;
}> = ({ terms, chosen, disabled, onChoose }) => {
  const intl = useIntl();
  const handleClick = useCallback(() => {
    onChoose(terms);
  }, [onChoose, terms]);
  return (
    <KornerPill
      label={intl.formatMessage(sampleTermsName(terms))}
      active={chosen === terms}
      disabled={disabled}
      onClick={handleClick}
    />
  );
};

export const SampleFields: React.FC<{
  value: SampleDetails;
  onChange: (value: SampleDetails) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const intl = useIntl();

  const handleType = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (isSampleType(e.target.value)) {
        onChange({ ...value, sampleType: e.target.value });
      }
    },
    [value, onChange],
  );
  const handleKey = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, musicalKey: e.target.value });
    },
    [value, onChange],
  );
  const handleBpm = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, bpm: e.target.value.replace(/\D/g, '') });
    },
    [value, onChange],
  );
  const handleGenre = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, genre: e.target.value });
    },
    [value, onChange],
  );
  const handleVibes = useCallback(
    (vibes: BoothVibe[]) => {
      onChange({ ...value, vibes });
    },
    [value, onChange],
  );
  const handleTerms = useCallback(
    (terms: BoothSampleTerms) => {
      onChange({ ...value, terms });
    },
    [value, onChange],
  );

  return (
    <>
      <ComposeField label={intl.formatMessage(messages.type)}>
        <ComposeSelect
          value={value.sampleType}
          onChange={handleType}
          disabled={disabled}
        >
          {SAMPLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {intl.formatMessage(sampleTypeName(type))}
            </option>
          ))}
        </ComposeSelect>
      </ComposeField>

      <ComposeRow>
        <ComposeField label={intl.formatMessage(messages.key)}>
          <ComposeInput
            value={value.musicalKey}
            onChange={handleKey}
            placeholder={intl.formatMessage(messages.keyPlaceholder)}
            maxLength={20}
            disabled={disabled}
          />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.bpm)}>
          <ComposeInput
            value={value.bpm}
            onChange={handleBpm}
            inputMode='numeric'
            maxLength={3}
            disabled={disabled}
          />
        </ComposeField>
        <ComposeField label={intl.formatMessage(messages.genre)}>
          <ComposeInput
            value={value.genre}
            onChange={handleGenre}
            maxLength={50}
            disabled={disabled}
          />
        </ComposeField>
      </ComposeRow>

      <VibesField
        value={value.vibes}
        onChange={handleVibes}
        disabled={disabled}
      />

      <ComposeSection title={intl.formatMessage(messages.terms)}>
        <div className='booth-upload-form__shape'>
          {SAMPLE_TERMS.map((terms) => (
            <TermsPill
              key={terms}
              terms={terms}
              chosen={value.terms}
              disabled={disabled}
              onChoose={handleTerms}
            />
          ))}
        </div>
        <ComposeHint>
          {intl.formatMessage(sampleTermsHint(value.terms))}
        </ComposeHint>
      </ComposeSection>
    </>
  );
};
