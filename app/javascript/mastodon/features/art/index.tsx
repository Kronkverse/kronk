import { useCallback, useRef, useState } from 'react';

import { defineMessages, useIntl } from 'react-intl';

import { Helmet } from 'react-helmet';

import AppsIcon from '@/material-icons/400-24px/apps.svg?react';
import ArticleIcon from '@/material-icons/400-24px/article-fill.svg?react';
import BarChartIcon from '@/material-icons/400-24px/bar_chart_4_bars.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import type { DialBubble, DialSlice } from 'mastodon/components/kronk_dial';
import { KronkDial } from 'mastodon/components/kronk_dial';
import { Stage } from 'mastodon/components/stage';

// Art korner landing — scaffold. Renders the concentric dial
// (kronk_dial) with placeholder slices so Tal can iterate on the
// picker shape before we decide whether Art is one korner with many
// disciplines or an umbrella that reuses the dial across per-
// discipline korners (2026-08-14 screencast).
//
// No content plumbing yet — drags rotate the wheel and update the
// "shown" callout below, but there's no piece grid underneath. That
// lands with the composer + a real content backend.

const messages = defineMessages({
  title: { id: 'art.title', defaultMessage: 'Art' },
  outerAria: {
    id: 'art.dial.outer_aria',
    defaultMessage: 'Choose a medium',
  },
  innerAria: {
    id: 'art.dial.inner_aria',
    defaultMessage: 'Choose a view',
  },
  centerAction: {
    id: 'art.dial.center_action',
    defaultMessage: 'Scroll to the content below',
  },
  toBrowse: { id: 'art.to_browse', defaultMessage: '{count} to browse' },
});

// Placeholder slices — mirror the "Writing · The Library" set Tal's
// screencast showed. Real slices will come from a manifest / API
// once the shape is settled.
const SAMPLE_OUTER: DialSlice[] = [
  { key: 'journals', label: 'Journals', count: 26 },
  { key: 'chapters', label: 'Chapters', count: 121 },
  { key: 'poems', label: 'Poems', count: 55 },
  { key: 'essays', label: 'Essays', count: 94 },
  { key: 'volumes', label: 'Volumes', count: 11 },
  { key: 'authors', label: 'Authors', count: 24 },
  { key: 'letters', label: 'Letters', count: 19 },
];

// Placeholder lens bubbles — one per Kronk creative medium so the
// inner ring reads as "how you're looking at it" rather than "what
// the thing is". Uses icons the repo already ships (palette / brush
// aren't in the material set yet).
const SAMPLE_INNER: DialBubble[] = [
  { key: 'grid', label: 'Grid', Icon: AppsIcon },
  { key: 'waveform', label: 'Waveform', Icon: BarChartIcon },
  { key: 'article', label: 'Article', Icon: ArticleIcon },
  { key: 'gallery', label: 'Gallery', Icon: PhotoLibraryIcon },
  { key: 'camera', label: 'Camera', Icon: PhotoCameraIcon },
  { key: 'voice', label: 'Voice', Icon: MicIcon },
];

const ArtHub: React.FC = () => {
  const intl = useIntl();
  const [outerIndex, setOuterIndex] = useState(0);
  const [innerIndex, setInnerIndex] = useState(2); // 'article' — matches Writing default

  const outerSlice = SAMPLE_OUTER[outerIndex];
  const title = intl.formatMessage(messages.title);

  // The centre hub is wired to scroll the viewer down to the content
  // area below the dial (Tal 2026-08-15). Once a real piece list
  // lives here the ref moves to it; for now it lands on the callout,
  // which is the only thing below the dial in the current scaffold.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const handleCenterClick = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Stage label={title}>
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className='art-hub'>
        {/* Space title + tagline are provided by the Frame-level
            <AutoSpaceHeader> (fired by <Stage>) — reading them from
            config/korners/art.yaml. No manual <SpaceHeader> here or
            we'd double-render the header. Applies to every korner
            landing that lives at /hub/<slug>; core spaces (/me,
            /settings) are the ones that hand-roll SpaceHeader
            because Auto returns null for `core: true` manifests. */}

        <div className='art-hub__dial'>
          <KronkDial
            outer={SAMPLE_OUTER}
            outerIndex={outerIndex}
            onOuterChange={setOuterIndex}
            inner={SAMPLE_INNER}
            innerIndex={innerIndex}
            onInnerChange={setInnerIndex}
            onCenterClick={handleCenterClick}
            centerActionLabel={intl.formatMessage(messages.centerAction)}
            outerAriaLabel={intl.formatMessage(messages.outerAria)}
            innerAriaLabel={intl.formatMessage(messages.innerAria)}
          />
        </div>

        {/* Selection callout — the big-serif title + count Tal's
            screencast showed under the dial. Reads live from the
            currently-selected outer slice. */}
        {outerSlice && (
          <div className='art-hub__callout' ref={contentRef}>
            <p className='art-hub__callout-crumb'>
              WRITING <span aria-hidden>·</span> THE LIBRARY
            </p>
            <h2 className='art-hub__callout-title'>{outerSlice.label}</h2>
            {typeof outerSlice.count === 'number' && (
              <p className='art-hub__callout-count'>
                {intl.formatMessage(messages.toBrowse, {
                  count: outerSlice.count,
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </Stage>
  );
};

// eslint-disable-next-line import/no-default-export -- async-components loader unwraps `.default`
export default ArtHub;
