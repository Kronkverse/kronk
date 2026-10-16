import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IntlShape } from 'react-intl';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import AddIcon from '@/material-icons/400-24px/add.svg?react';
import { apiListProfileKuestions } from 'mastodon/api/kuestions';
import type { ApiProfileKuestionJSON } from 'mastodon/api_types/kuestions';
import { KornerActionBar } from 'mastodon/components/korner_action_bar';
import { KornerPill } from 'mastodon/components/korner_pill';

import { KuestionComposer } from './kuestion_composer';
import { ProfileAnswerSheet } from './profile_answer_sheet';

const messages = defineMessages({
  loading: { id: 'kuestions.loading', defaultMessage: 'Loading…' },
  fromMembers: {
    id: 'kuestions.profile.from_members',
    defaultMessage: 'From members',
  },
  notShown: {
    id: 'kuestions.profile.not_shown',
    defaultMessage: 'Not on your profile',
  },
  yourAnswer: {
    id: 'kuestions.answered.your_answer',
    defaultMessage: 'Your answer',
  },
  askedBy: {
    id: 'kuestions.profile.asked_by',
    defaultMessage: 'Asked by @{acct}',
  },
  ask: {
    id: 'kuestions.profile.ask',
    defaultMessage: 'Ask a profile kuestion',
  },
  expand: {
    id: 'kuestions.profile.expand',
    defaultMessage: 'Answer kuestions ({count})',
  },
  collapse: {
    id: 'kuestions.profile.collapse',
    defaultMessage: 'Hide kuestions',
  },
});

interface Props {
  // Bumped by the parent when a profile Kuestion is posted from the
  // composer overlay, so it shows up without a reload.
  refreshKey?: number;
  // After any answer is saved, changed or removed. The profile's edit
  // space, which embeds this grid, refreshes what the profile shows.
  onChange?: () => void;
  // On the profile, while designing it: folded until asked for, with a way
  // to ask a new one (Tal 2026-10-15: every Kuestion at once was too much).
  // The Kuestions korner's own Profile view shows them all and asks from
  // its composer.
  folded?: boolean;
}

interface Group {
  name: string;
  kuestions: ApiProfileKuestionJSON[];
}

