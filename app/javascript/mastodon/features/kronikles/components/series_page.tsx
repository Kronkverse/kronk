import { useCallback, useEffect, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useParams } from 'react-router-dom';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import ArrowDownwardIcon from '@/material-icons/400-24px/arrow_downward.svg?react';
import ArrowUpwardIcon from '@/material-icons/400-24px/arrow_upward.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import EditIcon from '@/material-icons/400-24px/edit.svg?react';
import {
  apiGetSeries,
  apiListSeriesChapters,
  apiRemoveSeriesChapter,
  apiReorderSeries,
} from 'mastodon/api/kronikles';
import type {
  ApiChronicleSeriesJSON,
  ChronicleSummaryJSON,
} from 'mastodon/api_types/kronikles';
import { EmptyState } from 'mastodon/components/empty_state';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerDetail } from 'mastodon/components/korner_detail';
import { KornerMeta } from 'mastodon/components/korner_meta';
import { KornerPill } from 'mastodon/components/korner_pill';
import { LoadingState } from 'mastodon/components/loading_state';
import { useRegisterPageAction } from 'mastodon/features/ui/components/page_action_context';

import { AddChapterComposer, SeriesComposer } from './series_composers';

// A Series' own page (docs/spaces/kronikles.md, Series): its cover, title,
// description and contents, the chapters you can see in reading order. Its
// writer gets Edit Series in the Ж menu, Add a chapter, and a way to move
// or take out each chapter. A Series you can see no chapter of isn't here
// for you (the server says 404).

const messages = defineMessages({
  missing: {
    id: 'kronikles.series.missing',
    defaultMessage: 'This Series isn’t here, or none of it is shared with you.',
  },
  chapters: {
    id: 'kronikles.series.chapter_count',
    defaultMessage: '{count, plural, one {# chapter} other {# chapters}}',
  },
  contents: { id: 'kronikles.series.contents', defaultMessage: 'Contents' },
  empty: {
    id: 'kronikles.series.empty',
    defaultMessage: 'No chapters yet.',
  },
  emptyBody: {
    id: 'kronikles.series.empty_body',
    defaultMessage:
      'Add one of your Kronikles, or choose this Series when you write one. Nobody else sees the Series until it has a chapter they can read.',
  },
  edit: {
    id: 'kronikles.page_action.edit_series',
    defaultMessage: 'Edit Series',
  },
  addChapter: {
    id: 'kronikles.series.add_chapter',
    defaultMessage: 'Add a chapter',
  },
  moveUp: { id: 'kronikles.series.move_up', defaultMessage: 'Move up' },
  moveDown: { id: 'kronikles.series.move_down', defaultMessage: 'Move down' },
  takeOut: { id: 'kronikles.series.take_out', defaultMessage: 'Take out' },
  failed: {
    id: 'kronikles.series.change_failed',
    defaultMessage: 'That didn’t save. Try again.',
  },
});

interface Loaded {
  series: ApiChronicleSeriesJSON;
  chapters: ChronicleSummaryJSON[];
}

export const SeriesRoute: React.FC = () => {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded | 'missing' | null>(null);

  useEffect(() => {
    const guard = { stale: false };
    setLoaded(null);
    void (async () => {
      try {
        const [series, chapters] = await Promise.all([
          apiGetSeries(id),
          apiListSeriesChapters(id),
        ]);
        if (!guard.stale) setLoaded({ series, chapters });
      } catch {
        if (!guard.stale) setLoaded('missing');
      }
    })();
    return () => {
      guard.stale = true;
    };
  }, [id]);

  if (loaded === null) return <LoadingState />;

  if (loaded === 'missing') {
    return (
      <div className='stage-column'>
        <EmptyState title={intl.formatMessage(messages.missing)} />
      </div>
    );
  }

  return (
    <SeriesPage
      key={loaded.series.id}
      initialSeries={loaded.series}
      initialChapters={loaded.chapters}
    />
  );
};

interface PageProps {
  initialSeries: ApiChronicleSeriesJSON;
  initialChapters: ChronicleSummaryJSON[];
}

