import { useCallback } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Link, useHistory } from 'react-router-dom';

import ChevronLeftIcon from '@/material-icons/400-24px/chevron_left.svg?react';
import ChevronRightIcon from '@/material-icons/400-24px/chevron_right.svg?react';
import ListIcon from '@/material-icons/400-24px/list.svg?react';
import type { ApiChronicleJSON } from 'mastodon/api_types/kronikles';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

// A chapter's place in its Series (docs/spaces/kronikles.md, Series). The
// head line names the Series and "Chapter N of M"; the foot steps to the
// previous and next chapters and back to the contents. Numbers and
// neighbours come from the server, counted over the chapters you can see.

const messages = defineMessages({
  chapterOf: {
    id: 'kronikles.series.chapter_of',
    defaultMessage: 'Chapter {number} of {count}',
  },
  previous: {
    id: 'kronikles.series.previous',
    defaultMessage: 'Previous chapter',
  },
  next: { id: 'kronikles.series.next', defaultMessage: 'Next chapter' },
  contents: { id: 'kronikles.series.contents', defaultMessage: 'Contents' },
  navLabel: {
    id: 'kronikles.series.nav_label',
    defaultMessage: 'Chapters of {title}',
  },
});

interface Props {
  chronicle: ApiChronicleJSON;
  placement: 'head' | 'foot';
}

export const ChapterNav: React.FC<Props> = ({ chronicle, placement }) => {
  const intl = useIntl();
  const history = useHistory();
  const series = chronicle.series;
  const chapter = chronicle.chapter;
  const previousId = chapter?.previous_id;
  const nextId = chapter?.next_id;

  const goPrevious = useCallback(() => {
    if (previousId) history.push(`/hub/kronikles/${previousId}`);
  }, [history, previousId]);
  const goNext = useCallback(() => {
    if (nextId) history.push(`/hub/kronikles/${nextId}`);
  }, [history, nextId]);
  const goContents = useCallback(() => {
    if (series) history.push(`/hub/kronikles/series/${series.id}`);
  }, [history, series]);

  if (!series || !chapter) return null;

  const chapterOf = intl.formatMessage(messages.chapterOf, {
    number: chapter.number,
    count: chapter.count,
  });

  if (placement === 'head') {
    return (
      <div className='kronikles-chapter-nav kronikles-chapter-nav--head'>
        <Link to={`/hub/kronikles/series/${series.id}`}>{series.title}</Link>
        <span aria-hidden>·</span>
        <span>{chapterOf}</span>
      </div>
    );
  }

  return (
    <nav
      className='kronikles-chapter-nav kronikles-chapter-nav--foot'
      aria-label={intl.formatMessage(messages.navLabel, {
        title: series.title,
      })}
    >
      <KornerActionBar align='between'>
        <KornerPill
          label={intl.formatMessage(messages.previous)}
          icon={ChevronLeftIcon}
          iconId='chevron_left'
          disabled={!previousId}
          onClick={goPrevious}
        />
        <KornerPill
          label={intl.formatMessage(messages.contents)}
          icon={ListIcon}
          iconId='list'
          onClick={goContents}
        />
        <KornerPill
          label={intl.formatMessage(messages.next)}
          icon={ChevronRightIcon}
          iconId='chevron_right'
          disabled={!nextId}
          onClick={goNext}
          variant={nextId ? 'primary' : 'default'}
        />
      </KornerActionBar>
    </nav>
  );
};
