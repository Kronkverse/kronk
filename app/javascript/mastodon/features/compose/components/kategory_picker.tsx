import { useEffect, useState, useCallback, useMemo } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import { apiRequestGet } from 'mastodon/api';
import { changeCompose } from 'mastodon/actions/compose';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

// Curated Kategories (tags with `curated: true`) — surfaces framework
// recommended tags for the current post. Clicking a chip appends
// `#tagname` to the composer text if not already present. Small +
// unobtrusive: rendered only when at least one kategory exists.

const messages = defineMessages({
  add: { id: 'compose.kategory.add', defaultMessage: '+ Kategorize' },
  hide: { id: 'compose.kategory.hide', defaultMessage: 'Hide kategories' },
});

interface KategoryJSON {
  name: string;
}

export const KategoryPicker = () => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const text = useAppSelector((state) => (state.compose.get('text') ?? '') as string);

  const [expanded, setExpanded] = useState(false);
  const [kategories, setKategories] = useState<KategoryJSON[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiRequestGet<KategoryJSON[]>('v1/kategories');
        if (!cancelled) setKategories(data);
      } catch {
        // Kategories are optional — silent failure keeps composer usable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const alreadyTaggedRe = useMemo(() => text.toLowerCase(), [text]);

  const toggle = useCallback(
    (tag: string) => {
      const hashtag = `#${tag}`;
      const lower = hashtag.toLowerCase();
      if (alreadyTaggedRe.includes(lower)) return;
      const next = text.length === 0 || text.endsWith(' ') || text.endsWith('\n')
        ? `${text}${hashtag} `
        : `${text} ${hashtag} `;
      dispatch(changeCompose(next));
    },
    [dispatch, text, alreadyTaggedRe],
  );

  if (kategories.length === 0) return null;

  return (
    <div className='compose-form__kategory-picker'>
      <button
        type='button'
        onClick={() => setExpanded((v) => !v)}
        className='compose-form__kategory-toggle'
        aria-expanded={expanded}
      >
        {intl.formatMessage(expanded ? messages.hide : messages.add)}
      </button>

      {expanded && (
        <div className='compose-form__kategory-chips'>
          {kategories.slice(0, 12).map((k) => {
            const tagged = alreadyTaggedRe.includes(`#${k.name.toLowerCase()}`);
            return (
              <button
                key={k.name}
                type='button'
                onClick={() => toggle(k.name)}
                className={`compose-form__kategory-chip ${tagged ? 'compose-form__kategory-chip--active' : ''}`}
                aria-pressed={tagged}
              >
                {tagged ? '✓ ' : '#'}
                {k.name}
              </button>
            );
          })}
          {kategories.length > 12 && (
            <p className='compose-form__kategory-more'>
              <FormattedMessage
                id='compose.kategory.more'
                defaultMessage='+ {n} more (type # for the full list)'
                values={{ n: kategories.length - 12 }}
              />
            </p>
          )}
        </div>
      )}
    </div>
  );
};
