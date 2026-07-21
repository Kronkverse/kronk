import { useState, useCallback, useRef } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import SendIcon from '@/material-icons/400-24px/arrow_upward-fill.svg?react';

const messages = defineMessages({
  placeholder: {
    id: 'nudges.composer.placeholder',
    defaultMessage: 'Message…',
  },
  send: { id: 'nudges.composer.send', defaultMessage: 'Send' },
});

interface ComposerProps {
  onSend: (body: string) => Promise<void> | void;
}

// Minimal text-only composer for Phase 1b. Media + voice arrive later
// (voice is kronk-app parity-gated per brief).
export const Composer: React.FC<ComposerProps> = ({ onSend }) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    [],
  );

  const submit = useCallback(async () => {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setValue('');
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }, [value, sending, onSend]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const canSend = value.trim() !== '' && !sending;

  return (
    <form className='nudges-composer' onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        className='nudges-composer__input'
        placeholder={intl.formatMessage(messages.placeholder)}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <button
        type='submit'
        className='nudges-composer__send'
        disabled={!canSend}
        aria-label={intl.formatMessage(messages.send)}
      >
        <SendIcon />
      </button>
    </form>
  );
};
