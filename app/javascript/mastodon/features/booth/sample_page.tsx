import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory, useParams } from 'react-router-dom';

import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import DownloadIcon from '@/material-icons/400-24px/download.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { ComposeTitle } from 'mastodon/components/compose_fields';
import { ComposeShell } from 'mastodon/components/compose_shell';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { Stage } from 'mastodon/components/stage';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useAppDispatch } from 'mastodon/store';

import { SampleFields, detailsPayload } from './components/sample_fields';
import type { SampleDetails } from './components/sample_fields';
import { SamplePlayer } from './components/sample_player';
import {
  makerName,
  SAMPLE_ICONS,
  sampleDownloadUrl,
  sampleFacts,
  sampleTermsHint,
  sampleTermsName,
} from './samples';
import type { BoothSample, BoothSampleRequest } from './types';
import { vibeName } from './vibes';

// A sample's page (docs/spaces/booth.md, Samples), on the shared detail
// shell: what it is, who made it and on what terms, its player, then
// Download or Ask to use. Its maker answers requests here and edits it from
// the Ж menu. Under it, the sets that list it as used.

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: {
    id: 'booth.sample.not_found',
    defaultMessage: 'Sample not found.',
  },
  notFoundBody: {
    id: 'booth.sample.not_found_body',
    defaultMessage: 'It may have been taken down by the person who shared it.',
  },
  by: { id: 'booth.sample.by', defaultMessage: 'by {name}' },
  inPack: { id: 'booth.sample.in_pack', defaultMessage: 'In {pack}' },
  download: { id: 'booth.sample.download', defaultMessage: 'Download' },
  ask: { id: 'booth.sample.ask', defaultMessage: 'Ask to use' },
  askAgain: { id: 'booth.sample.ask_again', defaultMessage: 'Ask again' },
  asked: { id: 'booth.sample.asked', defaultMessage: 'Asked' },
  askedNote: {
    id: 'booth.sample.asked_note',
    defaultMessage: 'You asked. {name} will say yes or no.',
  },
  saidNo: {
    id: 'booth.sample.said_no',
    defaultMessage: '{name} said no this time.',
  },
  saidYes: {
    id: 'booth.sample.said_yes',
    defaultMessage:
      '{name} said yes. Download it, and list it under Samples used on the set you make with it.',
  },
  creditNote: {
    id: 'booth.sample.credit_note',
    defaultMessage:
      'Used it in a set? List it under Samples used when you upload or edit the set, so it credits {name}.',
  },
  requests: { id: 'booth.sample.requests', defaultMessage: 'Asking to use it' },
  yes: { id: 'booth.sample.request.yes', defaultMessage: 'Yes' },
  no: { id: 'booth.sample.request.no', defaultMessage: 'No' },
  saidYesTo: {
    id: 'booth.sample.request.said_yes',
    defaultMessage: 'You said yes',
  },
  saidNoTo: {
    id: 'booth.sample.request.said_no',
    defaultMessage: 'You said no',
  },
  usedIn: { id: 'booth.sample.used_in', defaultMessage: 'Used in' },
  edit: { id: 'booth.sample.edit', defaultMessage: 'Edit sample' },
  editLabel: { id: 'booth.sample.edit_label', defaultMessage: 'Edit sample' },
  save: { id: 'booth.sample.save', defaultMessage: 'Save' },
  saving: { id: 'booth.sample.saving', defaultMessage: 'Saving…' },
  title: { id: 'booth.sample.compose.title', defaultMessage: 'Name it' },
  delete: { id: 'booth.sample.delete', defaultMessage: 'Delete' },
  deleteTitle: {
    id: 'booth.sample.delete_title',
    defaultMessage: 'Delete “{title}”?',
  },
  deleteBody: {
    id: 'booth.sample.delete_body',
    defaultMessage: 'Sets that list it will no longer credit it.',
  },
  failed: {
    id: 'booth.sample.failed',
    defaultMessage: 'That didn’t work. Please try again.',
  },
});

const toDetails = (sample: BoothSample): SampleDetails => ({
  sampleType: sample.sample_type,
  musicalKey: sample.musical_key ?? '',
  bpm: sample.bpm ? String(sample.bpm) : '',
  genre: sample.genre ?? '',
  vibes: sample.vibes,
  terms: sample.terms,
});

