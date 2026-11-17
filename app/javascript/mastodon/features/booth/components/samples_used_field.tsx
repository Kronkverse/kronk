import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import api from 'mastodon/api';

import { makerName, sampleTypeName } from '../samples';
import type { BoothSample, BoothSampleUsed } from '../types';

// Samples used, on a set's upload and edit forms (docs/spaces/booth.md,
// Samples): the samples it was made with, which credits them and tells their
// makers. Only samples you may use are offered (`usable`): your own, the
// free ones, and ask-first ones whose maker said yes.

const MAX = 30;

const messages = defineMessages({
  label: { id: 'booth.samples_used.label', defaultMessage: 'Samples used' },
  hint: {
    id: 'booth.samples_used.hint',
    defaultMessage:
      'Made it with samples from the Booth? Add them so the set credits whoever made them.',
  },
  placeholder: {
    id: 'booth.samples_used.placeholder',
    defaultMessage: 'Search samples you can use',
  },
  by: { id: 'booth.samples_used.by', defaultMessage: '{title} by {name}' },
  none: {
    id: 'booth.samples_used.none',
    defaultMessage: 'No samples you can use match that',
  },
  remove: { id: 'booth.credits.remove', defaultMessage: 'Remove {name}' },
});

export const samplesPayload = (samples: BoothSampleUsed[]) =>
  samples.map((sample) => sample.id);

interface Props {
  value: BoothSampleUsed[];
  onChange: (next: BoothSampleUsed[]) => void;
  disabled?: boolean;
}

export const SamplesUsedField: React.FC<Props> = ({
  value,
  onChange,
  disabled,
}) => {
  const intl = useIntl();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<BoothSample[] | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) {
      setFound(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api()
        .get<BoothSample[]>('/api/v1/booth_samples', {
          params: { q: term, usable: true },
        })
        .then((res) => {
          if (!cancelled) setFound(res.data.slice(0, 8));
          return undefined;
        })
        .catch(() => {
          if (!cancelled) setFound([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const handleQuery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handlePick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const sample = found?.find((s) => s.id === e.currentTarget.value);
      if (!sample || value.length >= MAX) return;
      onChange([
        ...value,
        {
          id: sample.id,
          title: sample.title,
          sample_type: sample.sample_type,
          account: sample.account,
        },
      ]);
      setQuery('');
      setFound(null);
    },
    [found, onChange, value],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onChange(value.filter((sample) => sample.id !== e.currentTarget.value));
    },
    [onChange, value],
  );

  // Enter searches; it must not submit the form.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.preventDefault();
    },
    [],
  );

  const taken = new Set(value.map((sample) => sample.id));
  const suggestions = (found ?? []).filter((sample) => !taken.has(sample.id));
  const full = value.length >= MAX;

  return (
    <div className='booth-upload-form__field booth-credits booth-samples-used'>
      <span>{intl.formatMessage(messages.label)}</span>
      <p className='booth-credits__hint'>{intl.formatMessage(messages.hint)}</p>

      {value.length > 0 && (
        <ul className='booth-credits__list'>
          {value.map((sample) => {
            const label = intl.formatMessage(messages.by, {
              title: sample.title,
              name: makerName(sample.account),
            });
            return (
              <li key={sample.id} className='booth-credits__chip'>
                <img src={sample.account.avatar} alt='' aria-hidden='true' />
                <span>{label}</span>
                <button
                  type='button'
                  value={sample.id}
                  onClick={handleRemove}
                  disabled={disabled}
                  aria-label={intl.formatMessage(messages.remove, {
                    name: label,
                  })}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!full && (
        <input
          type='search'
          value={query}
          onChange={handleQuery}
          onKeyDown={handleKeyDown}
          placeholder={intl.formatMessage(messages.placeholder)}
          aria-label={intl.formatMessage(messages.placeholder)}
          maxLength={100}
          disabled={disabled}
        />
      )}

      {!full && found !== null && (
        <ul className='booth-credits__found'>
          {suggestions.map((sample) => (
            <li key={sample.id}>
              <button type='button' value={sample.id} onClick={handlePick}>
                <img src={sample.account.avatar} alt='' aria-hidden='true' />
                <span>{sample.title}</span>
                <span className='booth-credits__handle'>
                  {intl.formatMessage(sampleTypeName(sample.sample_type))} ·{' '}
                  {makerName(sample.account)}
                </span>
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className='booth-samples-used__none'>
              {intl.formatMessage(messages.none)}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
