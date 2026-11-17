import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link, useHistory, useParams } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import StacksIcon from '@/material-icons/400-24px/stacks.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import api from 'mastodon/api';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LinkifiedText } from 'mastodon/components/linkified_text';
import { LoadingState } from 'mastodon/components/loading_state';
import { SpaceGrid } from 'mastodon/components/space_grid';
import { Stage } from 'mastodon/components/stage';
import { useConfirmDialog } from 'mastodon/hooks/useConfirmDialog';
import { useAppDispatch } from 'mastodon/store';

import { SampleCard } from './components/sample_card';
import { makerName, sampleTypeName } from './samples';
import type { BoothSamplePack } from './types';

// A sample pack's page (docs/spaces/booth.md, Samples): its cover, title
// and maker, what's in it, and its samples as tiles. Its maker can add
// more or delete it, which deletes its samples.

const messages = defineMessages({
  heading: { id: 'booth.title', defaultMessage: 'The Booth' },
  loading: { id: 'booth.set_page.loading', defaultMessage: 'Loading…' },
  notFound: { id: 'booth.pack.not_found', defaultMessage: 'Pack not found.' },
  by: { id: 'booth.sample.by', defaultMessage: 'by {name}' },
  count: {
    id: 'booth.samples.pack_count',
    defaultMessage: '{count, plural, one {# sample} other {# samples}}',
  },
  add: { id: 'booth.pack.add', defaultMessage: 'Add samples' },
  delete: { id: 'booth.sample.delete', defaultMessage: 'Delete' },
  deleteTitle: {
    id: 'booth.pack.delete_title',
    defaultMessage: 'Delete “{title}” and its samples?',
  },
  deleteBody: {
    id: 'booth.pack.delete_body',
    defaultMessage: 'Sets that list them will no longer credit them.',
  },
  failed: {
    id: 'booth.sample.failed',
    defaultMessage: 'That didn’t work. Please try again.',
  },
});

const BoothSamplePackPage: React.FC<{ multiColumn: boolean }> = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const [pack, setPack] = useState<BoothSamplePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, confirm] = useConfirmDialog();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api()
      .get<BoothSamplePack>(`/api/v1/booth_sample_packs/${id}`)
      .then((res) => {
        if (cancelled) return undefined;
        setPack(res.data);
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

  const handleAdd = useCallback(() => {
    history.push(`/hub/booth/composer/sample?pack=${id}`);
  }, [history, id]);

  const packTitle = pack?.title ?? '';
  const handleDelete = useCallback(() => {
    void (async () => {
      const ok = await confirm({
        title: intl.formatMessage(messages.deleteTitle, { title: packTitle }),
        message: intl.formatMessage(messages.deleteBody),
        confirmLabel: intl.formatMessage(messages.delete),
        destructive: true,
      });
      if (!ok) return;
      try {
        await api().delete(`/api/v1/booth_sample_packs/${id}`);
        history.push('/hub/booth/samples');
      } catch {
        dispatch(showAlert({ message: messages.failed }));
      }
    })();
  }, [confirm, id, intl, packTitle, history, dispatch]);

  if (loading || !pack) {
    return (
      <Stage label={intl.formatMessage(messages.heading)}>
        <div className='stage-column'>
          {loading ? (
            <LoadingState label={intl.formatMessage(messages.loading)} />
          ) : (
            <EmptyState title={intl.formatMessage(messages.notFound)} />
          )}
        </div>
      </Stage>
    );
  }

  const samples = pack.samples ?? [];

  return (
    <Stage label={intl.formatMessage(messages.heading)}>
      <KornerDetail
        className='booth-sample-pack'
        hero={
          <div className='booth-set__cover'>
            {pack.cover_url ? (
              <img src={pack.cover_url} alt='' />
            ) : (
              <StacksIcon aria-hidden='true' />
            )}
          </div>
        }
        title={pack.title}
        subtitle={
          <Link to={`/@${pack.account.acct}`}>
            {intl.formatMessage(messages.by, {
              name: makerName(pack.account),
            })}
          </Link>
        }
        meta={
          <KornerMeta
            items={[
              intl.formatMessage(messages.count, { count: samples.length }),
              pack.sample_types
                .map((type) => intl.formatMessage(sampleTypeName(type)))
                .join(', '),
            ]}
          />
        }
        actions={
          pack.is_owner ? (
            <KornerActionBar>
              <KornerPill
                icon={AddIcon}
                iconId='add'
                label={intl.formatMessage(messages.add)}
                onClick={handleAdd}
              />
              <KornerPill
                variant='destructive'
                icon={DeleteIcon}
                iconId='delete'
                label={intl.formatMessage(messages.delete)}
                onClick={handleDelete}
              />
            </KornerActionBar>
          ) : undefined
        }
      >
        {pack.description && (
          <p className='booth-set__description'>
            <LinkifiedText text={pack.description} />
          </p>
        )}
        <SpaceGrid className='booth-samples__grid'>
          {samples.map((sample) => (
            <SampleCard key={sample.id} sample={sample} showMaker={false} />
          ))}
        </SpaceGrid>
      </KornerDetail>

      {confirmDialog}

      <Helmet>
        <title>{`${pack.title} — ${intl.formatMessage(messages.heading)}`}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export
export default BoothSamplePackPage;