const EditSample: React.FC<{
  sample: BoothSample;
  onSaved: (sample: BoothSample) => void;
  onCancel: () => void;
}> = ({ sample, onSaved, onCancel }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState(sample.title);
  const [details, setDetails] = useState(() => toDetails(sample));
  const [saving, setSaving] = useState(false);

  const handleTitle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);
  const handleSubmit = useCallback(() => {
    setSaving(true);
    void api()
      .patch<BoothSample>(`/api/v1/booth_samples/${sample.id}`, {
        ...detailsPayload(details),
        title: title.trim(),
      })
      .then((res) => {
        onSaved(res.data);
        return undefined;
      })
      .catch(() => {
        setSaving(false);
        dispatch(showAlert({ message: messages.failed }));
      });
  }, [sample.id, details, title, onSaved, dispatch]);

  return (
    <ComposeShell
      korner='booth'
      label={intl.formatMessage(messages.editLabel)}
      submitLabel={intl.formatMessage(messages.save)}
      submittingLabel={intl.formatMessage(messages.saving)}
      submitting={saving}
      canSubmit={title.trim() !== ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      konnect={null}
    >
      <ComposeTitle
        value={title}
        onChange={handleTitle}
        placeholder={intl.formatMessage(messages.title)}
        aria-label={intl.formatMessage(messages.title)}
        maxLength={200}
      />
      <SampleFields value={details} onChange={setDetails} disabled={saving} />
    </ComposeShell>
  );
};

const RequestRow: React.FC<{
  request: BoothSampleRequest;
  onAnswer: (request: BoothSampleRequest, state: 'yes' | 'no') => void;
}> = ({ request, onAnswer }) => {
  const intl = useIntl();
  const handleYes = useCallback(() => {
    onAnswer(request, 'yes');
  }, [onAnswer, request]);
  const handleNo = useCallback(() => {
    onAnswer(request, 'no');
  }, [onAnswer, request]);

  return (
    <li className='booth-sample-request'>
      <Link to={`/@${request.account.acct}`} className='booth-credit'>
        <img src={request.account.avatar} alt='' />
        {makerName(request.account)}
      </Link>
      {request.state === 'pending' ? (
        <KornerActionBar>
          <KornerPill
            variant='primary'
            label={intl.formatMessage(messages.yes)}
            onClick={handleYes}
          />
          <KornerPill
            label={intl.formatMessage(messages.no)}
            onClick={handleNo}
          />
        </KornerActionBar>
      ) : (
        <span className='booth-credit__flag'>
          {intl.formatMessage(
            request.state === 'yes' ? messages.saidYesTo : messages.saidNoTo,
          )}
        </span>
      )}
    </li>
  );
};

