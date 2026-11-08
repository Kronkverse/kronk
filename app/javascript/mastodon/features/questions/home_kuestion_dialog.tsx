import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import {
  apiAnswerKuestion,
  apiDeleteKuestion,
  apiGetKuestion,
  apiMarkKuestionSeen,
} from 'mastodon/api/kuestions';
import type { ApiKuestionJSON } from 'mastodon/api_types/kuestions';
import {
  ComposeField,
  ComposeHint,
  ComposeTextarea,
} from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { LoadingState } from 'mastodon/components/loading_state';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';

import { ChoiceGrid } from './answer_sheet';
import { ChoiceReveal, TextReveal } from './reveal_sheet';

// A Kuestion in a Krew or a projekt, opened from its row (Tal, 2026-11-09):
// the standard pop-up over the page, not the Kuestions korner's sheet from
// the bottom. It shows the question, a box to answer it while you haven't
// (the asker too), and everyone's answers, which every member sees whether
// they've answered or not (Kuestions::VisibilityGate, a home is open).
// Nothing to Konnect. Next kuestion steps through the row's Kuestions; the
// asker can delete theirs.

const messages = defineMessages({
  label: {
    id: 'kuestions.home_dialog.label',
    defaultMessage: 'Kuestion {n} of {total}',
  },
  askedBy: {
    id: 'kuestions.home_dialog.asked_by',
    defaultMessage: 'asked by {asker}',
  },
  answer: { id: 'kuestions.home_dialog.answer', defaultMessage: 'Answer' },
  sending: { id: 'kuestions.home_dialog.sending', defaultMessage: 'Sending…' },
  yourAnswer: {
    id: 'kuestions.home_dialog.your_answer',
    defaultMessage: 'Your answer',
  },
  pick: {
    id: 'kuestions.home_dialog.pick',
    defaultMessage: 'Tap your answer.',
  },
  answers: {
    id: 'kuestions.home_dialog.answers',
    defaultMessage: '{count, plural, one {# answer} other {# answers}}',
  },
  none: {
    id: 'kuestions.home_dialog.none',
    defaultMessage: 'No answers yet.',
  },
  next: { id: 'kuestions.reveal.next', defaultMessage: 'Next kuestion' },
  done: { id: 'kuestions.home_dialog.done', defaultMessage: 'Done' },
  failed: {
    id: 'kuestions.home_dialog.failed',
    defaultMessage: "Couldn't send. Try again?",
  },
  delete: { id: 'kuestions.reveal.delete', defaultMessage: 'Delete Kuestion' },
  deleteTitle: {
    id: 'kuestions.reveal.delete_title',
    defaultMessage: 'Delete this Kuestion?',
  },
  deleteBody: {
    id: 'kuestions.reveal.delete_body',
    defaultMessage: 'Its answers go with it, and its post leaves the feed.',
  },
  deleteConfirm: {
    id: 'kuestions.reveal.delete_confirm',
    defaultMessage: 'Delete',
  },
});

interface Props {
  // The row's Kuestions, in its order, and the one opened.
  kuestions: ApiKuestionJSON[];
  startId: string;
  onClose: () => void;
  // Something was answered or deleted: the row reloads.
  onChanged: () => void;
}