const SeriesPage: React.FC<PageProps> = ({
  initialSeries,
  initialChapters,
}) => {
  const intl = useIntl();
  const [series, setSeries] = useState(initialSeries);
  const [chapters, setChapters] = useState(initialChapters);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = series.is_owner;

  const startEdit = useCallback(() => {
    setEditing(true);
  }, []);
  const stopEdit = useCallback(() => {
    setEditing(false);
  }, []);
  const saved = useCallback((next: ApiChronicleSeriesJSON) => {
    setSeries(next);
    setEditing(false);
  }, []);
  useRegisterPageAction(
    {
      key: 'edit-series',
      label: intl.formatMessage(messages.edit),
      icon: EditIcon,
      iconId: 'edit',
    },
    startEdit,
    isOwner && !editing,
  );

  const startAdd = useCallback(() => {
    setAdding(true);
  }, []);
  const stopAdd = useCallback(() => {
    setAdding(false);
  }, []);

  // The owner sees every chapter, so their list is the whole Series.
  const takeList = useCallback((next: ChronicleSummaryJSON[]) => {
    setChapters(next);
    setSeries((s) => ({ ...s, chapter_count: next.length }));
  }, []);

  const added = useCallback(
    (next: ChronicleSummaryJSON[]) => {
      takeList(next);
      setAdding(false);
    },
    [takeList],
  );

  const change = useCallback(
    (request: () => Promise<ChronicleSummaryJSON[]>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      void request()
        .then((next) => {
          takeList(next);
          return undefined;
        })
        .catch(() => {
          setError(intl.formatMessage(messages.failed));
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [busy, intl, takeList],
  );

  const handleMove = useCallback(
    (from: number, step: -1 | 1) => {
      const to = from + step;
      if (to < 0 || to >= chapters.length) return;
      const ids = chapters.map((c) => c.id);
      const [moved] = ids.splice(from, 1);
      if (moved === undefined) return;
      ids.splice(to, 0, moved);
      change(() => apiReorderSeries(series.id, ids));
    },
    [change, chapters, series.id],
  );

  const handleTakeOut = useCallback(
    (chronicleId: string) => {
      change(() => apiRemoveSeriesChapter(series.id, chronicleId));
    },
    [change, series.id],
  );

  return (
    <KornerDetail
      className='kronikles-series'
      hero={
        series.cover_url ? (
          <img
            className='kronikles-series__cover'
            src={series.cover_url}
            alt=''
          />
        ) : undefined
      }
      title={series.title}
      subtitle={series.description || undefined}
      meta={
        <KornerMeta
          items={[
            `@${series.owner.acct}`,
            intl.formatMessage(messages.chapters, {
              count: series.chapter_count,
            }),
          ]}
        />
      }
      actions={
        isOwner ? (
          <KornerActionBar>
            <KornerPill
              label={intl.formatMessage(messages.addChapter)}
              icon={AddIcon}
              iconId='add'
              onClick={startAdd}
            />
          </KornerActionBar>
        ) : undefined
      }
    >
      <h3 className='korner-section-heading'>
        {intl.formatMessage(messages.contents)}
      </h3>

      {chapters.length === 0 ? (
        <EmptyState
          title={intl.formatMessage(messages.empty)}
          body={isOwner ? intl.formatMessage(messages.emptyBody) : undefined}
        />
      ) : (
        <ol className='kronikles-series__contents'>
          {chapters.map((c, index) => (
            <ChapterRow
              key={c.id}
              chapter={c}
              index={index}
              last={index === chapters.length - 1}
              canArrange={isOwner}
              busy={busy}
              onMove={handleMove}
              onTakeOut={handleTakeOut}
            />
          ))}
        </ol>
      )}

      {error && <p className='kronikles-series__error'>{error}</p>}

      {editing && (
        <SeriesComposer series={series} onCancel={stopEdit} onSaved={saved} />
      )}
      {adding && (
        <AddChapterComposer
          seriesId={series.id}
          onCancel={stopAdd}
          onAdded={added}
        />
      )}
    </KornerDetail>
  );
};

interface RowProps {
  chapter: ChronicleSummaryJSON;
  index: number;
  last: boolean;
  canArrange: boolean;
  busy: boolean;
  onMove: (index: number, step: -1 | 1) => void;
  onTakeOut: (chronicleId: string) => void;
}

// One line of the contents: its number, title and opening words. Its
// writer can move it up or down, or take it out of the Series (the
// Kronikle stays).
const ChapterRow: React.FC<RowProps> = ({
  chapter,
  index,
  last,
  canArrange,
  busy,
  onMove,
  onTakeOut,
}) => {
  const intl = useIntl();
  const moveUp = useCallback(() => {
    onMove(index, -1);
  }, [index, onMove]);
  const moveDown = useCallback(() => {
    onMove(index, 1);
  }, [index, onMove]);
  const takeOut = useCallback(() => {
    onTakeOut(chapter.id);
  }, [chapter.id, onTakeOut]);

  return (
    <li className='kronikles-series__chapter'>
      <span className='kronikles-series__number' aria-hidden>
        {index + 1}
      </span>
      <Link
        to={`/hub/kronikles/${chapter.id}`}
        className='kronikles-series__link'
      >
        <span className='kronikles-series__title'>{chapter.title}</span>
        <span className='kronikles-series__excerpt'>{chapter.excerpt}</span>
      </Link>
      {canArrange && (
        <KornerActionBar className='kronikles-series__controls'>
          <KornerPill
            label={intl.formatMessage(messages.moveUp)}
            icon={ArrowUpwardIcon}
            iconId='arrow_upward'
            disabled={busy || index === 0}
            onClick={moveUp}
          />
          <KornerPill
            label={intl.formatMessage(messages.moveDown)}
            icon={ArrowDownwardIcon}
            iconId='arrow_downward'
            disabled={busy || last}
            onClick={moveDown}
          />
          <KornerPill
            label={intl.formatMessage(messages.takeOut)}
            icon={CloseIcon}
            iconId='close'
            disabled={busy}
            onClick={takeOut}
          />
        </KornerActionBar>
      )}
    </li>
  );
};