const BoothSamplePage: React.FC<{ multiColumn: boolean }> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const [sample, setSample] = useState<BoothSample | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [requests, setRequests] = useState<BoothSampleRequest[]>([]);
  const [confirmDialog, confirm] = useConfirmDialog();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api()
      .get<BoothSample>(`/api/v1/booth_samples/${id}`)
      .then((res) => {
        if (cancelled) return undefined;
        setSample(res.data);
        setLoading(false);
        return undefined;
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Its maker sees who asked, when the terms are ask first.
  const ownAsk = sample?.is_owner === true && sample.terms === 'ask';
  useEffect(() => {
    if (!ownAsk) return;
    void api()
      .get<BoothSampleRequest[]>(`/api/v1/booth_samples/${id}/requests`)
      .then((res) => {
        setRequests(res.data);
        return undefined;
      })
      .catch(() => undefined);
  }, [id, ownAsk]);

  const handleEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    setEditing(false);
  }, []);
  const handleSaved = useCallback((updated: BoothSample) => {
    setSample(updated);
    setEditing(false);
  }, []);

  useRegisterPageAction(
    {
      key: 'edit',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    handleEdit,
    sample?.is_owner === true && !editing,
  );

  const handleDownload = useCallback(() => {
    if (sample) window.location.assign(sampleDownloadUrl(sample));
  }, [sample]);

  const handleAsk = useCallback(() => {
    void api()
      .post<BoothSample>(`/api/v1/booth_samples/${id}/requests`)
      .then((res) => {
        setSample(res.data);
        return undefined;
      })
      .catch(() => {
        dispatch(showAlert({ message: messages.failed }));
      });
  }, [id, dispatch]);

  const handleAnswer = useCallback(
    (request: BoothSampleRequest, state: 'yes' | 'no') => {
      void api()
        .patch<BoothSampleRequest>(
          `/api/v1/booth_sample_requests/${request.id}`,
          {
            state,
          },
        )
        .then((res) => {
          setRequests((list) =>
            list.map((r) => (r.id === res.data.id ? res.data : r)),
          );
          return undefined;
        })
        .catch(() => {
          dispatch(showAlert({ message: messages.failed }));
        });
    },
    [dispatch],
  );

  const sampleTitle = sample?.title ?? '';
  const handleDelete = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.deleteTitle, { title: sampleTitle }),
        message: intl.formatMessage(messages.deleteBody),
        confirmLabel: intl.formatMessage(messages.delete),
        destructive: true,
      });
      if (!ok) return;
      try {
        await api().delete(`/api/v1/booth_samples/${id}`);
        history.push('/hub/booth/samples');
      } catch {
        dispatch(showAlert({ message: messages.failed }));
      }
    })();
  }, [confirm, id, intl, sampleTitle, history, dispatch]);

  if (loading || !sample) {
    return (
      <Stage label={intl.formatMessage(messages.heading)}>
        <div className='stage-column'>
          {loading ? (
            <LoadingState label={intl.formatMessage(messages.loading)} />
          ) : (
            <EmptyState
              title={intl.formatMessage(messages.notFound)}
              body={intl.formatMessage(messages.notFoundBody)}
            />
          )}
        </div>
      </Stage>
    );
  }

  const Glyph = SAMPLE_ICONS[sample.sample_type];
  const maker = makerName(sample.account);
  const usedIn = sample.used_in ?? [];
  const canAsk =
    !sample.is_owner &&
    sample.terms === 'ask' &&
    (sample.request_state === null ||
      sample.request_state === undefined ||
      sample.request_state === 'no');
  const note = sample.is_owner
    ? null
    : sample.request_state === 'pending'
      ? intl.formatMessage(messages.askedNote, { name: maker })
      : sample.request_state === 'no'
        ? intl.formatMessage(messages.saidNo, { name: maker })
        : sample.request_state === 'yes'
          ? intl.formatMessage(messages.saidYes, { name: maker })
          : sample.can_download
            ? intl.formatMessage(messages.creditNote, { name: maker })
            : null;

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <KornerDetail
        className='booth-sample'
        hero={
          <div className='booth-set__cover booth-sample__glyph'>
            <Glyph aria-hidden='true' />
          </div>
        }
        title={sample.title}
        subtitle={
          <Link to={`/@${sample.account.acct}`}>
            {intl.formatMessage(messages.by, { name: maker })}
          </Link>
        }
        meta={
          <KornerMeta
            items={[
              ...sampleFacts(sample, intl),
              sample.genre,
              sample.vibes.length > 0 &&
                sample.vibes
                  .map((vibe) => intl.formatMessage(vibeName(vibe)))
                  .join(', '),
              sample.pack && (
                <Link key='pack' to={`/hub/booth/packs/${sample.pack.id}`}>
                  {intl.formatMessage(messages.inPack, {
                    pack: sample.pack.title,
                  })}
                </Link>
              ),
            ]}
          />
        }
        banner={
          <div className='booth-set__notice booth-sample__terms'>
            <strong>{intl.formatMessage(sampleTermsName(sample.terms))}</strong>
            <span>{intl.formatMessage(sampleTermsHint(sample.terms))}</span>
          </div>
        }
        actions={
          <KornerActionBar>
            {sample.can_download && (
              <KornerPill
                variant='primary'
                icon={DownloadIcon}
                iconId='download'
                label={intl.formatMessage(messages.download)}
                onClick={handleDownload}
              />
            )}
            {canAsk && (
              <KornerPill
                variant='primary'
                label={intl.formatMessage(
                  sample.request_state === 'no'
                    ? messages.askAgain
                    : messages.ask,
                )}
                onClick={handleAsk}
              />
            )}
            {sample.request_state === 'pending' && (
              <KornerPill label={intl.formatMessage(messages.asked)} disabled />
            )}
            {sample.is_owner && (
              <KornerPill
                variant='destructive'
                icon={DeleteIcon}
                iconId='delete'
                label={intl.formatMessage(messages.delete)}
                onClick={handleDelete}
              />
            )}
          </KornerActionBar>
        }
      >
        <SamplePlayer sample={sample} />

        {note && <p className='booth-sample__note'>{note}</p>}

        {ownAsk && requests.length > 0 && (
          <section className='booth-set__section'>
            <h2 className='booth-set__section-title'>
              {intl.formatMessage(messages.requests)}
            </h2>
            <ul className='booth-sample-requests'>
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onAnswer={handleAnswer}
                />
              ))}
            </ul>
          </section>
        )}

        {usedIn.length > 0 && (
          <section className='booth-set__section'>
            <h2 className='booth-set__section-title'>
              {intl.formatMessage(messages.usedIn)}
            </h2>
            <ul className='booth-sample-used-in'>
              {usedIn.map((set) => (
                <li key={set.id}>
                  <Link to={`/hub/booth/sets/${set.id}`}>{set.title}</Link>{' '}
                  <span>{set.artist_name}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </KornerDetail>

      {confirmDialog}
      {editing && (
        <EditSample
          sample={sample}
          onSaved={handleSaved}
          onCancel={handleEditCancel}
        />
      )}

      <Helmet>
        <title>{`${sample.title} — ${intl.formatMessage(messages.heading)}`}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothSamplePage;