// A list answer is typed with commas or new lines; show it as one line.
// A date is stored YYYY-MM-DD; show it the reader's way, read as a
// calendar day rather than a moment (no timezone shift).
const displayAnswer = (
  intl: IntlShape,
  k: ApiProfileKuestionJSON,
  body: string,
) => {
  if (k.answer_format === 'list') {
    return body
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .join(' · ');
  }
  if (k.answer_format === 'date') {
    return intl.formatDate(`${body}T00:00:00Z`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return body;
};

// Profile = the Kuestions you answer for your profile instead of a deck.
// A grid, grouped: Kronk's own under their headings (they replace the
// old profile Fields), then ones members wrote. Tap a tile to answer;
// answering pins it to your profile. The same grid sits in the profile's
// edit space, where it replaced the old field picker.
export const ProfilePanel: React.FC<Props> = ({
  refreshKey = 0,
  onChange,
  folded = false,
}) => {
  const intl = useIntl();
  const [list, setList] = useState<ApiProfileKuestionJSON[] | null>(null);
  const [editing, setEditing] = useState<ApiProfileKuestionJSON | null>(null);
  const [open, setOpen] = useState(!folded);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    void (async () => {
      setList(null);
      try {
        setList(await apiListProfileKuestions());
      } catch {
        setList([]);
      }
    })();
  }, [refreshKey, asked]);

  const handleToggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  const handleAsk = useCallback(() => {
    setAsking(true);
  }, []);
  const handleAskCancel = useCallback(() => {
    setAsking(false);
  }, []);
  // A new one is open to everyone on Kronk to answer; it shows here at
  // once, ready for your own answer.
  const handleAsked = useCallback(() => {
    setAsking(false);
    setOpen(true);
    setAsked((n) => n + 1);
  }, []);

  const groups = useMemo<Group[]>(() => {
    if (!list) return [];
    const byName = new Map<string, ApiProfileKuestionJSON[]>();
    const members = intl.formatMessage(messages.fromMembers);
    list.forEach((k) => {
      const name = k.group ?? members;
      byName.set(name, [...(byName.get(name) ?? []), k]);
    });
    return Array.from(byName, ([name, kuestions]) => ({ name, kuestions }));
  }, [list, intl]);

  const handleOpen = useCallback((k: ApiProfileKuestionJSON) => {
    setEditing(k);
  }, []);

  const handleCancel = useCallback(() => {
    setEditing(null);
  }, []);

  const handleSaved = useCallback(
    (updated: ApiProfileKuestionJSON) => {
      setEditing(null);
      setList(
        (prev) => prev?.map((k) => (k.id === updated.id ? updated : k)) ?? null,
      );
      onChange?.();
    },
    [onChange],
  );

  if (list === null) {
    return (
      <section className='kuestions-panel'>
        <p className='space-subtitle'>{intl.formatMessage(messages.loading)}</p>
      </section>
    );
  }

  return (
    <section className='kuestions-panel'>
      <p className='kuestions-profile__intro'>
        <FormattedMessage
          id='kuestions.profile.intro'
          defaultMessage='Answer one and it goes on your profile. Each answer has its own reach.'
        />
      </p>

      {folded && (
        <KornerActionBar>
          <KornerPill
            label={intl.formatMessage(
              open ? messages.collapse : messages.expand,
              { count: list.length },
            )}
            onClick={handleToggle}
          />
          <KornerPill
            label={intl.formatMessage(messages.ask)}
            icon={AddIcon}
            iconId='add'
            onClick={handleAsk}
          />
        </KornerActionBar>
      )}

      {open &&
        groups.map((group) => (
          <section key={group.name} className='kuestions-profile__group'>
            {groups.length > 1 && (
              <h3 className='kuestions-profile__heading'>{group.name}</h3>
            )}
            <ul className='kuestions-profile__grid'>
              {group.kuestions.map((k) => (
                <ProfileTile key={k.id} kuestion={k} onOpen={handleOpen} />
              ))}
            </ul>
          </section>
        ))}

      {asking && (
        <KuestionComposer
          initialKind='profile'
          onCancel={handleAskCancel}
          onCreated={handleAsked}
        />
      )}

      {editing && (
        <ProfileAnswerSheet
          kuestion={editing}
          onCancel={handleCancel}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
};

interface TileProps {
  kuestion: ApiProfileKuestionJSON;
  onOpen: (k: ApiProfileKuestionJSON) => void;
}

const ProfileTile: React.FC<TileProps> = ({ kuestion, onOpen }) => {
  const intl = useIntl();
  const mine = kuestion.my_answer;
  const handleClick = useCallback(() => {
    onOpen(kuestion);
  }, [kuestion, onOpen]);

  const state = !mine ? 'open' : mine.pinned ? 'pinned' : 'hidden';

  return (
    <li className='kuestions-profile__cell'>
      <button
        type='button'
        className={`kuestions-profile__tile kuestions-profile__tile--${state}`}
        onClick={handleClick}
      >
        {kuestion.label && (
          <span className='kuestions-profile__label'>{kuestion.label}</span>
        )}
        {mine ? (
          <>
            <span className='kuestions-profile__answer'>
              <span className='sr-only'>
                {kuestion.title} {intl.formatMessage(messages.yourAnswer)}:{' '}
              </span>
              {displayAnswer(intl, kuestion, mine.body)}
            </span>
            {!mine.pinned && (
              <span className='kuestions-profile__meta'>
                {intl.formatMessage(messages.notShown)}
              </span>
            )}
          </>
        ) : (
          <span className='kuestions-profile__q'>{kuestion.title}</span>
        )}
        {kuestion.asker && (
          <span className='kuestions-profile__meta'>
            {intl.formatMessage(messages.askedBy, {
              acct: kuestion.asker.acct,
            })}
          </span>
        )}
      </button>
    </li>
  );
};
