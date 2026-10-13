import { useCallback, useEffect, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiAnswerProfileKuestion,
  apiRemoveMyKuestionAnswer,
  apiUpdateMyKuestionAnswer,
} from 'mastodon/api/kuestions';
import type {
  ApiProfileKuestionJSON,
  KuestionVisibilityScope,
} from 'mastodon/api_types/kuestions';

import { KuestionScopePicker } from './kuestion_scope_picker';
import { SheetFrame } from './sheet_frame';

const messages = defineMessages({
  cancel: { id: 'kuestions.profile_sheet.cancel', defaultMessage: 'Cancel' },
  save: { id: 'kuestions.profile_sheet.save', defaultMessage: 'Save' },
  remove: {
    id: 'kuestions.profile_sheet.remove',
    defaultMessage: 'Remove answer',
  },
  by: { id: 'kuestions.profile_sheet.by', defaultMessage: 'asked by {name}' },
  placeholder: {
    id: 'kuestions.profile_sheet.placeholder',
    defaultMessage: 'Your answer',
  },
  listHint: {
    id: 'kuestions.profile_sheet.list_hint',
    defaultMessage: 'Separate them with commas or new lines.',
  },
  linkPlaceholder: {
    id: 'kuestions.profile_sheet.link_placeholder',
    defaultMessage: 'example.com',
  },
  pinnedTitle: {
    id: 'kuestions.profile_sheet.pinned_title',
    defaultMessage: 'On my profile',
  },
  pinnedNote: {
    id: 'kuestions.profile_sheet.pinned_note',
    defaultMessage: 'Off keeps the answer here without showing it.',
  },
  reachTitle: {
    id: 'kuestions.profile_sheet.reach_title',
    defaultMessage: 'Who sees it',
  },
  error: {
    id: 'kuestions.profile_sheet.error',
    defaultMessage: "Couldn't save. Check the answer and try again.",
  },
});

interface Props {
  kuestion: ApiProfileKuestionJSON;
  onCancel: () => void;
  // The Kuestion as it now stands, with the viewer's answer (or none).
  onSaved: (updated: ApiProfileKuestionJSON) => void;
}

// Answer a profile Kuestion, or change or take back an answer. Answering
// pins it to your profile; the switch takes it off again without losing
// it. Unlike a deck answer there's no lock: profile Kuestions are open,
// and each answer reaches whoever its own scope says.
export const ProfileAnswerSheet: React.FC<Props> = ({
  kuestion,
  onCancel,
  onSaved,
}) => {
  const intl = useIntl();
  const mine = kuestion.my_answer;
  const [body, setBody] = useState(mine?.body ?? '');
  const [scope, setScope] = useState<KuestionVisibilityScope>(
    mine?.visibility_scope ?? 'public',
  );
  const [pinned, setPinned] = useState(mine?.pinned ?? true);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const run = useCallback(
    (work: () => Promise<ApiProfileKuestionJSON>) => {
      setPending(true);
      setFailed(false);
      void work()
        .then(onSaved)
        .catch(() => {
          setFailed(true);
          setPending(false);
        });
    },
    [onSaved],
  );

  const handleSave = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    run(async () => {
      if (mine) {
        return apiUpdateMyKuestionAnswer(kuestion.id, {
          body: trimmed,
          visibility_scope: scope,
          pinned,
        });
      }
      // A new answer is pinned on arrival; unpin straight after if asked.
      const created = await apiAnswerProfileKuestion(kuestion.id, {
        body: trimmed,
        visibility_scope: scope,
      });
      return pinned
        ? created
        : apiUpdateMyKuestionAnswer(kuestion.id, { pinned: false });
    });
  }, [body, kuestion.id, mine, pinned, run, scope]);

  const handleRemove = useCallback(() => {
    run(async () => {
      await apiRemoveMyKuestionAnswer(kuestion.id);
      return {
        ...kuestion,
        has_answered: false,
        answers_count: Math.max(0, kuestion.answers_count - 1),
        my_answer: null,
      };
    });
  }, [kuestion, run]);

  const handleBody = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setBody(e.target.value);
    },
    [],
  );

  const handlePinned = useCallback(() => {
    setPinned((p) => !p);
  }, []);

  const format = kuestion.answer_format;
  const multiline = format === 'longtext' || format === 'list';
  const askerName = kuestion.asker
    ? kuestion.asker.display_name || kuestion.asker.username
    : null;

  return (
    <SheetFrame
      onClose={onCancel}
      closeLabel={intl.formatMessage(messages.cancel)}
    >
      <h2 className='kuestions-sheet__q'>{kuestion.title}</h2>
      {askerName && (
        <p className='kuestions-sheet__by'>
          {intl.formatMessage(messages.by, { name: askerName })}
        </p>
      )}

      {multiline ? (
        <textarea
          ref={inputRef}
          className='kuestions-sheet__text'
          value={body}
          onChange={handleBody}
          placeholder={intl.formatMessage(messages.placeholder)}
          aria-label={intl.formatMessage(messages.placeholder)}
          disabled={pending}
        />
      ) : (
        <input
          ref={inputRef}
          className='kuestions-sheet__text kuestions-sheet__text--line'
          type={format === 'date' ? 'date' : format === 'link' ? 'url' : 'text'}
          value={body}
          onChange={handleBody}
          placeholder={intl.formatMessage(
            format === 'link' ? messages.linkPlaceholder : messages.placeholder,
          )}
          aria-label={intl.formatMessage(messages.placeholder)}
          disabled={pending}
        />
      )}
      {format === 'list' && (
        <p className='kuestions-sheet__hint'>
          {intl.formatMessage(messages.listHint)}
        </p>
      )}

      <div className='kuestions-settings__row'>
        <div className='kuestions-settings__row-body'>
          <b>{intl.formatMessage(messages.pinnedTitle)}</b>
          <span>{intl.formatMessage(messages.pinnedNote)}</span>
        </div>
        <button
          type='button'
          role='switch'
          aria-checked={pinned}
          aria-label={intl.formatMessage(messages.pinnedTitle)}
          className={`kuestions-settings__switch ${pinned ? 'kuestions-settings__switch--on' : ''}`}
          onClick={handlePinned}
          disabled={pending}
        >
          <span className='kuestions-settings__switch-knob' />
        </button>
      </div>

      <div className='kuestions-settings__row'>
        <div className='kuestions-settings__row-body'>
          <b>{intl.formatMessage(messages.reachTitle)}</b>
        </div>
        <KuestionScopePicker value={scope} onChange={setScope} />
      </div>

      {failed && (
        <p className='kuestions-sheet__error' role='alert'>
          {intl.formatMessage(messages.error)}
        </p>
      )}

      <div className='kuestions-sheet__actions'>
        {mine && (
          <button
            type='button'
            className='kuestions-btn kuestions-btn--ghost kuestions-sheet__remove'
            onClick={handleRemove}
            disabled={pending}
          >
            {intl.formatMessage(messages.remove)}
          </button>
        )}
        <button
          type='button'
          className='kuestions-btn kuestions-btn--ghost'
          onClick={onCancel}
          disabled={pending}
        >
          {intl.formatMessage(messages.cancel)}
        </button>
        <button
          type='button'
          className='kuestions-btn'
          onClick={handleSave}
          disabled={pending || body.trim() === ''}
        >
          {intl.formatMessage(messages.save)}
        </button>
      </div>
    </SheetFrame>
  );
};