export const HomeKuestionDialog: React.FC<Props> = ({
  kuestions,
  startId,
  onClose,
  onChanged,
}) => {
  const intl = useIntl();
  const [confirmDialog, confirm] = useConfirmDialog();
  const [currentId, setCurrentId] = useState(startId);
  const [detail, setDetail] = useState<ApiKuestionJSON | null>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const index = Math.max(
    0,
    kuestions.findIndex((k) => k.id === currentId),
  );

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setText('');
    setError(false);
    void apiGetKuestion(currentId)
      .then((kuestion) => {
        if (!cancelled) setDetail(kuestion);
        void apiMarkKuestionSeen(currentId).catch(() => undefined);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  const submit = useCallback(
    (params: { body?: string; choice_index?: number }) => {
      setPending(true);
      setError(false);
      void (async () => {
        try {
          await apiAnswerKuestion(currentId, params);
          setDetail(await apiGetKuestion(currentId));
          setText('');
          onChanged();
        } catch {
          setError(true);
        }
        setPending(false);
      })();
    },
    [currentId, onChanged],
  );

  const handleText = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
    },
    [],
  );
  const handleSend = useCallback(() => {
    const body = text.trim();
    if (body) submit({ body });
  }, [submit, text]);
  const handleChoice = useCallback(
    (choice: number) => {
      submit({ choice_index: choice });
    },
    [submit],
  );

  const handleNext = useCallback(() => {
    const next = kuestions[(index + 1) % kuestions.length];
    if (next) setCurrentId(next.id);
  }, [index, kuestions]);

  const handleDelete = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.deleteTitle),
        message: intl.formatMessage(messages.deleteBody),
        confirmLabel: intl.formatMessage(messages.deleteConfirm),
        destructive: true,
      });
      if (!ok) return;
      try {
        await apiDeleteKuestion(currentId);
        onChanged();
        onClose();
      } catch {
        setError(true);
      }
    })();
  }, [confirm, currentId, intl, onChanged, onClose]);

  const answered = detail?.has_answered ?? false;
  // The one button at the foot: Answer while writing one, then on to the
  // next Kuestion in the row (or Done when it is the only one).
  const writing = !!detail && !answered && detail.answer_format === 'text';
  const hasNext = kuestions.length > 1;
  const handleFooter = writing ? handleSend : hasNext ? handleNext : onClose;
  const textFormat = detail?.answer_format === 'text';
  const choiceFormat =
    detail?.answer_format === 'mc' || detail?.answer_format === 'yn';
  const asker = detail
    ? detail.asker.display_name || detail.asker.username
    : '';

  return (
    <ComposeShell
      korner='kuestions'
      label={intl.formatMessage(messages.label, {
        n: index + 1,
        total: kuestions.length,
      })}
      subtitle={
        detail ? intl.formatMessage(messages.askedBy, { asker }) : undefined
      }
      submitLabel={intl.formatMessage(
        writing ? messages.answer : hasNext ? messages.next : messages.done,
      )}
      submittingLabel={intl.formatMessage(messages.sending)}
      submitting={pending}
      canSubmit={!!detail && (!writing || text.trim().length > 0)}
      onSubmit={handleFooter}
      onCancel={onClose}
      konnect={null}
    >
      {confirmDialog}
      {!detail ? (
        error ? (
          <ComposeHint error>{intl.formatMessage(messages.failed)}</ComposeHint>
        ) : (
          <LoadingState />
        )
      ) : (
        <>
          <h2 className='home-kuestion-dialog__q'>{detail.title}</h2>

          {!answered && textFormat && (
            <ComposeField label={intl.formatMessage(messages.yourAnswer)}>
              <ComposeTextarea
                value={text}
                onChange={handleText}
                disabled={pending}
                rows={3}
              />
            </ComposeField>
          )}
          {!answered && choiceFormat && (
            <ComposeField label={intl.formatMessage(messages.pick)}>
              <ChoiceGrid
                options={detail.mc_options.map((o) => o.label)}
                layout={detail.answer_format === 'yn' ? 'yn' : 'mc'}
                disabled={pending}
                onPick={handleChoice}
              />
            </ComposeField>
          )}
          {error && (
            <ComposeHint error>
              {intl.formatMessage(messages.failed)}
            </ComposeHint>
          )}

          <section className='home-kuestion-dialog__answers'>
            <h3 className='home-kuestion-dialog__heading'>
              {intl.formatMessage(messages.answers, {
                count: detail.answers_count,
              })}
            </h3>
            {detail.answers_count === 0 ? (
              <p className='home-kuestion-dialog__none'>
                {intl.formatMessage(messages.none)}
              </p>
            ) : textFormat ? (
              detail.answers && <TextReveal answers={detail.answers} />
            ) : (
              detail.aggregate && <ChoiceReveal aggregate={detail.aggregate} />
            )}
          </section>

          {detail.asked_by_me && (
            <button
              type='button'
              className='compose-shell__delete'
              onClick={handleDelete}
            >
              {intl.formatMessage(messages.delete)}
            </button>
          )}
        </>
      )}
    </ComposeShell>
  );
};
